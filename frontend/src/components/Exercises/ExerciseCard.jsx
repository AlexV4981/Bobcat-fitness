/**
 * ExerciseCard
 * ---------------------------------------------------------------------------
 * One tile in the Exercises grid: a thumbnail of the form animation, the name,
 * category, difficulty, main muscles and a short summary.
 *
 * The thumbnail is a frozen frame (the bottom/top of the rep) that plays while
 * the card is hovered or focused, so a long list stays calm and cheap. The
 * whole card is clickable through the title button (stretched with CSS), so
 * there is exactly one tab stop per card.
 *
 * @param {Object} props
 * @param {Object} props.exercise - An entry from exerciseCatalog.EXERCISES.
 * @param {(id: string) => void} props.onSelect - Called with the exercise id.
 */

import { useState } from "react";

export default function ExerciseCard({ exercise, onSelect }) {
  const { Guide, name, category, difficulty, muscles, summary } = exercise;
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
      <div className="ex-card-thumb" aria-hidden="true">
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
      </div>

      <div className="ex-card-body">
        <div className="ex-card-tags">
          <span className="ex-pill">{category}</span>
          <span className={`ex-pill ex-pill--${difficulty.toLowerCase()}`}>{difficulty}</span>
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
