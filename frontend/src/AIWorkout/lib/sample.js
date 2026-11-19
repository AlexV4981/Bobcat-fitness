// Example shown before the first workout is generated
export const SAMPLE_WORKOUT = {
  title: "Bodyweight Strength Builder",
  summary:
    "A full-body strength session using only bodyweight. Slow eccentrics and short rest keep it hard without equipment.",
  durationMin: 45,
  intensity: "Moderate–hard",
  isSample: true,
  warmup: [
    { name: "Jumping jacks", detail: "60 seconds" },
    { name: "Arm circles + band pull-aparts", detail: "10 each direction" },
    { name: "Bodyweight squats", detail: "2 × 10, slow" },
  ],
  blocks: [
    {
      name: "Main strength",
      rounds: 1,
      exercises: [
        { name: "Push-ups (3-sec lowering)", sets: 4, reps: "8–12", restSec: 90, cue: "Elbows at about 45°, body in one line." },
        { name: "Bulgarian split squats", sets: 4, reps: "8 / leg", restSec: 90, cue: "Front shin stays mostly vertical." },
        { name: "Inverted rows (table or bar)", sets: 4, reps: "8–10", restSec: 90, cue: "Pull your chest to the edge, squeeze shoulder blades." },
      ],
    },
    {
      name: "Finisher circuit",
      rounds: 3,
      exercises: [
        { name: "Glute bridges", sets: 1, reps: "15", restSec: 0, cue: "Pause 1 sec at the top." },
        { name: "Plank shoulder taps", sets: 1, reps: "20 total", restSec: 0, cue: "Keep hips still." },
        { name: "Reverse lunges", sets: 1, reps: "10 / leg", restSec: 60, cue: "Rest after the third move." },
      ],
    },
  ],
  cooldown: [
    { name: "Child's pose", detail: "60 seconds" },
    { name: "Hip flexor stretch", detail: "45 sec / side" },
    { name: "Doorway chest stretch", detail: "45 seconds" },
  ],
};

// Example 4-week program shown before the first workout or program is generated.
const wk = (...pairs) => pairs.map(([sets, reps]) => ({ sets, reps }));

export const SAMPLE_PROGRAM = {
  type: "program",
  isSample: true,
  title: "4-Week Bodyweight Foundation",
  summary:
    "Three full-body sessions a week. Reps climb for three weeks, then week 4 backs off so you recover before the next block.",
  intensity: "Moderate",
  progression: "Add 1–2 reps per set each week. Week 4 drops a set from every exercise as a deload.",
  weeks: 4,
  weekNotes: [
    { focus: "Learn the moves", note: "Leave 2–3 reps in the tank and focus on clean form.", deload: false },
    { focus: "Build volume", note: "Same exercises, a couple more reps each set.", deload: false },
    { focus: "Push harder", note: "Last set of each exercise should feel close to failure.", deload: false },
    { focus: "Deload", note: "One fewer set everywhere. Move well and recover.", deload: true },
  ],
  days: [
    {
      name: "Day 1 · Push + Legs",
      focus: "Chest, shoulders, quads",
      durationMin: 40,
      warmup: [
        { name: "Jumping jacks", detail: "60 seconds" },
        { name: "Arm circles", detail: "10 each direction" },
      ],
      blocks: [
        {
          name: "Main work",
          rounds: 1,
          exercises: [
            { name: "Push-ups", restSec: 90, cue: "Body in one line; use a bench if full push-ups are too hard.", weekly: wk([3, "8"], [3, "10"], [4, "10"], [3, "8"]) },
            { name: "Bulgarian split squats", restSec: 90, cue: "Front shin stays mostly vertical.", weekly: wk([3, "8 / leg"], [3, "10 / leg"], [4, "10 / leg"], [2, "8 / leg"]) },
            { name: "Pike push-ups", restSec: 75, cue: "Hips high, lower your head between your hands.", weekly: wk([3, "6"], [3, "8"], [3, "10"], [2, "6"]) },
          ],
        },
      ],
      cooldown: [
        { name: "Doorway chest stretch", detail: "45 seconds" },
        { name: "Quad stretch", detail: "30 sec / side" },
      ],
    },
    {
      name: "Day 2 · Pull + Core",
      focus: "Back, biceps, abs",
      durationMin: 35,
      warmup: [
        { name: "Cat-cow", detail: "10 reps" },
        { name: "Scapular pull-aparts", detail: "15 reps" },
      ],
      blocks: [
        {
          name: "Main work",
          rounds: 1,
          exercises: [
            { name: "Inverted rows (table or bar)", restSec: 90, cue: "Pull your chest to the edge and squeeze your shoulder blades.", weekly: wk([3, "8"], [3, "10"], [4, "10"], [3, "8"]) },
            { name: "Superman holds", restSec: 60, cue: "Lift chest and legs, keep your neck neutral.", weekly: wk([3, "20 sec"], [3, "25 sec"], [3, "30 sec"], [2, "20 sec"]) },
          ],
        },
        {
          name: "Core circuit",
          rounds: 3,
          exercises: [
            { name: "Dead bugs", restSec: 0, cue: "Lower back stays pressed into the floor.", weekly: wk([1, "10 / side"], [1, "12 / side"], [1, "14 / side"], [1, "8 / side"]) },
            { name: "Plank", restSec: 60, cue: "Squeeze glutes; rest after this move.", weekly: wk([1, "30 sec"], [1, "40 sec"], [1, "50 sec"], [1, "30 sec"]) },
          ],
        },
      ],
      cooldown: [{ name: "Child's pose", detail: "60 seconds" }],
    },
    {
      name: "Day 3 · Legs + Conditioning",
      focus: "Glutes, hamstrings, engine",
      durationMin: 40,
      warmup: [
        { name: "Leg swings", detail: "10 / leg" },
        { name: "Bodyweight squats", detail: "2 × 10, slow" },
      ],
      blocks: [
        {
          name: "Main work",
          rounds: 1,
          exercises: [
            { name: "Single-leg glute bridges", restSec: 60, cue: "Drive through the heel and pause at the top.", weekly: wk([3, "10 / leg"], [3, "12 / leg"], [4, "12 / leg"], [2, "10 / leg"]) },
            { name: "Reverse lunges", restSec: 75, cue: "Step back far enough that both knees reach 90°.", weekly: wk([3, "8 / leg"], [3, "10 / leg"], [4, "10 / leg"], [2, "8 / leg"]) },
          ],
        },
        {
          name: "Finisher",
          rounds: 4,
          exercises: [
            { name: "Squat jumps", restSec: 0, cue: "Land softly; swap for fast squats if jumping isn't an option.", weekly: wk([1, "10"], [1, "12"], [1, "15"], [1, "8"]) },
            { name: "Mountain climbers", restSec: 60, cue: "Hips level; rest after this move.", weekly: wk([1, "20 sec"], [1, "25 sec"], [1, "30 sec"], [1, "20 sec"]) },
          ],
        },
      ],
      cooldown: [
        { name: "Hamstring stretch", detail: "45 sec / side" },
        { name: "Hip flexor stretch", detail: "45 sec / side" },
      ],
    },
  ],
  done: [],
};
