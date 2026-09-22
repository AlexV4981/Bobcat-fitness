const MACROS = [
  { label: "Protein", value: 117, target: 150, color: "var(--macro-protein)" },
  { label: "Carbs", value: 146, target: 240, color: "var(--macro-carbs)" },
  { label: "Fats", value: 47, target: 65, color: "var(--macro-fats)" },
];

/**
 * Converts a value/max pair into an SVG `stroke-dashoffset` so a ring drawn
 * with `stroke-dasharray={circumference}` appears filled to the right
 * percentage. Values above `max` are clamped to a full ring.
 *
 * @param {number} value - Current amount (e.g. calories eaten).
 * @param {number} max - Goal amount the ring represents 100% as.
 * @param {number} circumference - The ring's circumference (2πr).
 * @returns {number} The dash-offset to apply to the progress circle.
 */


function ringDashOffset(value, max, circumference) {
  const pct = Math.min(value / max, 1);
  return circumference * (1 - pct);
}

/**
 * DailyNutrition
 * ---------------------------------------------------------------------------
 * Calorie progress ring, protein/carbs/fats bars, and a recommended-next-meal
 * suggestion banner.
 *
 * Data source: calorieGoal, calorieCurrent, MACROS, and the suggestion copy
 * are all mock. Replace with GET /api/nutrition/today for the totals, and a
 * recommendation endpoint (e.g. GET /api/nutrition/suggestions) for the
 * banner.
 *
 * Props: none.
 */


export default function DailyNutrition() {
  // TODO(api): replace calorie/macro totals and the suggestion with GET /api/nutrition/today
  const calorieGoal = 2100;
  const calorieCurrent = 1420;
  const circumference = 2 * Math.PI * 54;
  const calorieOffset = ringDashOffset(calorieCurrent, calorieGoal, circumference);

  return (
    <section className="card">
      <div className="card-header">
        <h3>Daily nutrition</h3>
        <a href="#food-log" className="link">View food log</a>
      </div>

      <div className="nutrition-body">
        <div className="calorie-ring">
          <svg viewBox="0 0 120 120" width="132" height="132">
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--ring-track)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={calorieOffset}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="calorie-ring-label">
            <span className="calorie-current">{calorieCurrent.toLocaleString()}</span>
            <span className="calorie-goal">of {calorieGoal.toLocaleString()} kcal</span>
          </div>
        </div>

        <div className="macros">
          {MACROS.map((m) => (
            <div className="macro-row" key={m.label}>
              <span className="macro-label">{m.label}</span>
              <div className="macro-track">
                <div
                  className="macro-fill"
                  style={{ width: `${Math.min((m.value / m.target) * 100, 100)}%`, background: m.color }}
                />
              </div>
              <span className="macro-value">{m.value}/{m.target}g</span>
            </div>
          ))}
        </div>
      </div>

      <div className="suggestion">
        <span className="suggestion-icon" aria-hidden="true">🥗</span>
        <div>
          <p className="suggestion-title">Recommended next: chicken burrito bowl</p>
          <p className="suggestion-meta">High protein, no tomato · 540 kcal · matches your preferences</p>
        </div>
      </div>
    </section>
  );
}
