import unittest
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import patch

import cv2
import numpy as np

from app.Webcam_utilities.WebcamCalibrator import (
    calculate_landmark_vectors,
    draw_landmark_vectors,
    reset_landmark_origins,
)
from app.Webcam_utilities.SkeletonOverlay import (
    BODY_CONNECTIONS,
    BODY_LANDMARK_INDEXES,
    UNCERTAIN_COLOR,
    draw_skeleton,
    process_jpeg_frame,
)
from app.Webcam_utilities.rep_counter import Landmark
from app.services.depth import StabilizedPose
from app.services.LandMarkVectors import (
    TRACKED_LANDMARK_INDEXES,
    format_position_vector,
)

#encodes a blank image as JPEG and returns data openCV can decode
class SkeletonOverlayTests(unittest.TestCase):

    def setUp(self) -> None:
        reset_landmark_origins()

    def test_recorded_landmarks_match_body_connections(self) -> None:
        # Adding/removing a drawn body joint must also update the JSON name map.
        connection_indexes = tuple(
            sorted({index for pair in BODY_CONNECTIONS for index in pair})
        )

        self.assertEqual(BODY_LANDMARK_INDEXES, connection_indexes)
        self.assertEqual(TRACKED_LANDMARK_INDEXES, connection_indexes)

    def test_blank_frame_stays_a_valid_jpeg(self) -> None:
        image = np.zeros((240, 320, 3), dtype=np.uint8)
        encoded, jpeg = cv2.imencode(".jpg", image)
        self.assertTrue(encoded)

        result = process_jpeg_frame(jpeg.tobytes())
        decoded = cv2.imdecode(np.frombuffer(result, dtype=np.uint8), cv2.IMREAD_COLOR)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded.shape, image.shape)

    def test_calibration_waits_until_every_required_landmark_is_visible(self) -> None:
        incomplete = {11: (0.25, 0.50, 0.10)}

        vectors = calculate_landmark_vectors(incomplete, [11, 12], 200, 100)

        self.assertEqual(vectors, {})

    def test_first_complete_pose_is_zero_then_movement_is_signed(self) -> None:
        origin = {
            11: (0.25, 0.50, 0.10),
            12: (0.75, 0.50, 0.10),
        }
        moved = {
            11: (0.30, 0.40, 0.20),
            12: (0.70, 0.60, 0.00),
        }

        zero_vectors = calculate_landmark_vectors(origin, [11, 12], 200, 100)
        moved_vectors = calculate_landmark_vectors(moved, [11, 12], 200, 100)

        self.assertEqual(zero_vectors, {11: (0, 0, 0), 12: (0, 0, 0)})
        self.assertEqual(moved_vectors, {11: (10, 10, 20), 12: (-10, -10, -20)})
        self.assertEqual(format_position_vector(moved_vectors[11]), "(10,10,20)")

    def test_vector_labels_are_drawn_without_connection_lines(self) -> None:
        image = np.zeros((120, 200, 3), dtype=np.uint8)
        points = {11: (50, 80), 12: (150, 80)}
        positions = {11: (0.25, 0.66, 0.0), 12: (0.75, 0.66, 0.0)}

        calibrated = draw_landmark_vectors(image, points, positions, [11, 12])

        self.assertTrue(calibrated)
        self.assertGreater(np.count_nonzero(image), 0)
        self.assertTrue(np.array_equal(image[80, 100], (0, 0, 0)))

    def test_camera_calibration_origins_are_independent(self):
        # Each person's first complete observation should independently be zero.
        first = {11: (0.2, 0.3, -0.2)}
        second = {11: (0.7, 0.8, 0.3)}
        calculate_landmark_vectors(first, [11], 200, 100, camera_id="first")
        vectors = calculate_landmark_vectors(second, [11], 200, 100, camera_id="second")
        self.assertEqual(vectors[11], (0, 0, 0))
        reset_landmark_origins("first")
        moved = {11: (0.8, 0.8, 0.3)}
        self.assertEqual(
            calculate_landmark_vectors(moved, [11], 200, 100, camera_id="second")[11],
            (20, 0, 0),
        )

    def test_live_pipeline_uses_filtered_coordinates_and_grays_uncertain_bones(self):
        # Make raw, filtered-image, and filtered-world coordinates distinct so
        # the test catches accidental coordinate-space mixing in integration.
        raw = [Landmark(0.8, 0.8, 0.8)] * 33
        image = [Landmark(0.4, 0.4, 0.04)] * 33
        world = [Landmark(0.1, 0.2, -0.3)] * 33
        world[13] = None  # Left elbow depth is unassessable for this frame.
        stable = StabilizedPose(tuple(image), tuple(world))
        result = SimpleNamespace(pose_landmarks=SimpleNamespace(landmark=raw))
        overlay = "app.Webcam_utilities.SkeletonOverlay"
        with (
            patch(f"{overlay}.pose_tracking.process", return_value=(result, stable)),
            patch(f"{overlay}.movement_recorders.record_frame") as record,
            patch(f"{overlay}.count_reps") as counter,
            patch(f"{overlay}.draw_landmark_vectors", return_value=True) as vectors,
            patch(f"{overlay}.cv2.line") as line,
        ):
            draw_skeleton(np.zeros((100, 200, 3), dtype=np.uint8), "test-camera")
        recorded = record.call_args.args[1]
        self.assertEqual(record.call_args.args[0], "test-camera")
        self.assertEqual(recorded[11], (0.4, 0.4, 0.04))
        self.assertNotIn(13, recorded)
        self.assertEqual(counter.call_args.args[2][11], world[11])
        self.assertEqual(counter.call_args.args[1][13].visibility, 0)
        self.assertEqual(vectors.call_args.kwargs["camera_id"], "test-camera")
        # Connection order: shoulders, then left shoulder-to-elbow. Each gets
        # an outline followed by its foreground color.
        self.assertEqual(line.call_args_list[3].args[3], UNCERTAIN_COLOR)
        self.assertEqual(line.call_args_list[0].args[1], (80, 40))

    def test_rejected_joints_never_fall_back_to_raw_predictions(self):
        raw = [Landmark(.5, .5)] * 33
        raw[15] = Landmark(.99, .99)
        image = [Landmark(.4, .4)] * 33
        image[15] = None
        stable = StabilizedPose(tuple(image), tuple(image))
        result = SimpleNamespace(pose_landmarks=SimpleNamespace(landmark=raw))
        overlay = "app.Webcam_utilities.SkeletonOverlay"
        with (
            patch(f"{overlay}.pose_tracking.process", return_value=(result, stable)),
            patch(f"{overlay}.movement_recorders.record_frame") as record,
            patch(f"{overlay}.count_reps"),
            patch(f"{overlay}.draw_landmark_vectors", return_value=True),
            patch(f"{overlay}.cv2.line") as line,
            patch(f"{overlay}.cv2.circle") as circle,
        ):
            draw_skeleton(np.full((100, 200, 3), 150, dtype=np.uint8))
        self.assertNotIn(15, record.call_args.args[1])
        for call in line.call_args_list:
            self.assertNotIn((198, 99), call.args[1:3])
        for call in circle.call_args_list:
            self.assertNotEqual(call.args[1], (198, 99))

    def test_calibration_and_darkness_block_recording_and_counting(self):
        points = (Landmark(.4, .4),) * 33
        valid = StabilizedPose(points, points)
        result = SimpleNamespace(pose_landmarks=SimpleNamespace(landmark=points))
        overlay = "app.Webcam_utilities.SkeletonOverlay"
        for stable in (replace(valid, calibrated=False), replace(valid, lighting="too_dark")):
            with (
                self.subTest(stable=stable),
                patch(f"{overlay}.pose_tracking.process", return_value=(result, stable)),
                patch(f"{overlay}.movement_recorders") as recorder,
                patch(f"{overlay}.rep_sessions.pause") as pause,
                patch(f"{overlay}.count_reps") as counter,
                patch(f"{overlay}.draw_landmark_vectors") as vectors,
            ):
                draw_skeleton(np.full((100, 200, 3), 150, dtype=np.uint8), "calibration-test")
                recorder.record_frame.assert_called_once_with("calibration-test", {})
                recorder.recorder.return_value.reset_samples.assert_called_once()
                counter.assert_called_once_with("calibration-test", None, None)
                pause.assert_called_once_with("calibration-test")
                vectors.assert_not_called()


if __name__ == "__main__":
    unittest.main()
