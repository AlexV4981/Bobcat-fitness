import { useState } from "react";
import { WorkoutBody } from "./WorkoutSheet.jsx";
import {
  countExercises,
  countSessionsDone,
  dayWorkout,
  isSessionDone,
  nextSession,
  programToText,
  sessionKey,
} from "../lib/format.js";

/**
 * A multi-week program: week tabs, day tabs, and the selected session's workout.
 * Remount it (via `key`) when a different program is shown so it reopens at the next session.
 */
export default function ProgramSheet({ program, loading, onToggleDone, onRest, onRegenerate }) {
  const [pos, setPos] = useState(() => nextSession(program));
  const [copyLabel, setCopyLabel] = useState("Copy as text");

  const week = Math.min(pos.week, program.weeks - 1);
  const day = Math.min(pos.day, program.days.length - 1);
  const workout = dayWorkout(program, week, day);
  const done = new Set(program.done?.[sessionKey(week, day)] || []);
  const totalSessions = program.weeks * program.days.length;
  const sessionsDone = countSessionsDone(program);
  const exCount = countExercises(workout);
  const note = program.weekNotes[week];

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
    : "Generated " +
      new Date(program.createdAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  const weekDone = (w) => program.days.every((_, d) => isSessionDone(program, w, d));

  return (
    <main className={`sheet${loading ? " loading" : ""}`} aria-live="polite">
      <section className="hero">
        <div className="hero-top">
          <div className="hero-head">
            <p className="hero-eyebrow">{when}</p>
            <h2>{program.title}</h2>
          </div>
          <div className="actions">
            <button type="button" className="pill" onClick={copy}>{copyLabel}</button>
            {!program.isSample && (
              <button type="button" className="pill pill-gold" onClick={onRegenerate} disabled={loading}>
                Regenerate →
              </button>
            )}
          </div>
        </div>
        <p className="summary">{program.summary}</p>

        <div className="stats">
          <div className="stat"><b>{program.weeks}</b><span>weeks</span></div>
          <div className="stat"><b>{program.days.length}</b><span>days / week</span></div>
          <div className="stat"><b>{totalSessions}</b><span>sessions</span></div>
          <div className="stat"><b className="small">{program.intensity}</b><span>intensity</span></div>
        </div>

        <div className="progress-row">
          <div className="progress" aria-hidden="true">
            <i style={{ width: `${(sessionsDone / totalSessions) * 100}%` }} />
          </div>
          <span>{sessionsDone}/{totalSessions} sessions done</span>
        </div>

        {program.progression && <p className="progression"><b>How it progresses:</b> {program.progression}</p>}
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
          {program.days.map((d, i) => (
            <button
              type="button"
              role="tab"
              key={i}
              aria-selected={i === day}
              className={`day-tab${i === day ? " on" : ""}${isSessionDone(program, week, i) ? " complete" : ""}`}
              onClick={() => setPos({ week, day: i })}
            >
              <b>{d.name}</b>
              <span>{d.focus} · {d.durationMin} min</span>
            </button>
          ))}
        </div>

        <div className="session-head">
          <h3>Week {week + 1} · {workout.title}</h3>
          <span>{done.size}/{exCount} exercises done</span>
        </div>

        <WorkoutBody
          workout={workout}
          done={done}
          onToggleDone={(i) => onToggleDone(week, day, i)}
          onRest={onRest}
        />
      </section>
    </main>
  );
}
