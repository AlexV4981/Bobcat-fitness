/**
 * exerciseCatalog
 * ---------------------------------------------------------------------------
 * The single source of truth for the Exercises page. The page, its filters, the
 * cards and the detail view are all generated from EXERCISES, so adding an
 * entry here is all it takes for a new exercise to show up.
 *
 * Each entry pairs catalog info (name, muscles, ...) with the form-guide
 * component and form data from components/exercises. The "How to" steps and
 * "Common mistakes" lists are read from that form data (see getSteps /
 * getMistakes), so the coaching text lives in one place only.
 *
 * Data source: static. TODO(api): the info fields could come from
 * GET /api/exercises later; `Guide` and `form` always stay on the frontend.
 *
 * Entry shape:
 *   id          unique, URL-safe string
 *   name        display name
 *   category    "Push" | "Pull" | "Legs" | "Core" (any string works; filter
 *               chips are built from whatever categories exist)
 *   difficulty  "Beginner" | "Intermediate" | "Advanced"
 *   equipment   string[] (empty array = bodyweight only)
 *   muscles     { primary: string[], secondary: string[] }
 *   summary     one or two sentences
 *   Guide       form-guide React component
 *   form        that exercise's form module ({ phases, views })
 */

import {
  PushUp, PullUp, Squat, SitUp,
  pushUpForm, pullUpForm, squatForm, sitUpForm,
} from "./index.js";

export const EXERCISES = [
  {
    id: "push-up",
    name: "Push-Up",
    category: "Push",
    difficulty: "Beginner",
    equipment: [],
    muscles: { primary: ["Chest", "Triceps"], secondary: ["Front shoulders", "Core"] },
    summary:
      "A bodyweight press that builds the chest, shoulders and triceps while the core holds a rigid plank. Easy to scale by changing how high your hands are.",
    Guide: PushUp,
    form: pushUpForm,
  },
  {
    id: "pull-up",
    name: "Pull-Up",
    category: "Pull",
    difficulty: "Intermediate",
    equipment: ["Pull-up bar"],
    muscles: { primary: ["Lats", "Biceps"], secondary: ["Upper back", "Forearms"] },
    summary:
      "A bodyweight vertical pull that works the lats and upper back, with the biceps and grip helping. Controlled reps from a full hang matter more than the count.",
    Guide: PullUp,
    form: pullUpForm,
  },
  {
    id: "back-squat",
    name: "Barbell Back Squat",
    category: "Legs",
    difficulty: "Intermediate",
    equipment: ["Barbell", "Squat rack"],
    muscles: {
      primary: ["Quadriceps", "Glutes"],
      secondary: ["Hamstrings", "Core", "Lower back"],
    },
    summary:
      "A barbell squat that loads the legs and hips with the bar across your upper back. Depth, a braced torso and a bar path over mid-foot are the keys.",
    Guide: Squat,
    form: squatForm,
  },
  {
    id: "sit-up",
    name: "Sit-Up",
    category: "Core",
    difficulty: "Beginner",
    equipment: [],
    muscles: { primary: ["Abs"], secondary: ["Hip flexors"] },
    summary:
      "A bodyweight trunk curl that trains the abs through a full range, from lying down to upright. Keep your feet anchored and your neck relaxed.",
    Guide: SitUp,
    form: sitUpForm,
  },
];

/** Unique categories, in the order they first appear in EXERCISES. */
export const CATEGORIES = [...new Set(EXERCISES.map((ex) => ex.category))];

export const getExercise = (id) => EXERCISES.find((ex) => ex.id === id) ?? null;

/** Everything a search box should match against, lower-cased. */
export const searchText = (ex) =>
  [ex.name, ex.category, ex.difficulty, ...ex.equipment, ...ex.muscles.primary, ...ex.muscles.secondary]
    .join(" ")
    .toLowerCase();

/** The four "how to" steps: one per rep phase, using the side-view coaching text. */
export function getSteps(ex) {
  const view = ex.form.views.side ?? Object.values(ex.form.views)[0];
  return view.good.map((text, i) => ({ title: ex.form.phases[i], text }));
}

/** Common mistakes from every view, de-duplicated by title. */
export function getMistakes(ex) {
  const seen = new Map();
  for (const view of Object.values(ex.form.views)) {
    for (const [title, text] of Object.values(view.bad)) {
      if (!seen.has(title)) seen.set(title, text);
    }
  }
  return [...seen].map(([title, text]) => ({ title, text }));
}