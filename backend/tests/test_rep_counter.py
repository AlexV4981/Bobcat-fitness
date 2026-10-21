import math
import unittest

from app.services.rep_session import RepSessionStore
from app.Webcam_utilities.rep_counter import (
    EXERCISES,
    Landmark,
    RepCounter,
    get_config,
    joint_angle,
)

HIDDEN = Landmark(0.0, 0.0, 0.0, 0.0)


def pose_with_angle(exercise, angle, a_dir=90.0, body=None):
    """Synthetic 33-landmark pose where the exercise's joint is at ``angle``.

    Joint b sits at (0.5, 0.5); a is 0.2 away in direction ``a_dir`` (degrees,
    image coords so 90 = down, 270 = up); c is ``angle`` degrees round from a.
    ``body`` ("horizontal" / "upright") places the ankles relative to the
    shoulders for the push-up posture gate.
    """
    lms = [HIDDEN] * 33
    for a, b, c in EXERCISES[exercise].joints:
        bx, by = 0.5, 0.5
        ax = bx + 0.2 * math.cos(math.radians(a_dir))
        ay = by + 0.2 * math.sin(math.radians(a_dir))
        cx = bx + 0.2 * math.cos(math.radians(a_dir + angle))
        cy = by + 0.2 * math.sin(math.radians(a_dir + angle))
        lms[a], lms[b], lms[c] = Landmark(ax, ay), Landmark(bx, by), Landmark(cx, cy)
        if body:
            ankle = {11: 27, 12: 28}.get(a)
            if ankle is not None:
                dx, dy = (1.5, 0.0) if body == "horizontal" else (0.0, 1.5)
                lms[ankle] = Landmark(ax + dx, ay + dy)
    return lms


def run_reps(counter, exercise, angles, step=0.1, **pose_kwargs):
    """Feed a list of angles at ``step`` seconds apart; return the final time."""
    t = 0.0
    for angle in angles:
        counter.update(pose_with_angle(exercise, angle, **pose_kwargs), now=t)
        t += step
    return t


def one_rep(start, peak, frames=8):
    down = [start - (start - peak) * i / frames for i in range(frames + 1)]
    return down + down[::-1][1:]


class JointAngleTests(unittest.TestCase):
    def test_right_angle(self):
        self.assertAlmostEqual(joint_angle(Landmark(1, 0), Landmark(0, 0), Landmark(0, 1)), 90.0)

    def test_straight_line(self):
        self.assertAlmostEqual(joint_angle(Landmark(-1, 0), Landmark(0, 0), Landmark(1, 0)), 180.0)

    def test_zero_length_segment(self):
        self.assertIsNone(joint_angle(Landmark(0, 0), Landmark(0, 0), Landmark(1, 0)))


