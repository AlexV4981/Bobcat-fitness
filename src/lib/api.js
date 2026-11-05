// Talks to the generative model backend. Nothing in here is shown to the user.
   const DEFAULT_MODEL = import.meta.env.VITE_MODEL || "gemini-3.8-flash";
const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

export const ENV_API_KEY = import.meta.env.VITE_API_KEY || "";

const SYSTEM = `You are an experienced strength and conditioning coach. Design one complete, safe, realistic workout session.
Rules:
- Use ONLY the equipment listed. If "bodyweight only" is the sole item, use no equipment except household items like a chair or table.
- Fit the total time (warm-up + main work + rest + cool-down) to the requested duration.
- Match volume and exercise difficulty to the level. Give regressions in the cue when a move is hard for the level.
- "reps" can be a number, a range, per-side counts, or a time like "30 sec".
- For circuits, set rounds > 1, sets = 1 per exercise, and put the between-round rest on the last exercise.
- Cues are one short sentence about form.
- Respect any injuries or constraints in the notes. Do not give medical advice.`;

const item = {
  type: "OBJECT",
  properties: { name: { type: "STRING" }, detail: { type: "STRING" } },
  required: ["name", "detail"],
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    durationMin: { type: "INTEGER" },
    intensity: { type: "STRING" },
    warmup: { type: "ARRAY", items: item },
    blocks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          rounds: { type: "INTEGER" },
          exercises: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                sets: { type: "INTEGER" },
                reps: { type: "STRING" },
                restSec: { type: "INTEGER" },
                cue: { type: "STRING" },
              },
              required: ["name", "sets", "reps", "restSec", "cue"],
            },
          },
        },
        required: ["name", "rounds", "exercises"],
      },
    },
    cooldown: { type: "ARRAY", items: item },
  },
  required: ["title", "summary", "durationMin", "intensity", "warmup", "blocks", "cooldown"],
};

function buildPrompt({ goal, focus, level, duration, equipment, notes }) {
  return `Build a workout.
Goal: ${goal}
Focus: ${focus}
Level: ${level}
Total time: ${duration} minutes
Equipment available: ${equipment.length ? equipment.join(", ") : "bodyweight only"}
Notes from the athlete: ${notes.trim() || "none"}`;
}

export async function generateWorkout(apiKey, options) {
  let res;
  try {
    res = await fetch(ENDPOINT(DEFAULT_MODEL), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: buildPrompt(options) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.9,
        },
      }),
    });
  } catch {
    throw new Error("Couldn't reach the workout service. Check your internet connection.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data?.error?.message || res.statusText;
    if (res.status === 400 && /API key/i.test(m))
      throw new Error("Your API key was rejected. Check that you copied the whole key.");
    if (res.status === 404) throw new Error("The workout service is unavailable right now. Try again later.");
    if (res.status === 429) throw new Error("Rate limit hit on your key. Wait a minute and try again.");
    throw new Error(`Something went wrong (${res.status}): ${m}`);
  }

  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");
  if (!text)
    throw new Error(`The workout came back empty${cand?.finishReason ? ` (${cand.finishReason})` : ""}. Try again.`);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The workout came back garbled. Try again.");
  }
}
