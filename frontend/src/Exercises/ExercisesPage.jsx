import { useEffect, useMemo, useState } from "react";
import "./ExercisesPage.css";
import "../components/Exercises/ExerciseCatalogExtras.css";
import { searchText } from "../components/Exercises/ExerciseCatalog.js";
import { useExercise, useExerciseList } from "../components/Exercises/useExerciseCatalog.js";
import ExerciseCard from "../components/Exercises/ExerciseCard.jsx";
import ExerciseDetail from "../components/Exercises/ExerciseDetail.jsx";

const PAGE_SIZE = 48;

/**
 * ExercisesPage
 * ---------------------------------------------------------------------------
 * The exercise library. Shows every active exercise in the Supabase `exercises`
 * table as a card grid with search and category filters; picking a card opens
 * that exercise's detail view in place. The grid renders PAGE_SIZE cards at a
 * time with a "Show more" button, so a catalog of hundreds stays fast.
 *
 * Data source: Supabase (see lib/exerciseService.js). Exercises with a
 * guide_key show the interactive form animation; the rest show photos and
 * text instructions.
 *
 * Navigation: the app switches pages with `page` state in App.jsx and has no
 * URLs, so by default the selected exercise is kept in local state. To drive it
 * from outside (e.g. react-router's `/exercises/:id`), pass `exerciseId` (a
 * slug, or null for the list) and `onSelectExercise`, and the page becomes
 * controlled.
 *
 * @param {Object} props
 * @param {string|null} [props.exerciseId] - Controlled selection (an exercise slug). Omit to let
 *   the page manage it.
 * @param {(id: string|null) => void} [props.onSelectExercise] - Fires whenever
 *   the user opens an exercise (slug) or goes back (null).
 * @param {string|null} [props.initialExerciseId=null] - Open this exercise on
 *   first render (uncontrolled mode only).
 */
export default function ExercisesPage({ exerciseId, onSelectExercise, initialExerciseId = null }) {
  const [internalId, setInternalId] = useState(initialExerciseId);
  const controlled = exerciseId !== undefined;
  const selectedId = controlled ? exerciseId : internalId;

  const select = (id) => {
    if (!controlled) setInternalId(id);
    onSelectExercise?.(id);
  };

  const { exercises, categories, loading, error, reload } = useExerciseList();
  const { exercise: selected, loading: detailLoading, error: detailError } = useExercise(selectedId);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cameraOnly, setCameraOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (ex) =>
        (category === "All" || ex.category === category) &&
        (!cameraOnly || ex.trackerName) &&
        (!q || searchText(ex).includes(q)),
    );
  }, [exercises, query, category, cameraOnly]);

  // Start from the first page again whenever the filters change.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, category, cameraOnly]);

  // Jump to the top when switching between the list and a detail view.
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [selectedId]);

  if (selectedId) {
    return (
      <div className="ex-page">
        {selected ? (
          <ExerciseDetail exercise={selected} onBack={() => select(null)} />
        ) : (
          <div className="card ex-empty">
            <p>
              <strong>
                {detailLoading ? "Loading exercise…" : detailError ? "Couldn't load this exercise." : "Exercise not found."}
              </strong>
            </p>
            {!detailLoading && (
              <p>
                <button type="button" className="link ex-reset" onClick={() => select(null)}>
                  Back to all exercises
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const filtered = query.trim() !== "" || category !== "All" || cameraOnly;

  return (
    <div className="ex-page">
      <header className="page-header">
        <div>
          <p className="page-header-date">Exercise library</p>
          <h1 className="page-header-title">Exercises</h1>
        </div>
        <p className="ex-count" role="status" aria-live="polite">
          {loading
            ? "Loading…"
            : `${filtered ? `${results.length} of ${exercises.length}` : exercises.length} ${
                exercises.length === 1 ? "exercise" : "exercises"
              }`}
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
          {["All", ...categories].map((c) => (
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
        <button
          type="button"
          className="ex-filter ex-filter--camera"
          aria-pressed={cameraOnly}
          onClick={() => setCameraOnly((on) => !on)}
        >
          Camera tracking
        </button>
      </div>

      {error ? (
        <div className="card ex-empty" role="alert">
          <p><strong>Couldn't load the exercise library.</strong></p>
          <p>
            <button type="button" className="link ex-reset" onClick={reload}>Try again</button>
          </p>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="ex-grid">
            {results.slice(0, visible).map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} onSelect={select} />
            ))}
          </div>
          {results.length > visible && (
            <button
              type="button"
              className="link ex-loadmore"
              onClick={() => setVisible((n) => n + PAGE_SIZE)}
            >
              Show more ({results.length - visible} left)
            </button>
          )}
        </>
      ) : !loading ? (
        <div className="card ex-empty">
          <p><strong>No exercises match.</strong></p>
          <p>Try a different search or{" "}
            <button
              type="button"
              className="link ex-reset"
              onClick={() => { setQuery(""); setCategory("All"); setCameraOnly(false); }}
            >
              clear the filters
            </button>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
