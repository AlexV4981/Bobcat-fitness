import { localToday } from "./workoutPlan.js";

/**
 * Starter kit: ready-made plans users can add next to their AI-generated ones.
 * Each day is { day, label, exercises: [[name, sets, reps], ...] }, where `day` is the
 * number of days after the date the plan is added, so a plan always starts today.
 */
export const STARTER_PLANS = [
  {
    id: "strength-foundations",
    category: "Strength & Power",
    name: "Strength Foundations",
    subtitle: "4-Week Compound Progression",
    icon: "🏋️‍♂️",
    lengthDays: 28,
    days: [
      { day: 0, label: "Push Day", exercises: [["Barbell Bench Press", 4, "6-8"], ["Overhead Press", 3, "8-10"], ["Incline Dumbbell Press", 3, "10-12"]] },
      { day: 2, label: "Pull Day", exercises: [["Deadlift", 4, "5"], ["Barbell Row", 3, "8-10"], ["Lat Pulldown", 3, "10-12"]] },
      { day: 4, label: "Leg Day", exercises: [["Back Squat", 4, "6-8"], ["Romanian Deadlift", 3, "8-10"], ["Walking Lunge", 3, "12/leg"]] },
      { day: 7, label: "Push Day", exercises: [["Barbell Bench Press", 4, "6-8"], ["Arnold Press", 3, "10-12"], ["Cable Fly", 3, "12-15"]] },
      { day: 9, label: "Pull Day", exercises: [["Weighted Pull-Up", 4, "6-8"], ["Seated Cable Row", 3, "10-12"], ["Face Pull", 3, "15"]] },
      { day: 11, label: "Leg Day", exercises: [["Front Squat", 4, "6-8"], ["Leg Press", 3, "10-12"], ["Calf Raise", 4, "15-20"]] },
    ],
  },
  {
    id: "upper-hypertrophy",
    category: "Hypertrophy",
    name: "Upper Body Hypertrophy",
    subtitle: "High Volume Muscle Building",
    icon: "💪",
    lengthDays: 28,
    days: [
      { day: 0, label: "Chest & Biceps", exercises: [["Incline Dumbbell Press", 4, "10-12"], ["Cable Curls", 3, "12-15"], ["Push-Up", 3, "15"]] },
      { day: 2, label: "Back & Triceps", exercises: [["Lat Pulldown", 4, "10-12"], ["Seated Cable Row", 3, "10-12"], ["Triceps Pushdown", 3, "12-15"]] },
      { day: 4, label: "Shoulders & Arms", exercises: [["Dumbbell Shoulder Press", 4, "10-12"], ["Lateral Raise", 3, "15"], ["Hammer Curl", 3, "12"]] },
      { day: 7, label: "Chest & Back", exercises: [["Dumbbell Bench Press", 4, "10-12"], ["One-Arm Dumbbell Row", 3, "10/side"], ["Cable Fly", 3, "12-15"]] },
    ],
  },
  {
    id: "hiit-core",
    category: "Cardio & Stamina",
    name: "HIIT & Core Conditioning",
    subtitle: "Fat Burn & Athleticism",
    icon: "🔥",
    lengthDays: 14,
    days: [
      { day: 0, label: "HIIT Circuit", exercises: [["Burpees", 4, "30 sec"], ["Mountain Climbers", 4, "40 sec"], ["Jump Squats", 4, "20"]] },
      { day: 2, label: "Core Focus", exercises: [["Plank", 3, "45 sec"], ["Bicycle Crunch", 3, "20"], ["Leg Raise", 3, "12"]] },
      { day: 4, label: "HIIT Circuit", exercises: [["High Knees", 4, "40 sec"], ["Push-Up", 4, "12"], ["Skater Hops", 4, "30 sec"]] },
      { day: 7, label: "Core & Conditioning", exercises: [["Russian Twist", 3, "30"], ["Sit-Up", 3, "15"], ["Burpees", 3, "45 sec"]] },
    ],
  },
  {
    id: "five-k-base",
    category: "Endurance",
    name: "5K Speed & Base Build",
    subtitle: "Aerobic Running Progression",
    icon: "🏃‍♂️",
    lengthDays: 28,
    days: [
      { day: 0, label: "Easy Run", exercises: [["Easy Run", 1, "20 min"], ["Strides", 4, "20 sec"]] },
      { day: 2, label: "Intervals", exercises: [["Warm-Up Jog", 1, "10 min"], ["400 m Repeats", 6, "400 m"], ["Cool-Down Jog", 1, "10 min"]] },
      { day: 4, label: "Tempo Run", exercises: [["Tempo Run", 1, "20 min"]] },
      { day: 7, label: "Long Run", exercises: [["Long Easy Run", 1, "35 min"]] },
    ],
  },
];

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function starterCounts(plan) {
  return {
    sessions: plan.days.length,
    exercises: plan.days.reduce((n, d) => n + d.exercises.length, 0),
  };
}

// A starter plan dated from `today`, with nothing ticked off, ready to insert.
export function instantiateStarter(plan, today = localToday()) {
  return {
    name: plan.name,
    start_date: today,
    end_date: addDays(today, plan.lengthDays - 1),
    days: plan.days.map((d) => ({
      date: addDays(today, d.day),
      label: d.label,
      exercises: d.exercises.map(([name, sets, reps], i) => ({
        id: `${plan.id}-d${d.day}-${i + 1}`,
        name,
        sets,
        reps,
        completed: false,
      })),
    })),
    meta: {
      source: "starter",
      starterId: plan.id,
      category: plan.category,
      icon: plan.icon,
      subtitle: plan.subtitle,
    },
  };
}
