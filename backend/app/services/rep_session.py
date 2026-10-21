"""Per-camera rep counting sessions, kept in memory (like camera_stream)."""

from threading import Lock
from typing import Optional, Sequence

from app.Webcam_utilities.rep_counter import Landmark, RepCounter

DEFAULT_EXERCISE = "Push-up"


class RepSessionStore:
    """One RepCounter per camera id.

    Exercises the counter does not know (the websocket defaults to "Exercise")
    are tolerated: that camera simply is not auto-counted until a supported
    exercise is selected.
    """

    def __init__(self) -> None:
        self._counters: dict[str, RepCounter] = {}
        self._unsupported: dict[str, str] = {}  # camera_id -> requested name
        self._lock = Lock()

    def _counter(self, camera_id: str) -> Optional[RepCounter]:
        if camera_id in self._unsupported:
            return None
        counter = self._counters.get(camera_id)
        if counter is None:
            counter = self._counters[camera_id] = RepCounter(DEFAULT_EXERCISE)
        return counter

    def _state(self, camera_id: str) -> dict:
        counter = self._counter(camera_id)
        if counter is None:
            return {
                "exercise": self._unsupported[camera_id],
                "reps": 0,
                "phase": "waiting",
                "angle": None,
                "tracking": False,
                "supported": False,
            }
        return {**counter.state(), "supported": True}

    def process(
        self,
        camera_id: str,
        image: Optional[Sequence[Landmark]],
        world: Optional[Sequence[Landmark]],
    ) -> bool:
        """Feed one frame of landmarks. Returns True if a rep was just completed."""
        with self._lock:
            counter = self._counter(camera_id)
            return counter.update(image, world) if counter else False

    def state(self, camera_id: str) -> dict:
        with self._lock:
            return self._state(camera_id)

    def set_exercise(self, camera_id: str, exercise: str) -> dict:
        """Select the exercise to count (resets the count)."""
        with self._lock:
            try:
                counter = self._counters.get(camera_id)
                if counter is None:
                    counter = self._counters[camera_id] = RepCounter(exercise)
                else:
                    counter.set_exercise(exercise)
                self._unsupported.pop(camera_id, None)
            except ValueError:
                self._unsupported[camera_id] = exercise
            return self._state(camera_id)

    def reset(self, camera_id: str) -> dict:
        with self._lock:
            counter = self._counter(camera_id)
            if counter:
                counter.reset()
            return self._state(camera_id)

    def adjust(self, camera_id: str, delta: int) -> dict:
        with self._lock:
            counter = self._counter(camera_id)
            if counter:
                counter.adjust(delta)
            return self._state(camera_id)


rep_sessions = RepSessionStore()
