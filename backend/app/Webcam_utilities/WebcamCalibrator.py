#Calibrate and draw numeric position vectors for pose landmarks
from collections.abc import Mapping, Sequence
from threading import Lock

import cv2
from cv2.typing import MatLike

from app.services.LandMarkVectors import (
    Position3D,
    PositionVector,
    ScreenPoint,
    displacement_from_origin,
    format_position_vector,
)


VECTOR_COLOR = (255, 80, 220)
VECTOR_FONT_SCALE = 0.38
VECTOR_LABEL_OFFSET = 12

_landmark_origins: dict[str, dict[int, Position3D]] = {}
_origin_lock = Lock()


def reset_landmark_origins(camera_id: str | None = None) -> None:
    #For now waits until full body in view then assumes thats 0,0,0 for each landmark
    with _origin_lock:
        if camera_id is None:
            _landmark_origins.clear()
        else:
            _landmark_origins.pop(camera_id, None)

#will determine what the vector for the landmark is
def calculate_landmark_vectors(
    positions: Mapping[int, Position3D],
    required_indexes: Sequence[int],
    frame_width: int,
    frame_height: int,
    camera_id: str = "default",
) -> dict[int, PositionVector]:
    #Later can be replaced with actual calibration
    with _origin_lock:
        if camera_id not in _landmark_origins:
            if any(index not in positions for index in required_indexes):
                return {}
            # Each camera calibrates independently; another user's pose must
            # never become this session's displacement origin.
            _landmark_origins[camera_id] = {
                index: positions[index] for index in required_indexes
            }
        origins = dict(_landmark_origins[camera_id])

    return {
        index: displacement_from_origin(
            position,
            origins[index],
            frame_width,
            frame_height,
        )
        for index, position in positions.items()
        if index in origins
    }


def draw_landmark_vectors(
    frame: MatLike,
    screen_points: Mapping[int, ScreenPoint],
    positions: Mapping[int, Position3D],
    required_indexes: Sequence[int],
    camera_id: str = "default",
    metric_positions: Mapping[int, Position3D] | None = None,
) -> bool:
    #Draws the vector on the landmark
    height, width = frame.shape[:2]
    vectors = (calculate_landmark_vectors(
        positions, required_indexes, width, height, camera_id=camera_id,
    ) if metric_positions is None else {})
    labels = ({index: f"({x:.3f},{y:.3f},{z:.3f}) m"
               for index, (x, y, z) in metric_positions.items()}
              if metric_positions is not None else
              {index: format_position_vector(vector) for index, vector in vectors.items()})
    if not labels:
        return False

    font = cv2.FONT_HERSHEY_SIMPLEX
    for index, label in labels.items():
        point = screen_points.get(index)
        if point is None:
            continue

        (text_width, text_height), _ = cv2.getTextSize(
            label,
            font,
            VECTOR_FONT_SCALE,
            1,
        )
        label_x = min(
            max(0, point[0] - text_width // 2),
            max(0, width - text_width - 1),
        )
        label_y = max(text_height + 1, point[1] - VECTOR_LABEL_OFFSET)
        label_point = (label_x, label_y)

        #Drawing last keeps labels above lines; the outline keeps them readable.
        cv2.putText(
            frame,
            label,
            label_point,
            font,
            VECTOR_FONT_SCALE,
            (10, 25, 30),
            3,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            label,
            label_point,
            font,
            VECTOR_FONT_SCALE,
            VECTOR_COLOR,
            1,
            cv2.LINE_AA,
        )

    return True
