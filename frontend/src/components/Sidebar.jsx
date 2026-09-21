import { useState } from "react";
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

const NAV_ITEMS = ["home", "workouts", "nutrition", "profile"];

export default function Sidebar() {
  // TODO(api): drive from GET /api/streak, and route changes instead of local state
  const [activeNav, setActiveNav] = useState("home");

  return (
    <aside className="sidebar">
      <div className="sidebar-avatar" aria-hidden="true">NH</div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            className={`sidebar-nav-item ${activeNav === item ? "is-active" : ""}`}
            onClick={() => setActiveNav(item)}
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
