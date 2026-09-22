const BEST_THIS_WEEK = [
  { rank: 1, title: "Bench press", subtitle: "Personal best", value: "145 lb" },
  { rank: 2, title: "Back squat", subtitle: "Best form score", value: "94%" },
  { rank: 3, title: "Plank", subtitle: "Longest hold", value: "1:42" },
];

/**
 * BestThisWeek
 * ---------------------------------------------------------------------------
 * Side-column card listing the top 3 personal records/highlights for the
 * current week, ranked 1–3.
 *
 * Data source: BEST_THIS_WEEK is mock. Replace with GET /api/records/week,
 * an array of up to 3 `{ title, subtitle, value }` records sorted by rank.
 *
 * Props: none.
 */

export default function BestThisWeek() {
  // TODO(api): replace with GET /api/records/week
  return (
    <section className="card card--tint-green">
      <div className="card-header">
        <h3>This week's best</h3>
        <span className="tag">Top 3</span>
      </div>
      <ul className="best-list">
        {BEST_THIS_WEEK.map((b) => (
          <li className="best-item" key={b.rank}>
            <span className="best-rank">{b.rank}</span>
            <span className="best-text">
              <span className="best-title">{b.title}</span>
              <span className="best-subtitle">{b.subtitle}</span>
            </span>
            <span className="best-value">{b.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
