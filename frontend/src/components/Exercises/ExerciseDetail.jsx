/**
 * ExerciseDetail
 * ---------------------------------------------------------------------------
 * Full view of one exercise: the interactive form guide (side/front, mistake
 * variants, overlays, scrubber) plus "How to do it", "Common mistakes",
 * "Muscles worked" and equipment. The steps and mistakes are read straight
 * from the exercise's form data, so they can't drift from the animation.
 *
 * @param {Object} props
 * @param {Object} props.exercise - An entry from exerciseCatalog.EXERCISES.
 * @param {() => void} props.onBack - Return to the list.
 */

import { getMistakes, getSteps } from "./exerciseCatalog.js";

export default function ExerciseDetail({ exercise, onBack }) {
  const { Guide, name, category, difficulty, equipment, muscles, summary } = exercise;
  const steps = getSteps(exercise);
  const mistakes = getMistakes(exercise);

  return (
    <>
      <button type="button" className="ex-back" onClick={onBack}>
        <span aria-hidden="true">←</span> All exercises
      </button>

      <header className="page-header ex-detail-header">
        <div>
          <p className="page-header-date">{category}</p>
          <h1 className="page-header-title">{name}</h1>
          <p className="ex-detail-summary">{summary}</p>
        </div>
        <div className="ex-card-tags">
          <span className={`ex-pill ex-pill--${difficulty.toLowerCase()}`}>{difficulty}</span>
          <span className="ex-pill">{equipment.length ? equipment.join(" + ") : "Bodyweight"}</span>
        </div>
      </header>

      <div className="ex-detail-grid">
        <section className="card ex-detail-guide">
          <Guide />
        </section>

        <div className="ex-detail-side">
          <section className="card">
            <div className="card-header"><h3>How to do it</h3></div>
            <ol className="ex-steps">
              {steps.map((s) => (
                <li key={s.title}>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="card card--tint-peach">
            <div className="card-header"><h3>Common mistakes</h3></div>
            <ul className="ex-mistakes">
              {mistakes.map((m) => (
                <li key={m.title}>
                  <strong>{m.title}</strong>
                  <span>{m.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card card--tint-green">
            <div className="card-header"><h3>Muscles worked</h3></div>
            <p className="ex-muscle-label">Primary</p>
            <ul className="ex-chips">
              {muscles.primary.map((m) => <li key={m}>{m}</li>)}
            </ul>
            {muscles.secondary.length > 0 && (
              <>
                <p className="ex-muscle-label">Secondary</p>
                <ul className="ex-chips ex-chips--soft">
                  {muscles.secondary.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
