"""Count exercise reps from MediaPipe pose landmarks.

Pure Python (no OpenCV / MediaPipe imports) so it can be unit-tested with
synthetic poses.

How it works
------------
Every supported exercise is tracked with ONE joint angle that swings between a
"start" position (large angle) and a "peak" position (small angle):

    Push-up  elbow angle   (shoulder-elbow-wrist)
    Pull-up  elbow angle   (shoulder-elbow-wrist), wrists must be above shoulders
    Squat    knee angle    (hip-knee-ankle)
    Sit-up   hip angle     (shoulder-hip-knee)

A rep is counted only when the angle goes start -> peak -> start, so half reps
that never reach the peak are ignored. Angles are measured in 3D from
MediaPipe's world landmarks when available, which keeps them mostly
independent of the camera angle.

State machine:  WAITING -> READY -> MOVING -> PEAK -> (rep counted) READY
"""

from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass
from enum import Enum
from typing import Callable, NamedTuple, Optional, Sequence


class Landmark(NamedTuple):
    x: float
    y: float
    z: float = 0.0
    visibility: float = 1.0


# MediaPipe Pose landmark indices
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANKLE, R_ANKLE = 27, 28

MIN_VISIBILITY = 0.5   # joints less visible than this are ignored
SMOOTHING = 0.5        # EMA weight of the newest angle (1.0 = no smoothing)
LEAVE_MARGIN = 10.0    # degrees below start_angle before a rep "begins"
LOST_TIMEOUT_S = 2.0   # no usable pose for this long -> forget the current rep
MAX_REP_SECONDS = 15.0  # a rep stuck in progress this long is abandoned


# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------

def joint_angle(a: Landmark, b: Landmark, c: Landmark, use_z: bool = True) -> Optional[float]:
    """Angle in degrees at ``b`` between segments b->a and b->c."""
    v1 = (a.x - b.x, a.y - b.y, (a.z - b.z) if use_z else 0.0)
    v2 = (c.x - b.x, c.y - b.y, (c.z - b.z) if use_z else 0.0)
    n1 = math.sqrt(sum(t * t for t in v1))
    n2 = math.sqrt(sum(t * t for t in v2))
    if n1 < 1e-6 or n2 < 1e-6:
        return None
    cosine = sum(p * q for p, q in zip(v1, v2)) / (n1 * n2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))


def _visible(image: Sequence[Landmark], index: int) -> bool:
    return image[index].visibility >= MIN_VISIBILITY


def _midpoint(image, pos, left: int, right: int) -> Optional[Landmark]:
    """Average position of whichever of the left/right landmarks are visible."""
    pts = [pos[i] for i in (left, right) if _visible(image, i)]
    if not pts:
        return None
    n = len(pts)
    return Landmark(sum(p.x for p in pts) / n, sum(p.y for p in pts) / n, sum(p.z for p in pts) / n)


# --------------------------------------------------------------------------
# Posture gates: "is the person actually in this exercise's position?"
# Each takes (image_landmarks, world_landmarks_or_None) and returns a bool.
# --------------------------------------------------------------------------

def wrists_above_shoulders(image, world) -> bool:
    """Pull-up gate: a hand is overhead (image y grows downward)."""
    for shoulder, wrist in ((L_SHOULDER, L_WRIST), (R_SHOULDER, R_WRIST)):
        if _visible(image, shoulder) and _visible(image, wrist) and image[wrist].y < image[shoulder].y:
            return True
    return False


def body_horizontal(image, world) -> bool:
    """Push-up gate: shoulders-to-feet line is closer to horizontal than vertical."""
    pos = world if world is not None else image
    use_z = world is not None
    shoulders = _midpoint(image, pos, L_SHOULDER, R_SHOULDER)
    lower = None
    for pair in ((L_ANKLE, R_ANKLE), (L_KNEE, R_KNEE), (L_HIP, R_HIP)):
        lower = _midpoint(image, pos, *pair)
        if lower is not None:
            break
    if shoulders is None or lower is None:
        return False
    dx, dy = lower.x - shoulders.x, lower.y - shoulders.y
    dz = (lower.z - shoulders.z) if use_z else 0.0
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-6:
        return False
    return abs(dy) / length < 0.6


# --------------------------------------------------------------------------
# Exercise definitions
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class ExerciseConfig:
    name: str  # matches the option values in CameraPage.jsx
    joints: tuple  # ((a, b, c) for the left side, (a, b, c) for the right side)
    start_angle: float  # at/above this = back in the start position
    peak_angle: float   # at/below this = full range reached
    min_rep_seconds: float = 0.6  # faster than this is tracking noise, not a rep
    posture_ok: Optional[Callable] = None


