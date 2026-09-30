"""In-memory bridge between browser camera producers and Python consumers."""

import asyncio
from dataclasses import dataclass
from time import time

MAX_FRAME_BYTES = 4 * 1024 * 1024


@dataclass(frozen=True)
class CameraSnapshot:
    frame: bytes | None = None
    sequence: int = 0
    producers: int = 0
    updated_at: float | None = None


class CameraStreamStore:
    """Keeps only the latest JPEG so a slow consumer never builds a backlog."""

    def __init__(self) -> None:
        self._states: dict[str, CameraSnapshot] = {}
        self._changed = asyncio.Condition()

    async def producer_connected(self, camera_id: str) -> None:
        async with self._changed:
            state = self._states.get(camera_id, CameraSnapshot())
            self._states[camera_id] = CameraSnapshot(
                frame=state.frame,
                sequence=state.sequence,
                producers=state.producers + 1,
                updated_at=state.updated_at,
            )
            self._changed.notify_all()

    async def producer_disconnected(self, camera_id: str) -> None:
        async with self._changed:
            state = self._states.get(camera_id, CameraSnapshot())
            self._states[camera_id] = CameraSnapshot(
                frame=state.frame,
                sequence=state.sequence,
                producers=max(0, state.producers - 1),
                updated_at=state.updated_at,
            )
            self._changed.notify_all()

    async def publish(self, camera_id: str, frame: bytes) -> int:
        self._validate_jpeg(frame)
        async with self._changed:
            state = self._states.get(camera_id, CameraSnapshot())
            sequence = state.sequence + 1
            self._states[camera_id] = CameraSnapshot(
                frame=frame,
                sequence=sequence,
                producers=state.producers,
                updated_at=time(),
            )
            self._changed.notify_all()
            return sequence

    async def snapshot(self, camera_id: str) -> CameraSnapshot:
        async with self._changed:
            return self._states.get(camera_id, CameraSnapshot())

    async def wait_for_frame(
        self,
        camera_id: str,
        after_sequence: int,
        timeout: float = 15.0,
    ) -> CameraSnapshot | None:
        def has_new_frame() -> bool:
            state = self._states.get(camera_id)
            return state is not None and state.frame is not None and state.sequence > after_sequence

        try:
            async with asyncio.timeout(timeout):
                async with self._changed:
                    await self._changed.wait_for(has_new_frame)
                    return self._states[camera_id]
        except TimeoutError:
            return None

    @staticmethod
    def _validate_jpeg(frame: bytes) -> None:
        if not frame:
            raise ValueError("An empty frame is not valid.")
        if len(frame) > MAX_FRAME_BYTES:
            raise ValueError(f"Frame exceeds the {MAX_FRAME_BYTES}-byte limit.")
        if not (frame.startswith(b"\xff\xd8") and frame.endswith(b"\xff\xd9")):
            raise ValueError("Frames must be JPEG images.")


camera_streams = CameraStreamStore()
