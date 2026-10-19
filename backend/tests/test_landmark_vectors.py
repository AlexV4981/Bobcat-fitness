import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from app.services.LandMarkVectors import (
    MISSING_VECTOR,
    MOVEMENT_THRESHOLD,
    TRACKED_LANDMARK_NAMES,
    VECTOR_FORMAT,
    calculate_motion_vectors,
    format_motion_sample,
    has_significant_movement,
)
from app.services.movement_recorder import MovementVectorRecorder, safe_exercise_name


#cover the animation export; temporary folders keep test recordings
#separate from backend/movement_data and remove them when each test finishes.
class LandmarkVectorTests(unittest.TestCase):
    def setUp(self) -> None:
        clock_patch = patch("app.services.movement_recorder.datetime", wraps=datetime)
        self.clock = clock_patch.start()
        self.addCleanup(clock_patch.stop)
        self.clock.now.return_value = datetime(2026, 10, 19, tzinfo=timezone.utc)

    def test_tracks_only_body_connection_landmarks(self) -> None:
        self.assertEqual(
            TRACKED_LANDMARK_NAMES,
            {
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
            },
        )

    def test_calculates_position_direction_and_velocity(self) -> None:
        position, direction, velocity = calculate_motion_vectors(
            (3.0, 4.0, 0.0),
            (0.0, 0.0, 0.0),
            2.0,
        )

        self.assertEqual(position, (3.0, 4.0, 0.0))
        self.assertEqual(direction, (0.6, 0.8, 0.0))
        self.assertEqual(velocity, (1.5, 2.0, 0.0))

    def test_significant_movement_requires_ten_percent_displacement(self) -> None:
        reference = {11: (0.1, 0.2, 0.3)}

        self.assertFalse(
            has_significant_movement({11: (0.19, 0.2, 0.3)}, reference)
        )
        self.assertTrue(
            has_significant_movement(
                {11: (0.1 + MOVEMENT_THRESHOLD, 0.2, 0.3)},
                reference,
            )
        )

    def test_rep_without_ten_percent_movement_is_not_saved(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            recorder = MovementVectorRecorder(Path(directory))
            recorder.start("Squat")

            self.assertFalse(
                recorder.record_frame(
                    {11: (0.1, 0.2, 0.3)},
                    timestamp_id="20261017T100000.000000Z",
                    monotonic_time=10.0,
                )
            )
            self.assertFalse(
                recorder.record_frame(
                    {11: (0.19, 0.2, 0.3)},
                    timestamp_id="20261017T100000.100000Z",
                    monotonic_time=10.1,
                )
            )

            with self.assertRaisesRegex(ValueError, "No landmark frames"):
                recorder.save_rep()
            with self.assertRaisesRegex(ValueError, "Save at least one rep"):
                recorder.finish_set()
            self.assertEqual(list(Path(directory).glob("*.json")), [])

    def test_missing_landmark_uses_negative_one_for_every_vector(self) -> None:
        vectors = calculate_motion_vectors(None, (0.0, 0.0, 0.0), 0.1)

        self.assertEqual(vectors, (MISSING_VECTOR, MISSING_VECTOR, MISSING_VECTOR))
        sample = format_motion_sample("frame-1", *vectors)
        self.assertEqual(sample, "frame-1|(-1,-1,-1)|(-1,-1,-1)|(-1,-1,-1)")

    def test_exercise_names_cannot_escape_the_output_directory(self) -> None:
        self.assertEqual(safe_exercise_name("../Push up"), "Push_up")
        with self.assertRaises(ValueError):
            safe_exercise_name("../")

    def test_saves_landmark_keyed_pipe_delimited_json_per_rep(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            recorder = MovementVectorRecorder(Path(directory))
            recorder.start("Squat")
            # Baseline -> sub-threshold step -> accepted pose. The first two
            # observations must not appear as samples in the saved rep.
            self.assertFalse(recorder.record_frame(
                {
                    0: (0.4, 0.1, 0.0),  # nose: deliberately ignored
                    11: (0.1, 0.2, 0.3),
                    17: (0.2, 0.3, 0.4),  # pinky: deliberately ignored
                    29: (0.3, 0.4, 0.5),  # heel: deliberately ignored
                },
                timestamp_id="20261017T100000.000000Z",
                monotonic_time=10.0,
            ))
            self.assertFalse(recorder.record_frame(
                {11: (0.16, 0.2, 0.3)},
                timestamp_id="20261017T100000.050000Z",
                monotonic_time=10.05,
            ))
            self.assertTrue(recorder.record_frame(
                {11: (0.21, 0.2, 0.3)},
                timestamp_id="20261017T100000.100000Z",
                monotonic_time=10.1,
            ))

            saved = recorder.save_rep()
            payload = json.loads(saved.path.read_text(encoding="utf-8"))

            self.assertEqual(saved.path.name, "Squat_Rep1.json")
            self.assertEqual(saved.path.parent.name, "2026-10-19_Squat_Set1")
            self.assertEqual(saved.set_number, 1)
            self.assertEqual(payload["vector_format"], VECTOR_FORMAT)
            self.assertEqual(payload["set_number"], 1)
            self.assertEqual(payload["frame_count"], 1)
            self.assertIn("timestamp_id", payload)
            self.assertEqual(len(payload["LEFT_SHOULDER"]), 1)
            self.assertEqual(
                set(payload) - {
                    "timestamp_id",
                    "exercise",
                    "set_number",
                    "rep_number",
                    "frame_count",
                    "vector_format",
                },
                set(TRACKED_LANDMARK_NAMES.values()),
            )
            self.assertNotIn("NOSE", payload)
            self.assertNotIn("LEFT_PINKY", payload)
            self.assertNotIn("LEFT_HEEL", payload)
            self.assertEqual(
                payload["RIGHT_SHOULDER"][0],
                "20261017T100000.100000Z|(-1,-1,-1)|(-1,-1,-1)|(-1,-1,-1)",
            )
            self.assertEqual(len(payload["LEFT_SHOULDER"][0].split("|")), 4)
            self.assertEqual(
                payload["LEFT_SHOULDER"][0],
                "20261017T100000.100000Z|(0.21,0.2,0.3)|(1,0,0)|(1.1,0,0)",
            )
            self.assertEqual(list(Path(directory).glob("*.tmp")), [])

            # The camera opens a WebSocket and calls the start endpoint, so a
            # duplicate start for the same exercise must preserve the set.
            recorder.start("Squat")
            self.assertFalse(recorder.record_frame(
                {11: (0.3, 0.2, 0.3)},
                timestamp_id="20261017T100001.000000Z",
                monotonic_time=11.0,
            ))
            self.assertTrue(recorder.record_frame(
                {11: (0.41, 0.2, 0.3)},
                timestamp_id="20261017T100001.100000Z",
                monotonic_time=11.1,
            ))
            second_rep = recorder.save_rep()
            self.assertEqual(second_rep.path.name, "Squat_Rep2.json")
            self.assertEqual(second_rep.path.parent.name, "2026-10-19_Squat_Set1")
            self.assertEqual(recorder.undo_last_rep(), "Squat_Rep2.json")
            self.assertFalse(second_rep.path.exists())

            self.assertEqual(recorder.finish_set(), 2)
            self.assertFalse(recorder.record_frame(
                {11: (0.5, 0.2, 0.3)},
                timestamp_id="20261017T100002.000000Z",
                monotonic_time=12.0,
            ))
            self.assertTrue(recorder.record_frame(
                {11: (0.61, 0.2, 0.3)},
                timestamp_id="20261017T100002.100000Z",
                monotonic_time=12.1,
            ))
            next_set_rep = recorder.save_rep()
            self.assertEqual(next_set_rep.path.name, "Squat_Rep1.json")
            self.assertEqual(next_set_rep.path.parent.name, "2026-10-19_Squat_Set2")
            self.assertEqual(next_set_rep.set_number, 2)

    def test_set_crossing_midnight_keeps_reps_together_then_resets_number(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output_directory = Path(directory)
            recorder = MovementVectorRecorder(output_directory)
            recorder.start("Push-Up")
            recorder.record_frame({11: (0.1, 0.2, 0.3)})
            recorder.record_frame({11: (0.3, 0.2, 0.3)})
            first_rep = recorder.save_rep()

            self.clock.now.return_value = datetime(2026, 10, 20, tzinfo=timezone.utc)
            recorder.record_frame({11: (0.1, 0.2, 0.3)})
            recorder.record_frame({11: (0.3, 0.2, 0.3)})
            second_rep = recorder.save_rep()
            self.assertEqual(second_rep.path.parent, first_rep.path.parent)
            self.assertEqual(second_rep.path.name, "Push-Up_Rep2.json")
            self.assertEqual(recorder.undo_last_rep(), "Push-Up_Rep2.json")
            self.assertTrue(first_rep.path.exists())
            self.assertFalse(second_rep.path.exists())

            self.assertEqual(recorder.finish_set(), 1)
            recorder.record_frame({11: (0.1, 0.2, 0.3)})
            recorder.record_frame({11: (0.3, 0.2, 0.3)})
            next_day_rep = recorder.save_rep()
            self.assertEqual(next_day_rep.path.parent.name, "2026-10-20_Push-Up_Set1")
            self.assertEqual(next_day_rep.path.name, "Push-Up_Rep1.json")
            self.assertEqual(next_day_rep.set_number, 1)

    def test_unsaved_set_uses_date_of_first_save(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output_directory = Path(directory)
            (output_directory / "2026-10-19_Push-Up_Set5").mkdir()
            recorder = MovementVectorRecorder(output_directory)
            recorder.start("Push-Up")
            recorder.record_frame({11: (0.1, 0.2, 0.3)})
            recorder.record_frame({11: (0.3, 0.2, 0.3)})

            self.clock.now.return_value = datetime(2026, 10, 20, tzinfo=timezone.utc)
            saved = recorder.save_rep()

            self.assertEqual(saved.path.parent.name, "2026-10-20_Push-Up_Set1")
            self.assertEqual(saved.path.name, "Push-Up_Rep1.json")
            self.assertFalse((output_directory / "2026-10-19_Push-Up_Set6").exists())

    def test_restart_on_new_date_uses_that_dates_existing_sets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output_directory = Path(directory)
            (output_directory / "2026-10-20_Push-Up_Set1").mkdir()
            recorder = MovementVectorRecorder(output_directory)
            recorder.start("Push-Up")
            recorder.record_frame({11: (0.1, 0.2, 0.3)})
            recorder.record_frame({11: (0.3, 0.2, 0.3)})
            previous_day_rep = recorder.save_rep()

            self.clock.now.return_value = datetime(2026, 10, 20, tzinfo=timezone.utc)
            recorder.start("Push-Up")
            recorder.record_frame({11: (0.1, 0.2, 0.3)})
            recorder.record_frame({11: (0.3, 0.2, 0.3)})
            saved = recorder.save_rep()

            self.assertEqual(saved.path.parent.name, "2026-10-20_Push-Up_Set2")
            self.assertEqual(saved.path.name, "Push-Up_Rep1.json")
            self.assertTrue(previous_day_rep.path.exists())

    def test_new_recorder_uses_next_available_set_folder(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output_directory = Path(directory)
            (output_directory / "2026-10-19_Push-Up_Set1").mkdir()
            (output_directory / "2026-10-19_Push-Up_Set2").mkdir()
            (output_directory / "2026-10-18_Push-Up_Set9").mkdir()
            (output_directory / "2026-10-19_Squat_Set8").mkdir()
            (output_directory / "Push-Up_Set12").mkdir()
            recorder = MovementVectorRecorder(output_directory)
            recorder.start("Push-Up")
            recorder.record_frame(
                {11: (0.1, 0.2, 0.3)},
                monotonic_time=10.0,
            )
            recorder.record_frame(
                {11: (0.21, 0.2, 0.3)},
                monotonic_time=10.1,
            )

            saved = recorder.save_rep()

            self.assertEqual(saved.path.parent.name, "2026-10-19_Push-Up_Set3")
            self.assertEqual(saved.path.name, "Push-Up_Rep1.json")


if __name__ == "__main__":
    unittest.main()
