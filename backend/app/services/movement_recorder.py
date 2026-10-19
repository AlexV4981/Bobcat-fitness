from __future__ import annotations

import json
import os
import re
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from time import monotonic

from app.services.LandMarkVectors import (
    Position3D,
    TRACKED_LANDMARK_INDEXES,
    TRACKED_LANDMARK_NAMES,
    VECTOR_FORMAT,
    calculate_motion_vectors,
    format_motion_sample,
    has_significant_movement,
)

#resolves too backend/movement_data
DEFAULT_VECTOR_DIRECTORY = Path(__file__).resolve().parents[2] / "movement_data"

def sortable_timestamp_id(moment: datetime | None = None) -> str:
    #returns UTC identifier time stamp
    current = moment or datetime.now(timezone.utc)
    #year first so the time stamps stay in order when sorted as text
    return current.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")


def safe_exercise_name(exercise: str) -> str:
    #creates a filename component without accepting path traversal
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", exercise.strip()).strip("_-")
    if not cleaned:
        raise ValueError("Exercise name must contain a letter or number.")
    #limits how much of the exercise name gets used in the file path
    return cleaned[:64]

#all the the tracked stats for the json file
@dataclass(frozen=True)
class SavedRep:
    exercise: str
    set_number: int
    rep_number: int
    timestamp_id: str
    frame_count: int
    path: Path

#Saves landmark frames and save it all to one file per rep
class MovementVectorRecorder:

    def __init__(self, output_directory: Path = DEFAULT_VECTOR_DIRECTORY) -> None:
        self.output_directory = Path(output_directory)
        #frame processing and HTTP save requests can run on different threads
        self._lock = RLock()
        self._exercise: str | None = None
        self._set_date: str | None = None
        self._set_number: int | None = None
        self._set_has_saved_rep = False
        self._recording_timestamp_id: str | None = None
        #holds the accepted poses in memory until count rep saves them
        self._samples: dict[str, list[str]] = {}
        #last accepted positions and times used for movement and velocity
        self._previous_positions: dict[int, Position3D] = {}
        self._previous_times: dict[int, float] = {}
        self._frame_count = 0
        #only files saved in the current set can be removed with undo
        self._saved_paths: list[Path] = []


    def exercise(self) -> str | None:
        with self._lock:
            return self._exercise

    def start(self, exercise: str) -> None:
        #starts new unsaved rep removing any unfinished rep
        with self._lock:
            safe_name = safe_exercise_name(exercise)
            #UTC date keeps folder names consistent even if the timezone changes
            set_date = datetime.now(timezone.utc).date().isoformat()
            #repeats for the same excersise keep the current set number
            if (
                safe_name != self._exercise
                or self._set_number is None
                or self._set_date != set_date
            ):
                #new exercise or date checks its own folders for the next set
                self._exercise = safe_name
                self._set_date = set_date
                self._set_number = self.next_set_number(safe_name, set_date)
                self._set_has_saved_rep = False
                self._saved_paths = []
            self.reset_samples()

    def record_frame(
        self,
        positions: Mapping[int, Position3D],
        *,
        timestamp_id: str | None = None,
        monotonic_time: float | None = None,
    ) -> bool:
        #appends frames only after the tracked landmark passes the 10% threshold
        with self._lock:
            if self._exercise is None:
                return False

            frame_timestamp = timestamp_id or sortable_timestamp_id()
            #UTC ID for sorting, monotonic time measures velocity
            sample_time = monotonic_time if monotonic_time is not None else monotonic()
            #ignores any landmarks outside the body points we are tracking
            tracked_positions = {
                index: positions[index]
                for index in TRACKED_LANDMARK_INDEXES
                if index in positions
            }

            if not self._previous_positions:
                #the first visible pose is discarded 
                self._previous_positions = tracked_positions
                self._previous_times = {
                    index: sample_time for index in tracked_positions
                }
                return False

            if not has_significant_movement(
                tracked_positions,
                self._previous_positions,
            ):
                #new visible landmarks need a new basline but exsisting landmarks are fixed so smaller movements can build up to the 10% 
                for index, position in tracked_positions.items():
                    if index not in self._previous_positions:
                        self._previous_positions[index] = position
                        self._previous_times[index] = sample_time
                return False

            #landmark crossing the threshold keeps the whole pose uses all 14 names and -1 incase it couldnt find all points
            for index, name in TRACKED_LANDMARK_NAMES.items():
                position = tracked_positions.get(index)
                previous_position = self._previous_positions.get(index)
                previous_time = self._previous_times.get(index)
                #time since this landmark was last used as a reference
                elapsed = (
                    sample_time - previous_time
                    if previous_time is not None
                    else None
                )
                stored_position, direction, velocity = calculate_motion_vectors(
                    position,
                    previous_position,
                    elapsed,
                )
                #each landmark gets its own list of time stamped movement samples
                self._samples.setdefault(name, []).append(
                    format_motion_sample(
                        frame_timestamp,
                        stored_position,
                        direction,
                        velocity,
                    )
                )

            #accepted pose becomes the reference for the next movement check
            self._previous_positions = tracked_positions
            self._previous_times = {
                index: sample_time for index in tracked_positions
            }
            #counts accetped poses not landmark vectors
            self._frame_count += 1
            return True

