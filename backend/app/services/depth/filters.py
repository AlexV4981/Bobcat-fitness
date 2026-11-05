"""Small, causal One Euro filter; no future frames or extra dependencies.

The adaptive cutoff suppresses stationary jitter while following faster motion.
This is a stability tool, not a correction for inaccurate monocular depth.
"""

import math


def _alpha(cutoff: float, elapsed: float) -> float:
    """Convert a cutoff in Hz and an actual frame interval into filter weight."""
    return 1.0 / (1.0 + 1.0 / (2.0 * math.pi * cutoff * elapsed))


class OneEuroFilter:
    """Filter one coordinate using timestamps rather than an assumed FPS.

    Callers validate samples and strictly increasing times before updating.
    Creating a new instance resets both the signal and derivative histories.
    """

    def __init__(self, cutoff: float, beta: float, derivative_cutoff: float) -> None:
        self.cutoff = cutoff
        self.beta = beta
        self.derivative_cutoff = derivative_cutoff
        self._time: float | None = None
        self._raw = self._filtered = self._derivative = 0.0

    def update(self, value: float, timestamp: float) -> float:
        """Return a filtered sample; the first sample establishes the baseline."""
        if self._time is None:
            self._time = timestamp
            self._raw = self._filtered = value
            return value
        elapsed = timestamp - self._time
        if elapsed <= 0:
            raise ValueError("Filter timestamps must increase.")
        derivative = (value - self._raw) / elapsed
        weight = _alpha(self.derivative_cutoff, elapsed)
        self._derivative += weight * (derivative - self._derivative)
        cutoff = self.cutoff + self.beta * abs(self._derivative)
        self._filtered += _alpha(cutoff, elapsed) * (value - self._filtered)
        self._raw, self._time = value, timestamp
        return self._filtered
