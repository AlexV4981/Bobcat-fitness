"""Calculate, serialize, and safely store MediaPipe landmark vectors."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

#screen points use pixels, 3D positions use raw mediapipe coordinates
ScreenPoint = tuple[int, int]
Position3D = tuple[float, float, float]
PositionVector = tuple[int, int, int]
MotionVector = tuple[float, float, float]

MISSING_VALUE = -1
#missing vectors keep all three components so the json format stays consistent
MISSING_VECTOR = (MISSING_VALUE, MISSING_VALUE, MISSING_VALUE)
#Uses Euclidena displacement in mediapipe cords uses the whole pose not individual landmarks
MOVEMENT_THRESHOLD = 0.10
#0.10 is coordinate distance, not a 10% change in the previous vector length
#landmark is the key with values seprated by |
VECTOR_FORMAT = "frame_timestamp_id|position_vector|directional_vector|velocity"

#uses landmarks that are currently being tracked can be expanded if needed later
TRACKED_LANDMARK_NAMES = {
    11: "LEFT_SHOULDER",
    12: "RIGHT_SHOULDER",
    13: "LEFT_ELBOW",
    14: "RIGHT_ELBOW",
    15: "LEFT_WRIST",
    16: "RIGHT_WRIST",
    23: "LEFT_HIP",
    24: "RIGHT_HIP",
    25: "LEFT_KNEE",
    26: "RIGHT_KNEE",
    27: "LEFT_ANKLE",
    28: "RIGHT_ANKLE",
    31: "LEFT_FOOT_INDEX",
    32: "RIGHT_FOOT_INDEX",
}
TRACKED_LANDMARK_INDEXES = tuple(TRACKED_LANDMARK_NAMES)

#return screen space movmenet from landmarks origin
def displacement_from_origin(
    current: Position3D,
    origin: Position3D,
    frame_width: int,
    frame_height: int,
) -> PositionVector:

    #positive values mean right up and backward respectively
    current_x, current_y, current_z = current
    origin_x, origin_y, origin_z = origin
    #flips y so moving up is positive on the preview, depth uses the width scale
    return (
        round((current_x - origin_x) * frame_width),
        round((origin_y - current_y) * frame_height),
        round((current_z - origin_z) * frame_width),
    )


def format_position_vector(vector: PositionVector) -> str:
    #formats the vector to be drawn ontop of the landmark
    return f"({vector[0]},{vector[1]},{vector[2]})"


def rounded(vector: Position3D) -> MotionVector:
    #keeps exported values to six decimal places
    return tuple(round(component, 6) for component in vector)


#returns position, unit direction, and per second velocity for each sample
def calculate_motion_vectors(
    position: Position3D | None,
    previous_position: Position3D | None,
    elapsed_seconds: float | None,
) -> tuple[
    MotionVector | tuple[int, int, int],
    MotionVector | tuple[int, int, int],
    MotionVector | tuple[int, int, int],
]:
    #invalid values use -1, position uses raw mediapipe cords, direction is the unit displacement vector and velocity is displacement divded by seconds that have passed
    if position is None:
        return MISSING_VECTOR, MISSING_VECTOR, MISSING_VECTOR

    stored_position = rounded(position)
    if previous_position is None:
        #first sighting has a position but no earlier point to calculate movement
        return stored_position, MISSING_VECTOR, MISSING_VECTOR

    #difference from the reference pose, exported y still follows mediapipe down
    delta = tuple(
        current - previous
        for current, previous in zip(position, previous_position, strict=True)
    )
    magnitude = math.sqrt(sum(component * component for component in delta))
    #dividing by the length gives direction only, no movement uses a zero vector
    direction = (
        (0.0, 0.0, 0.0)
        if magnitude == 0
        else rounded(tuple(component / magnitude for component in delta))
    )
    #missing or invalid time cannot give a velocity, avoids dividing by zero
    velocity = (
        MISSING_VECTOR
        if elapsed_seconds is None or elapsed_seconds <= 0
        else rounded(tuple(component / elapsed_seconds for component in delta))
    )
    return stored_position, direction, velocity

#must move 3D cordinante distance of 10%
def has_significant_movement(
    positions: Mapping[int, Position3D],
    reference_positions: Mapping[int, Position3D],
    threshold: float = MOVEMENT_THRESHOLD,
) -> bool:
    #returns if the tracked landmark is moved by the normalized threshold
    for index in TRACKED_LANDMARK_INDEXES:
        position = positions.get(index)
        reference = reference_positions.get(index)
        if position is None or reference is None:
            #needs both positions, a newly visible point cannot trigger movement yet
            continue
        #straight line distance from the baseline, not total distance traveled
        distance = math.dist(position, reference)
        #isclose handles rounding near the threshold, one match keeps the whole pose
        if distance >= threshold or math.isclose(distance, threshold):
            return True
    return False

#if -1 then super bad its got no value
def format_number(value: float | int) -> str:
    if value == MISSING_VALUE:
        return "-1"
    if isinstance(value, int):
        return str(value)
    #removes extra decimal zeros to keep the sample strings smaller
    return f"{value:.6f}".rstrip("0").rstrip(".") or "0"

#adds the | inbetween each value for future processing
def format_motion_sample(
    timestamp_id: str,
    position: Sequence[float | int],
    direction: Sequence[float | int],
    velocity: Sequence[float | int],
) -> str:

    def vector_text(vector: Sequence[float | int]) -> str:
        return f"({','.join(format_number(value) for value in vector)})"

    #timestamp|position|direction|velocity, each vector keeps its x,y,z order
    return "|".join(
        (
            timestamp_id,
            vector_text(position),
            vector_text(direction),
            vector_text(velocity),
        )
    )
