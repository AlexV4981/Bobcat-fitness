#Run from the backend directory after starting FastAPI and the React camera: python OpenCVConsumer.py
#consumes react camera stream with OpenCV, project spcific OpenCV work goes in process frame

import argparse
import time
from pathlib import Path

import cv2
from cv2.typing import MatLike
from app.Webcam_utilities.SkeletonOverlay import draw_skeleton

#draws the skeleton frame by frame
def process_frame(frame: MatLike) -> MatLike:
    """Add the main body skeleton to an OpenCV frame."""
    return draw_skeleton(frame)

#opens reads processes and counts each frame    
def consume_stream(stream_url: str, output: Path | None = None) -> None:
    capture = cv2.VideoCapture(stream_url)
    if not capture.isOpened():
        raise RuntimeError(
            f"Could not open {stream_url}. Start FastAPI, then enable the React camera."
        )

    frame_count = 0
    started_at = time.monotonic() #tracks the time from the start of consumption
    #releases the capture no matter what
    try:
        while True:
            received, frame = capture.read()
            if not received:
                raise RuntimeError("The camera stream ended or stopped returning frames.")

            processed = process_frame(frame)
            frame_count += 1

            if output is not None:
                cv2.imwrite(str(output), processed)

            #prints the number of processed frames and fps
            if frame_count % 100 == 0:
                elapsed = max(time.monotonic() - started_at, 0.001)
                print(f"Processed {frame_count} frames ({frame_count / elapsed:.1f} fps)")
    finally:
        capture.release()

#reads the command line options the stream is HTTP MJPEG
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--stream-url",
        default="http://127.0.0.1:8000/api/camera/default/mjpeg",
        help="FastAPI MJPEG stream URL",
    ) #Default URL
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional path that is continually updated with the latest processed frame",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    consume_stream(arguments.stream_url, arguments.output)