class RepCounterTests(unittest.TestCase):
    def test_counts_full_reps_for_each_exercise(self):
        extra = {"pushup": {"body": "horizontal"}, "pullup": {"a_dir": 90.0}}
        for key, cfg in EXERCISES.items():
            with self.subTest(exercise=cfg.name):
                counter = RepCounter(cfg.name)
                angles = [cfg.start_angle + 15] * 3
                for _ in range(3):
                    angles += one_rep(cfg.start_angle + 15, cfg.peak_angle - 10)
                run_reps(counter, key, angles, **extra.get(key, {}))
                self.assertEqual(counter.count, 3)

    def test_half_rep_is_not_counted(self):
        counter = RepCounter("Squat")
        run_reps(counter, "squat", [170] * 3 + one_rep(170, 125))
        self.assertEqual(counter.count, 0)

    def test_jitter_that_is_too_fast_is_not_counted(self):
        counter = RepCounter("Squat")
        # a full swing in about 0.3s
        run_reps(counter, "squat", [170, 170, 90, 170, 170], step=0.075)
        self.assertEqual(counter.count, 0)

    def test_must_start_from_start_position(self):
        counter = RepCounter("Squat")
        # begins half-way down, so the first "rep" has no valid start
        run_reps(counter, "squat", [120, 95, 95, 120, 130])
        self.assertEqual(counter.count, 0)

    def test_low_visibility_frames_are_ignored(self):
        counter = RepCounter("Squat")
        pose = [lm._replace(visibility=0.1) for lm in pose_with_angle("squat", 170)]
        counter.update(pose, now=0.0)
        self.assertFalse(counter.tracking)

    def test_lost_pose_forgets_rep_in_progress_but_keeps_count(self):
        counter = RepCounter("Squat")
        run_reps(counter, "squat", [170] * 3 + one_rep(170, 90))
        self.assertEqual(counter.count, 1)
        counter.update(pose_with_angle("squat", 170), now=100.0)
        counter.update(pose_with_angle("squat", 120), now=100.1)  # mid rep
        counter.update(None, now=110.0)  # nobody for a long time
        self.assertEqual(counter.phase.value, "waiting")
        self.assertEqual(counter.count, 1)

    def test_pullup_requires_hands_overhead(self):
        counter = RepCounter("Pull-up")
        # arms hanging DOWN from the shoulders (wrists below): e.g. a bicep curl
        angles = [170] * 3 + one_rep(170, 60) * 3
        run_reps(counter, "pullup", angles, a_dir=270.0)
        self.assertEqual(counter.count, 0)
        counter = RepCounter("Pull-up")
        run_reps(counter, "pullup", angles, a_dir=90.0)
        self.assertEqual(counter.count, 3)

    def test_pushup_requires_horizontal_body(self):
        counter = RepCounter("Push-up")
        angles = [165] * 3 + one_rep(165, 80) * 3
        run_reps(counter, "pushup", angles, body="upright")
        self.assertEqual(counter.count, 0)
        counter = RepCounter("Push-up")
        run_reps(counter, "pushup", angles, body="horizontal")
        self.assertEqual(counter.count, 3)

    def test_switching_exercise_resets(self):
        counter = RepCounter("Squat")
        run_reps(counter, "squat", [170] * 3 + one_rep(170, 90))
        counter.set_exercise("sit_up")
        self.assertEqual(counter.count, 0)
        self.assertEqual(counter.config.name, "Sit-up")

    def test_adjust_never_goes_negative(self):
        counter = RepCounter("Squat")
        counter.adjust(-5)
        self.assertEqual(counter.count, 0)
        counter.adjust(2)
        self.assertEqual(counter.count, 2)

    def test_unknown_exercise(self):
        with self.assertRaises(ValueError):
            get_config("deadlift")


class RepSessionStoreTests(unittest.TestCase):
    def test_sessions_are_per_camera(self):
        store = RepSessionStore()
        store.set_exercise("a", "Squat")
        store.adjust("a", 3)
        self.assertEqual(store.state("a")["reps"], 3)
        self.assertEqual(store.state("b")["reps"], 0)
        self.assertEqual(store.state("a")["exercise"], "Squat")

    def test_process_counts_reps(self):
        store = RepSessionStore()
        store.set_exercise("cam", "Squat")
        t_frames = [170] * 3 + one_rep(170, 90)
        # process() uses the real clock, so frames must be spaced out
        import time
        for angle in t_frames:
            store.process("cam", pose_with_angle("squat", angle), None)
            time.sleep(0.01)
        # real-time gap is ~0.2s < min_rep_seconds, so it must not count
        self.assertEqual(store.state("cam")["reps"], 0)

    def test_unsupported_exercise_is_tolerated(self):
        store = RepSessionStore()
        state = store.set_exercise("cam", "Exercise")
        self.assertFalse(state["supported"])
        self.assertFalse(store.process("cam", pose_with_angle("squat", 170), None))
        self.assertEqual(store.set_exercise("cam", "Push-Up")["exercise"], "Push-up")
        self.assertTrue(store.state("cam")["supported"])

    def test_reset(self):
        store = RepSessionStore()
        store.adjust("cam", 4)
        self.assertEqual(store.reset("cam")["reps"], 0)


if __name__ == "__main__":
    unittest.main()
