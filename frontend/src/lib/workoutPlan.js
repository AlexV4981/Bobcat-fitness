/**
 * workoutPlan
 * ---------------------------------------------------------------------------
 * Pure helpers that translate between the two shapes a workout lives in:
 *
 *   working copy   what the AI Workout page edits (title, warmup, blocks, ...)
 *   DB row         public.workout_runs:
 *
 *     plan_snapshot  days array: [{ date, label, exercises: [{ id, name, sets, reps, completed }] }]
 *                    (the shape workoutLog.js / the camera page also read and write)
 *     session        jsonb: { title, summary, durationMin, intensity, warmup, blocks, cooldown }
 *     meta           jsonb: { source, options, category, icon, subtitle }
 *
 * `session` is the full editable workout. `plan_snapshot` is derived from it on every save.
 * Completion lives only in plan_snapshot[].exercises[].completed.
 *
 * Multi-week programs (session.type === "program") use the same row: `session` holds the
 * program (each training day once, with weekly sets/reps), and `plan_snapshot` gets one
 * dated day per session (week x day), so the Workouts tab shows every session on its date.
 */

// plan_snapshot is a days array; tolerate the column default ({"days": []}) too.
export function daysOf(row) {
  const snap = row?.plan_snapshot;
  if (Array.isArray(snap)) return snap;
  return Array.isArray(snap?.days) ? snap.days : [];
}

export function countDays(days) {
  const all = days.flatMap((d) => d.exercises ?? []);
  const total = all.length;
  const done = all.filter((e) => e.completed).length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function localToday() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newId(prefix = "ex") {
  const rnd = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

// Every block exercise needs a stable id so completion survives edits and reordering.
export function withIds(session) {
  return {
    ...session,
    blocks: session.blocks.map((b) => ({
      ...b,
      exercises: b.exercises.map((e) => ({ ...e, id: e.id ?? newId() })),
    })),
  };
}

// ----------------------------- multi-week programs -----------------------------

export const isProgram = (w) => w?.type === "program";

// Program exercises need stable ids too (same reason as withIds).
export function withProgramIds(program) {
  return {
    ...program,
    days: program.days.map((d) => ({
      ...d,
      blocks: d.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((e) => ({ ...e, id: e.id ?? newId() })),
      })),
    })),
  };
}

// One exercise appears in every week, so each week's copy gets its own id for completion.
export const instanceId = (exerciseId, week) => `${exerciseId}~w${week + 1}`;

// Spread training days across the week (offsets in days from the start of each week).
const DAY_OFFSETS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

export function sessionDate(startDate, week, day, daysPerWeek) {
  const offsets = DAY_OFFSETS[daysPerWeek] ?? [0, 1, 2, 3, 4, 5, 6];
  return addDays(startDate, week * 7 + (offsets[day] ?? day));
}

// plan_snapshot days for a program: one dated day per session, in date order.
export function programPlanDays(p) {
  const done = new Set(p.done ?? []);
  const days = [];
  for (let w = 0; w < p.weeks; w++) {
    p.days.forEach((day, d) => {
      days.push({
        date: sessionDate(p.scheduledDate, w, d, p.days.length),
        label: `Week ${w + 1} · ${day.name}`,
        exercises: day.blocks.flatMap((b) =>
          b.exercises.map((e) => {
            const id = instanceId(e.id, w);
            const rx = e.weekly[w] ?? e.weekly[e.weekly.length - 1];
            return {
              id,
              name: e.name,
              sets: b.rounds > 1 ? b.rounds : rx.sets,
              reps: rx.reps,
              completed: done.has(id),
            };
          }),
        ),
      });
    });
  }
  return days;
}

// Returns an error message, or "" when the program can be saved. Programs aren't edited
// field by field, so only the parts the user can change are checked.
export function validateProgram(p) {
  if (!p.title?.trim()) return "Give the program a title.";
  if (!p.scheduledDate) return "Pick a start date for the program.";
  if (!p.days?.length) return "This program has no training days.";
  return "";
}

