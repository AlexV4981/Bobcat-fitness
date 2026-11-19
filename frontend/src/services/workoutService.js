import { supabase } from "../lib/supabase";
import { buildPlan, countDays, daysOf } from "../lib/workoutPlan";

/**
 * workoutService
 * ---------------------------------------------------------------------------
 * CRUD for public.workout_runs. Row Level Security limits every query to the
 * signed-in user, and user_id defaults to auth.uid(), so it is never sent.
 * There is no recount trigger on this table, so progress columns are computed here
 * (the same way workoutLog.js does it).
 *
 *   listWorkouts()                    Read   all of the user's workouts ([] for guests)
 *   getWorkout(id)                    Read   one workout, or null
 *   createWorkout(workout)            Create from an AI Workout working copy
 *   createStarterWorkouts(plans)      Create several ready-made plans at once (starter kit)
 *   updateWorkout(id, workout)        Update the whole workout (AI Workout page)
 *   updatePlanDays(row, {name, days}) Update a workout that has no session (starter kit / camera)
 *   setExerciseCompleted(row, id, b)  Update just one exercise's completed flag
 *   deleteWorkout(id)                 Delete (logged sets are kept, unlinked)
 *
 * Needs supabase/0007_workout_runs_session.sql (adds the session + meta columns).
 */

const TABLE = "workout_runs";
const COLUMNS =
  "id, name, start_date, end_date, plan_snapshot, session, meta, total_exercises, completed_exercises, completion_pct, status, completed_at, created_at, updated_at";

async function hasSession() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data?.session);
}

async function requireSession(action) {
  if (!(await hasSession())) throw new Error(`Sign in with an account to ${action}.`);
}

// Totals + status for a days array. An abandoned run stays abandoned.
// completion_pct is a generated column (the database computes it from the two counters),
// so it must never be sent.
function progressColumns(days, current) {
  const { total, done } = countDays(days);
  const finished = total > 0 && done === total;
  return {
    total_exercises: total,
    completed_exercises: done,
    status: finished ? "completed" : current?.status === "abandoned" ? "abandoned" : "in_progress",
    completed_at: finished ? (current?.completed_at ?? new Date().toISOString()) : null,
  };
}

export async function listWorkouts() {
  if (!(await hasSession())) return []; // guests have no database access
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getWorkout(id) {
  await requireSession("open saved workouts");
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

function toColumns(w) {
  const title = w.title?.trim() || "Untitled workout";
  const { days, session, meta } = buildPlan({ ...w, title });
  return {
    name: title,
    start_date: w.scheduledDate,
    end_date: w.scheduledDate,
    plan_snapshot: days,
    session,
    meta,
    ...progressColumns(days),
  };
}

export async function createWorkout(w) {
  await requireSession("save workouts");
  const { data, error } = await supabase.from(TABLE).insert(toColumns(w)).select(COLUMNS).single();
  if (error) throw error;
  return data;
}

// `plans` come from instantiateStarter(); they have no editable session (shown read-only in the generator).
export async function createStarterWorkouts(plans) {
  await requireSession("add starter workouts");
  const rows = plans.map((p) => ({
    name: p.name,
    start_date: p.start_date,
    end_date: p.end_date,
    plan_snapshot: p.days,
    session: null,
    meta: p.meta,
    ...progressColumns(p.days),
  }));
  const { error } = await supabase.from(TABLE).insert(rows);
  if (error) throw error;
}

export async function updateWorkout(id, w) {
  await requireSession("save workouts");
  const { data, error } = await supabase
    .from(TABLE)
    .update(toColumns(w))
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That workout no longer exists.");
  return data;
}

// Day-by-day edit for workouts without a session. AI workouts must go through updateWorkout,
// otherwise their editable session and their days would drift apart.
export async function updatePlanDays(row, { name, days }) {
  await requireSession("save workouts");
  if (row.session) throw new Error("This workout is edited on the AI Workout page.");
  const dates = days.map((d) => d.date).sort();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name,
      start_date: dates[0],
      end_date: dates[dates.length - 1],
      plan_snapshot: days,
      ...progressColumns(days, row),
    })
    .eq("id", row.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That workout no longer exists.");
  return data;
}

// `row` is the workout as it was before the change.
export async function setExerciseCompleted(row, exerciseId, completed) {
  const days = daysOf(row).map((day) => ({
    ...day,
    exercises: (day.exercises ?? []).map((ex) => (ex.id === exerciseId ? { ...ex, completed } : ex)),
  }));
  const { data, error } = await supabase
    .from(TABLE)
    .update({ plan_snapshot: days, ...progressColumns(days, row) })
    .eq("id", row.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That workout no longer exists.");
  return data;
}

export async function deleteWorkout(id) {
  await requireSession("delete workouts");
  const { data, error } = await supabase.from(TABLE).delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("That workout was already deleted.");
}
