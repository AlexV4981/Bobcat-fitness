import NavIcon from "./NavIcon";

/**
 * Sidebar
 * ---------------------------------------------------------------------------
 * Fixed left navigation rail: avatar, 4-item nav (home/workouts/nutrition/
 * profile), and the day-streak counter pinned to the bottom. Collapses to a
 * horizontal top bar under 720px (see .sidebar media query in HomePage.css).
 *
 * Data source: `activeNav` is local UI state, not app data — swap it for
 * real routing (e.g. react-router's `useLocation`) once pages exist for
 * each nav item. The streak count ("7") is mock; replace with
 * GET /api/streak.
 *
 * Props: none.
 */

const NAV_ITEMS = [
  { key: "home",      label: "Home",      icon: "home" },
  { key: "camera",    label: "Camera",    icon: "camera" },
  { key: "workouts",  label: "Workouts",  icon: "workouts" },
  { key: "exercises", label: "Exercises", icon: "exercises" },
  { key: "AI Dieting", label: "AI Diet",  icon: "nutrition" },
  { key: "about-us",  label: "About-us",  icon: "about-us" },
  { key: "profile",   label: "Profile",   icon: "profile" },
];

export default function Sidebar({ activePage = "home", onNavigate, onLogout }) {
  const handleClick = (item) => {
    if (NAV_ITEMS.includes(item)) onNavigate?.(item);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-avatar" aria-hidden="true">NH</div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`sidebar-nav-item ${activePage === key ? "is-active" : ""}`}
            onClick={() => onNavigate?.(key)}
          >
            <span className="sidebar-nav-icon"><NavIcon name={icon} /></span>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-streak">
        <span className="sidebar-streak-count">7</span>
        <span className="sidebar-streak-label">day streak</span>
      </div>
    </aside>
  );
}