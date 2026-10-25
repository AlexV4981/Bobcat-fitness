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
