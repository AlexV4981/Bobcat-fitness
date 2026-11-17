import { useState } from "react";
import { countExercises, countSets, fmtRest, workoutToText } from "../lib/format.js";
import { newId } from "../../lib/workoutPlan.js";
import WorkoutOptionsMenu from "../../components/WorkoutCrud/WorkoutOptionsMenu.jsx";

function SimpleList({ items }) {
  return (
    <ul className="simple">
      {items.map((x, i) => (
        <li key={i}>
          <b>{x.name}</b>
          <span>{x.detail}</span>
        </li>
      ))}
    </ul>
  );
}

// Warm-up / cool-down rows while editing
function EditableList({ items, label, onChange }) {
  const update = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ed-list">
      {items.map((x, i) => (
        <div className="ed-row" key={i}>
          <input
            className="ed"
            aria-label={`${label} name`}
            placeholder="Name"
            value={x.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            className="ed"
            aria-label={`${label} detail`}
            placeholder="Detail (e.g. 60 seconds)"
            value={x.detail}
            onChange={(e) => update(i, { detail: e.target.value })}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ${x.name || label}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={() => onChange([...items, { name: "", detail: "" }])}>
        + Add
      </button>
    </div>
  );
}

const toInt = (v) => (v === "" ? "" : Math.max(0, parseInt(v, 10) || 0));

function formatDate(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function WorkoutSheet({
  workout,
  loading,
  mode,
  dirty,
  saving,
  message,
  canRegenerate,
  onToggleDone,
  onRest,
  onRegenerate,
  onChange,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}) {
  const [copyLabel, setCopyLabel] = useState("Copy as text");
  const editing = mode === "edit";
  const isSaved = Boolean(workout.id);
  const done = new Set(workout.done || []);
  const totalEx = countExercises(workout);
  const allIds = workout.blocks.flatMap((b) => b.exercises.map((e) => e.id));
  const doneCount = allIds.filter((id) => done.has(id)).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(workoutToText(workout));
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    setTimeout(() => setCopyLabel("Copy as text"), 1500);
  };

  // ---- immutable edit helpers (every change goes up through onChange) ----
  const set = (patch) => onChange({ ...workout, ...patch });
  const setBlock = (bi, patch) =>
    set({ blocks: workout.blocks.map((b, j) => (j === bi ? { ...b, ...patch } : b)) });
  const setEx = (bi, ei, patch) =>
    setBlock(bi, { exercises: workout.blocks[bi].exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) });
  const addEx = (bi) =>
    setBlock(bi, {
      exercises: [...workout.blocks[bi].exercises, { id: newId(), name: "", sets: 3, reps: "10", restSec: 60, cue: "" }],
    });
  const removeEx = (bi, ei) =>
    setBlock(bi, { exercises: workout.blocks[bi].exercises.filter((_, j) => j !== ei) });
  const addBlock = () =>
    set({
      blocks: [
        ...workout.blocks,
        {
          name: "New block",
          rounds: 1,
          exercises: [{ id: newId(), name: "", sets: 3, reps: "10", restSec: 60, cue: "" }],
        },
      ],
    });
  const removeBlock = (bi) => set({ blocks: workout.blocks.filter((_, j) => j !== bi) });

  const when = workout.isSample
    ? "Example workout — build your own on the left"
    : dirty && !isSaved
      ? "Unsaved draft — save it to keep it"
      : `${dirty ? "Unsaved changes · " : "Saved · "}${formatDate(workout.scheduledDate)}`;

  return (
    <main className={`sheet${loading ? " loading" : ""}`} aria-live="polite">
      <section className="hero">
        <div className="hero-top">
          <div className="hero-head">
            {editing ? (
              <label className="ed-date">
                Scheduled for
                <input
                  type="date"
                  className="ed"
                  value={workout.scheduledDate || ""}
                  onChange={(e) => set({ scheduledDate: e.target.value })}
                />
              </label>
            ) : (
              <p className="hero-eyebrow">{when}</p>
            )}
            {editing ? (
              <input
                className="ed ed-title"
                aria-label="Workout title"
                placeholder="Workout title"
                value={workout.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            ) : (
              <h2>{workout.title}</h2>
            )}
          </div>

          <div className="actions">
            {editing ? (
              <>
                <button type="button" className="pill" onClick={onCancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="pill pill-gold" onClick={onSave} disabled={saving}>
                  {saving ? "Saving…" : isSaved ? "Save changes" : "Save workout"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="pill" onClick={copy}>
                  {copyLabel}
                </button>
                {!workout.isSample && canRegenerate && (
                  <button type="button" className="pill" onClick={onRegenerate} disabled={loading}>
                    Regenerate
                  </button>
                )}
                {!workout.isSample && dirty && (
                  <button type="button" className="pill pill-gold" onClick={onSave} disabled={saving}>
                    {saving ? "Saving…" : isSaved ? "Save changes" : "Save workout"}
                  </button>
                )}
              </>
            )}
            {!workout.isSample && (
              <WorkoutOptionsMenu
                variant="dark"
                label="Workout options"
                onEdit={editing ? undefined : onEdit}
                onDelete={onDelete}
                deleteLabel={isSaved ? "Delete" : "Discard draft"}
              />
            )}
          </div>
        </div>

        {editing ? (
          <textarea
            className="ed ed-summary"
            aria-label="Summary"
            placeholder="Short summary"
            value={workout.summary}
            onChange={(e) => set({ summary: e.target.value })}
          />
        ) : (
          <p className="summary">{workout.summary}</p>
        )}

        {message && (
          <p className={`flash flash--${message.type}`} role={message.type === "err" ? "alert" : "status"}>
            {message.text}
          </p>
        )}

        <div className="stats">
          <div className="stat">
            {editing ? (
              <input
                type="number"
                min="1"
                className="ed ed-stat"
                aria-label="Duration in minutes"
                value={workout.durationMin}
                onChange={(e) => set({ durationMin: toInt(e.target.value) })}
              />
            ) : (
              <b>{workout.durationMin}</b>
            )}
            <span>minutes</span>
          </div>
          <div className="stat"><b>{totalEx}</b><span>exercises</span></div>
          <div className="stat"><b>{countSets(workout)}</b><span>working sets</span></div>
          <div className="stat">
            {editing ? (
              <input
                className="ed ed-stat"
                aria-label="Intensity"
                value={workout.intensity}
                onChange={(e) => set({ intensity: e.target.value })}
              />
            ) : (
              <b className="small">{workout.intensity}</b>
            )}
            <span>intensity</span>
          </div>
        </div>

        <div className="progress-row">
          <div className="progress" aria-hidden="true">
            <i style={{ width: `${totalEx ? (doneCount / totalEx) * 100 : 0}%` }} />
          </div>
          <span>{doneCount}/{totalEx} done</span>
        </div>
      </section>

      <section className="card">
        <section className="sec">
          <h3>Warm-up</h3>
          {editing ? (
            <EditableList items={workout.warmup} label="Warm-up" onChange={(warmup) => set({ warmup })} />
          ) : (
            <SimpleList items={workout.warmup} />
          )}
        </section>

        {workout.blocks.map((b, bi) => (
          <section className="sec" key={bi}>
            {editing ? (
              <div className="ed-block-head">
                <input
                  className="ed"
                  aria-label="Block name"
                  value={b.name}
                  onChange={(e) => setBlock(bi, { name: e.target.value })}
                />
                <label className="ed-inline">
                  Rounds
                  <input
                    type="number"
                    min="1"
                    className="ed ed-num"
                    value={b.rounds}
                    onChange={(e) => setBlock(bi, { rounds: toInt(e.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove block ${b.name}`}
                  onClick={() => removeBlock(bi)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <h3>
                {b.name} {b.rounds > 1 && <small>{b.rounds} rounds</small>}
              </h3>
            )}

            {b.exercises.map((e, ei) => {
              if (editing) {
                return (
                  <div className="ex ex-edit" key={e.id}>
                    <div className="ex-fields">
                      <input
                        className="ed"
                        aria-label="Exercise name"
                        placeholder="Exercise name"
                        value={e.name}
                        onChange={(ev) => setEx(bi, ei, { name: ev.target.value })}
                      />
                      <input
                        className="ed"
                        aria-label="Form cue"
                        placeholder="Form cue"
                        value={e.cue}
                        onChange={(ev) => setEx(bi, ei, { cue: ev.target.value })}
                      />
                      <div className="ex-nums">
                        {b.rounds <= 1 && (
                          <label>
                            Sets
                            <input
                              type="number"
                              min="1"
                              className="ed ed-num"
                              value={e.sets}
                              onChange={(ev) => setEx(bi, ei, { sets: toInt(ev.target.value) })}
                            />
                          </label>
                        )}
                        <label>
                          Reps
                          <input
                            className="ed ed-num"
                            value={e.reps}
                            onChange={(ev) => setEx(bi, ei, { reps: ev.target.value })}
                          />
                        </label>
                        <label>
                          Rest (s)
                          <input
                            type="number"
                            min="0"
                            className="ed ed-num"
                            value={e.restSec}
                            onChange={(ev) => setEx(bi, ei, { restSec: toInt(ev.target.value) })}
                          />
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${e.name || "exercise"}`}
                      onClick={() => removeEx(bi, ei)}
                    >
                      ✕
                    </button>
                  </div>
                );
              }

              const isDone = done.has(e.id);
              return (
                <div className={`ex${isDone ? " done" : ""}`} key={e.id}>
                  <button
                    type="button"
                    className="check"
                    aria-label={`Mark ${e.name} done`}
                    aria-pressed={isDone}
                    onClick={() => onToggleDone(e.id)}
                  >
                    ✓
                  </button>
                  <div className="ex-body">
                    <div className="ex-name">{e.name}</div>
                    <div className="cue">{e.cue}</div>
                  </div>
                  <div className="rx">
                    <span className="sr">{b.rounds > 1 ? "" : `${e.sets} × `}{e.reps}</span>
                    {e.restSec > 0 && (
                      <button type="button" className="rest" onClick={() => onRest(e.restSec)}>
                        rest {fmtRest(e.restSec)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {editing && (
              <button type="button" className="add-btn" onClick={() => addEx(bi)}>
                + Add exercise
              </button>
            )}
          </section>
        ))}

        {editing && (
          <button type="button" className="add-btn add-block" onClick={addBlock}>
            + Add block
          </button>
        )}

        <section className="sec">
          <h3>Cool-down</h3>
          {editing ? (
            <EditableList items={workout.cooldown} label="Cool-down" onChange={(cooldown) => set({ cooldown })} />
          ) : (
            <SimpleList items={workout.cooldown} />
          )}
        </section>

        <p className="note">
          AI-generated plan. Scale anything that hurts, and check with a doctor or physio if you're working
          around an injury.
        </p>
      </section>
    </main>
  );
}
