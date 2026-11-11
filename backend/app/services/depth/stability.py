# Check and smooth image points and 3D points separately.
# Use None for missing points. A depth value of -1 can still be valid.
# Image x/y use the image size, and image z uses the image width.
# World points estimate meters from the hips. Keep these separate from image points.
# Smoothing reduces shaking but does not prove the depth is accurate.

from dataclasses import dataclass
import math
from typing import Sequence

from app.Webcam_utilities.rep_counter import Landmark
from .filters import OneEuroFilter

LANDMARK_COUNT = 33


@dataclass(frozen=True)
class StabilityConfig:
    # Keep the settings together so we can tune them with recorded footage.

    min_visibility: float = 0.5
    warmup_frames: int = 3  # Wait for this many good frames before using a joint.
    reset_after_seconds: float = 0.5  # Reset tracking instead of keeping old depth.
    min_cutoff_hz: float = 1.5
    beta: float = 0.5
    derivative_cutoff_hz: float = 1.0
    image_max_speed: float = 2.0  # Image position change allowed per second.
    image_jump_slack: float = 0.02
    world_max_speed: float = 4.0  # Allowed meters per second, not a limit on human movement.
    world_jump_slack: float = 0.04

    def __post_init__(self) -> None:
        # Check the settings before using them in the filters.
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
    # Store the result for one frame. None means the joint cannot be checked.

    image: tuple[Landmark | None, ...]
    world: tuple[Landmark | None, ...]
    calibrated: bool = True
    calibration_progress: float = 1.0
    tracking_message: str = ""
    lighting: str = "good"

    def counter_landmarks(self) -> tuple[list[Landmark] | None, list[Landmark] | None]:
        # Only count a joint when both its image and 3D points are usable.
        # Missing depth should not fall back to 2D angles.
        # Use zeros as placeholders and visibility=0 so the counter skips them.
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
    # Keep one joint's previous point and separate filters for x, y and z.

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
        # Reject sudden jumps before smoothing and do not reuse old points.
        if point is None:
            self.consecutive = 0
            return None
        if self.previous is not None:
            elapsed = timestamp - self.accepted_at
            if math.dist(point[:3], self.previous[:3]) > slack + speed * elapsed:
                # Keep the last good point when this point is rejected.
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
    # Keep smoothing history for one camera session. The caller controls access.

    def __init__(self, config: StabilityConfig | None = None) -> None:
        self.config = config or StabilityConfig()
        self._image: dict[int, _JointFilter] = {}
        self._world: dict[int, _JointFilter] = {}
        self._timestamp: float | None = None

    def _validated(self, points: Sequence[Landmark | None] | None) -> list[Landmark | None]:
        # Reject missing points, invalid numbers and joints that are not visible enough.
        if points is None or len(points) != LANDMARK_COUNT:
            return [None] * LANDMARK_COUNT
        return [
            point if point is not None and all(math.isfinite(value) for value in point)
            and self.config.min_visibility <= point.visibility <= 1.0 else None
            for point in points
        ]

    def _space(
        self, points: list[Landmark | None], state: dict[int, _JointFilter],
        timestamp: float, speed: float, slack: float,
    ) -> tuple[Landmark | None, ...]:
        # Reset a joint's history if it has gone too long without a usable point.
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
        self, image: Sequence[Landmark | None] | None, world: Sequence[Landmark | None] | None,
        timestamp: float,
    ) -> StabilizedPose:
        # Process the next frame. Reject bad timestamps before changing the history.
        if not math.isfinite(timestamp) or (
            self._timestamp is not None and timestamp <= self._timestamp
        ):
            raise ValueError("Pose timestamps must be finite and strictly increasing.")
        self._timestamp = timestamp
        visible = self._validated(image)
        spatial = self._validated(world)
        # Ignore 3D points when their image points are not visible enough.
        spatial = [point if visible[i] is not None else None for i, point in enumerate(spatial)]
        return StabilizedPose(
            self._space(visible, self._image, timestamp,
                        self.config.image_max_speed, self.config.image_jump_slack),
            self._space(spatial, self._world, timestamp,
                        self.config.world_max_speed, self.config.world_jump_slack),
        )
