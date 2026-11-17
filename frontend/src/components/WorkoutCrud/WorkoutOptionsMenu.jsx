import { useEffect, useRef, useState } from "react";
import "./WorkoutCrud.css";

/**
 * WorkoutOptionsMenu
 * ---------------------------------------------------------------------------
 * The "⋯" button + dropdown used on workout cards and above a workout's exercise
 * list. Omit `onEdit` or `onDelete` to leave that item out.
 *
 * Props: onEdit, onDelete, editLabel, deleteLabel, label (aria-label),
 *        variant ("light" | "dark", for the surface it sits on).
 * Clicks are stopped from bubbling so using it on a clickable card doesn't open the card.
 */
export default function WorkoutOptionsMenu({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  label = "Workout options",
  variant = "light",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div
      className={`wom wom--${variant}`}
      ref={rootRef}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="wom-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <ul className="wom-menu" role="menu">
          {onEdit && (
            <li role="none">
              <button type="button" role="menuitem" className="wom-item" onClick={pick(onEdit)}>
                {editLabel}
              </button>
            </li>
          )}
          {onDelete && (
            <li role="none">
              <button type="button" role="menuitem" className="wom-item wom-item--danger" onClick={pick(onDelete)}>
                {deleteLabel}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
