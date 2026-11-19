export function fmtRest(sec) {
  if (!sec) return "";
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec}s`;
}

export function fmtClock(sec) {
  const a = Math.abs(sec);
  return `${sec < 0 ? "+" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

export function countExercises(w) {
  return w.blocks.reduce((n, b) => n + b.exercises.length, 0);
}

export function countSets(w) {
  return w.blocks.reduce(
    (n, b) => n + b.exercises.reduce((m, e) => m + e.sets * Math.max(1, b.rounds), 0),
    0
  );
}

export function workoutToText(w) {
  let t = `${w.title} (${w.durationMin} min)\n${w.summary}\n\nWARM-UP\n`;
  t += w.warmup.map((x) => `- ${x.name}: ${x.detail}`).join("\n");
  for (const b of w.blocks) {
    t += `\n\n${b.name.toUpperCase()}${b.rounds > 1 ? ` — ${b.rounds} rounds` : ""}\n`;
    t += b.exercises
      .map(
        (e) =>
          `- ${e.name}: ${b.rounds > 1 ? "" : e.sets + " x "}${e.reps}${
            e.restSec ? `, rest ${fmtRest(e.restSec)}` : ""
          }\n  ${e.cue}`
      )
      .join("\n");
  }
  t += `\n\nCOOL-DOWN\n` + w.cooldown.map((x) => `- ${x.name}: ${x.detail}`).join("\n");
  return t;
}

// ---------- Multi-week program helpers ----------

// Key used to store which exercises are checked for one session (week and day are 0-based).
export function sessionKey(week, day) {
  return `${week}-${day}`;
}

// Builds a normal single-workout object for one day of one week,
// so it can be shown with the same components as a single workout.
export function dayWorkout(program, week, day) {
  const d = program.days[day];
  return {
    title: d.name,
    durationMin: d.durationMin,
    warmup: d.warmup,
    cooldown: d.cooldown,
    blocks: d.blocks.map((b) => ({
      ...b,
      exercises: b.exercises.map((e) => ({
        name: e.name,
        cue: e.cue,
        restSec: e.restSec,
        sets: e.weekly[week].sets,
        reps: e.weekly[week].reps,
      })),
    })),
  };
}

export function isSessionDone(program, week, day) {
  const checked = program.done?.[sessionKey(week, day)] || [];
  return checked.length > 0 && checked.length >= countExercises(program.days[day]);
}

export function countSessionsDone(program) {
  let n = 0;
  for (let w = 0; w < program.weeks; w++)
    for (let d = 0; d < program.days.length; d++) if (isSessionDone(program, w, d)) n++;
  return n;
}

// First session that isn't finished yet, so the page opens where the user left off.
export function nextSession(program) {
  for (let w = 0; w < program.weeks; w++)
    for (let d = 0; d < program.days.length; d++)
      if (!isSessionDone(program, w, d)) return { week: w, day: d };
  return { week: 0, day: 0 };
}

export function programToText(p) {
  let t = `${p.title} (${p.weeks} weeks, ${p.days.length} days/week)\n${p.summary}\n\nPROGRESSION\n${p.progression}\n\nWEEKS\n`;
  t += p.weekNotes
    .map((w, i) => `- Week ${i + 1}${w.deload ? " (deload)" : ""}: ${w.focus}. ${w.note}`)
    .join("\n");
  for (const d of p.days) {
    t += `\n\n${d.name.toUpperCase()} (${d.durationMin} min)\nWarm-up: ${d.warmup.map((x) => `${x.name} ${x.detail}`).join("; ")}`;
    for (const b of d.blocks) {
      t += `\n${b.name}${b.rounds > 1 ? ` — ${b.rounds} rounds` : ""}`;
      for (const e of b.exercises) {
        const weeks = e.weekly.map((x, i) => `W${i + 1} ${b.rounds > 1 ? "" : x.sets + "x"}${x.reps}`).join(", ");
        t += `\n- ${e.name}${e.restSec ? ` (rest ${fmtRest(e.restSec)})` : ""}: ${weeks}`;
      }
    }
    t += `\nCool-down: ${d.cooldown.map((x) => `${x.name} ${x.detail}`).join("; ")}`;
  }
  return t;
}
