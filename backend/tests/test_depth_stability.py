"""Behavioral tests with synthetic poses; no camera or MediaPipe required."""

from dataclasses import replace
import math
import unittest

from app.Webcam_utilities.rep_counter import Landmark, RepCounter, joint_angle
from app.services.depth import PoseStabilizer, StabilityConfig
from app.services.depth.evaluation import evaluate_angles


def pose(z: float = 0.0, visibility: float = 1.0) -> list[Landmark]:
    """Build a complete input whose depth can be varied independently."""
    return [Landmark(0.5, 0.5, z, visibility)] * 33


class DepthStabilityTests(unittest.TestCase):
    """Exercise validity, outliers, reacquisition, timing, and smoothing."""

    def test_warmup_requires_consecutive_valid_observations(self):
        stabilizer = PoseStabilizer()
        for frame in range(2):
            stable = stabilizer.update(pose(), pose(), frame / 30)
            self.assertIsNone(stable.world[0])
        stable = stabilizer.update(pose(), pose(), 2 / 30)
        self.assertIsNotNone(stable.world[0])
        self.assertIsNotNone(stable.counter_landmarks()[0])

    def test_real_negative_one_depth_is_not_a_missing_sentinel(self):
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        stable = stabilizer.update(pose(-1), pose(-1), 0)
        self.assertEqual(stable.world[0].z, -1)
        self.assertIsNotNone(stable.counter_landmarks()[0])

    def test_nonfinite_and_low_confidence_samples_are_not_filtered(self):
        for point in (
            Landmark(math.nan, 0, 0), Landmark(0, math.inf, 0),
            Landmark(0, 0, -math.inf), Landmark(0, 0, 0, math.nan),
            Landmark(0, 0, 0, 0.49), Landmark(0, 0, 0, 1.1),
        ):
            with self.subTest(point=point):
                stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
                stable = stabilizer.update([point] * 33, pose(), 0)
                self.assertIsNone(stable.image[0])
                self.assertIsNone(stable.world[0])
                self.assertEqual(stable.counter_landmarks(), (None, None))
                recovered = stabilizer.update(pose(), pose(), 0.1)
                self.assertEqual(recovered.world[0].z, 0)

    def test_missing_or_short_frames_do_not_reuse_last_pose(self):
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        stabilizer.update(pose(), pose(), 0)
        for frame, missing in enumerate((None, [], pose()[:20]), start=1):
            stable = stabilizer.update(missing, missing, frame / 30)
            self.assertTrue(all(point is None for point in stable.image))
            self.assertEqual(stable.counter_landmarks(), (None, None))

    def test_missing_world_does_not_fall_back_to_frontal_2d_angles(self):
        stable = PoseStabilizer(StabilityConfig(warmup_frames=1)).update(pose(), None, 0)
        self.assertIsNotNone(stable.image[0])
        self.assertEqual(stable.counter_landmarks(), (None, None))

    def test_world_outlier_masks_only_that_joint_in_counter_adapter(self):
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        stabilizer.update(pose(), pose(), 0)
        world = pose()
        world[25] = Landmark(0.5, 0.5, 2)
        stable = stabilizer.update(pose(), world, 1 / 30)
        image, spatial = stable.counter_landmarks()
        self.assertEqual(image[25].visibility, 0)
        self.assertEqual(spatial[25].visibility, 0)
        self.assertEqual(image[26].visibility, 1)

    def test_depth_sign_jump_is_rejected_before_smoothing(self):
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        stabilizer.update(pose(-1), pose(-1), 0)
        stable = stabilizer.update(pose(1), pose(1), 1 / 30)
        self.assertIsNone(stable.world[0])
        recovered = stabilizer.update(pose(-1), pose(-1), 2 / 30)
        self.assertEqual(recovered.world[0].z, -1)

    def test_continuous_sign_flips_never_finish_default_warmup(self):
        stabilizer = PoseStabilizer()
        for frame in range(30):
            z = -1 if frame % 2 == 0 else 1
            stable = stabilizer.update(pose(z), pose(z), frame / 30)
            self.assertIsNone(stable.world[0])

    def test_long_loss_restarts_filters_and_warmup(self):
        stabilizer = PoseStabilizer()
        for frame in range(3):
            stabilizer.update(pose(), pose(), frame / 30)
        stabilizer.update(None, None, 0.2)
        for frame in range(3):
            stable = stabilizer.update(pose(1), pose(1), 1 + frame / 30)
            self.assertEqual(stable.world[0] is not None, frame == 2)
        self.assertEqual(stable.world[0].z, 1)

    def test_sustained_reposition_can_reacquire_after_rejected_jumps(self):
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        stabilizer.update(pose(), pose(), 0)
        self.assertIsNone(stabilizer.update(pose(1), pose(1), 0.1).world[0])
        self.assertEqual(stabilizer.update(pose(1), pose(1), 0.6).world[0].z, 1)

    def test_real_smooth_motion_crossing_zero_is_preserved(self):
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        depths = []
        for frame in range(61):
            depth = -0.1 + frame / 300
            stable = stabilizer.update(pose(depth), pose(depth), frame / 30)
            self.assertIsNotNone(stable.world[0])
            depths.append(stable.world[0].z)
        self.assertLess(depths[0], 0)
        self.assertGreater(depths[-1], 0.08)

    def test_filter_follows_small_depth_change_within_two_tenths(self):
        # Check the filter's response only, excluding capture/inference/network.
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        for frame in range(10):
            stabilizer.update(pose(), pose(), frame / 30)
        for frame in range(10, 16):
            stable = stabilizer.update(pose(0.05), pose(0.05), frame / 30)
        self.assertGreater(stable.world[0].z, 0.04)

    def test_invalid_time_raises_without_corrupting_history(self):
        stabilizer = PoseStabilizer(StabilityConfig(warmup_frames=1))
        stabilizer.update(pose(), pose(), 1)
        for timestamp in (1, 0, math.nan, math.inf):
            with self.subTest(timestamp=timestamp), self.assertRaises(ValueError):
                stabilizer.update(pose(1), pose(1), timestamp)
        self.assertEqual(stabilizer.update(pose(), pose(), 1.1).world[0].z, 0)

    def test_configuration_rejects_unusable_values(self):
        for settings in (
            {"warmup_frames": 0}, {"warmup_frames": 1.5}, {"min_cutoff_hz": 0},
            {"min_visibility": math.nan}, {"beta": -1}, {"world_max_speed": math.inf},
        ):
            with self.subTest(settings=settings), self.assertRaises(ValueError):
                replace(StabilityConfig(), **settings)

    def test_stationary_angle_jitter_is_reduced_with_high_coverage(self):
        stabilizer = PoseStabilizer()
        raw_angles, filtered_angles = [], []
        # A right angle with alternating noisy depth on the final endpoint.
        # These known synthetic coordinates test filtering, not camera accuracy.
        for frame in range(120):
            points = pose()
            points[11] = Landmark(0, 0, -0.3)
            points[13] = Landmark(0, 0, 0)
            points[15] = Landmark(0.3, 0, 0.015 * (-1) ** frame)
            stable = stabilizer.update(pose(), points, frame / 30)
            raw_angles.append(joint_angle(points[11], points[13], points[15]))
            selected = [stable.world[i] for i in (11, 13, 15)]
            filtered_angles.append(joint_angle(*selected) if all(selected) else None)
        raw = evaluate_angles(raw_angles[10:])
        filtered = evaluate_angles(filtered_angles[10:], [90] * 110)
        self.assertGreater(filtered.valid_fraction, 0.95)
        self.assertLess(filtered.jitter_p95_degrees, raw.jitter_p95_degrees / 2)
        self.assertLess(filtered.reference_error_p95_degrees, 3)

    def test_rejected_depth_does_not_generate_squat_reps(self):
        stabilizer = PoseStabilizer()
        counter = RepCounter("Squat")
        for frame in range(60):
            points = pose(-1 if frame % 2 == 0 else 1)
            stable = stabilizer.update(pose(), points, frame / 30)
            self.assertFalse(counter.update(*stable.counter_landmarks(), now=frame / 30))
        self.assertEqual(counter.count, 0)


class AngleEvaluationTests(unittest.TestCase):
    """Metrics must expose missing data and distinguish jitter from accuracy."""

    def test_constant_wrong_angle_is_stable_but_inaccurate(self):
        report = evaluate_angles([120] * 20, [90] * 20)
        self.assertEqual(report.jitter_p95_degrees, 0)
        self.assertEqual(report.reference_error_p95_degrees, 30)

    def test_no_valid_data_cannot_claim_zero_error(self):
        report = evaluate_angles([None, math.nan, -1, math.inf], [90] * 4)
        self.assertEqual(report.valid_fraction, 0)
        self.assertIsNone(report.jitter_p95_degrees)
        self.assertIsNone(report.reference_error_p95_degrees)
        self.assertEqual(evaluate_angles([]).total_frames, 0)

    def test_reference_requires_frame_alignment(self):
        with self.assertRaises(ValueError):
            evaluate_angles([90], [90, 90])


if __name__ == "__main__":
    unittest.main()
