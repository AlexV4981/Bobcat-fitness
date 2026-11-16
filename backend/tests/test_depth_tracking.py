"""Verify camera ownership and resource cleanup without loading pose models."""

from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from app.Webcam_utilities.rep_counter import Landmark
from app.services.depth.tracking import PoseTrackingStore
from test_pose_calibration import t_pose


def detection(depth=0.0):
    """Create SDK-shaped output with known image and world coordinates."""
    points = SimpleNamespace(landmark=[Landmark(0.5, 0.5, depth)] * 33)
    return SimpleNamespace(pose_landmarks=points, pose_world_landmarks=points)


class PoseTrackingTests(unittest.TestCase):
    """One model and one warmup history must belong to exactly one camera."""

    def setUp(self):
        self.models = []

        def factory():
            model = Mock()
            model.process.return_value = detection()
            self.models.append(model)
            return model

        self.store = PoseTrackingStore(factory, max_cameras=2)
        self.frame = SimpleNamespace(shape=(720, 1280, 3))

    def test_creating_camera_store_does_not_start_pose_models(self):
        # Importing the API creates its store, but unrelated pages and routes
        # must not pay for pose inference until a camera frame is processed.
        self.assertEqual(self.models, [])
        self.store.reset("unused-camera")
        self.assertEqual(self.models, [])

    def test_cameras_have_independent_models_and_warmup(self):
        with patch("app.services.depth.tracking.time.monotonic", side_effect=[0, .1, .2, .3]):
            for _ in range(3):
                _, first = self.store.process("first", self.frame)
            _, second = self.store.process("second", self.frame)
        self.assertIsNotNone(first.world[0])
        self.assertIsNone(second.world[0])
        self.assertEqual(len(self.models), 2)
        self.assertEqual(self.models[0].process.call_count, 3)
        self.assertEqual(self.models[1].process.call_count, 1)

    def test_reset_closes_model_and_restarts_warmup(self):
        for _ in range(3):
            self.store.process("camera", self.frame)
        self.store.reset("camera")
        self.models[0].close.assert_called_once()
        _, stable = self.store.process("camera", self.frame)
        self.assertIsNone(stable.world[0])
        self.assertEqual(len(self.models), 2)
        self.store.reset("unknown")  # Cleanup is safe even without a session.

    def test_resetting_one_camera_preserves_the_other_camera_history(self):
        # Disconnecting a laptop camera must not interrupt an active phone
        # camera's tracking history, model, or completed warmup.
        with patch(
            "app.services.depth.tracking.time.monotonic",
            side_effect=[0, .1, .2, .3, .4, .5, .6],
        ):
            for _ in range(3):
                self.store.process("laptop", self.frame)
            for _ in range(3):
                self.store.process("phone", self.frame)
            self.store.reset("laptop")
            _, stable = self.store.process("phone", self.frame)
        self.assertIsNotNone(stable.world[0])
        self.assertEqual(len(self.models), 2)
        self.models[0].close.assert_called_once()
        self.models[1].close.assert_not_called()

    def test_lru_eviction_closes_only_the_oldest_camera(self):
        self.store.process("first", self.frame)
        self.store.process("second", self.frame)
        self.store.process("first", self.frame)  # Make first most recently used.
        self.store.process("third", self.frame)
        self.models[1].close.assert_called_once()
        self.models[0].close.assert_not_called()
        self.models[2].close.assert_not_called()

    def test_no_detection_does_not_reuse_previous_landmarks(self):
        self.store.process("camera", self.frame)
        self.models[0].process.return_value = SimpleNamespace(
            pose_landmarks=None, pose_world_landmarks=None,
        )
        _, stable = self.store.process("camera", self.frame)
        self.assertEqual(stable.counter_landmarks(), (None, None))

    def test_dark_frames_skip_inference_and_report_lighting(self):
        _, stable = self.store.process("dark", self.frame, lighting="too_dark")
        self.models[0].process.assert_not_called()
        self.assertEqual(stable.counter_landmarks(), (None, None))
        self.assertEqual(self.store.status("dark")["lighting"], "too_dark")
        self.assertFalse(stable.calibrated)

    def test_recalibration_preserves_other_cameras_and_existing_model(self):
        pose = t_pose()
        result = SimpleNamespace(
            pose_landmarks=SimpleNamespace(landmark=pose.image),
            pose_world_landmarks=SimpleNamespace(landmark=pose.world),
        )
        def factory():
            model = Mock()
            model.process.return_value = result
            self.models.append(model)
            return model

        self.store = PoseTrackingStore(factory, max_cameras=2)
        with patch("app.services.depth.tracking.time.monotonic", side_effect=[i / 10 for i in range(52)]):
            for camera in ("first", "second"):
                for _ in range(26):
                    self.store.process(camera, self.frame)
        self.assertTrue(self.store.status("first")["calibrated"])
        self.assertTrue(self.store.status("second")["calibrated"])
        self.store.recalibrate("first")
        self.assertFalse(self.store.status("first")["calibrated"])
        self.assertTrue(self.store.status("second")["calibrated"])
        self.models[0].close.assert_not_called()
        self.assertEqual(len(self.models), 2)


if __name__ == "__main__":
    unittest.main()
