"""Validate and stabilize image and world landmarks independently.

Missing data uses None, never a numeric sentinel. A real z=-1 is permitted.
Image x/y are normalized by frame dimensions; image z is width-scaled.
World x/y/z are estimated meters relative to the hips. These spaces must not
be mixed, and smoothing does not make the estimates measured ground truth.
"""

from dataclasses import dataclass
import math
from typing import Sequence

from app.Webcam_utilities.rep_counter import Landmark
from .filters import OneEuroFilter

LANDMARK_COUNT = 33


@dataclass(frozen=True)
class StabilityConfig:
    """Provisional tuning, kept together so recorded footage can refine it."""

    min_visibility: float = 0.5
    warmup_frames: int = 3  # Consecutive plausible observations before use.
    reset_after_seconds: float = 0.5  # Reacquire instead of holding stale depth.
    min_cutoff_hz: float = 1.5
    beta: float = 0.5
    derivative_cutoff_hz: float = 1.0
    image_max_speed: float = 2.0  # Normalized coordinate distance per second.
    image_jump_slack: float = 0.02
    world_max_speed: float = 4.0  # Meters per second; not a biomechanical rule.
    world_jump_slack: float = 0.04

    def __post_init__(self) -> None:
        """Reject unusable tuning early instead of poisoning filter state."""
        if not math.isfinite(self.min_visibility) or not 0 <= self.min_visibility <= 1:
            raise ValueError("min_visibility must be between zero and one.")
        if type(self.warmup_frames) is not int or self.warmup_frames < 1:
            raise ValueError("warmup_frames must be a positive integer.")
        for name in (
            "reset_after_seconds", "min_cutoff_hz", "derivative_cutoff_hz",
            "image_max_speed", "world_max_speed",
        ):
            value = getattr(self, name)
            if not math.isfinite(value) or value <= 0:
                raise ValueError(f"{name} must be finite and positive.")
        for name in ("beta", "image_jump_slack", "world_jump_slack"):
            value = getattr(self, name)
            if not math.isfinite(value) or value < 0:
                raise ValueError(f"{name} must be finite and nonnegative.")


@dataclass(frozen=True)
class StabilizedPose:
    """Per-frame output; None slots explicitly mean unassessable joints."""

    image: tuple[Landmark | None, ...]
    world: tuple[Landmark | None, ...]
    calibrated: bool = True
    calibration_progress: float = 1.0
    tracking_message: str = ""
    lighting: str = "good"

    def counter_landmarks(self) -> tuple[list[Landmark] | None, list[Landmark] | None]:
        """Adapt validity to the existing counter's visibility-based contract.

        Both spaces must be valid for a joint. Do not silently fall back to
        front-view 2D angles when 3D depth is unavailable. Zero coordinates in
        invalid slots are placeholders only; visibility=0 excludes them.
        """
        image, world = [], []
        missing = Landmark(0.0, 0.0, 0.0, 0.0)
        for point, spatial in zip(self.image, self.world, strict=True):
            usable = point is not None and spatial is not None
            image.append(point if usable else missing)
            world.append(spatial if usable else missing)
        if not any(point.visibility > 0 for point in image):
            return None, None
        return image, world


class _JointFilter:
    """Own one joint's raw history and three independent coordinate filters."""

    def __init__(self, config: StabilityConfig) -> None:
        self.config = config
        self.filters = [
            OneEuroFilter(config.min_cutoff_hz, config.beta, config.derivative_cutoff_hz)
            for _ in range(3)
        ]
        self.previous: Landmark | None = None
        self.accepted_at: float | None = None
        self.consecutive = 0

    def update(
        self, point: Landmark | None, timestamp: float, speed: float, slack: float,
    ) -> Landmark | None:
        """Gate raw jumps before filtering; never return stale coordinates."""
        if point is None:
            self.consecutive = 0
            return None
        if self.previous is not None:
            elapsed = timestamp - self.accepted_at
            if math.dist(point[:3], self.previous[:3]) > slack + speed * elapsed:
                # Rejected observations cannot become the next reference.
                self.consecutive = 0
                return None
        coordinates = [
            filter_.update(value, timestamp)
            for filter_, value in zip(self.filters, point[:3], strict=True)
        ]
        self.previous, self.accepted_at = point, timestamp
        self.consecutive += 1
        if self.consecutive < self.config.warmup_frames:
            return None
        return Landmark(*coordinates, point.visibility)


class PoseStabilizer:
    """One session's bounded state; callers serialize access per camera."""

    def __init__(self, config: StabilityConfig | None = None) -> None:
        self.config = config or StabilityConfig()
        self._image: dict[int, _JointFilter] = {}
        self._world: dict[int, _JointFilter] = {}
        self._timestamp: float | None = None

    def _validated(self, points: Sequence[Landmark] | None) -> list[Landmark | None]:
        """Reject malformed frames, nonfinite coordinates, and invisible joints."""
        if points is None or len(points) != LANDMARK_COUNT:
            return [None] * LANDMARK_COUNT
        return [
            point if all(math.isfinite(value) for value in point)
            and self.config.min_visibility <= point.visibility <= 1.0 else None
            for point in points
        ]

    def _space(
        self, points: list[Landmark | None], state: dict[int, _JointFilter],
        timestamp: float, speed: float, slack: float,
    ) -> tuple[Landmark | None, ...]:
        """Expire individual joint histories after loss or repeated rejection."""
        output = []
        for index, point in enumerate(points):
            joint = state.get(index)
            if joint is None or (
                joint.accepted_at is not None
                and timestamp - joint.accepted_at > self.config.reset_after_seconds
            ):
                joint = state[index] = _JointFilter(self.config)
            output.append(joint.update(point, timestamp, speed, slack))
        return tuple(output)

    def update(
        self, image: Sequence[Landmark] | None, world: Sequence[Landmark] | None,
        timestamp: float,
    ) -> StabilizedPose:
        """Process one chronological frame; invalid time leaves state intact."""
        if not math.isfinite(timestamp) or (
            self._timestamp is not None and timestamp <= self._timestamp
        ):
            raise ValueError("Pose timestamps must be finite and strictly increasing.")
        self._timestamp = timestamp
        visible = self._validated(image)
        spatial = self._validated(world)
        # Image visibility gates world estimates too; hidden depth is not evidence.
        spatial = [point if visible[i] is not None else None for i, point in enumerate(spatial)]
        return StabilizedPose(
            self._space(visible, self._image, timestamp,
                        self.config.image_max_speed, self.config.image_jump_slack),
            self._space(spatial, self._world, timestamp,
                        self.config.world_max_speed, self.config.world_jump_slack),
        )
