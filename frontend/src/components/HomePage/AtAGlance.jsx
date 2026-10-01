/**
 * AtAGlance
 * ---------------------------------------------------------------------------
 * Three-stat summary row (workouts completed, total reps, form score) plus a
 * "Synced today" status pill.
 *
 * Data source: all three stats and the sync status are mock. Replace with
 * GET /api/stats/summary; the "+N this week" / "On track" notes should come
 * from the same payload (e.g. a `delta` field per stat).
 *
 * Props: none.
 */

export default function AtAGlance() {
  // TODO(api): replace with GET /api/stats/summary
  return (
    <section className="card">
      <div className="card-header">
        <h3>At a glance</h3>
        <span className="sync-pill"><span className="sync-dot" /> Synced today</span>
      </div>
      <div className="glance-grid">
        <div className="glance-item">
          <p className="glance-label">Workouts</p>
          <p className="glance-value">4 / 5</p>
          <p className="glance-note">On track</p>
        </div>
        <div className="glance-item">
          <p className="glance-label">Total reps</p>
          <p className="glance-value">286</p>
          <p className="glance-note glance-note--up">+32 this week</p>
        </div>
        <div className="glance-item">
          <p className="glance-label">Form score</p>
          <p className="glance-value">88%</p>
          <p className="glance-note glance-note--up">+6 points</p>
        </div>
      </div>
    </section>
  );
}
