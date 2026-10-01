import Sparkline from "./Sparkline";

const TRAINING_LOAD = [18, 22, 24, 27, 33, 38, 40, 41, 44, 47, 50, 49, 52, 58];

/**
 * TrainingLoad
 * ---------------------------------------------------------------------------
 * Side-column card showing a 4-week training-load trend, rendered with the
 * Sparkline component, plus week-start date labels along the bottom.
 *
 * Data source: TRAINING_LOAD is mock (14 points ≈ one every ~2 days over 4
 * weeks). Replace with GET /api/stats/training-load?weeks=4, and update the
 * hardcoded axis labels ("Aug 24" etc.) to match the returned date range.
 *
 * Props: none.
 */

export default function TrainingLoad() {
  // TODO(api): replace TRAINING_LOAD with GET /api/stats/training-load?weeks=4
  return (
    <section className="card card--tint-amber">
      <div className="card-header">
        <h3>Training load</h3>
        <span className="tag">4 weeks</span>
      </div>
      <Sparkline points={TRAINING_LOAD} />
      <div className="sparkline-axis">
        <span>Aug 24</span>
        <span>Aug 31</span>
        <span>Sep 7</span>
        <span>Sep 14</span>
      </div>
    </section>
  );
}
