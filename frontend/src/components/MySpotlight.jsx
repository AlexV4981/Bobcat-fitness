import { useState } from "react";

/**
 * MySpotlight
 * ---------------------------------------------------------------------------
 * Side-column card letting the user pick which stat to "spotlight" from a
 * dropdown, then displays that stat's headline value plus a small bar
 * sparkline.
 *
 * Data source: the dropdown options are mock; the displayed value ("7",
 * "day streak") and bar heights are currently hardcoded and do NOT yet
 * change when `spotlightStat` changes. When wiring to the API
 * (e.g. GET /api/stats/spotlight?stat=<key>), fetch and re-render the
 * value/bars whenever `spotlightStat` changes.
 *
 * Props: none.
 */

export default function MySpotlight() {
  // TODO(api): swap the displayed value/bars based on GET /api/stats/spotlight?stat=
  const [spotlightStat, setSpotlightStat] = useState("streak");

  return (
    <section className="card card--tint-blue">
      <h3>My spotlight</h3>
      <label className="spotlight-label" htmlFor="spotlight-select">Choose a stat</label>
      <select
        id="spotlight-select"
        className="spotlight-select"
        value={spotlightStat}
        onChange={(e) => setSpotlightStat(e.target.value)}
      >
        <option value="streak">Workout streak</option>
        <option value="pr">Recent PR</option>
        <option value="consistency">Consistency</option>
      </select>
      <div className="spotlight-body">
        <div>
          <p className="spotlight-value">7</p>
          <p className="spotlight-caption">day streak</p>
        </div>
        <svg className="spotlight-bars" viewBox="0 0 60 40" aria-hidden="true">
          {[14, 20, 24, 30, 34, 40].map((h, i) => (
            <rect key={i} x={i * 10} y={40 - h} width="6" height={h} rx="2" fill="var(--macro-protein)" />
          ))}
        </svg>
      </div>
    </section>
  );
}
