// Talks to our FastAPI backend (backend/app/workout.py), which calls Gemini.
// The API key lives only on the server in backend/.env.local, never in the browser.
// In development, Vite forwards /api to the backend (see frontend/vite.config.js).
const ENDPOINT = "/api/ai-workout";

async function requestWorkout(body, what) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the workout service. Check your internet connection.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // No JSON error from FastAPI usually means the backend isn't running.
    if (!data?.detail)
      throw new Error("Couldn't reach the backend. Make sure it's running (uvicorn on port 8000).");
    throw new Error(typeof data.detail === "string" ? data.detail : `The ${what} request was invalid.`);
  }
  if (!data) throw new Error(`The ${what} came back garbled. Try again.`);
  return data;
}

function toRequest(o) {
  return {
    mode: o.mode,
    goal: o.goal,
    focus: o.focus,
    level: o.level,
    duration: o.duration,
    equipment: o.equipment,
    notes: o.notes,
    weeks: o.weeks,
    days_per_week: o.daysPerWeek,
  };
}

export function generateWorkout(options) {
  return requestWorkout(toRequest({ ...options, mode: "single" }), "workout");
}

// If the model returns fewer weeks than asked for, extra weeks continue the plan:
// they repeat the last normal (non-deload) week rather than copying a deload week.
const EXTRA_WEEK_NOTE = {
  focus: "Keep progressing",
  note: "Repeat last week's numbers and add a rep wherever it felt easy.",
  deload: false,
};

export function normalizeProgram(raw, weeks) {
  const notes = (raw.weekNotes || []).slice(0, weeks);
  // Index of the most recent normal week among the weeks the model did write
  const lastNormal = (count) => {
    for (let i = Math.min(count, notes.length) - 1; i >= 0; i--) if (!notes[i]?.deload) return i;
    return count - 1;
  };
  const fitWeekly = (weekly) => {
    const list = Array.isArray(weekly) && weekly.length ? weekly.slice(0, weeks) : [{ sets: 3, reps: "10" }];
    const source = list[Math.max(0, lastNormal(list.length))];
    while (list.length < weeks) list.push(source);
    return list;
  };
  while (notes.length < weeks) notes.push(EXTRA_WEEK_NOTE);

  return {
    ...raw,
    weeks,
    weekNotes: notes,
    days: (raw.days || []).map((day) => ({
      ...day,
      blocks: (day.blocks || []).map((b) => ({
        ...b,
        exercises: (b.exercises || []).map((e) => ({ ...e, weekly: fitWeekly(e.weekly) })),
      })),
    })),
  };
}

export async function generateProgram(options) {
  const raw = await requestWorkout(toRequest({ ...options, mode: "program" }), "program");
  return normalizeProgram(raw, options.weeks);
}
