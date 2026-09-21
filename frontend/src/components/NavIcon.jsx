/**
 * NavIcon
 * ---------------------------------------------------------------------------
 * Renders one inline SVG icon for the Sidebar nav (home / workouts /
 * nutrition / profile). Kept as a lookup table + single <svg> wrapper so
 * every icon shares stroke width, caps, and color (`currentColor`, so it
 * inherits text color from its parent button).
 *
 * @param {Object} props
 * @param {"home"|"workouts"|"nutrition"|"profile"} props.name - Which icon
 *   to render. Must be a key of ICON_PATHS below.
 */

const ICON_PATHS = {
  home: (
    <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5a.5.5 0 0 1-.5-.5V15a2 2 0 0 0-4 0v4.5a.5.5 0 0 1-.5.5H5a1 1 0 0 1-1-1v-7.5Z" />
  ),
  workouts: (
    <path d="M6.5 8v8M4 10v4M17.5 8v8M20 10v4M8.5 12h7" />
  ),
  nutrition: (
    <path d="M12 3c-2.5 2-2.5 5-1 6.5S14 12 14 15a4 4 0 0 1-8 0c0-2 1-3 1-3M18 3s1 2-1 4" />
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" />
    </>
  ),
};

export default function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}
