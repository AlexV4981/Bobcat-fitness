// View helpers for multi-week programs (the saved shape lives in ../../lib/workoutPlan.js).
import { instanceId, sessionDate } from "../../lib/workoutPlan.js";
import { fmtRest } from "./format.js";

// One session (week, day) as a normal single-workout object, using that week's sets/reps.
// Exercise ids are per-week, so checking off week 2 doesn't tick week 1.
export function dayWorkout(program, week, day) {
  const d = program.days[day];
  return {
    title: d.name,
    durationMin: d.durationMin,
    warmup: d.warmup,
    cooldown: d.cooldown,
    blocks: d.blocks.map((b) => ({
      ...b,
      exercises: b.exercises.map((e) => {
        const rx = e.weekly[week] ?? e.weekly[e.weekly.length - 1];
        return { id: instanceId(e.id, week), name: e.name, cue: e.cue, restSec: e.restSec, sets: rx.sets, reps: rx.reps };
      }),
    })),
  };
}

export function sessionIds(program, week, day) {
  return program.days[day].blocks.flatMap((b) => b.exercises.map((e) => instanceId(e.id, week)));
}

export function isSessionDone(program, week, day) {
  const done = new Set(program.done ?? []);
  const ids = sessionIds(program, week, day);
  return ids.length > 0 && ids.every((id) => done.has(id));
}

export function countSessionsDone(program) {
  let n = 0;
  for (let w = 0; w < program.weeks; w++)
    for (let d = 0; d < program.days.length; d++) if (isSessionDone(program, w, d)) n++;
  return n;
}

// First unfinished session, so the page opens where the user left off.
export function nextSession(program) {
  for (let w = 0; w < program.weeks; w++)
    for (let d = 0; d < program.days.length; d++) if (!isSessionDone(program, w, d)) return { week: w, day: d };
  return { week: 0, day: 0 };
}

export function sessionDateOf(program, week, day) {
  return program.scheduledDate ? sessionDate(program.scheduledDate, week, day, program.days.length) : null;
}

export function programToText(p) {
  let t = `${p.title} (${p.weeks} weeks, ${p.days.length} days/week)\n${p.summary}\n\nPROGRESSION\n${p.progression}\n\nWEEKS\n`;
  t += p.weekNotes.map((w, i) => `- Week ${i + 1}${w.deload ? " (deload)" : ""}: ${w.focus}. ${w.note}`).join("\n");
  for (const d of p.days) {
    t += `\n\n${d.name.toUpperCase()} (${d.durationMin} min)`;
    if (d.warmup.length) t += `\nWarm-up: ${d.warmup.map((x) => `${x.name} ${x.detail}`).join("; ")}`;
    for (const b of d.blocks) {
      t += `\n${b.name}${b.rounds > 1 ? ` — ${b.rounds} rounds` : ""}`;
      for (const e of b.exercises) {
        const weeks = e.weekly.map((x, i) => `W${i + 1} ${b.rounds > 1 ? "" : `${x.sets}x`}${x.reps}`).join(", ");
        t += `\n- ${e.name}${e.restSec ? ` (rest ${fmtRest(e.restSec)})` : ""}: ${weeks}`;
      }
    }
    if (d.cooldown.length) t += `\nCool-down: ${d.cooldown.map((x) => `${x.name} ${x.detail}`).join("; ")}`;
  }
  return t;
}
