import React, { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import "./WorkoutSchedulePage.css";

/**
 * WorkoutSchedulePage
 * ---------------------------------------------------------------------------
 * Shows progress against a workout plan:
 *  - Left: a burnup chart (cumulative exercises completed vs. scheduled)
 *    plotted against the plan's real calendar dates.
 *  - Right: <ExercisePanel />, a scrolling checklist of every exercise in the
 *    plan, grouped by day, showing status (done / today / missed / upcoming).
 *
 * Styles live in ./WorkoutSchedulePage.css.
 *
 * DATA SHAPE (swap MOCK_PLAN for your real data / API response):
 *
 * plan = {
 *   name: string,
 *   startDate: "YYYY-MM-DD",
 *   endDate: "YYYY-MM-DD",
 *   days: [
 *     {
 *       date: "YYYY-MM-DD",
 *       label: string,            // e.g. "Push Day", "Rest"
 *       exercises: [
 *         {
 *           id: string,
 *           name: string,
 *           sets: number,
 *           reps: string,          // "8-10" or "12" etc.
 *           completed: boolean,
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * PROPS
 *   plan               Plan object above. If it changes (e.g. after a fetch),
 *                      the page re-syncs to it.
 *   today              "YYYY-MM-DD", defaults to the user's local date.
 *   onToggleExercise   Optional (dateStr, exerciseId, nextCompleted) => void.
 *                      Fires after each checkbox toggle. Use it to persist to
 *                      your API or to lift state into App.
 *
 * REPLACING THE EXERCISE LIST LATER
 *   The right-hand panel is fully isolated in <ExercisePanel />. It only needs
 *   `days`, `today` and `onToggle`, and it owns its own scrolling
 *   (.ws-exercises in the CSS). To plug in real exercise plans, either:
 *     1. keep the same day/exercise shape and just change the data source, or
 *     2. write a new panel component with the same three props and swap it in
 *        at the "RIGHT PANEL" marker in the page below, or
 *     3. if your API's shape differs, map it once in an adapter (see
 *        `adaptApiPlan` below) so nothing else has to change.
 * ---------------------------------------------------------------------------
 */

// ----------------------------- Mock data ------------------------------------
// Replace this with props / a fetch / your app state.
const MOCK_PLAN = {
  name: "Strength Foundations — Week 1-4",
  startDate: "2026-09-01",
  endDate: "2026-09-28",
  days: [
    {
      date: "2026-09-01",
      label: "Push Day",
      exercises: [
        { id: "e1", name: "Barbell Bench Press", sets: 4, reps: "6-8", completed: true },
        { id: "e2", name: "Overhead Press", sets: 3, reps: "8-10", completed: true },
        { id: "e3", name: "Incline Dumbbell Press", sets: 3, reps: "10-12", completed: true },
      ],
    },
    {
      date: "2026-09-03",
      label: "Pull Day",
      exercises: [
        { id: "e4", name: "Deadlift", sets: 4, reps: "5", completed: true },
        { id: "e5", name: "Barbell Row", sets: 3, reps: "8-10", completed: true },
        { id: "e6", name: "Lat Pulldown", sets: 3, reps: "10-12", completed: false },
      ],
    },
    {
      date: "2026-09-05",
      label: "Leg Day",
      exercises: [
        { id: "e7", name: "Back Squat", sets: 4, reps: "6-8", completed: true },
        { id: "e8", name: "Romanian Deadlift", sets: 3, reps: "8-10", completed: false },
        { id: "e9", name: "Walking Lunge", sets: 3, reps: "12/leg", completed: false },
      ],
    },
    {
      date: "2026-09-08",
      label: "Push Day",
      exercises: [
        { id: "e10", name: "Barbell Bench Press", sets: 4, reps: "6-8", completed: true },
        { id: "e11", name: "Arnold Press", sets: 3, reps: "10-12", completed: false },
        { id: "e12", name: "Cable Fly", sets: 3, reps: "12-15", completed: false },
      ],
    },
    {
      date: "2026-09-10",
      label: "Pull Day",
      exercises: [
        { id: "e13", name: "Weighted Pull-Up", sets: 4, reps: "6-8", completed: false },
        { id: "e14", name: "Seated Cable Row", sets: 3, reps: "10-12", completed: false },
        { id: "e15", name: "Face Pull", sets: 3, reps: "15", completed: false },
      ],
    },
    {
      date: "2026-09-12",
      label: "Leg Day",
      exercises: [
        { id: "e16", name: "Front Squat", sets: 4, reps: "6-8", completed: false },
        { id: "e17", name: "Leg Press", sets: 3, reps: "10-12", completed: false },
        { id: "e18", name: "Calf Raise", sets: 4, reps: "15-20", completed: false },
      ],
    },
    {
      date: "2026-09-15",
      label: "Push Day",
      exercises: [
        { id: "e19", name: "Barbell Bench Press", sets: 4, reps: "6-8", completed: false },
        { id: "e20", name: "Overhead Press", sets: 3, reps: "8-10", completed: false },
      ],
    },
    {
      date: "2026-09-22",
      label: "Pull Day",
      exercises: [
        { id: "e21", name: "Deadlift", sets: 4, reps: "5", completed: false },
        { id: "e22", name: "Barbell Row", sets: 3, reps: "8-10", completed: false },
      ],
    },
    {
      date: "2026-09-28",
      label: "Leg Day",
      exercises: [
        { id: "e23", name: "Back Squat", sets: 4, reps: "6-8", completed: false },
        { id: "e24", name: "Romanian Deadlift", sets: 3, reps: "8-10", completed: false },
      ],
    },
  ],
};

// ----------------------------- API adapter -----------------------------------

/**
 * Placeholder for when real exercise plans come from your backend.
 * Map whatever the API returns into the plan shape documented above, then
 * pass the result in as the `plan` prop. Example (adjust to your response):
 *
 *   export function adaptApiPlan(api) {
 *     return {
 *       name: api.title,
 *       startDate: api.start_date,
 *       endDate: api.end_date,
 *       days: api.sessions.map((s) => ({
 *         date: s.scheduled_for,
 *         label: s.name,
 *         exercises: s.exercises.map((e) => ({
 *           id: String(e.id),
 *           name: e.exercise_name,
 *           sets: e.sets,
 *           reps: String(e.reps),
 *           completed: e.status === "done",
 *         })),
 *       })),
 *     };
 *   }
 */
export function adaptApiPlan(apiPlan) {
  return apiPlan;
}

// ----------------------------- Helpers ---------------------------------------

// Chart colors must be JS values (Recharts props). Keep in sync with the
// tokens at the top of WorkoutSchedulePage.css.
const CHART_COLORS = {
  green: "#c8d629",
  orange: "#D9822B",
  greyLine: "#C9C9C2",
  tickText: "#8A8A83",
  axisLine: "#E4E4DE",
  grid: "#F0F0EC",
};

function localToday() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toDate(d) {
  return new Date(`${d}T00:00:00`);
}

function formatShort(d) {
  return toDate(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isSameDay(a, b) {
  return a === b;
}

function isPast(dateStr, today) {
  return toDate(dateStr) < toDate(today);
}

function sortDays(days) {
  return [...days].sort((a, b) => toDate(a.date) - toDate(b.date));
}

/**
 * Builds a cumulative burnup series across the plan's date range:
 * one point per scheduled workout day, tracking cumulative exercises
 * completed vs. cumulative exercises scheduled ("target").
 */
function buildBurnupSeries(plan) {
  let cumulativeTarget = 0;
  let cumulativeCompleted = 0;

  return sortDays(plan.days).map((day) => {
    cumulativeTarget += day.exercises.length;
    cumulativeCompleted += day.exercises.filter((e) => e.completed).length;
    return {
      date: day.date,
      dateLabel: formatShort(day.date),
      target: cumulativeTarget,
      completed: cumulativeCompleted,
    };
  });
}

function planStats(plan) {
  const allExercises = plan.days.flatMap((d) => d.exercises);
  const total = allExercises.length;
  const done = allExercises.filter((e) => e.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}

// ----------------------------- Chart pieces -----------------------------------

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const completed = payload.find((p) => p.dataKey === "completed")?.value ?? 0;
  const target = payload.find((p) => p.dataKey === "target")?.value ?? 0;
  return (
    <div className="ws-tooltip">
      <div className="ws-tooltip-title">{label}</div>
      <div>Completed: {completed}</div>
      <div className="ws-tooltip-secondary">Scheduled: {target}</div>
    </div>
  );
}

function Legend({ swatch, label, dashed }) {
  return (
    <div className="ws-legend-item">
      <span
        className={`ws-legend-swatch ${dashed ? "ws-legend-swatch--dashed" : ""}`}
        style={{ "--swatch": swatch }}
      />
      <span className="ws-legend-label">{label}</span>
    </div>
  );
}

// ----------------------------- Exercise panel ----------------------------------

const STATUS_TEXT = {
  done: "Done",
  today: "Today",
  missed: "Missed",
  upcoming: "Upcoming",
};

function statusOf(day, exercise, today) {
  if (exercise.completed) return "done";
  if (isSameDay(day.date, today)) return "today";
  if (isPast(day.date, today)) return "missed";
  return "upcoming";
}

function ExerciseRow({ day, exercise, today, onToggle }) {
  const status = statusOf(day, exercise, today);

  return (
    <li className="ws-exercise-row">
      <button
        type="button"
        className={`ws-check ${exercise.completed ? "is-checked" : ""}`}
        onClick={() => onToggle(day.date, exercise.id)}
        aria-pressed={exercise.completed}
        aria-label={
          exercise.completed
            ? `Mark ${exercise.name} incomplete`
            : `Mark ${exercise.name} complete`
        }
      >
        {exercise.completed && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8.5L6.2 11.5L13 4.5"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div className="ws-exercise-info">
        <div className={`ws-exercise-name ${exercise.completed ? "is-done" : ""}`}>
          {exercise.name}
        </div>
        <div className="ws-exercise-detail">
          {exercise.sets} sets × {exercise.reps}
        </div>
      </div>

      <span className={`ws-status ws-status--${status}`}>{STATUS_TEXT[status]}</span>
    </li>
  );
}

/**
 * ExercisePanel: the scrolling right-hand column.
 * Self-contained: give it `days`, `today` and `onToggle` and it renders a
 * scrollable, day-grouped checklist. Swap this component out (or change how
 * `days` is produced) when real exercise plans land.
 */
function ExercisePanel({ days, today, onToggle }) {
  return (
    <section className="ws-card ws-exercises">
      <h2 className="ws-exercises-title">Exercises</h2>

      {days.length === 0 && (
        <p className="ws-exercises-empty">No exercises scheduled yet.</p>
      )}

      {days.map((day) => (
        <div key={day.date} className="ws-day">
          <div className="ws-day-header">
            <span className="ws-day-label">{day.label}</span>
            <span className="ws-day-date">{formatShort(day.date)}</span>
          </div>
          <ul className="ws-exercise-list">
            {day.exercises.map((exercise) => (
              <ExerciseRow
                key={exercise.id}
                day={day}
                exercise={exercise}
                today={today}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

// ----------------------------- Main component ----------------------------------

export default function WorkoutSchedulePage({
  plan = MOCK_PLAN,
  today = localToday(),
  onToggleExercise,
}) {
  const [localPlan, setLocalPlan] = useState(plan);

  // Re-sync when a new plan arrives (e.g. after fetching from the API).
  useEffect(() => {
    setLocalPlan(plan);
  }, [plan]);

  const burnupData = useMemo(() => buildBurnupSeries(localPlan), [localPlan]);
  const stats = useMemo(() => planStats(localPlan), [localPlan]);
  const sortedDays = useMemo(() => sortDays(localPlan.days), [localPlan]);

  function handleToggle(dateStr, exerciseId) {
    let nextCompleted = false;

    setLocalPlan((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.date !== dateStr
          ? day
          : {
              ...day,
              exercises: day.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                nextCompleted = !ex.completed;
                return { ...ex, completed: nextCompleted };
              }),
            }
      ),
    }));

    onToggleExercise?.(dateStr, exerciseId, nextCompleted);
  }

  const todayIndex = burnupData.findIndex((d) => d.date >= today);
  const todayLabel = todayIndex >= 0 ? burnupData[todayIndex].dateLabel : null;

  return (
    <div className="ws-page">
      <header className="ws-header">
        <div className="ws-header-dates">
          {formatShort(localPlan.startDate)} – {formatShort(localPlan.endDate)}
        </div>
        <h1 className="ws-header-title">{localPlan.name}</h1>
      </header>

      <div className="ws-grid">
        {/* LEFT: burnup chart */}
        <section className="ws-card ws-chart-card">
          <div className="ws-chart-card-header">
            <h2 className="ws-card-title">Progress</h2>
            <div className="ws-chart-stats">
              {stats.done} / {stats.total} exercises · {stats.pct}%
            </div>
          </div>

          <div className="ws-chart-area">
            <ResponsiveContainer>
              <ComposedChart
                data={burnupData}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="completedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 12, fill: CHART_COLORS.tickText }}
                  axisLine={{ stroke: CHART_COLORS.axisLine }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: CHART_COLORS.tickText }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                {todayLabel && (
                  <ReferenceLine
                    x={todayLabel}
                    stroke={CHART_COLORS.orange}
                    strokeDasharray="4 4"
                    label={{
                      value: "Today",
                      position: "top",
                      fill: CHART_COLORS.orange,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke={CHART_COLORS.greyLine}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  name="Scheduled"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke={CHART_COLORS.green}
                  strokeWidth={2.5}
                  fill="url(#completedFill)"
                  dot={{ r: 3, fill: CHART_COLORS.green, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name="Completed"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="ws-legend">
            <Legend swatch={CHART_COLORS.green} label="Completed" />
            <Legend swatch={CHART_COLORS.greyLine} dashed label="Scheduled" />
          </div>
        </section>

        {/* RIGHT PANEL: swap this for a new exercise-plan component later */}
        <ExercisePanel days={sortedDays} today={today} onToggle={handleToggle} />
      </div>
    </div>
  );
}