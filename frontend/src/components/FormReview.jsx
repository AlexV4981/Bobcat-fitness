/**
 * FormReview
 * ---------------------------------------------------------------------------
 * Side-column card comparing last week's vs. this week's exercise-form
 * score, with a placeholder figure panel for each and a coaching note.
 *
 * Data source: both scores (78%/91%), the figures (currently flat-color
 * placeholder blocks via .form-figure--before/--after in HomePage.css), and
 * the coaching note are all mock. Replace with GET /api/form/latest —
 * likely swapping the placeholder `<div>` figures for real pose-estimation
 * snapshots or skeleton renders once that data exists.
 *
 * Props: none.
 */

export default function FormReview() {
  // TODO(api): replace scores/note and swap the figures for real pose snapshots via GET /api/form/latest
  return (
    <section className="card card--tint-peach">
      <div className="card-header">
        <h3>Form review</h3>
        <a href="#form-history" className="link">Full history</a>
      </div>
      <div className="form-compare">
        <div className="form-panel">
          <div className="form-panel-header">
            <span>Last week</span>
            <strong>78%</strong>
          </div>
          <div className="form-figure form-figure--before" aria-hidden="true" />
        </div>
        <div className="form-panel">
          <div className="form-panel-header">
            <span>This week</span>
            <strong>91%</strong>
          </div>
          <div className="form-figure form-figure--after" aria-hidden="true" />
        </div>
      </div>
      <p className="form-note">
        <strong>+13 points.</strong> Your knees stayed aligned over your feet. Keep your chest slightly higher during the final reps.
      </p>
    </section>
  );
}
