const WEEK = [
  { label: "MON", date: 14, state: "done" },
  { label: "TUE", date: 15, state: "today" },
  { label: "WED", date: 16, state: "upcoming" },
  { label: "THU", date: 17, state: "upcoming" },
  { label: "FRI", date: 18, state: "upcoming" },
  { label: "SAT", date: 19, state: "upcoming" },
  { label: "SUN", date: 20, state: "upcoming" },
];

/**
 * WorkoutHero
 * ---------------------------------------------------------------------------
 * The large dark "Today's workout" card: workout name, meta stats (duration/
 * intensity/calorie estimate), a Start workout CTA, and the 7-day strip
 * showing which days are done/today/upcoming.
 *
 * Data source: WEEK and the workout details (name, exercise count, duration,
 * intensity, calorie estimate) are mock. Replace with
 * GET /api/workouts/week, and wire the Start workout button to whatever
 * kicks off a workout session.
 *
 * `state` per day is one of "done" | "today" | "upcoming" and drives the
 * `.week-day--<state>` class (see HomePage.css) plus the checkmark/"Today"
 * label.
 *
 * Props: none.
 */

export default function WorkoutHero() {
  // TODO(api): replace WEEK and the workout details with GET /api/workouts/week
  return (
    <section className="card hero">
      <div className="hero-top">
        <div>
          <p className="hero-eyebrow">Today's workout</p>
          <h2 className="hero-title">Lower body strength</h2>
          <p className="hero-meta">5 exercises · AI form coaching enabled</p>
        </div>
        <button type="button" className="btn-primary">Start workout →</button>
      </div>

      <div className="hero-stats">
        <span>⏱ 48 min</span>
        <span>◎ Moderate</span>
        <span>⚡ 410 kcal est.</span>
      </div>

      <div className="week-strip">
        {WEEK.map((d) => (
          <div key={d.label} className={`week-day week-day--${d.state}`}>
            <span className="week-day-label">{d.label}</span>
            <span className="week-day-date">{d.date}</span>
            {d.state === "done" && <span className="week-day-check">✓</span>}
            {d.state === "today" && <span className="week-day-today">Today</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
