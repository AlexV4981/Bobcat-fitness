import unittest

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
    process_jpeg_frame,
)
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


if __name__ == "__main__":
    unittest.main()
