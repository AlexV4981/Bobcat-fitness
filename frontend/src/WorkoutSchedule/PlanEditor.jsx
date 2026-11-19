import { useEffect, useRef } from "react";
import ExercisePicker from "./ExercisePicker";
import { useExerciseList } from "../components/Exercises/useExerciseCatalog.js";
import useDragSort from "./useDragSort";
import { addDays, localToday, newId } from "../lib/workoutPlan";

const blankExercise = () => ({ id: newId(), name: "", sets: 3, reps: "10", completed: false });
const toInt = (v) => (v === "" ? "" : Math.max(0, parseInt(v, 10) || 0));

/** One day: label, date and a list of exercise boxes that can be dragged up and down. */
function DayEditor({ day, scrollRef, catalog, onChange, onRemove }) {
  const listRef = useRef(null);
  const gripRefs = useRef({});
  const refocus = useRef(null);

  const move = (from, to) => {
    if (from === to || to < 0 || to >= day.exercises.length) return;
    const list = [...day.exercises];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    onChange({ exercises: list });
  };
  const { dragIndex, rowProps } = useDragSort({ listRef, scrollRef, onMove: move });

  // keep keyboard focus on the grip after a keyboard reorder
  useEffect(() => {
    if (refocus.current) {
      gripRefs.current[refocus.current]?.focus();
      refocus.current = null;
    }
  });

  const setEx = (i, patch) =>
    onChange({ exercises: day.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const onGripKey = (e, i, id) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    refocus.current = id;
    move(i, i + (e.key === "ArrowUp" ? -1 : 1));
  };

  return (
    <div className="ws-editor-day">
      <div className="ws-editor-dayhead">
        <input
          className="ws-input"
          aria-label="Day label"
          placeholder="Day label (e.g. Push Day)"
          value={day.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
        <input
          type="date"
          className="ws-input ws-input--date"
          aria-label="Day date"
          value={day.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
        <button
          type="button"
          className="ws-icon-btn ws-icon-btn--danger"
          aria-label={`Remove ${day.label || "day"}`}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>

      <div className="ws-editor-list" ref={listRef}>
        {day.exercises.map((e, i) => (
          <div
            key={e.id}
            className={`ws-editor-ex${dragIndex === i ? " is-dragging" : ""}`}
            {...rowProps(i)}
          >
            <button
              type="button"
              className="ws-grip"
              data-grip=""
              ref={(el) => {
                if (el) gripRefs.current[e.id] = el;
                else delete gripRefs.current[e.id];
              }}
              aria-label={`Reorder ${e.name || "exercise"}. Drag, or press the up and down arrow keys.`}
              onKeyDown={(ev) => onGripKey(ev, i, e.id)}
            >
              <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">
                <circle cx="3" cy="3" r="1.6" /><circle cx="9" cy="3" r="1.6" />
                <circle cx="3" cy="9" r="1.6" /><circle cx="9" cy="9" r="1.6" />
                <circle cx="3" cy="15" r="1.6" /><circle cx="9" cy="15" r="1.6" />
              </svg>
            </button>

            <ExercisePicker
              value={e.name}
              catalog={catalog}
              onChange={({ name, exerciseId }) => setEx(i, { name, exerciseId })}
            />

            <div className="ws-ex-line2">
              <input
                type="number"
                min="1"
                className="ws-input ws-input--num"
                aria-label="Sets"
                value={e.sets}
                onChange={(ev) => setEx(i, { sets: toInt(ev.target.value) })}
              />
              <span className="ws-times" aria-hidden="true">×</span>
              <input
                className="ws-input ws-input--reps"
                aria-label="Reps"
                placeholder="reps"
                value={e.reps}
                onChange={(ev) => setEx(i, { reps: ev.target.value })}
              />
              <button
                type="button"
                className="ws-icon-btn ws-icon-btn--danger ws-ex-remove"
                aria-label={`Remove ${e.name || "exercise"}`}
                onClick={() => onChange({ exercises: day.exercises.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="ws-add-btn"
        onClick={() => onChange({ exercises: [...day.exercises, blankExercise()] })}
      >
        + Add exercise
      </button>
    </div>
  );
}

/**
 * PlanEditor
 * Day-by-day editor for a workout. It is a fixed-height panel: the title and the
 * Save / Cancel buttons stay put and only the middle scrolls, so the page never grows
 * or jumps while you add exercises. Props: draft ({ name, days }), onChange(draft),
 * onSave, onCancel, saving, error.
 */
export default function PlanEditor({ draft, onChange, onSave, onCancel, saving = false, error = "" }) {
  const scrollRef = useRef(null);
  const catalog = useExerciseList(); // one load shared by every exercise picker in the editor

  const setDay = (di, patch) =>
    onChange({ ...draft, days: draft.days.map((d, i) => (i === di ? { ...d, ...patch } : d)) });
  const removeDay = (di) => onChange({ ...draft, days: draft.days.filter((_, i) => i !== di) });
  const addDay = () => {
    const dates = draft.days.map((d) => d.date).filter(Boolean).sort();
    const date = dates.length ? addDays(dates[dates.length - 1], 1) : localToday();
    onChange({ ...draft, days: [...draft.days, { date, label: "New day", exercises: [blankExercise()] }] });
    // bring the new day into view
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  };

  return (
    <section className="ws-card ws-editor" aria-label="Edit workout">
      <div className="ws-editor-bar">
        <h2 className="ws-exercises-title">Edit workout</h2>
        <div className="ws-editor-actions">
          <button type="button" className="ws-open-btn ws-open-btn--ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="ws-open-btn" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <p className="ws-error ws-editor-error" role="alert">
          {error}
        </p>
      )}

      <div className="ws-editor-scroll" ref={scrollRef}>
        <label className="ws-field">
          <span>Name</span>
          <input
            className="ws-input"
            value={draft.name}
            maxLength={80}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </label>

        {draft.days.map((day, di) => (
          <DayEditor
            key={di}
            day={day}
            scrollRef={scrollRef}
            catalog={catalog}
            onChange={(patch) => setDay(di, patch)}
            onRemove={() => removeDay(di)}
          />
        ))}

        <button type="button" className="ws-add-btn ws-add-day" onClick={addDay}>
          + Add day
        </button>
      </div>
    </section>
  );
}
