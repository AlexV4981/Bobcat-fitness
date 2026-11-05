"""Calibration and quality checks use synthetic geometry, not a live camera."""

from dataclasses import replace
import unittest

import cv2
import numpy as np

from app.Webcam_utilities.rep_counter import Landmark, RepCounter
from app.services.depth.calibration import TPoseCalibration
from app.services.depth.lighting import prepare_pose_frame
from app.services.depth.stability import StabilizedPose


def t_pose():
    # Equal image dimensions here keep the synthetic pose easy to inspect.
    xy = {
        11: (.4, .3), 12: (.6, .3), 13: (.25, .3), 14: (.75, .3),
        15: (.1, .3), 16: (.9, .3), 23: (.42, .55), 24: (.58, .55),
        25: (.42, .72), 26: (.58, .72), 27: (.42, .9), 28: (.58, .9),
        31: (.4, .93), 32: (.6, .93),
    }
    image = [Landmark(.5, .2)] * 33
    world = [Landmark(0, 0)] * 33
    for i, (x, y) in xy.items():
        image[i] = Landmark(x, y)
        world[i] = Landmark((x - .5) * 2, (y - .55) * 2)
    return StabilizedPose(tuple(image), tuple(world))


def calibrated():
    calibration = TPoseCalibration()
    for frame in range(22):
        result = calibration.update(t_pose(), 720, 720, frame / 10, "good")
    assert result.calibrated
    return calibration


class TPoseTests(unittest.TestCase):
    def test_requires_two_seconds_and_multiple_observations(self):
        calibration = TPoseCalibration()
        for frame in range(20):
            result = calibration.update(t_pose(), 720, 720, frame / 10, "good")
            self.assertFalse(result.calibrated)
        result = calibration.update(t_pose(), 720, 720, 2.0, "good")
        self.assertTrue(result.calibrated)
        self.assertEqual(result.calibration_progress, 1)

    def test_dropped_frames_and_bad_lighting_restart_hold(self):
        for lighting in ("dim", "too_dark"):
            calibration = TPoseCalibration()
            calibration.update(t_pose(), 720, 720, 0, "good")
            result = calibration.update(t_pose(), 720, 720, 1, lighting)
            self.assertEqual(result.calibration_progress, 0)
            self.assertFalse(result.calibrated)
        calibration.update(t_pose(), 720, 720, 1.1, "good")
        result = calibration.update(t_pose(), 720, 720, 3.2, "good")
        self.assertEqual(result.calibration_progress, 0)

    def test_full_body_confidence_and_straight_arms_required(self):
        for point in (None, Landmark(.1, .3, visibility=.6),
                      Landmark(-.1, .3), Landmark(.25, .5)):
            pose = t_pose()
            image = list(pose.image)
            image[15] = point
            pose = replace(pose, image=tuple(image))
            calibration = TPoseCalibration()
            for frame in range(30):
                result = calibration.update(pose, 720, 720, frame / 10, "good")
            self.assertFalse(result.calibrated)

    def test_moving_reference_cannot_finish_hold(self):
        calibration = TPoseCalibration()
        for frame in range(30):
            pose = t_pose()
            dx = .04 if frame % 2 else 0
            image = tuple(Landmark(p.x + dx, p.y, p.z) for p in pose.image)
            result = calibration.update(replace(pose, image=image), 720, 720, frame / 10, "good")
        self.assertFalse(result.calibrated)

    def test_long_world_bone_is_hidden_and_recovers_next_frame(self):
        calibration = calibrated()
        pose = t_pose()
        world = list(pose.world)
        world[15] = Landmark(-2, 0, 1)
        result = calibration.update(replace(pose, world=tuple(world)), 720, 720, 3, "good")
        self.assertIsNone(result.image[15])
        self.assertIsNone(result.world[15])
        self.assertIsNotNone(result.world[26])
        counter_image, _ = result.counter_landmarks()
        self.assertEqual(counter_image[15].visibility, 0)
        recovered = calibration.update(pose, 720, 720, 3.1, "good")
        self.assertIsNotNone(recovered.world[15])

    def test_bent_camera_facing_arm_with_same_lengths_is_preserved(self):
        calibration = calibrated()
        pose = t_pose()
        world, image = list(pose.world), list(pose.image)
        elbow = world[13]
        world[15] = Landmark(elbow.x, elbow.y, .3)
        image[15] = image[13]  # Strong foreshortening, valid 3D forearm.
        result = calibration.update(replace(pose, image=tuple(image), world=tuple(world)), 720, 720, 3, "good")
        self.assertIsNotNone(result.world[15])

    def test_image_sprawl_rejected_even_if_world_length_looks_plausible(self):
        calibration = calibrated()
        pose = t_pose()
        image = list(pose.image)
        image[15] = Landmark(.98, .95)
        result = calibration.update(replace(pose, image=tuple(image)), 720, 720, 3, "good")
        self.assertIsNone(result.image[15])

    def test_calibration_is_not_shared_between_people(self):
        first = calibrated()
        second = TPoseCalibration()
        self.assertTrue(first.ready)
        self.assertFalse(second.ready)
        self.assertEqual(second.lengths, {})


class LightingTests(unittest.TestCase):
    def test_bright_frames_keep_rgb_values_and_geometry(self):
        frame = np.full((80, 120, 3), (100, 150, 200), dtype=np.uint8)
        prepared, lighting = prepare_pose_frame(frame)
        self.assertEqual(lighting, "good")
        np.testing.assert_array_equal(prepared, cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    def test_dim_image_gets_contrast_assistance_without_mutating_preview(self):
        gray = np.tile(np.linspace(35, 85, 120, dtype=np.uint8), (80, 1))
        frame = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        original = frame.copy()
        prepared, lighting = prepare_pose_frame(frame)
        self.assertEqual(lighting, "dim")
        self.assertEqual(prepared.shape, frame.shape)
        self.assertGreater(float(prepared.mean()), float(frame.mean()))
        np.testing.assert_array_equal(frame, original)

    def test_black_image_is_not_brightened_into_false_evidence(self):
        prepared, lighting = prepare_pose_frame(np.zeros((80, 120, 3), dtype=np.uint8))
        self.assertEqual(lighting, "too_dark")
        self.assertFalse(prepared.any())

    def test_pausing_discards_partial_rep_without_losing_completed_reps(self):
        counter = RepCounter("Squat")
        counter.adjust(3)
        for angle, now in ((175, 0), (120, .5), (80, 1)):
            counter.update_angle(angle, now)
        counter.pause()
        self.assertFalse(counter.update_angle(175, 1.5))
        self.assertEqual(counter.count, 3)
