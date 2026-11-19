/**
 * ExerciseCard
 * ---------------------------------------------------------------------------
 * One tile in the Exercises grid: a thumbnail, the name, category, difficulty,
 * main muscles and a short summary.
 *
 * Exercises with a form animation (exercise.Guide) show a frozen frame of it
 * that plays while the card is hovered or focused. Imported exercises show
 * their first photo instead, swapping to the second on hover. The whole card
 * is clickable through the title button (stretched with CSS), so there is
 * exactly one tab stop per card.
 *
 * @param {Object} props
 * @param {Object} props.exercise - A UI exercise (see ExerciseCatalog.toExercise).
 * @param {(id: string) => void} props.onSelect - Called with the exercise id.
 */

import { useState } from "react";

export default function ExerciseCard({ exercise, onSelect }) {
  const { Guide, images, name, category, difficulty, muscles, summary, trackerName } = exercise;
  const [active, setActive] = useState(false);

  return (
    <article
      className="ex-card"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      {/* Decorative: the text below carries the meaning. No focusable controls inside. */}
      <div className={`ex-card-thumb${Guide ? "" : " ex-card-thumb--photo"}`} aria-hidden="true">
        {Guide ? (
          <Guide
            autoPlay={active}
            startAt={0.43}
            showViewToggle={false}
            showMistakes={false}
            showIndicators={false}
            showMetrics={false}
            showControls={false}
            showFeedback={false}
          />
        ) : images.length > 0 ? (
          <img src={active && images[1] ? images[1] : images[0]} alt="" loading="lazy" decoding="async" />
        ) : null}
      </div>

      <div className="ex-card-body">
        <div className="ex-card-tags">
          <span className="ex-pill">{category}</span>
          <span className={`ex-pill ex-pill--${difficulty.toLowerCase()}`}>{difficulty}</span>
          {trackerName && <span className="ex-pill ex-pill--camera">Camera tracking</span>}
        </div>
        <h3 className="ex-card-title">
          <button type="button" className="ex-card-link" onClick={() => onSelect(exercise.id)}>
            {name}
          </button>
        </h3>
        <p className="ex-card-muscles">{muscles.primary.join(" · ")}</p>
        <p className="ex-card-summary">{summary}</p>
      </div>
    </article>
  );
}
