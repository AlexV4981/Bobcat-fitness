# Test the position calculations and checks with made-up data.
# These tests do not measure accuracy on a real camera.
from dataclasses import replace
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import numpy as np
from app.Webcam_utilities.rep_counter import Landmark, joint_angle
from app.services.depth.reconstruction import CameraIntrinsics, DepthSamplingConfig, load_camera_intrinsics, reconstruct_pose
from app.services.depth.tracking import PoseTrackingStore
from test_pose_calibration import t_pose


def points():
    result = [None] * 33
    for i, xy in {11: (.3, .25), 13: (.3, .5), 15: (.5, .5), 23: (.4, .6), 24: (.6, .6)}.items():
        result[i] = Landmark(*xy, visibility=.9)
    return result


class ReconstructionTests(unittest.TestCase):
    def setUp(self):
        self.intrinsics = CameraIntrinsics(640, 480, 500, 500, 320, 240)
        self.depth = np.full((480, 640), 2.0, np.float32)
        self.points = points()

    def reconstruct(self, **kwargs):
        return reconstruct_pose(kwargs.get('points', self.points), kwargs.get('depth', self.depth),
                                kwargs.get('intrinsics', self.intrinsics))

    def test_known_plane_hip_origin_scale_and_joint_angle(self):
        result = self.reconstruct()
        self.assertEqual(result.status, 'ready')
        np.testing.assert_allclose(result.camera[11][:3], (-.512, -.48, 2))
        np.testing.assert_allclose(result.world[23][:3], (-.256, 0, 0), atol=1e-15)
        np.testing.assert_allclose(result.world[24][:3], (.256, 0, 0), atol=1e-15)
        self.assertAlmostEqual(joint_angle(*(result.world[i] for i in (11, 13, 15))), 90)
        self.depth *= 2
        np.testing.assert_allclose(self.reconstruct().world[11][:3], np.asarray(result.world[11][:3]) * 2)

    def test_nonplanar_depth_and_negative_relative_z(self):
        self.depth[117:124, 189:196] = 1.5
        result = self.reconstruct()
        self.assertAlmostEqual(result.camera[11].z, 1.5)
        self.assertAlmostEqual(result.world[11].z, -.5)

    def test_mirror_is_undone_before_asymmetric_intrinsics(self):
        calibration = replace(self.intrinsics, cx=300)
        native = self.reconstruct(intrinsics=calibration)
        mirrored = [None if p is None else p._replace(x=(639 - p.x * 640) / 640) for p in self.points]
        result = self.reconstruct(points=mirrored, intrinsics=replace(calibration, mirrored=True))
        for i in (11, 13, 15, 23, 24):
            np.testing.assert_allclose(result.camera[i], native.camera[i], atol=1e-10)

    def test_radial_distortion_is_removed(self):
        calibration = replace(self.intrinsics, distortion=(.2, 0, 0, 0, 0))
        factor = 1 + .2 * (.2**2 + .1**2)  # Analytic projection of ray (.2,.1,1).
        self.points[11] = Landmark((500 * .2 * factor + 320) / 640, (500 * .1 * factor + 240) / 480)
        np.testing.assert_allclose(self.reconstruct(intrinsics=calibration).camera[11][:3], (.4, .2, 2), atol=1e-7)

    def test_missing_or_wrong_resolution_calibration_never_guesses(self):
        for calibration, status in ((None, 'intrinsics_required'),
                                    (replace(self.intrinsics, width=320, cx=160), 'resolution_mismatch')):
            result = self.reconstruct(intrinsics=calibration)
            self.assertEqual(result.status, status)
            self.assertTrue(all(p is None for p in result.world))
        self.assertEqual(self.reconstruct(points=[]).status, 'pose_missing')

    def test_missing_hip_invalidates_origin_without_reusing_it(self):
        self.assertEqual(self.reconstruct().status, 'ready')
        self.points[23] = None
        result = self.reconstruct()
        self.assertEqual(result.status, 'hips_required')
        self.assertIsNotNone(result.camera[11])
        self.assertTrue(all(p is None for p in result.world))
        self.points[23] = points()[23]
        self.assertEqual(self.reconstruct().status, 'ready')

    def test_confidence_bounds_and_nonfinite_joints_are_excluded(self):
        for point in (None, Landmark(.3, .25, visibility=.49), Landmark(1, .25),
                      Landmark(-.1, .25), Landmark(.3, float('nan')), Landmark(.3, .25, visibility=float('inf'))):
            self.points[11] = point
            result = self.reconstruct()
            self.assertIsNone(result.camera[11])
            self.assertIsNotNone(result.world[13])

    def test_isolated_corruption_is_tolerated_but_holes_and_depth_edges_are_rejected(self):
        for value in (np.nan, np.inf, 0, -1, 9):
            self.depth[120, 192] = value
            self.assertAlmostEqual(self.reconstruct().camera[11].z, 2)
        self.depth[118:123, 190:193] = np.nan
        self.assertIsNone(self.reconstruct().camera[11])
        self.depth[:] = 2
        self.depth[118:123, 192:195] = 4
        self.assertIsNone(self.reconstruct().camera[11])
        self.assertIsNotNone(self.reconstruct().world[13])

    def test_depth_range_and_border_sampling(self):
        for value in (.1, 11, np.nan):
            result = self.reconstruct(depth=np.full_like(self.depth, value))
            self.assertEqual(result.status, 'hips_required')
            self.assertTrue(all(p is None for p in result.camera))
        self.points[11] = Landmark(0, 0)
        np.testing.assert_allclose(self.reconstruct().camera[11][:3], (-1.28, -.96, 2))

    def test_intrinsics_and_sampling_configuration_validation(self):
        for kwargs in ({'fx': 0}, {'fy': float('nan')}, {'cx': 640}, {'width': True},
                       {'mirrored': 'true'}, {'distortion': (0, 0, 0)}, {'distortion': (0, 0, 0, np.inf)}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                replace(self.intrinsics, **kwargs)
        for kwargs in ({'radius': 11}, {'min_valid_fraction': 0}, {'min_depth_m': 11},
                       {'max_relative_spread': -1}, {'max_spread_m': np.nan}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                DepthSamplingConfig(**kwargs)

    def test_camera_specific_file_config_requires_explicit_mirroring(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'cameras.json'
            entry = dict(width=640, height=480, fx=500, fy=500, cx=320, cy=240, mirrored=True)
            path.write_text(json.dumps({'phone': entry}))
            with patch.dict(os.environ, {'BOBCAT_CAMERA_CALIBRATIONS': str(path)}):
                self.assertTrue(load_camera_intrinsics('phone').mirrored)
                self.assertIsNone(load_camera_intrinsics('laptop'))
                del entry['mirrored']
                path.write_text(json.dumps({'phone': entry}))
                with self.assertRaisesRegex(ValueError, 'explicitly declare mirrored'):
                    load_camera_intrinsics('phone')
                path.write_text('broken')
                with self.assertRaisesRegex(ValueError, 'Invalid camera calibration'):
                    load_camera_intrinsics('phone')
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(load_camera_intrinsics('phone'))


class MetricTrackingTests(unittest.TestCase):
    def setUp(self):
        self.models = []
        def factory():
            model = Mock()
            model.process.side_effect = lambda frame: SimpleNamespace(
                pose_landmarks=SimpleNamespace(landmark=t_pose().image), pose_world_landmarks=None,
                depth_meters=np.full(frame.shape[:2], 2, np.float32))
            self.models.append(model)
            return model
        self.intrinsics = CameraIntrinsics(720, 720, 720, 720, 360, 360)
        self.provider = Mock(return_value=self.intrinsics)
        self.store = PoseTrackingStore(factory, calibration_provider=self.provider)
        self.frame = np.zeros((720, 720, 3), np.uint8)

    def test_world_reaches_existing_filters_and_tpose_reference(self):
        with patch('app.services.depth.tracking.time.monotonic', side_effect=[i / 10 for i in range(26)]):
            for i in range(26):
                raw, stable = self.store.process('phone', self.frame)
                if i < 2:
                    self.assertIsNone(stable.world[11])
        self.assertTrue(stable.calibrated)
        self.assertIsNotNone(stable.world[11])
        self.assertAlmostEqual(raw.camera_landmarks.landmark[11].z, 2)
        self.assertAlmostEqual(stable.world[11].z, 0)
        self.provider.assert_called_once_with('phone')
        self.assertEqual(self.store.status('phone')['metric_tracking']['status'], 'ready')
        self.store.recalibrate('phone')
        self.store.process('phone', self.frame)
        self.assertEqual(self.provider.call_count, 2)

    def test_cameras_have_independent_intrinsics_and_status(self):
        self.provider.side_effect = lambda camera: self.intrinsics if camera == 'laptop' else None
        raw, _ = self.store.process('laptop', self.frame)
        other, stable = self.store.process('phone', self.frame)
        self.assertIsNotNone(raw.pose_world_landmarks.landmark[11])
        self.assertIsNone(other.pose_world_landmarks.landmark[11])
        self.assertFalse(stable.calibrated)
        self.assertIn('intrinsics required', stable.tracking_message)
        self.assertEqual(self.store.status('laptop')['metric_tracking']['status'], 'ready')
        self.assertEqual(self.store.status('phone')['metric_tracking']['status'], 'intrinsics_required')
        self.store.reset('phone')
        self.models[0].close.assert_not_called()
        self.models[1].close.assert_called_once()

    def test_two_calibrated_cameras_use_their_own_focal_lengths(self):
        self.provider.side_effect = lambda camera: replace(self.intrinsics, fx=720 if camera == 'laptop' else 1440)
        laptop, _ = self.store.process('laptop', self.frame)
        phone, _ = self.store.process('phone', self.frame)
        self.assertAlmostEqual(laptop.camera_landmarks.landmark[11].x,
                               phone.camera_landmarks.landmark[11].x * 2)
        self.assertEqual(self.provider.call_count, 2)

    def test_depth_loss_clears_world_validity_and_requires_fresh_warmup(self):
        with patch('app.services.depth.tracking.time.monotonic', side_effect=[i / 10 for i in range(7)]):
            for _ in range(3):
                _, stable = self.store.process('phone', self.frame)
            self.assertIsNotNone(stable.world[11])
            infer = self.models[0].process.side_effect
            self.models[0].process.side_effect = lambda frame: SimpleNamespace(
                pose_landmarks=SimpleNamespace(landmark=t_pose().image), pose_world_landmarks=None,
                depth_meters=np.full(frame.shape[:2], np.nan, np.float32))
            _, lost = self.store.process('phone', self.frame)
            self.assertTrue(all(p is None for p in lost.world))
            self.models[0].process.side_effect = infer
            for i in range(3):
                _, recovered = self.store.process('phone', self.frame)
                if i < 2:
                    self.assertIsNone(recovered.world[11])
            self.assertIsNotNone(recovered.world[11])

    def test_resolution_change_clears_reference_and_world_history(self):
        with patch('app.services.depth.tracking.time.monotonic', side_effect=[i / 10 for i in range(28)]):
            for _ in range(26):
                self.store.process('phone', self.frame)
            _, mismatch = self.store.process('phone', self.frame[:360])
            self.assertFalse(mismatch.calibrated)
            self.assertTrue(all(p is None for p in mismatch.world))
            self.assertIn('resolution changed', mismatch.tracking_message)
            _, restored = self.store.process('phone', self.frame)
            self.assertFalse(restored.calibrated)
            self.assertIsNone(restored.world[11])

    def test_dark_frames_have_no_stale_depth_or_world_status(self):
        self.store.process('phone', self.frame)
        raw, stable = self.store.process('phone', self.frame, lighting='too_dark')
        self.assertIsNone(raw.pose_world_landmarks)
        self.assertTrue(all(p is None for p in stable.world))
        self.assertEqual(self.models[0].process.call_count, 1)
        self.assertEqual(self.store.status('phone')['metric_tracking']['status'], 'too_dark')


if __name__ == '__main__':
    unittest.main()
