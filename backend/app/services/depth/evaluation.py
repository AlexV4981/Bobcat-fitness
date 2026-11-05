"""Report observed angle stability separately from reference accuracy.

Use stationary clips for jitter and independently measured angles for accuracy.
These metrics do not establish true depth accuracy without reference data.
"""

from dataclasses import dataclass
import math
import statistics
from typing import Sequence


@dataclass(frozen=True)
class AngleReport:
    """Degrees, plus coverage so dropping all bad frames cannot look perfect."""

    total_frames: int
    valid_frames: int
    valid_fraction: float
    median_degrees: float | None
    jitter_p95_degrees: float | None
    reference_error_p95_degrees: float | None


def _percentile95(values: list[float]) -> float | None:
    """Nearest-rank percentile, defined even for a single valid observation."""
    return sorted(values)[math.ceil(0.95 * len(values)) - 1] if values else None


def evaluate_angles(
    measured: Sequence[float | None],
    reference: Sequence[float | None] | None = None,
) -> AngleReport:
    """Summarize finite 0..180 degree observations and optional aligned truth.

    Jitter is distance from the clip median, meaningful for stationary clips.
    Reference error is absolute paired error, meaningful for moving clips too.
    Invalid reference samples are skipped rather than interpreted as angles.
    """
    if reference is not None and len(reference) != len(measured):
        raise ValueError("Reference and measured angles must have equal lengths.")

    def valid(angle: float | None) -> bool:
        return angle is not None and math.isfinite(angle) and 0 <= angle <= 180

    values = [angle for angle in measured if valid(angle)]
    median = statistics.median(values) if values else None
    errors = [] if reference is None else [
        abs(angle - truth)
        for angle, truth in zip(measured, reference, strict=True)
        if valid(angle) and valid(truth)
    ]
    return AngleReport(
        total_frames=len(measured), valid_frames=len(values),
        valid_fraction=len(values) / len(measured) if measured else 0.0,
        median_degrees=median,
        jitter_p95_degrees=_percentile95([abs(angle - median) for angle in values]),
        reference_error_p95_degrees=_percentile95(errors),
    )
