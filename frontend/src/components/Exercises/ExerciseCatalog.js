/**
 * ExerciseCatalog
 * ---------------------------------------------------------------------------
 * Helpers that turn a public.exercises row into the shape the Exercises UI
 * uses, plus the search and "how to / mistakes" helpers. The data itself comes
 * from Supabase (lib/exerciseService.js, hooks in useExerciseCatalog.js).
 *
 * UI exercise shape:
 *   id          the row's slug (URL-safe, stable)
 *   dbId        the row's uuid (use this for workout_sets.exercise_id)
 *   name, category ("Push" | "Pull" | "Legs" | "Core" | "Other"), difficulty
 *   equipment   string[] (empty = bodyweight)
 *   muscles     { primary, secondary }
 *   summary     always a string (generated when the row has none)
 *   instructions string[]   (detail rows only)
 *   images      string[]    photo URLs
 *   Guide/form  form-guide component + data, or undefined when there's no animation
 *   trackerName string|null name the rep counter accepts, null = not camera-trackable
 */

import { imageUrls } from "../../lib/exerciseService.js";
import { GUIDES } from "./guideRegistry.js";

export const CATEGORY_ORDER = ["Push", "Pull", "Legs", "Core", "Other"];

function describe(row) {
  const bits = [row.level, row.category].filter(Boolean).join(" ").toLowerCase();
  const gear = row.equipment?.length ? `using ${row.equipment.join(" + ").toLowerCase()}` : "with no equipment";
  const target = row.primary_muscles?.length ? ` Targets the ${row.primary_muscles.join(", ").toLowerCase()}.` : "";
  return `${bits ? `A ${bits} exercise` : "An exercise"} ${gear}.${target}`;
}

export function toExercise(row) {
  const entry = row.guide_key ? GUIDES[row.guide_key] : undefined;
  return {
    id: row.slug,
    dbId: row.id,
    name: row.name,
    category: row.movement ?? "Other",
    difficulty: row.level ?? "Beginner",
    equipment: row.equipment ?? [],
    muscles: { primary: row.primary_muscles ?? [], secondary: row.secondary_muscles ?? [] },
    summary: row.summary ?? describe(row),
    instructions: row.instructions ?? [],
    images: imageUrls(row),
    Guide: entry?.Guide,
    form: entry?.form,
    trackerName: row.tracker_name ?? null,
  };
}

/** Categories present in the list, in a fixed, sensible order. */
export const getCategories = (exercises) => {
  const present = new Set(exercises.map((ex) => ex.category));
  return [...CATEGORY_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !CATEGORY_ORDER.includes(c))];
};

/** Everything a search box should match against, lower-cased. */
export const searchText = (ex) =>
  [ex.name, ex.category, ex.difficulty, ...ex.equipment, ...ex.muscles.primary, ...ex.muscles.secondary]
    .join(" ")
    .toLowerCase();

/**
 * "How to do it" steps. Exercises with a form guide use its coaching text (one step per rep phase),
 * so it can't drift from the animation; everything else uses the dataset's instructions.
 */
export function getSteps(ex) {
  if (ex.form) {
    const view = ex.form.views.side ?? Object.values(ex.form.views)[0];
    return view.good.map((text, i) => ({ title: ex.form.phases[i], text }));
  }
  return ex.instructions.map((text, i) => ({ title: `Step ${i + 1}`, text }));
}

/** Common mistakes from every view, de-duplicated by title. Empty when there's no form guide. */
export function getMistakes(ex) {
  if (!ex.form) return [];
  const seen = new Map();
  for (const view of Object.values(ex.form.views)) {
    for (const [title, text] of Object.values(view.bad)) {
      if (!seen.has(title)) seen.set(title, text);
    }
  }
  return [...seen].map(([title, text]) => ({ title, text }));
}
