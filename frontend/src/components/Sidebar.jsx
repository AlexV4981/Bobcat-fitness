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

//const NAV_ITEMS = ["home", "workouts", "nutrition", "profile"];

// Only these have real pages so far; the rest are ignored for now
const AVAILABLE_PAGES = ["home", "profile"];

export default function Sidebar({ activePage = "home", onNavigate, onLogout }) {
  const handleClick = (item) => {
    if (AVAILABLE_PAGES.includes(item)) onNavigate?.(item);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-avatar" aria-hidden="true">NH</div>

      <nav className="sidebar-nav">
        {AVAILABLE_PAGES.map((item) => (
          <button
            key={item}
            className={`sidebar-nav-item ${activePage === item ? "is-active" : ""}`}
            onClick={() => handleClick(item)}
            type="button"
          >
            <span className="sidebar-nav-icon"><NavIcon name={item} /></span>
            <span className="sidebar-nav-label">{item[0].toUpperCase() + item.slice(1)}</span>
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