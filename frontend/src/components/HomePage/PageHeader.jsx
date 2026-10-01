/**
 * PageHeader
 * ---------------------------------------------------------------------------
 * Top-of-page greeting ("Ready for leg day, {userName}?") plus the date
 * label and the This week ←/→ navigator pill.
 *
 * Data source: the date string is hardcoded. Replace with a real
 * formatted date (e.g. from `new Date()` or the server clock), and wire the
 * ←/→ buttons to whatever changes the week's data once that's dynamic.
 *
 * @param {Object} props
 * @param {string} [props.userName="there"] - Name shown in the greeting.
 */

export default function PageHeader({ userName = "there" }) {
  // TODO(api): derive the date string and greeting from the server/local clock
  return (
    <header className="page-header">
      <div>
        <p className="page-header-date">Tuesday, September 15</p>
        <h1 className="page-header-title">Ready for leg day, {userName}?</h1>
      </div>
      <div className="week-nav">
        <button type="button" className="week-nav-btn" aria-label="Previous week">←</button>
        <span>This week</span>
        <button type="button" className="week-nav-btn" aria-label="Next week">→</button>
      </div>
    </header>
  );
}