# Thresholds are deliberately forgiving (e.g. no need to fully lock out).
# Tune them here after testing with real footage.
EXERCISES = {
    "pushup": ExerciseConfig(
        name="Push-up",
        joints=((L_SHOULDER, L_ELBOW, L_WRIST), (R_SHOULDER, R_ELBOW, R_WRIST)),
        start_angle=150, peak_angle=95,
        posture_ok=body_horizontal,
    ),
    "pullup": ExerciseConfig(
        name="Pull-up",
        joints=((L_SHOULDER, L_ELBOW, L_WRIST), (R_SHOULDER, R_ELBOW, R_WRIST)),
        start_angle=150, peak_angle=85,
        min_rep_seconds=0.8,
        posture_ok=wrists_above_shoulders,
    ),
    "squat": ExerciseConfig(
        name="Squat",
        joints=((L_HIP, L_KNEE, L_ANKLE), (R_HIP, R_KNEE, R_ANKLE)),
        start_angle=155, peak_angle=105,
    ),
    "situp": ExerciseConfig(
        name="Sit-up",
        joints=((L_SHOULDER, L_HIP, L_KNEE), (R_SHOULDER, R_HIP, R_KNEE)),
        start_angle=115, peak_angle=85,
    ),
}


def normalize_exercise(name: str) -> str:
    """'Push-up', 'push_up', 'PushUp' -> 'pushup'."""
    return re.sub(r"[^a-z]", "", name.lower())


def get_config(name: str) -> ExerciseConfig:
    config = EXERCISES.get(normalize_exercise(name))
    if config is None:
        supported = ", ".join(c.name for c in EXERCISES.values())
        raise ValueError(f"Unknown exercise {name!r}. Supported: {supported}")
    return config


# --------------------------------------------------------------------------
# The counter
# --------------------------------------------------------------------------

class Phase(str, Enum):
    WAITING = "waiting"  # no pose yet, or not in the start position
    READY = "ready"      # in the start position
    MOVING = "moving"    # between start and peak
    PEAK = "peak"        # full range reached; finishing the rep counts it


class RepCounter:
    def __init__(self, exercise: str) -> None:
        self.count = 0
        self.set_exercise(exercise)

    def set_exercise(self, exercise: str) -> None:
        self.config = get_config(exercise)
        self.reset()

    def reset(self) -> None:
        """Zero the count and forget any rep in progress."""
        self.count = 0
        self._reset_motion()

    def adjust(self, delta: int) -> None:
        """Manual correction (the +/- buttons); never goes below zero."""
        self.count = max(0, self.count + delta)

    def _reset_motion(self) -> None:
        self.phase = Phase.WAITING
        self.tracking = False
        self.angle: Optional[float] = None
        self._smoothed: Optional[float] = None
        self._rep_started: Optional[float] = None
        self._last_seen: Optional[float] = None

    # -- per-frame input ----------------------------------------------------

    def update(
        self,
        image: Optional[Sequence[Landmark]],
        world: Optional[Sequence[Landmark]] = None,
        now: Optional[float] = None,
    ) -> bool:
        """Feed one frame of landmarks (``None`` = nobody detected).

        Returns True if this frame completed a rep.
        """
        now = time.monotonic() if now is None else now
        angle = self._measure(image, world) if image is not None else None
        if angle is None:
            self.tracking = False
            if self._last_seen is not None and now - self._last_seen > LOST_TIMEOUT_S:
                self._reset_motion()
            return False
        return self.update_angle(angle, now)

    def update_angle(self, angle: float, now: float) -> bool:
        """Advance the state machine with one measured angle (degrees)."""
        self.tracking = True
        self._last_seen = now
        self._smoothed = angle if self._smoothed is None else (
            SMOOTHING * angle + (1 - SMOOTHING) * self._smoothed
        )
        a = self.angle = self._smoothed
        cfg = self.config

        if (
            self.phase in (Phase.MOVING, Phase.PEAK)
            and self._rep_started is not None
            and now - self._rep_started > MAX_REP_SECONDS
        ):
            self.phase = Phase.WAITING

        if self.phase is Phase.WAITING:
            if a >= cfg.start_angle:
                self.phase = Phase.READY
        elif self.phase is Phase.READY:
            if a < cfg.start_angle - LEAVE_MARGIN:
                self.phase = Phase.MOVING
                self._rep_started = now
        elif self.phase is Phase.MOVING:
            # raw angle for the peak: smoothing lags and can hide a quick bottom
            if min(a, angle) <= cfg.peak_angle:
                self.phase = Phase.PEAK
            elif a >= cfg.start_angle:
                self.phase = Phase.READY  # came back without reaching full range
        elif self.phase is Phase.PEAK:
            if a >= cfg.start_angle:
                self.phase = Phase.READY
                if self._rep_started is not None and now - self._rep_started >= cfg.min_rep_seconds:
                    self.count += 1
                    return True
        return False

    # -- measurement --------------------------------------------------------

    def _measure(self, image, world) -> Optional[float]:
        cfg = self.config
        if cfg.posture_ok is not None and not cfg.posture_ok(image, world):
            return None

        pos = world if world is not None else image
        use_z = world is not None
        angles = []
        for a, b, c in cfg.joints:
            if all(_visible(image, i) for i in (a, b, c)):
                angle = joint_angle(pos[a], pos[b], pos[c], use_z)
                if angle is not None:
                    angles.append(angle)
        return sum(angles) / len(angles) if angles else None

    # -- output -------------------------------------------------------------

    def state(self) -> dict:
        return {
            "exercise": self.config.name,
            "reps": self.count,
            "phase": self.phase.value,
            "angle": None if self.angle is None else round(self.angle, 1),
            "tracking": self.tracking,
        }
