import { useEffect, useRef, useState } from "react";
import { STARTER_PLANS, starterCounts } from "../lib/starterPlans";
import "../components/WorkoutCrud/WorkoutCrud.css";

/**
 * StarterKitDialog
 * Pick any of the ready-made plans to add to "My Workouts" next to the AI-generated ones.
 * Plans the user already added are shown as "Added" and can't be picked again.
 * Props: addedIds (Set of starter ids), busy, error, onAdd(ids), onCancel
 */
export default function StarterKitDialog({ addedIds, busy = false, error = "", onAdd, onCancel }) {
  const [selected, setSelected] = useState(() => new Set());
  const closeRef = useRef(null);
  const available = STARTER_PLANS.filter((p) => !addedIds.has(p.id));

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = available.length > 0 && available.every((p) => selected.has(p.id));

  return (
    <div
      className="wcd-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="wcd wcd--wide" role="dialog" aria-modal="true" aria-labelledby="wsk-title">
        <h2 id="wsk-title">Starter kit</h2>
        <p>
          Ready-made plans to get going. They start today and appear in My Workouts next to your AI-generated
          ones, where you can track progress or delete them.
        </p>

        <div className="ws-starter-tools">
          <button
            type="button"
            className="ws-link-btn"
            disabled={busy || available.length === 0}
            onClick={() => setSelected(allSelected ? new Set() : new Set(available.map((p) => p.id)))}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </button>
        </div>

        <ul className="ws-starter-list">
          {STARTER_PLANS.map((plan) => {
            const added = addedIds.has(plan.id);
            const { sessions, exercises } = starterCounts(plan);
            return (
              <li key={plan.id}>
                <label className={`ws-starter-item${added ? " is-added" : ""}${selected.has(plan.id) ? " is-selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(plan.id)}
                    disabled={added || busy}
                    onChange={() => toggle(plan.id)}
                  />
                  <span className="ws-starter-icon" aria-hidden="true">{plan.icon}</span>
                  <span className="ws-starter-text">
                    <span className="ws-starter-name">{plan.name}</span>
                    <span className="ws-starter-sub">
                      {plan.category} · {plan.subtitle}
                    </span>
                    <span className="ws-starter-sub">
                      {sessions} sessions · {exercises} exercises · {plan.lengthDays} days
                    </span>
                  </span>
                  {added && <span className="ws-starter-tag">Added</span>}
                </label>
              </li>
            );
          })}
        </ul>

        {error && (
          <p className="wcd-error" role="alert">
            {error}
          </p>
        )}

        <div className="wcd-actions">
          <button ref={closeRef} type="button" className="wcd-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="wcd-btn wcd-btn--primary"
            disabled={busy || selected.size === 0}
            onClick={() => onAdd([...selected])}
          >
            {busy ? "Adding…" : selected.size > 0 ? `Add ${selected.size} selected` : "Add selected"}
          </button>
        </div>
      </div>
    </div>
  );
}