#finish the current rep and save it then move to the next
    def save_rep(self) -> SavedRep:

        with self._lock:
            if self._exercise is None:
                raise ValueError("Start an exercise recording before saving a rep.")
            if self._set_number is None:
                raise ValueError("Start an exercise set before saving a rep.")
            if self._frame_count == 0:
                #counted rep raises error if its an empty JSON this means a pose wasnt met
                raise ValueError("No landmark frames are available for this rep.")

            set_date = datetime.now(timezone.utc).date().isoformat()
            #if midnight passed before saving any reps use the new date
            #a set with saved reps keeps its original date so they stay together
            if not self._set_has_saved_rep and self._set_date != set_date:
                self._set_date = set_date
                self._set_number = self.next_set_number(self._exercise, set_date)

            #example: backend/movement_data/2026-10-19_Push-Up_Set1/Push-Up_Rep1.json.
            #counts existing files to create new files within the same folder
            set_directory = self.output_directory / (
                f"{self._set_date}_{self._exercise}_Set{self._set_number}"
            )
            set_directory.mkdir(parents=True, exist_ok=True)
            rep_number = self.next_rep_number(set_directory, self._exercise)
            destination = set_directory / f"{self._exercise}_Rep{rep_number}.json"
            recording_timestamp = self._recording_timestamp_id or sortable_timestamp_id()
            payload: dict[str, object] = {
                #Rep start ID sorts each one also has a sample frame ID
                "timestamp_id": recording_timestamp,
                "exercise": self._exercise,
                "set_number": self._set_number,
                "rep_number": rep_number,
                "frame_count": self._frame_count,
                "vector_format": VECTOR_FORMAT,
            }
            #metadata shares the JSON root with landmark-name -> sample-list keys.
            payload.update(self._samples)

            #finish writing before clearing samples so a failed save can be retried
            self.full_json_write(destination, payload)
            saved = SavedRep(
                exercise=self._exercise,
                set_number=self._set_number,
                rep_number=rep_number,
                timestamp_id=recording_timestamp,
                frame_count=self._frame_count,
                path=destination,
            )
            self._saved_paths.append(destination)
            self._set_has_saved_rep = True
            #successful write resets the basline the following pose is the baseline 
            self.reset_samples()
            return saved

#close the current active set and return the next set number
    def finish_set(self) -> int:
        with self._lock:
            if self._exercise is None or self._set_number is None:
                raise ValueError("Start an exercise set before finishing it.")
            if not self._set_has_saved_rep:
                raise ValueError("Save at least one rep before finishing the set.")

            #finishing a set resets unfinished samples and makes the next rep in a new folder
            set_date = datetime.now(timezone.utc).date().isoformat()
            #same date moves up a set, new date starts at one unless folders exist
            self._set_number = max(
                self._set_number + 1 if self._set_date == set_date else 1,
                self.next_set_number(self._exercise, set_date),
            )
            self._set_date = set_date
            self._set_has_saved_rep = False
            self._saved_paths = []
            self.reset_samples()
            return self._set_number