const GOAL_META = [
  { match: /strength/i, category: "Strength & Power", icon: "🏋️‍♂️" },
  { match: /hypertrophy|muscle/i, category: "Hypertrophy", icon: "💪" },
  { match: /conditioning|endurance/i, category: "Cardio & Stamina", icon: "🔥" },
  { match: /calisthenics|skill/i, category: "Calisthenics", icon: "🤸" },
  { match: /mobility|recovery/i, category: "Mobility & Recovery", icon: "🧘" },
];
const DEFAULT_META = { category: "General Fitness", icon: "🏃" };

// ----------------------------- working copy -> DB -----------------------------

export function buildPlan(w) {
  if (isProgram(w)) return buildProgramPlan(w);
  const done = new Set(w.done ?? []);
  const exercises = w.blocks.flatMap((b) =>
    b.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      // circuits are stored as sets = 1 per exercise, so show the rounds instead
      sets: b.rounds > 1 ? b.rounds : e.sets,
      reps: e.reps,
      completed: done.has(e.id),
    })),
  );

  const options = w.meta?.options ?? null;
  const look = GOAL_META.find((g) => g.match.test(options?.goal ?? "")) ?? DEFAULT_META;

  return {
    days: [{ date: w.scheduledDate, label: w.title, exercises }],
    session: {
      title: w.title,
      summary: w.summary,
      durationMin: w.durationMin,
      intensity: w.intensity,
      warmup: w.warmup,
      blocks: w.blocks,
      cooldown: w.cooldown,
    },
    meta: {
      source: "ai",
      options,
      category: look.category,
      icon: look.icon,
      subtitle: [`${w.durationMin} min`, options?.focus].filter(Boolean).join(" · "),
    },
  };
}

function buildProgramPlan(p) {
  const options = p.meta?.options ?? null;
  const look = GOAL_META.find((g) => g.match.test(options?.goal ?? "")) ?? DEFAULT_META;
  return {
    days: programPlanDays(p),
    session: {
      type: "program",
      title: p.title,
      summary: p.summary,
      intensity: p.intensity,
      progression: p.progression,
      weeks: p.weeks,
      weekNotes: p.weekNotes,
      days: p.days,
    },
    meta: {
      source: "ai",
      options,
      category: look.category,
      icon: look.icon,
      subtitle: `${p.weeks} weeks · ${p.days.length} days/week`,
    },
  };
}

// Trim names and drop blank rows/blocks so empty inputs never reach the database.
export function cleanWorkout(w) {
  const items = (list) =>
    (list ?? [])
      .map((x) => ({ name: (x.name ?? "").trim(), detail: (x.detail ?? "").trim() }))
      .filter((x) => x.name);

  return {
    ...w,
    title: (w.title ?? "").trim(),
    summary: (w.summary ?? "").trim(),
    intensity: (w.intensity ?? "").trim(),
    durationMin: Math.max(1, Number(w.durationMin) || 1),
    warmup: items(w.warmup),
    cooldown: items(w.cooldown),
    blocks: w.blocks
      .map((b) => ({
        ...b,
        name: (b.name ?? "").trim() || "Main work",
        rounds: Math.max(1, Number(b.rounds) || 1),
        exercises: b.exercises
          .map((e) => ({
            ...e,
            name: (e.name ?? "").trim(),
            reps: String(e.reps ?? "").trim(),
            cue: (e.cue ?? "").trim(),
            sets: Number(e.sets) || 0,
            restSec: Math.max(0, Number(e.restSec) || 0),
          }))
          .filter((e) => e.name),
      }))
      .filter((b) => b.exercises.length > 0),
  };
}

// Returns an error message, or "" when the workout can be saved.
export function validateWorkout(w) {
  if (!w.title) return "Give the workout a title.";
  if (!w.scheduledDate) return "Pick a date for the workout.";
  if (w.blocks.length === 0) return "Add at least one exercise.";
  for (const b of w.blocks) {
    for (const e of b.exercises) {
      if (e.sets < 1) return `“${e.name}” needs at least 1 set.`;
      if (!e.reps) return `“${e.name}” needs a rep count (for example 8–10 or 30 sec).`;
    }
  }
  return "";
}

