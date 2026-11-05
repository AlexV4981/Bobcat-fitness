import { useState } from "react";
import { countExercises, countSets, fmtRest, workoutToText } from "../lib/format.js";

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

export default function WorkoutSheet({ workout, loading, onToggleDone, onRest, onRegenerate }) {
  const [copyLabel, setCopyLabel] = useState("Copy as text");
  const done = new Set(workout.done || []);
  const totalEx = countExercises(workout);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(workoutToText(workout));
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    setTimeout(() => setCopyLabel("Copy as text"), 1500);
  };

  const when = workout.isSample
    ? "Example workout — build your own on the left"
    : "Generated " +
      new Date(workout.createdAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  let idx = 0;

  return (
    <main className={`sheet${loading ? " loading" : ""}`} aria-live="polite">
      <section className="hero">
        <div className="hero-top">
          <div className="hero-head">
            <p className="hero-eyebrow">{when}</p>
            <h2>{workout.title}</h2>
          </div>
          <div className="actions">
            <button type="button" className="pill" onClick={copy}>{copyLabel}</button>
            {!workout.isSample && (
              <button type="button" className="pill pill-gold" onClick={onRegenerate} disabled={loading}>
                Regenerate →
              </button>
            )}
          </div>
        </div>
        <p className="summary">{workout.summary}</p>

        <div className="stats">
          <div className="stat"><b>{workout.durationMin}</b><span>minutes</span></div>
          <div className="stat"><b>{totalEx}</b><span>exercises</span></div>
          <div className="stat"><b>{countSets(workout)}</b><span>working sets</span></div>
          <div className="stat"><b className="small">{workout.intensity}</b><span>intensity</span></div>
        </div>

        <div className="progress-row">
          <div className="progress" aria-hidden="true">
            <i style={{ width: `${totalEx ? (done.size / totalEx) * 100 : 0}%` }} />
          </div>
          <span>{done.size}/{totalEx} done</span>
        </div>
      </section>

      <section className="card">
      <section className="sec">
        <h3>Warm-up</h3>
        <SimpleList items={workout.warmup} />
      </section>

      {workout.blocks.map((b, bi) => (
        <section className="sec" key={bi}>
          <h3>
            {b.name} {b.rounds > 1 && <small>{b.rounds} rounds</small>}
          </h3>
          {b.exercises.map((e) => {
            const i = idx++;
            const isDone = done.has(i);
            return (
              <div className={`ex${isDone ? " done" : ""}`} key={i}>
                <button
                  type="button"
                  className="check"
                  aria-label={`Mark ${e.name} done`}
                  aria-pressed={isDone}
                  onClick={() => onToggleDone(i)}
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

      <section className="sec">
        <h3>Cool-down</h3>
        <SimpleList items={workout.cooldown} />
      </section>

      <p className="note">
        AI-generated plan. Scale anything that hurts, and check with a doctor or physio if you're working
        around an injury.
      </p>
      </section>
    </main>
  );
}
