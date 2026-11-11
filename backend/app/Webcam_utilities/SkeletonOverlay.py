#Draw a simple skeleton on the human body

import math

import cv2
import mediapipe as mp
import numpy as np
from cv2.typing import MatLike

from app.Webcam_utilities.WebcamCalibrator import draw_landmark_vectors
from app.services.LandMarkVectors import TRACKED_LANDMARK_INDEXES
from app.services.movement_recorder import movement_recorders
from app.services.rep_session import rep_sessions
from app.services.depth.tracking import PoseTrackingStore
from app.services.depth.lighting import prepare_pose_frame
from app.services.depth.onnx_inference import create_pose_model


#main body parts skipping small hand and face points
BODY_CONNECTIONS = [
    (11, 12),  #shoulders
    (11, 13),
    (13, 15),  #left arm
    (12, 14),
    (14, 16),  #right arm
    (11, 23),
    (12, 24),
    (23, 24),  #torso
    (23, 25),
    (25, 27),
    (27, 31),  #left leg and foot
    (24, 26),
    (26, 28),
    (28, 32),  #right leg and foot
]

#shared joints are recorded once
BODY_LANDMARK_INDEXES = tuple(
    sorted({index for connection in BODY_CONNECTIONS for index in connection})
)

#fails if drawing and JSON landmark names dont match
if BODY_LANDMARK_INDEXES != TRACKED_LANDMARK_INDEXES:
    raise RuntimeError(
        "TRACKED_LANDMARK_NAMES must exactly match the indexes in BODY_CONNECTIONS."
    )

#minimum camera quality and color of the skeleton overlay
MIN_VISIBILITY = 0.45
SKELETON_COLOR = (80, 230, 180)
UNCERTAIN_COLOR = (140, 140, 140)


def _create_mediapipe_pose():
    """Give each camera its own SDK temporal history, created only when needed."""
    return mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )


def _create_pose():
    return create_pose_model(_create_mediapipe_pose)


pose_tracking = PoseTrackingStore(_create_pose)

#generates a landmark point on the body using joints
def landmark_point(landmarks, index: int, width: int, height: int):
    landmark = landmarks[index]
    # Invalid/missing samples must never reach integer conversion or drawing.
    if landmark is None or not all(math.isfinite(value) for value in (
        landmark.x, landmark.y, landmark.z, landmark.visibility,
    )) or landmark.visibility < MIN_VISIBILITY or not (0 <= landmark.x <= 1 and 0 <= landmark.y <= 1):
        return None

    x = int(landmark.x * width)
    y = int(landmark.y * height)
    return (x, y)

#Draws circle around face landmarks
def draw_head(frame: MatLike, landmarks) -> None:
    height, width = frame.shape[:2]
    face_points = []

#gets the points in landmark then draws on the land marks
    for index in range(11):
        point = landmark_point(landmarks, index, width, height)
        if point is not None:
            face_points.append(point)

#ensures theres enough points to begin drawing
    if len(face_points) < 2:
        return

    points = np.array(face_points, dtype=np.float32)
    (center_x, center_y), radius = cv2.minEnclosingCircle(points)
    radius = max(10, int(radius * 1.35))
    center = (int(center_x), int(center_y))

    cv2.circle(frame, center, radius, (10, 25, 30), 8, cv2.LINE_AA)
    cv2.circle(frame, center, radius, SKELETON_COLOR, 4, cv2.LINE_AA)

#feeds the pose to the automatic rep counter (None = nobody detected)
def count_reps(camera_id: str, image_landmarks, world_landmarks) -> None:
    if not rep_sessions.process(camera_id, image_landmarks, world_landmarks):
        return
    #a detected rep is saved exactly like a Count Rep click so the JSON files match the count
    try:
        movement_recorders.save_rep(camera_id)
    except ValueError as error:
        #recorder rejected it (no pose crossed its movement threshold) so the rep is not counted
        rep_sessions.adjust(camera_id, -1)
        print(f"Auto-detected rep was not saved: {error}")

