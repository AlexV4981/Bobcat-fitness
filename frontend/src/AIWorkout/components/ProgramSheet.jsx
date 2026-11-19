import { useState } from "react";
import { fmtRest } from "../lib/format.js";
import {
  countSessionsDone,
  dayWorkout,
  isSessionDone,
  nextSession,
  programToText,
  sessionDateOf,
} from "../lib/program.js";
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

function shortDate(d) {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "";
}

/**
 * A multi-week program: week tabs, day tabs, and the selected session's workout.
 * Programs can be saved, regenerated, deleted and checked off; their start date can be changed.
 * (Editing exercises week by week isn't supported yet; single workouts keep the full editor.)
 *
 * Remount it with a `key` when a different program is shown so it reopens at the next session.
 */
export default function ProgramSheet({
  program,
  loading,
  dirty,
  saving,
  message,
  canRegenerate,
  onToggleDone,
  onRest,
  onRegenerate,
  onChange,
  onSave,
  onDelete,
}) {
  const [pos, setPos] = useState(() => nextSession(program));
  const [copyLabel, setCopyLabel] = useState("Copy as text");

  const isSaved = Boolean(program.id);
  const week = Math.min(pos.week, program.weeks - 1);
  const day = Math.min(pos.day, program.days.length - 1);
  const workout = dayWorkout(program, week, day);
  const done = new Set(program.done ?? []);
  const ids = workout.blocks.flatMap((b) => b.exercises.map((e) => e.id));
  const doneHere = ids.filter((id) => done.has(id)).length;
  const totalSessions = program.weeks * program.days.length;
  const sessionsDone = countSessionsDone(program);
  const note = program.weekNotes[week];
  const weekDone = (w) => program.days.every((_, d) => isSessionDone(program, w, d));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(programToText(program));
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    setTimeout(() => setCopyLabel("Copy as text"), 1500);
  };

  const when = program.isSample
    ? "Example program — build your own on the left"
    : dirty && !isSaved
      ? "Unsaved program — save it to keep it"
      : `${dirty ? "Unsaved changes" : "Saved"}`;

  return (
    <main className={`sheet${loading ? " loading" : ""}`} aria-live="polite">
      <section className="hero">
        <div className="hero-top">
          <div className="hero-head">
            <p className="hero-eyebrow">{when}</p>
            <h2>{program.title}</h2>
          </div>

          <div className="actions">
            <button type="button" className="pill" onClick={copy}>
              {copyLabel}
            </button>
            {!program.isSample && canRegenerate && (
              <button type="button" className="pill" onClick={onRegenerate} disabled={loading}>
                Regenerate
              </button>
            )}
            {!program.isSample && dirty && (
              <button type="button" className="pill pill-gold" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : isSaved ? "Save changes" : "Save program"}
              </button>
            )}
            {!program.isSample && (
              <WorkoutOptionsMenu
                variant="dark"
                label="Program options"
                onDelete={onDelete}
                deleteLabel={isSaved ? "Delete" : "Discard program"}
              />
            )}
          </div>
        </div>

        <p className="summary">{program.summary}</p>

        {message && (
          <p className={`flash flash--${message.type}`} role={message.type === "err" ? "alert" : "status"}>
            {message.text}
          </p>
        )}

        <div className="stats">
          <div className="stat"><b>{program.weeks}</b><span>weeks</span></div>
          <div className="stat"><b>{program.days.length}</b><span>days / week</span></div>
          <div className="stat"><b>{totalSessions}</b><span>sessions</span></div>
          <div className="stat"><b className="small">{program.intensity}</b><span>intensity</span></div>
        </div>

        <div className="progress-row">
          <div className="progress" aria-hidden="true">
            <i style={{ width: `${totalSessions ? (sessionsDone / totalSessions) * 100 : 0}%` }} />
          </div>
          <span>{sessionsDone}/{totalSessions} sessions done</span>
        </div>

        {program.progression && (
          <p className="progression">
            <b>How it progresses:</b> {program.progression}
          </p>
        )}

        {!program.isSample && (
          <label className="start-date">
            Starts on
            <input
              type="date"
              className="ed"
              value={program.scheduledDate || ""}
              onChange={(e) => onChange({ ...program, scheduledDate: e.target.value })}
            />
          </label>
        )}
      </section>

      <section className="card">
        <div className="tabs-label">Week</div>
        <div className="tabs" role="tablist" aria-label="Week">
          {program.weekNotes.map((w, i) => (
            <button
              type="button"
              role="tab"
              key={i}
              aria-selected={i === week}
              aria-label={`Week ${i + 1}${w.deload ? " (deload)" : ""}${weekDone(i) ? ", complete" : ""}`}
              className={`tab${i === week ? " on" : ""}${weekDone(i) ? " complete" : ""}${w.deload ? " deload" : ""}`}
              onClick={() => setPos({ week: i, day: 0 })}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="week-note">
          <b>
            Week {week + 1}: {note.focus}
            {note.deload && <span className="badge">Deload</span>}
          </b>
          {note.note && <span>{note.note}</span>}
        </div>

        <div className="tabs-label">Day</div>
        <div className="day-tabs" role="tablist" aria-label="Training day">
          {program.days.map((d, i) => {
            const date = program.isSample ? "" : shortDate(sessionDateOf(program, week, i));
            return (
              <button
                type="button"
                role="tab"
                key={i}
                aria-selected={i === day}
                className={`day-tab${i === day ? " on" : ""}${isSessionDone(program, week, i) ? " complete" : ""}`}
                onClick={() => setPos({ week, day: i })}
              >
                <b>{d.name}</b>
                <span>{[date, d.focus, `${d.durationMin} min`].filter(Boolean).join(" · ")}</span>
              </button>
            );
          })}
        </div>

        <div className="session-head">
          <h3>Week {week + 1} · {workout.title}</h3>
          <span>{doneHere}/{ids.length} exercises done</span>
        </div>

        {workout.warmup.length > 0 && (
          <section className="sec">
            <h3>Warm-up</h3>
            <SimpleList items={workout.warmup} />
          </section>
        )}

        {workout.blocks.map((b, bi) => (
          <section className="sec" key={bi}>
            <h3>
              {b.name} {b.rounds > 1 && <small>{b.rounds} rounds</small>}
            </h3>
            {b.exercises.map((e) => {
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
          </section>
        ))}

        {workout.cooldown.length > 0 && (
          <section className="sec">
            <h3>Cool-down</h3>
            <SimpleList items={workout.cooldown} />
          </section>
        )}

        <p className="note">
          AI-generated plan. Scale anything that hurts, and check with a doctor or physio if you're working
          around an injury.
        </p>
      </section>
    </main>
  );
}
