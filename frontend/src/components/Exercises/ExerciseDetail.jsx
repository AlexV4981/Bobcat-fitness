/**
 * ExerciseDetail
 * ---------------------------------------------------------------------------
 * Full view of one exercise. Exercises with a form animation get the
 * interactive guide (side/front, mistake variants, overlays, scrubber) and
 * "Common mistakes", read straight from the form data so they can't drift from
 * the animation. Other exercises show their photos and the dataset's step-by-
 * step instructions, and hide the mistakes card.
 *
 * @param {Object} props
 * @param {Object} props.exercise - A full UI exercise (with instructions), from useExercise().
 * @param {() => void} props.onBack - Return to the list.
 */

import { getMistakes, getSteps } from "./ExerciseCatalog.js";

export default function ExerciseDetail({ exercise, onBack }) {
  const { Guide, images, name, category, difficulty, equipment, muscles, summary } = exercise;
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
          {Guide ? (
            <Guide />
          ) : images.length > 0 ? (
            <div className="ex-gallery">
              {images.map((src, i) => (
                <img key={src} src={src} alt={`${name}, position ${i + 1}`} loading="lazy" decoding="async" />
              ))}
            </div>
          ) : (
            <p className="ex-muscle-label">No demonstration available yet.</p>
          )}
        </section>

        <div className="ex-detail-side">
          <section className="card">
            <div className="card-header"><h3>How to do it</h3></div>
            {steps.length > 0 ? (
              <ol className="ex-steps">
                {steps.map((s) => (
                  <li key={s.title}>
                    <strong>{s.title}</strong>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ex-muscle-label">No instructions available yet.</p>
            )}
          </section>

          {mistakes.length > 0 && (
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
          )}

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
