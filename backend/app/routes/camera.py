#Routes that ingest React webcam frames and sends and process them with OpenCV
import asyncio
import re
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.services.camera_stream import MAX_FRAME_BYTES, camera_streams
from app.Webcam_utilities.SkeletonOverlay import process_jpeg_frame

router = APIRouter(prefix="/api/camera", tags=["camera"])

#Validates any camera ID and ensures its following the allowed format
CAMERA_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MJPEG_BOUNDARY = "frame"


#Ensures that the camera id has a valid format
def validate_camera_id(camera_id: str) -> str:
    if not CAMERA_ID_PATTERN.fullmatch(camera_id):
        raise HTTPException(
            status_code=422,
            detail="Camera ID must contain only letters, numbers, underscores, or hyphens.",
        )
    return camera_id


#creates the websock upload endpoint
@router.websocket("/ws/{camera_id}")
#Selects the camera using the ID
async def camera_websocket(websocket: WebSocket, camera_id: str) -> None:
    if not CAMERA_ID_PATTERN.fullmatch(camera_id):
        await websocket.close(code=1008, reason="Invalid camera ID")
        return

#accepts the websocket but doest not connect to the camera, producer records that its connected
    await websocket.accept()
    await camera_streams.producer_connected(camera_id)

#continously receives the stream from the websocket
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break


            frame = message.get("bytes")
            #ensures the frame has contains data no validation here
            if frame is None:
                await websocket.close(code=1003, reason="Binary JPEG frames are required")
                break


            try:
                #tries to push the current frame from the camera
                await camera_streams.publish(camera_id, frame)
            except ValueError as error:
                #handles empty, oversized, or invalid format
                close_code = 1009 if len(frame) > MAX_FRAME_BYTES else 1003
                await websocket.close(code=close_code, reason=str(error))
                break
    except WebSocketDisconnect:
        pass
    finally:
        await camera_streams.producer_disconnected(camera_id)

#Gets the status from the camera using camera_ID
@router.get("/{camera_id}/status")
#returns the camera connection and frame status in the JSON format
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

#contionsouly streams processed JPEG images using MJPEG
@router.get("/{camera_id}/mjpeg")


async def camera_mjpeg(camera_id: str) -> StreamingResponse:
    validate_camera_id(camera_id)

#After camera validation it generates frames and keeps track of state with a sequence variable
    async def generate_frames() -> AsyncIterator[bytes]:
        sequence = 0
        #waits for time out if it has no frame still the loop tries again
        while True:
            state = await camera_streams.wait_for_frame(camera_id, sequence)
            if state is None or state.frame is None:
                continue
            #changes the state of sequence
            sequence = state.sequence
            #sends the frame to process_jpeg_frame() in a worker thread then creates the MJPEG headers and response bytes
            frame = await asyncio.to_thread(process_jpeg_frame, state.frame)
            yield (
                f"--{MJPEG_BOUNDARY}\r\n"
                "Content-Type: image/jpeg\r\n"
                f"Content-Length: {len(frame)}\r\n\r\n"
            ).encode("ascii") + frame + b"\r\n"

    return StreamingResponse(
        generate_frames(),
        media_type=f"multipart/x-mixed-replace; boundary={MJPEG_BOUNDARY}",
        headers={"Cache-Control": "no-store"},
    )
