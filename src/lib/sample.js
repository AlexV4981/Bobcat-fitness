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
