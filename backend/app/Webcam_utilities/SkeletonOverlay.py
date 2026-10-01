#Draw a simple skeleton on the human body

from threading import Lock

import cv2
import mediapipe as mp
import numpy as np
from cv2.typing import MatLike


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

#minimum camera quality and color of the skeleton overlay
MIN_VISIBILITY = 0.45
SKELETON_COLOR = (80, 230, 180)

pose = mp.solutions.pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

#MediaPipe tracks information between frames only one thread can use it at a time
pose_lock = Lock()

#generates a landmark point on the body using joints
def landmark_point(landmarks, index: int, width: int, height: int):
    landmark = landmarks[index]
    if landmark.visibility < MIN_VISIBILITY:
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

#find the person and draw their main limbs
def draw_skeleton(frame: MatLike) -> MatLike:
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    with pose_lock:
        result = pose.process(rgb_frame)

    if not result.pose_landmarks:
        return frame

    landmarks = result.pose_landmarks.landmark
    height, width = frame.shape[:2]

    #draws a dark outline first so the skeleton is easy to see on light video.
    for start_index, end_index in BODY_CONNECTIONS:
        start = landmark_point(landmarks, start_index, width, height)
        end = landmark_point(landmarks, end_index, width, height)
        if start is None or end is None:
            continue
        cv2.line(frame, start, end, (10, 25, 30), 10, cv2.LINE_AA)
        cv2.line(frame, start, end, SKELETON_COLOR, 5, cv2.LINE_AA)

    joint_indexes = sorted({index for pair in BODY_CONNECTIONS for index in pair})
    for index in joint_indexes:
        point = landmark_point(landmarks, index, width, height)
        if point is not None:
            cv2.circle(frame, point, 7, (10, 25, 30), -1, cv2.LINE_AA)
            cv2.circle(frame, point, 4, SKELETON_COLOR, -1, cv2.LINE_AA)

    draw_head(frame, landmarks)
    return frame

#decodes a JPEG and adds the skeleton then codes it back into a JPEG
def process_jpeg_frame(jpeg: bytes) -> bytes:
    frame_data = np.frombuffer(jpeg, dtype=np.uint8)
    frame = cv2.imdecode(frame_data, cv2.IMREAD_COLOR)
    #ensures the jpeg is clear enough to begin drawing
    if frame is None:
        return jpeg

    #draws after getting enough information
    processed_frame = draw_skeleton(frame)
    encoded, output = cv2.imencode(
        ".jpg",
        processed_frame,
        [cv2.IMWRITE_JPEG_QUALITY, 85],
    )#returns compelted jpeg if it was encoded if not just returns the same bytes
    return output.tobytes() if encoded else jpeg

