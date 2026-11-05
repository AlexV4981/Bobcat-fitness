"""Bounded camera sessions keep inference history and filters isolated."""

from collections import OrderedDict
from dataclasses import dataclass, field
from threading import Lock
from types import SimpleNamespace
import time
from typing import Callable

from app.Webcam_utilities.rep_counter import Landmark
from .stability import PoseStabilizer, StabilizedPose
from .calibration import TPoseCalibration


@dataclass
class _Session:
    model: object
    stabilizer: PoseStabilizer = field(default_factory=PoseStabilizer)
    calibration: TPoseCalibration = field(default_factory=TPoseCalibration)
    latest: StabilizedPose | None = None


def _landmarks(result) -> list[Landmark] | None:
    """Copy SDK coordinates so the numerical layer has no MediaPipe dependency."""
    if result is None:
        return None
    return [Landmark(p.x, p.y, p.z, p.visibility) for p in result.landmark]


class PoseTrackingStore:
    """Serialize model access and evict least-recently-used camera resources."""

    def __init__(self, model_factory: Callable, max_cameras: int = 4) -> None:
        if max_cameras < 1:
            raise ValueError("max_cameras must be positive.")
        self._factory = model_factory
        self._capacity = max_cameras
        self._sessions: OrderedDict[str, _Session] = OrderedDict()
        self._lock = Lock()

    def reset(self, camera_id: str) -> None:
        """Release the model and filter history on reconnect or disconnect."""
        with self._lock:
            session = self._sessions.pop(camera_id, None)
            if session is not None:
                session.model.close()

    def status(self, camera_id: str) -> dict:
        with self._lock:
            session = self._sessions.get(camera_id)
            latest = session.latest if session else None
            return {
                "calibrated": latest.calibrated if latest else False,
                "progress": latest.calibration_progress if latest else 0.0,
                "message": latest.tracking_message if latest else (
                    session.calibration.message if session else "Start the camera and stand in a full-body T-pose."
                ),
                "lighting": latest.lighting if latest else "unknown",
            }

    def recalibrate(self, camera_id: str) -> dict:
        with self._lock:
            session = self._sessions.get(camera_id)
            if session:
                session.calibration = TPoseCalibration()
                session.stabilizer = PoseStabilizer()
                session.latest = None
        return self.status(camera_id)

    def process(self, camera_id: str, rgb_frame, *, lighting: str = "good") -> tuple[object, StabilizedPose]:
        """Infer and stabilize atomically, using completion time for each frame."""
        with self._lock:
            if camera_id not in self._sessions:
                if len(self._sessions) >= self._capacity:
                    _, oldest = self._sessions.popitem(last=False)
                    oldest.model.close()
                self._sessions[camera_id] = _Session(self._factory())
            self._sessions.move_to_end(camera_id)
            session = self._sessions[camera_id]
            result = (session.model.process(rgb_frame) if lighting != "too_dark" else
                      SimpleNamespace(pose_landmarks=None, pose_world_landmarks=None))
            timestamp = time.monotonic()
            stable = session.stabilizer.update(
                _landmarks(result.pose_landmarks),
                _landmarks(result.pose_world_landmarks), timestamp,
            )
            height, width = rgb_frame.shape[:2]
            stable = session.calibration.update(stable, width, height, timestamp, lighting)
            session.latest = stable
            return result, stable
