import { supabase } from "./supabase";

/**
 * workoutLog
 * ---------------------------------------------------------------------------
 * Saves what the camera page records into Supabase.
 *
 *   workout_sets   one row per completed set (always written)
 *   workout_runs   one row per attempt at a plan; its plan_snapshot (the days
 *                  array shown on the schedule page) gets the exercise ticked
 *                  off and its progress totals recalculated
 *
 * `session` describes the plan attempt the camera is being used for:
 *   { runId, planExerciseId, targetReps }
 * Leave it out for a freestyle set: the set is still saved, with no plan link.
 */

// "8-10" -> 8, "12/leg" -> 12, "5" -> 5, anything without a number -> null
export function parseTargetReps(reps) {
  const match = String(reps ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Sign in to save your workout.");
  return data.user.id;
}

/**
 * Saves one completed set.
 * @param {Object} args
 * @param {string} args.exercise   e.g. "Push-Up"
 * @param {number} args.reps       reps counted in the set
 * @param {{runId: string, planExerciseId: string, targetReps?: number}} [args.session]
 */
export async function logCompletedSet({ exercise, reps, session }) {
  const userId = await currentUserId();
  const runId = session?.runId ?? null;
  const planExerciseId = session?.planExerciseId ?? null;
  const linkedToPlan = Boolean(runId && planExerciseId);

  // Which set of this exercise in this attempt is it? (1, 2, 3...)
  let setNumber = null;
  if (linkedToPlan) {
    const { count, error } = await supabase
      .from("workout_sets")
      .select("id", { count: "exact", head: true })
      .eq("run_id", runId)
      .eq("plan_exercise_id", planExerciseId);
    if (error) throw error;
    setNumber = (count ?? 0) + 1;
  }

  const { error } = await supabase.from("workout_sets").insert({
    user_id: userId,
    run_id: runId,
    plan_exercise_id: planExerciseId,
    exercise,
    set_number: setNumber,
    reps,
    target_reps: session?.targetReps ?? null,
  });
  if (error) throw error;

  if (linkedToPlan) await refreshRunProgress(runId, planExerciseId, setNumber);
}

// Ticks the exercise off once all of its planned sets are logged, then
// recalculates the attempt's totals (and finishes it when everything is done).
async function refreshRunProgress(runId, planExerciseId, setsLogged) {
  const { data: run, error } = await supabase
    .from("workout_runs")
    .select("plan_snapshot")
    .eq("id", runId)
    .single();
  if (error) throw error;
  if (!Array.isArray(run?.plan_snapshot)) return; // not the days-array shape

  const days = run.plan_snapshot.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) =>
      ex.id === planExerciseId && setsLogged >= ex.sets ? { ...ex, completed: true } : ex,
    ),
  }));

  const all = days.flatMap((day) => day.exercises);
  const total = all.length;
  const done = all.filter((ex) => ex.completed).length;
  const finished = total > 0 && done === total;

  const { error: updateError } = await supabase
    .from("workout_runs")
    .update({
      plan_snapshot: days,
      total_exercises: total,
      completed_exercises: done,
      completion_pct: total === 0 ? 0 : Math.round((done / total) * 100),
      // undefined fields are not sent, so an abandoned attempt isn't reopened
      status: finished ? "completed" : undefined,
      completed_at: finished ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (updateError) throw updateError;
}