#find the person and draw their main limbs
def draw_skeleton(frame: MatLike, camera_id: str = "default") -> MatLike:
    rgb_frame, lighting = prepare_pose_frame(frame)

    result, stable = pose_tracking.process(camera_id, rgb_frame, lighting=lighting)
    can_record = stable.calibrated and stable.lighting != "too_dark"
    if not can_record:
        # Never stitch an unfinished exercise across calibration or darkness.
        rep_sessions.pause(camera_id)
        movement_recorders.recorder(camera_id).reset_samples()
    if stable.lighting != "good" or not stable.calibrated:
        label = ("Too dark - add light in front of you" if stable.lighting == "too_dark" else
                 "Low light - add light in front of you" if stable.lighting == "dim" else
                 f"Hold a full-body T-pose: {round(stable.calibration_progress * 100)}%")
        cv2.putText(frame, label, (12, 28), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, (255, 255, 255), 2, cv2.LINE_AA)
    # The adapter masks joints unless both their image and depth are usable.
    image_landmarks, world_landmarks = stable.counter_landmarks()

    if not result.pose_landmarks:
        #empty pose cannot pass the filter, so this creates no saved sample.
        movement_recorders.record_frame(camera_id, {})
        count_reps(camera_id, None, None)
        return frame

    # Rejected joints stay absent. Falling back to the raw prediction here
    # would bring the exact sprawling outlier back into the overlay.
    display_landmarks = stable.image
    height, width = frame.shape[:2]

    #draws a dark outline first so the skeleton is easy to see on light video.
    for start_index, end_index in BODY_CONNECTIONS:
        start = landmark_point(display_landmarks, start_index, width, height)
        end = landmark_point(display_landmarks, end_index, width, height)
        if start is None or end is None:
            continue
        cv2.line(frame, start, end, (10, 25, 30), 10, cv2.LINE_AA)
        reliable = all(
            stable.image[index] is not None and stable.world[index] is not None
            for index in (start_index, end_index)
        )
        color = SKELETON_COLOR if reliable else UNCERTAIN_COLOR
        cv2.line(frame, start, end, color, 5, cv2.LINE_AA)

    joint_indexes = BODY_LANDMARK_INDEXES
    screen_points = {}
    positions = {}
    for index in joint_indexes:
        point = landmark_point(display_landmarks, index, width, height)
        if point is not None:
            landmark = stable.image[index]
            reliable = landmark is not None and stable.world[index] is not None
            if reliable:
                screen_points[index] = point
                # Preserve the recorder's image-coordinate schema and threshold.
                positions[index] = (landmark.x, landmark.y, landmark.z)
            cv2.circle(frame, point, 7, (10, 25, 30), -1, cv2.LINE_AA)
            color = SKELETON_COLOR if reliable else UNCERTAIN_COLOR
            cv2.circle(frame, point, 4, color, -1, cv2.LINE_AA)

    # Only validated, filtered joints reach recording. Legacy -1 placeholders
    # are introduced by serialization, never fed back into the stability layer.
    movement_recorders.record_frame(camera_id, positions if can_record else {})
    #counted after recording so the frame that finishes a rep is part of that rep's JSON
    count_reps(camera_id, image_landmarks if can_record else None,
               world_landmarks if can_record else None)

    draw_head(frame, display_landmarks)

    if not can_record:
        return frame

    calibrated = draw_landmark_vectors(
        frame,
        screen_points,
        positions,
        joint_indexes,
        camera_id=camera_id,
    )
    if not calibrated:
        cv2.putText(
            frame,
            "Show full body to calibrate vectors",
            (12, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
    return frame

#decodes a JPEG and adds the skeleton then codes it back into a JPEG
def process_jpeg_frame(jpeg: bytes, camera_id: str = "default") -> bytes:
    frame_data = np.frombuffer(jpeg, dtype=np.uint8)
    frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)
    #ensures the jpeg is clear enough to begin drawing
    if frame is None:
        return jpeg

    #draws after getting enough information
    processed_frame = draw_skeleton(frame, camera_id)
    encoded, output = cv2.imencode(
        ".jpg",
        processed_frame,
        [cv2.IMWRITE_JPEG_QUALITY, 85],
    )#returns compelted jpeg if it was encoded if not just returns the same bytes
    return output.tobytes() if encoded else jpeg

