# Test the ONNX inputs and outputs without downloading models.
# These tests do not measure model accuracy.
import os
import unittest
from unittest.mock import Mock, patch
import numpy as np
from app.services.depth.onnx_inference import OpenCVPoseDepth, create_pose_model
from app.services.depth.tracking import PoseTrackingStore


class OnnxInferenceTests(unittest.TestCase):
    def setUp(self):
        self.pose, self.depth = Mock(), Mock()
        x, y = np.zeros((1, 17, 384), np.float32), np.zeros((1, 17, 512), np.float32)
        x[:, :, 192], y[:, :, 256] = .9, .8
        self.pose.forward.return_value = (y, x)
        self.depth.forward.return_value = np.full((1, 518, 518), 2.5, np.float32)
        with patch('app.services.depth.onnx_inference._load_net', side_effect=[self.pose, self.depth]):
            self.model = OpenCVPoseDepth('pose.onnx', 'depth.onnx')
        self.frame = np.zeros((240, 640, 3), np.uint8)

    def test_inverse_letterbox_mapping_confidence_and_meter_units(self):
        result = self.model.process(self.frame)
        point = result.pose_landmarks.landmark[11]
        self.assertAlmostEqual(point.x, .5)
        self.assertAlmostEqual(point.y, .5)
        self.assertAlmostEqual(point.visibility, .8)
        self.assertEqual(result.pose_landmarks.landmark[31].visibility, 0)
        self.assertEqual(result.depth_meters.shape, (240, 640))
        np.testing.assert_allclose(result.depth_meters, 2.5)
        self.assertIsNone(result.pose_world_landmarks)
        self.assertTrue(all(t >= 0 for t in result.inference_ms.values()))

    def test_padding_joints_are_invalid(self):
        y = self.pose.forward.return_value[0]
        y[:] = 0
        y[:, :, 0] = .9
        self.assertEqual(self.model.process(self.frame).pose_landmarks.landmark[11].visibility, 0)

    def test_rgb_normalization_preserves_channels(self):
        self.frame[:, :, 0] = 255
        self.model.process(self.frame)
        tensor = self.depth.setInput.call_args.args[0]
        self.assertEqual(tensor.shape, (1, 3, 518, 518))
        self.assertAlmostEqual(float(tensor[0, 0, 0, 0]), (1 - .485) / .229, places=5)
        self.assertAlmostEqual(float(tensor[0, 2, 0, 0]), -.406 / .225, places=5)

    def test_invalid_and_incompatible_output_is_rejected(self):
        for value in (0, -1, np.nan, np.inf):
            with self.subTest(value=value):
                self.depth.forward.return_value[0, 0, 0] = value
                result = self.model.process(self.frame)
                self.assertTrue(np.isnan(result.depth_meters[0, 0]))
                self.assertAlmostEqual(float(result.depth_meters[-1, -1]), 2.5)
        self.depth.forward.return_value = np.ones((1, 3, 518, 518))
        with self.assertRaisesRegex(ValueError, 'Metric depth export'):
            self.model.process(self.frame)
        self.pose.forward.return_value = (np.zeros((1, 133, 384)), np.zeros((1, 133, 512)))
        with self.assertRaisesRegex(ValueError, 'COCO-17'):
            self.model.process(self.frame)

    def test_tracker_accepts_adapter_and_pauses_counting_without_world_depth(self):
        store = PoseTrackingStore(lambda: self.model, calibration_provider=lambda camera: None)
        for _ in range(3):
            _, stable = store.process('phone', self.frame)
        self.assertIsNotNone(stable.image[11])
        self.assertEqual(stable.counter_landmarks(), (None, None))
        self.assertFalse(stable.calibrated)
        store.reset('phone')
        self.assertIsNone(self.model.depth_net)
        with self.assertRaises(RuntimeError):
            self.model.process(self.frame)

    def test_default_and_bad_configuration(self):
        factory = Mock()
        with patch.dict(os.environ, {}, clear=True):
            self.assertIs(create_pose_model(factory), factory.return_value)
        with patch.dict(os.environ, {'BOBCAT_POSE_BACKEND': 'opencv_onnx'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'requires'):
                create_pose_model(factory)
        with patch.dict(os.environ, {'BOBCAT_POSE_BACKEND': 'typo'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'must be'):
                create_pose_model(factory)


if __name__ == '__main__':
    unittest.main()
