"""Consume the React camera stream with OpenCV.

Run from the backend directory after starting FastAPI and the React camera:
    python opencv_consumer.py

Put project-specific OpenCV work in ``process_frame`` below.
"""

import argparse
import time
from pathlib import Path

import cv2
from cv2.typing import MatLike


def process_frame(frame: MatLike) -> MatLike:
    """Apply OpenCV processing here and return the resulting frame."""
    cv2.putText(
        frame,
        "Bobcat Fitness - OpenCV connected",
        (24, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (80, 230, 180),
        2,
        cv2.LINE_AA,
    )
    return frame


def consume_stream(stream_url: str, output: Path | None = None) -> None:
    capture = cv2.VideoCapture(stream_url)
    if not capture.isOpened():
        raise RuntimeError(
            f"Could not open {stream_url}. Start FastAPI, then enable the React camera."
        )

    frame_count = 0
    started_at = time.monotonic()
    try:
        while True:
            received, frame = capture.read()
            if not received:
                raise RuntimeError("The camera stream ended or stopped returning frames.")

            processed = process_frame(frame)
            frame_count += 1

            if output is not None:
                cv2.imwrite(str(output), processed)

            if frame_count % 100 == 0:
                elapsed = max(time.monotonic() - started_at, 0.001)
                print(f"Processed {frame_count} frames ({frame_count / elapsed:.1f} fps)")
    finally:
        capture.release()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--stream-url",
        default="http://127.0.0.1:8000/api/camera/default/mjpeg",
        help="FastAPI MJPEG stream URL",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path that is continually updated with the latest processed frame",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    consume_stream(arguments.stream_url, arguments.output)
