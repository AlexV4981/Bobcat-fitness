# Keep each camera's model and smoothing history separate. Limit stored sessions.

from collections import OrderedDict
from dataclasses import dataclass, field, replace
from threading import Lock
from types import SimpleNamespace
import time
from typing import Callable

from app.Webcam_utilities.rep_counter import Landmark
from .stability import PoseStabilizer, StabilizedPose
from .calibration import MAX_SAMPLE_GAP, TPoseCalibration
from .reconstruction import CameraIntrinsics, load_camera_intrinsics, reconstruct_pose


@dataclass
class _Session:
    model: object
    stabilizer: PoseStabilizer = field(default_factory=PoseStabilizer)
    calibration: TPoseCalibration = field(default_factory=TPoseCalibration)
    latest: StabilizedPose | None = None
    intrinsics: CameraIntrinsics | None = None
    intrinsics_loaded: bool = False
    metric_status: str | None = None
    camera_joints: int = 0
    performance: dict = field(default_factory=dict)
    finished_at: float | None = None


def _landmarks(result) -> list[Landmark | None] | None:
    # Copy the model points so the calculations do not need MediaPipe objects.
    if result is None:
        return None
    return [None if p is None else Landmark(p.x, p.y, p.z, p.visibility) for p in result.landmark]


class PoseTrackingStore:
    # Run one camera at a time and remove the least recently used session when full.

    def __init__(self, model_factory: Callable, max_cameras: int = 4, *,
                 calibration_provider: Callable = load_camera_intrinsics) -> None:
        if max_cameras < 1:
            raise ValueError("max_cameras must be positive.")
        self._factory = model_factory
        self._calibration_provider = calibration_provider
        self._capacity = max_cameras
        self._sessions: OrderedDict[str, _Session] = OrderedDict()
        self._lock = Lock()

    def reset(self, camera_id: str) -> None:
        # Close the model and clear its history when the camera reconnects or disconnects.
        with self._lock:
            session = self._sessions.pop(camera_id, None)
            if session is not None:
                session.model.close()

    def status(self, camera_id: str) -> dict:
        with self._lock:
            session = self._sessions.get(camera_id)
            latest = session.latest if session else None
            status = {
                "calibrated": latest.calibrated if latest else False,
                "progress": latest.calibration_progress if latest else 0.0,
                "message": latest.tracking_message if latest else (
                    session.calibration.message if session else "Start the camera and stand in a full-body T-pose."
                ),
                "lighting": latest.lighting if latest else "unknown",
            }
            if session:
                backend = getattr(session.model, 'backend', None)
                runtime = getattr(session.model, 'runtime', None)
                status['backend'] = backend if isinstance(backend, str) else type(session.model).__name__
                status['runtime'] = runtime if isinstance(runtime, str) else None
                status['performance'] = dict(session.performance)
            if session and session.metric_status is not None:
                status["metric_tracking"] = {
                    "status": session.metric_status,
                    "camera_joints": session.camera_joints,
                    "world_joints": sum(p is not None for p in latest.world) if latest else 0,
                }
            return status

    def recalibrate(self, camera_id: str) -> dict:
        with self._lock:
            session = self._sessions.get(camera_id)
            if session:
                session.calibration = TPoseCalibration()
                session.stabilizer = PoseStabilizer()
                session.latest = None
                session.intrinsics = None
                session.intrinsics_loaded = False
                session.metric_status = None
                session.camera_joints = 0
                session.performance.clear()
                session.finished_at = None
        return self.status(camera_id)

    def process(self, camera_id: str, rgb_frame, *, lighting: str = "good") -> tuple[object, StabilizedPose]:
        # Run the model and smooth its points under one lock.
        # Use the time when the model finishes as the frame timestamp.
        with self._lock:
            if camera_id not in self._sessions:
                if len(self._sessions) >= self._capacity:
                    _, oldest = self._sessions.popitem(last=False)
                    oldest.model.close()
                self._sessions[camera_id] = _Session(self._factory())
            self._sessions.move_to_end(camera_id)
            session = self._sessions[camera_id]
            started = time.perf_counter()
            result = (session.model.process(rgb_frame) if lighting != "too_dark" else
                      SimpleNamespace(pose_landmarks=None, pose_world_landmarks=None))
            depth = getattr(result, "depth_meters", None)
            if depth is not None:
                if not session.intrinsics_loaded:
                    session.intrinsics = self._calibration_provider(camera_id)
                    session.intrinsics_loaded = True
                reconstruction = reconstruct_pose(_landmarks(result.pose_landmarks), depth, session.intrinsics)
                if reconstruction.status == "resolution_mismatch" and session.metric_status != "resolution_mismatch":
                    # Reset saved lengths and smoothing when the image size changes.
                    session.stabilizer = PoseStabilizer()
                    session.calibration = TPoseCalibration()
                session.metric_status = reconstruction.status
                session.camera_joints = sum(p is not None for p in reconstruction.camera)
                result.camera_landmarks = SimpleNamespace(landmark=reconstruction.camera)
                result.pose_world_landmarks = SimpleNamespace(landmark=reconstruction.world)
            elif lighting == "too_dark" and session.metric_status is not None:
                session.metric_status = "too_dark"
                session.camera_joints = 0
            timestamp = time.monotonic()
            stable = session.stabilizer.update(
                _landmarks(result.pose_landmarks),
                _landmarks(result.pose_world_landmarks), timestamp,
            )
            height, width = rgb_frame.shape[:2]
            stable = session.calibration.update(stable, width, height, timestamp, lighting)
            if depth is not None and session.metric_status in ("intrinsics_required", "resolution_mismatch"):
                message = ("Camera intrinsics required for metric 3D tracking." if session.metric_status == "intrinsics_required"
                           else "Camera resolution changed. Restore the calibrated resolution or recalibrate camera intrinsics.")
                stable = replace(stable, tracking_message=message)
            finished = time.perf_counter()
            session.performance = {
                'processing_ms': round((finished - started) * 1000, 1),
                'frame_interval_ms': (round((finished - session.finished_at) * 1000, 1)
                                      if session.finished_at is not None else None),
                'inference_ms': dict(getattr(result, 'inference_ms', {})),
                'calibration_rate_ok': (finished - started) <= MAX_SAMPLE_GAP and (
                    session.finished_at is None or finished - session.finished_at <= MAX_SAMPLE_GAP),
            }
            session.finished_at = finished
            session.latest = stable
            return result, stable
