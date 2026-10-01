/**
 * Sparkline
 * ---------------------------------------------------------------------------
 * Minimal line + gradient-fill area chart drawn as raw SVG (no charting
 * library). Used by TrainingLoad, but generic enough to reuse anywhere a
 * small trend line is needed.
 *
 * Scales `points` to fit the given width/height, draws a smoothed-looking
 * line through them, fills the area beneath it with a fading gradient, and
 * marks the last point with a dot. Line/fill color comes from the
 * `--macro-carbs` CSS variable defined in HomePage.css.
 *
 * @param {Object} props
 * @param {number[]} props.points - Y values to plot, left to right, evenly
 *   spaced along the x-axis. Needs at least 2 points.
 * @param {number} [props.width=460] - SVG viewBox width in px.
 * @param {number} [props.height=110] - SVG viewBox height in px.
 */

export default function Sparkline({ points, width = 460, height = 110 }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * (height - 16) - 8;
    return [x, y];
  });

  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--macro-carbs)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--macro-carbs)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#loadFill)" stroke="none" />
      <path d={linePath} fill="none" stroke="var(--macro-carbs)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="4.5" fill="var(--macro-carbs)" />
    </svg>
  );
}
