"""Compatibility entry point for the original webcam-processing prototype.

The working camera consumer now lives at ``backend/opencv_consumer.py``. This
module remains importable so older references do not fail while that code moves.
"""

from opencv_consumer import consume_stream, process_frame

__all__ = ["consume_stream", "process_frame"]
