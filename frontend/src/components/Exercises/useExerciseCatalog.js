/**
 * useExerciseCatalog
 * ---------------------------------------------------------------------------
 * React hooks over lib/exerciseService.js.
 *
 *   useExerciseList()         -> { exercises, categories, loading, error, reload }
 *   useExercise(slug)         -> { exercise, loading, error }    (full row, with instructions)
 *   useTrackableExercises()   -> { options, loading }            (camera dropdown options)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getExerciseBySlug,
  listExercises,
  listTrackableExercises,
} from "../../lib/exerciseService.js";
import { getCategories, toExercise } from "./ExerciseCatalog.js";

export function useExerciseList() {
  const [state, setState] = useState({ rows: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, error: null }));
    listExercises({ force: attempt > 0 })
      .then((rows) => !cancelled && setState({ rows, error: null }))
      .catch((error) => !cancelled && setState({ rows: null, error }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const exercises = useMemo(() => (state.rows ? state.rows.map(toExercise) : []), [state.rows]);
  const categories = useMemo(() => getCategories(exercises), [exercises]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { exercises, categories, loading: !state.rows && !state.error, error: state.error, reload };
}

export function useExercise(slug) {
  const [state, setState] = useState({ slug: null, exercise: null, error: null });

  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    getExerciseBySlug(slug)
      .then((row) => !cancelled && setState({ slug, exercise: row ? toExercise(row) : null, error: null }))
      .catch((error) => !cancelled && setState({ slug, exercise: null, error }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) return { exercise: null, loading: false, error: null };
  const ready = state.slug === slug;
  return { exercise: ready ? state.exercise : null, loading: !ready, error: ready ? state.error : null };
}

/**
 * Options for the camera's exercise dropdown. `value` is what the backend rep counter
 * receives (tracker_name); `name` is the display name saved with each logged set.
 */
export function useTrackableExercises() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listTrackableExercises()
      .then((data) => !cancelled && setRows(data))
      .catch((error) => {
        console.error("Unable to load trackable exercises", error);
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => (rows ?? []).map((r) => ({ value: r.tracker_name, label: r.name, name: r.name, exerciseId: r.id })),
    [rows],
  );
  return { options, loading: rows === null };
}
