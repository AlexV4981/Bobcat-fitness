import { useEffect, useMemo, useState } from "react";
import "./ExercisesPage.css";
import { CATEGORIES, EXERCISES, getExercise, searchText } from "../components/Exercises/ExerciseCatalog.js";
import ExerciseCard from "../components/Exercises/ExerciseCard.jsx";
import ExerciseDetail from "../components/Exercises/ExerciseDetail.jsx";

/**
 * ExercisesPage
 * ---------------------------------------------------------------------------
 * The exercise library. Shows every exercise in exerciseCatalog.js as a card
 * grid with search and category filters; picking a card opens that exercise's
 * detail view (interactive form guide, steps, common mistakes, muscles) in
 * place. Everything is generated from the catalog, so adding an entry there is
 * enough for a new exercise to appear here.
 *
 * Data source: static catalog (see exerciseCatalog.js for the TODO(api) note).
 *
 * Navigation: the app switches pages with `page` state in App.jsx and has no
 * URLs, so by default the selected exercise is kept in local state. To drive it
 * from outside (e.g. react-router's `/exercises/:id`), pass `exerciseId` (a
 * string, or null for the list) and `onSelectExercise`, and the page becomes
 * controlled.
 *
 * @param {Object} props
 * @param {string|null} [props.exerciseId] - Controlled selection. Omit to let
 *   the page manage it.
 * @param {(id: string|null) => void} [props.onSelectExercise] - Fires whenever
 *   the user opens an exercise (id) or goes back (null).
 * @param {string|null} [props.initialExerciseId=null] - Open this exercise on
 *   first render (uncontrolled mode only).
 */
export default function ExercisesPage({ exerciseId, onSelectExercise, initialExerciseId = null }) {
  const [internalId, setInternalId] = useState(initialExerciseId);
  const controlled = exerciseId !== undefined;
  const selectedId = controlled ? exerciseId : internalId;
  const selected = selectedId ? getExercise(selectedId) : null;

  const select = (id) => {
    if (!controlled) setInternalId(id);
    onSelectExercise?.(id);
  };

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter(
      (ex) => (category === "All" || ex.category === category) && (!q || searchText(ex).includes(q)),
    );
  }, [query, category]);

  // Jump to the top when switching between the list and a detail view.
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [selectedId]);

  if (selected) {
    return (
      <div className="ex-page">
        <ExerciseDetail exercise={selected} onBack={() => select(null)} />
      </div>
    );
  }

  const filtered = query.trim() !== "" || category !== "All";

  return (
    <div className="ex-page">
      <header className="page-header">
        <div>
          <p className="page-header-date">Exercise library</p>
          <h1 className="page-header-title">Exercises</h1>
        </div>
        <p className="ex-count" role="status" aria-live="polite">
          {filtered ? `${results.length} of ${EXERCISES.length}` : EXERCISES.length}{" "}
          {EXERCISES.length === 1 ? "exercise" : "exercises"}
        </p>
      </header>

      <div className="ex-toolbar">
        <input
          type="search"
          className="ex-search"
          placeholder="Search by name, muscle or equipment"
          aria-label="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="ex-filters" role="group" aria-label="Filter by category">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              className="ex-filter"
              aria-pressed={c === category}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {results.length > 0 ? (
        <div className="ex-grid">
          {results.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} onSelect={select} />
          ))}
        </div>
      ) : (
        <div className="card ex-empty">
          <p><strong>No exercises match.</strong></p>
          <p>Try a different search or{" "}
            <button
              type="button"
              className="link ex-reset"
              onClick={() => { setQuery(""); setCategory("All"); }}
            >
              clear the filters
            </button>.
          </p>
        </div>
      )}
    </div>
  );
}