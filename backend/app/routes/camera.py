"""Routes for ingesting React webcam frames and exposing them to OpenCV."""

import re
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.services.camera_stream import MAX_FRAME_BYTES, camera_streams

router = APIRouter(prefix="/api/camera", tags=["camera"])

CAMERA_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MJPEG_BOUNDARY = "frame"


def validate_camera_id(camera_id: str) -> str:
    if not CAMERA_ID_PATTERN.fullmatch(camera_id):
        raise HTTPException(
            status_code=422,
            detail="Camera ID must contain only letters, numbers, underscores, or hyphens.",
        )
    return camera_id


@router.websocket("/ws/{camera_id}")
async def camera_websocket(websocket: WebSocket, camera_id: str) -> None:
    if not CAMERA_ID_PATTERN.fullmatch(camera_id):
        await websocket.close(code=1008, reason="Invalid camera ID")
        return

    await websocket.accept()
    await camera_streams.producer_connected(camera_id)

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break

            frame = message.get("bytes")
            if frame is None:
                await websocket.close(code=1003, reason="Binary JPEG frames are required")
                break

            try:
                await camera_streams.publish(camera_id, frame)
            except ValueError as error:
                close_code = 1009 if len(frame) > MAX_FRAME_BYTES else 1003
                await websocket.close(code=close_code, reason=str(error))
                break
    except WebSocketDisconnect:
        pass
    finally:
        await camera_streams.producer_disconnected(camera_id)


@router.get("/{camera_id}/status")
async def camera_status(camera_id: str) -> dict[str, int | float | bool | None | str]:
    validate_camera_id(camera_id)
    state = await camera_streams.snapshot(camera_id)
    return {
        "camera_id": camera_id,
        "connected": state.producers > 0,
        "producers": state.producers,
        "sequence": state.sequence,
        "updated_at": state.updated_at,
    }


@router.get("/{camera_id}/mjpeg")
async def camera_mjpeg(camera_id: str) -> StreamingResponse:
    validate_camera_id(camera_id)

    async def generate_frames() -> AsyncIterator[bytes]:
        sequence = 0
        while True:
            state = await camera_streams.wait_for_frame(camera_id, sequence)
            if state is None or state.frame is None:
                continue
            sequence = state.sequence
            yield (
                f"--{MJPEG_BOUNDARY}\r\n"
                "Content-Type: image/jpeg\r\n"
                f"Content-Length: {len(state.frame)}\r\n\r\n"
            ).encode("ascii") + state.frame + b"\r\n"

    return StreamingResponse(
        generate_frames(),
        media_type=f"multipart/x-mixed-replace; boundary={MJPEG_BOUNDARY}",
        headers={"Cache-Control": "no-store"},
    )
