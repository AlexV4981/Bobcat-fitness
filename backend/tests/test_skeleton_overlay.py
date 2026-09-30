import unittest

import cv2
import numpy as np

from app.Webcam_utilities.SkeletonOverlay import process_jpeg_frame

#encodes a blank image as JPEG and returns data openCV can decode
class SkeletonOverlayTests(unittest.TestCase):

    def test_blank_frame_stays_a_valid_jpeg(self) -> None:
        image = np.zeros((240, 320, 3), dtype=np.uint8)
        encoded, jpeg = cv2.imencode(".jpg", image)
        self.assertTrue(encoded)

        result = process_jpeg_frame(jpeg.tobytes())
        decoded = cv2.imdecode(np.frombuffer(result, dtype=np.uint8), cv2.IMREAD_COLOR)

        self.assertIsNotNone(decoded)
        self.assertEqual(decoded.shape, image.shape)


if __name__ == "__main__":
    unittest.main()
