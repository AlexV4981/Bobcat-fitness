import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routes.camera import router


class CameraCalibrationRoutesTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def test_status_reads_camera_without_starting_recording(self):
        status = {"calibrated": False, "progress": .5, "lighting": "good", "message": "Hold still"}
        with patch("app.routes.camera.pose_tracking.status", return_value=status) as read:
            response = self.client.get("/api/camera/laptop/calibration")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), status)
        read.assert_called_once_with("laptop")

    def test_recalibration_resets_only_requested_camera_partial_motion(self):
        with (
            patch("app.routes.camera.pose_tracking.recalibrate", return_value={"calibrated": False}) as reset,
            patch("app.routes.camera.reset_landmark_origins") as origins,
            patch("app.routes.camera.rep_sessions.pause") as pause,
            patch("app.routes.camera.movement_recorders") as recorder,
        ):
            response = self.client.post("/api/camera/phone/calibration")
        self.assertEqual(response.status_code, 200)
        reset.assert_called_once_with("phone")
        origins.assert_called_once_with("phone")
        pause.assert_called_once_with("phone")
        recorder.recorder.assert_called_once_with("phone")
        recorder.recorder.return_value.reset_samples.assert_called_once()
        recorder.save_rep.assert_not_called()

    def test_invalid_camera_id_is_rejected_before_reset(self):
        with patch("app.routes.camera.pose_tracking.recalibrate") as reset:
            response = self.client.post("/api/camera/invalid%20camera/calibration")
        self.assertEqual(response.status_code, 422)
        reset.assert_not_called()
