/**
 * exerciseService
 * ---------------------------------------------------------------------------
 * Supabase queries for the exercise catalog (public.exercises). Raw rows only;
 * turning a row into the shape the UI uses (guide component, steps, ...) is
 * done by toExercise() in components/Exercises/ExerciseCatalog.js.
 *
 * The list query skips the long `instructions` column, so the full catalog
 * stays small. The detail query fetches everything for one exercise.
 * Results are cached in memory for the session.
 */

import { supabase } from "./supabase";

// Photos are served from our own bucket once mirrored (see sync-exercises?mode=images),
// otherwise straight from the dataset repo. Override with VITE_EXERCISE_IMAGE_BASE if needed.
const IMAGE_BASE =
  import.meta.env.VITE_EXERCISE_IMAGE_BASE ??
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

const LIST_COLUMNS =
  "id, slug, name, category, movement, level, equipment, primary_muscles, secondary_muscles, " +
  "summary, source_images, mirrored_images, guide_key, tracker_name, source";
const PAGE_SIZE = 1000;

/** Usable image URLs for a row: mirrored copies if we have them, else the dataset's. */
export function imageUrls(row) {
  if (row.mirrored_images?.length) return row.mirrored_images;
  return (row.source_images ?? []).map((path) => IMAGE_BASE + path.split("/").map(encodeURIComponent).join("/"));
}

let listPromise = null;
const detailCache = new Map();
let trackablePromise = null;

async function fetchAllPages() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("exercises")
      .select(LIST_COLUMNS)
      .eq("is_active", true)
      .eq("deprecated", false)
      .order("name")
      .order("slug")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Every active exercise (list columns only). */
export function listExercises({ force = false } = {}) {
  if (!listPromise || force) {
    listPromise = fetchAllPages().catch((error) => {
      listPromise = null; // don't cache a failure
      throw error;
    });
  }
  return listPromise;
}

/** One exercise with every column (instructions included), or null if the slug doesn't exist. */
export async function getExerciseBySlug(slug) {
  if (detailCache.has(slug)) return detailCache.get(slug);
  const { data, error } = await supabase.from("exercises").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (data) detailCache.set(slug, data);
  return data;
}

/** Exercises the Python rep counter can track (tracker_name is set). */
export function listTrackableExercises() {
  if (!trackablePromise) {
    trackablePromise = supabase
      .from("exercises")
      .select("id, slug, name, tracker_name")
      .not("tracker_name", "is", null)
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (error) throw error;
        return data;
      })
      .catch((error) => {
        trackablePromise = null;
        throw error;
      });
  }
  return trackablePromise;
}
