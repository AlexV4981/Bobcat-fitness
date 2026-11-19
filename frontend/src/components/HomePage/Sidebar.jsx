import NavIcon from "./NavIcon";
import { useDeviceMode } from "../../hooks/useDeviceMode";

const NAV_ITEMS = [
  { key: "home",       label: "Home",       icon: "home" },
  { key: "camera",     label: "Camera",     icon: "camera" },
  { key: "ai-workout", label: "AI Workout", icon: "ai-workout" },
  { key: "workouts",   label: "Workouts",   icon: "workouts" },
  { key: "exercises",  label: "Exercises",  icon: "exercises" },
  { key: "AI Dieting", label: "AI Diet",    icon: "nutrition" },
  { key: "about-us",   label: "About-us",   icon: "about-us" },
  { key: "profile",    label: "Profile",    icon: "profile" },
];

export default function Sidebar({ activePage = "home", onNavigate, onLogout }) {
  const { isMobile } = useDeviceMode();

  return (
    <aside
      className={`sidebar ${isMobile ? "sidebar--mobile" : "sidebar--desktop"}`}
      data-device={isMobile ? "mobile" : "desktop"}
      aria-label="Primary navigation"
    >
      <div className="sidebar-avatar" aria-hidden="true">NH</div>

      <nav className="sidebar-nav" aria-label="Pages">
        {NAV_ITEMS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            className={`sidebar-nav-item ${activePage === key ? "is-active" : ""}`}
            aria-current={activePage === key ? "page" : undefined}
            onClick={() => onNavigate?.(key)}
          >
            <span className="sidebar-nav-icon">
              <NavIcon name={icon} />
            </span>
            <span className="sidebar-nav-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-streak">
        <span className="sidebar-streak-count">7</span>
        <span className="sidebar-streak-label">{isMobile ? "streak" : "day streak"}</span>
      </div>
    </aside>
  );
}