// ----------------------------- DB -> working copy / schedule card -----------------------------

// Rows without a session were not made by the generator, so the AI page can't edit them.
export function workoutFromRow(row) {
  const session = row?.session;
  if (!session) return null;
  const done = daysOf(row)
    .flatMap((d) => d.exercises ?? [])
    .filter((e) => e.completed)
    .map((e) => e.id);

  if (isProgram(session)) {
    return {
      ...withProgramIds(session),
      id: row.id,
      createdAt: Date.parse(row.created_at),
      scheduledDate: row.start_date,
      done,
      meta: row.meta ?? {},
    };
  }

  return {
    ...withIds(session),
    id: row.id,
    createdAt: Date.parse(row.created_at),
    scheduledDate: row.start_date,
    done,
    meta: row.meta ?? {},
  };
}

function deriveStatus(startDate, days, today) {
  const all = days.flatMap((d) => d.exercises ?? []);
  const done = all.filter((e) => e.completed).length;
  if (all.length > 0 && done === all.length) return "Completed";
  if (startDate > today) return "Upcoming";
  return done > 0 ? "In Progress" : "Active";
}

// The shape the Workouts tab already renders (name/category/subtitle/icon/status/days).
export function toSchedulePlan(row, today) {
  const days = daysOf(row);
  const meta = row.meta ?? {};
  return {
    id: row.id,
    editable: Boolean(row.session), // runs made elsewhere (e.g. the camera) can't be edited in the generator
    name: row.name,
    category: meta.category ?? "Workout",
    subtitle: meta.subtitle ?? "",
    icon: meta.icon ?? "🏋️‍♂️",
    status: deriveStatus(row.start_date, days, today),
    startDate: row.start_date,
    endDate: row.end_date,
    days,
  };
}

// ----------------------------- day-by-day editor (workouts without a session) -----------------------------
// Starter-kit and camera workouts are just a list of days, so they are edited directly
// on the Workouts tab. (AI-generated workouts are edited on the AI Workout page.)

export function draftFromPlan(plan) {
  const days = [...plan.days].sort((a, b) => a.date.localeCompare(b.date));
  return {
    id: plan.id,
    name: plan.name,
    days: days.map((d) => ({
      date: d.date,
      label: d.label ?? "",
      exercises: (d.exercises ?? []).map((e) => ({ ...e })),
    })),
  };
}

// Trim text, drop blank exercises and empty days, sort days by date.
export function cleanPlanDraft(draft) {
  return {
    ...draft,
    name: (draft.name ?? "").trim(),
    days: draft.days
      .map((day) => ({
        ...day,
        label: (day.label ?? "").trim() || "Workout",
        exercises: day.exercises
          .map((e) => ({
            ...e,
            name: (e.name ?? "").trim(),
            reps: String(e.reps ?? "").trim(),
            sets: Number(e.sets) || 0,
            completed: Boolean(e.completed),
          }))
          .filter((e) => e.name),
      }))
      .filter((day) => day.exercises.length > 0)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
  };
}

// Returns an error message, or "" when the draft can be saved.
export function validatePlanDraft(draft) {
  if (!draft.name) return "Give the workout a name.";
  if (draft.days.length === 0) return "Add at least one exercise.";
  const seen = new Set();
  for (const day of draft.days) {
    if (!day.date) return "Every day needs a date.";
    if (seen.has(day.date)) return "Two days have the same date. Give each day its own date.";
    seen.add(day.date);
    for (const e of day.exercises) {
      if (e.sets < 1) return `“${e.name}” needs at least 1 set.`;
      if (!e.reps) return `“${e.name}” needs a rep count (for example 8-10 or 30 sec).`;
    }
  }
  return "";
}