#removes the most recent rep created
    def undo_last_rep(self) -> str:

        with self._lock:
            if not self._saved_paths:
                raise ValueError("There is no saved rep to undo.")
            #undo is limited to a file saved by the session in the current set cannot restore anything only remove
            saved_path = self._saved_paths.pop()
            saved_path.unlink(missing_ok=True)
            self._set_has_saved_rep = any(
                saved_path.parent.glob(f"{self._exercise}_Rep*.json")
            )
            #only removes the folder if undo left it completely empty
            if not self._set_has_saved_rep:
                try:
                    saved_path.parent.rmdir()
                except OSError:
                    pass
            return saved_path.name

    def reset_samples(self) -> None:
        #clears the partial rep but keeps the selected exercise date and set
        self._recording_timestamp_id = sortable_timestamp_id()
        self._samples = {}
        self._previous_positions = {}
        self._previous_times = {}
        self._frame_count = 0

    def next_set_number(self, exercise: str, set_date: str) -> int:
        #only checks folders for this date and exercise, older dates dont count
        prefix = f"{set_date}_{exercise}_Set"
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
        set_numbers = (
            int(match.group(1))
            for path in self.output_directory.glob(f"{prefix}*")
            if path.is_dir() and (match := pattern.fullmatch(path.name))
        )
        #highest existing set plus one, or set one if nothing matched
        return max(set_numbers, default=0) + 1


    @staticmethod
    def next_rep_number(set_directory: Path, exercise: str) -> int:
        #uses the highest rep number so gaps dont cause existing files to be replaced
        pattern = re.compile(rf"^{re.escape(exercise)}_Rep(\d+)\.json$")
        rep_numbers = (
            int(match.group(1))
            for path in set_directory.glob(f"{exercise}_Rep*.json")
            if (match := pattern.fullmatch(path.name))
        )
        return max(rep_numbers, default=0) + 1


    @staticmethod
    def full_json_write(destination: Path, payload: Mapping[str, object]) -> None:
        temporary_path: Path | None = None
        try:

            #temp file is kept beside the destination
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=destination.parent,
                prefix=f".{destination.stem}-",
                suffix=".tmp",
                delete=False,
            ) as temporary_file:
                temporary_path = Path(temporary_file.name)
                json.dump(payload, temporary_file, indent=2)
                temporary_file.write("\n")
                #flush the full JSON before making the final filename visible.
                temporary_file.flush()
                os.fsync(temporary_file.fileno())
            #final filename appears after the full JSON has been written
            os.replace(temporary_path, destination)
            temporary_path = None
        finally:
            #removes the temporary file if saving failed before the replace
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

#keeps the independent vector recorders for the camera thats connected
class MovementRecorderRegistry:

    def __init__(self, output_directory: Path = DEFAULT_VECTOR_DIRECTORY) -> None:
        self.output_directory = Path(output_directory)
        self._lock = RLock()
        self.recorders: dict[str, MovementVectorRecorder] = {}

    def recorder(self, camera_id: str) -> MovementVectorRecorder:
        with self._lock:
            #reuses the cameras recorder so requests share the same partial rep
            return self.recorders.setdefault(
                camera_id,
                MovementVectorRecorder(self.output_directory),
            )

    def start(self, camera_id: str, exercise: str) -> None:
        self.recorder(camera_id).start(exercise)

    def record_frame(
        self,
        camera_id: str,
        positions: Mapping[int, Position3D],
    ) -> bool:
        return self.recorder(camera_id).record_frame(positions)

    def save_rep(self, camera_id: str) -> SavedRep:
        #prevents two cameras from choosing the same excersise/rep filename at the same time needed for testing consistency without needing 5 horus of free time
        with self._lock:
            return self.recorder(camera_id).save_rep()

    def finish_set(self, camera_id: str) -> int:
        return self.recorder(camera_id).finish_set()

    def undo_last_rep(self, camera_id: str) -> str:
        return self.recorder(camera_id).undo_last_rep()


movement_recorders = MovementRecorderRegistry()
