import React, { useMemo, useState } from "react";
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

/**
 * WorkoutSchedulePage
 * ---------------------------------------------------------------------------
 * Shows progress against a workout plan:
 *  - Left: a burnup chart (cumulative exercises completed vs. target-to-date)
 *    plotted against the plan's real calendar dates.
 *  - Right: a checklist of every exercise in the plan, grouped by day,
 *    showing status (done / today / upcoming).
 *
 * DATA SHAPE (swap the MOCK_PLAN below for your real data / API response):
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

// ----------------------------- Helpers ---------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * Builds a cumulative burnup series across the plan's date range:
 * one point per scheduled workout day, tracking cumulative exercises
 * completed vs. cumulative exercises scheduled ("target").
 */
function buildBurnupSeries(plan) {
  const sortedDays = [...plan.days].sort(
    (a, b) => toDate(a.date) - toDate(b.date)
  );

  let cumulativeTarget = 0;
  let cumulativeCompleted = 0;

  return sortedDays.map((day) => {
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

// ----------------------------- Chart tooltip ----------------------------------

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const completed = payload.find((p) => p.dataKey === "completed")?.value ?? 0;
  const target = payload.find((p) => p.dataKey === "target")?.value ?? 0;
  return (
    <div
      style={{
        background: "#1C1D1B",
        color: "#F3F2EE",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        lineHeight: 1.4,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>Completed: {completed}</div>
      <div style={{ opacity: 0.7 }}>Scheduled: {target}</div>
    </div>
  );
}

// ----------------------------- Checklist item ----------------------------------

function statusOf(day, exercise, today) {
  if (exercise.completed) return "done";
  if (isSameDay(day.date, today)) return "today";
  if (isPast(day.date, today)) return "missed";
  return "upcoming";
}

const STATUS_STYLES = {
  done: { bg: "#E4F1E8", fg: "#2C6E49", dot: "#2C6E49", text: "Done" },
  today: { bg: "#FDF0DA", fg: "#9A5B13", dot: "#D9822B", text: "Today" },
  missed: { bg: "#F5E9E7", fg: "#9C4A3C", dot: "#C1584A", text: "Missed" },
  upcoming: { bg: "#F0F0EE", fg: "#6B6B65", dot: "#B7B7AF", text: "Upcoming" },
};

function ExerciseRow({ day, exercise, today, onToggle }) {
  const status = statusOf(day, exercise, today);
  const s = STATUS_STYLES[status];

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 4px",
        borderBottom: "1px solid #ECECE8",
      }}
    >
      <button
        onClick={() => onToggle(day.date, exercise.id)}
        aria-pressed={exercise.completed}
        aria-label={
          exercise.completed
            ? `Mark ${exercise.name} incomplete`
            : `Mark ${exercise.name} complete`
        }
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `2px solid ${exercise.completed ? "#2C6E49" : "#C9C9C2"}`,
          background: exercise.completed ? "#2C6E49" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {exercise.completed && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
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

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#1C1D1B",
            textDecoration: exercise.completed ? "line-through" : "none",
            opacity: exercise.completed ? 0.6 : 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {exercise.name}
        </div>
        <div style={{ fontSize: 12.5, color: "#8A8A83", marginTop: 1 }}>
          {exercise.sets} sets × {exercise.reps}
        </div>
      </div>

      <span
        style={{
          flexShrink: 0,
          fontSize: 11.5,
          fontWeight: 600,
          color: s.fg,
          background: s.bg,
          borderRadius: 999,
          padding: "3px 9px",
        }}
      >
        {s.text}
      </span>
    </li>
  );
}

// ----------------------------- Main component ----------------------------------

export default function WorkoutSchedulePage({
  plan = MOCK_PLAN,
  today = new Date().toISOString().slice(0, 10),
}) {
  const [localPlan, setLocalPlan] = useState(plan);

  const burnupData = useMemo(() => buildBurnupSeries(localPlan), [localPlan]);
  const stats = useMemo(() => planStats(localPlan), [localPlan]);

  const sortedDays = useMemo(
    () => [...localPlan.days].sort((a, b) => toDate(a.date) - toDate(b.date)),
    [localPlan]
  );

  function handleToggle(dateStr, exerciseId) {
    setLocalPlan((prev) => ({
      ...prev,
      days: prev.days.map((day) =>
        day.date !== dateStr
          ? day
          : {
              ...day,
              exercises: day.exercises.map((ex) =>
                ex.id !== exerciseId ? ex : { ...ex, completed: !ex.completed }
              ),
            }
      ),
    }));
  }

  const todayIndex = burnupData.findIndex((d) => d.date >= today);
  const todayLabel =
    todayIndex >= 0 ? burnupData[todayIndex].dateLabel : null;

  return (
    <div
      style={{
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background: "#FAFAF8",
        minHeight: "100%",
        padding: "32px 24px",
        color: "#1C1D1B",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: "#8A8A83", fontWeight: 500 }}>
            {formatShort(localPlan.startDate)} – {formatShort(localPlan.endDate)}
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: "4px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            {localPlan.name}
          </h1>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 1fr)",
            gap: 24,
          }}
          className="workout-schedule-grid"
        >
          {/* Left: burnup chart */}
          <section
            style={{
              background: "#fff",
              border: "1px solid #EDEDE9",
              borderRadius: 16,
              padding: "24px 20px 12px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 4,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                Progress
              </h2>
              <div style={{ fontSize: 13, color: "#8A8A83" }}>
                {stats.done} / {stats.total} exercises · {stats.pct}%
              </div>
            </div>

            <div style={{ width: "100%", height: 340, marginTop: 12 }}>
              <ResponsiveContainer>
                <ComposedChart
                  data={burnupData}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="completedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2C6E49" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#2C6E49" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#F0F0EC" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12, fill: "#8A8A83" }}
                    axisLine={{ stroke: "#E4E4DE" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#8A8A83" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {todayLabel && (
                    <ReferenceLine
                      x={todayLabel}
                      stroke="#D9822B"
                      strokeDasharray="4 4"
                      label={{
                        value: "Today",
                        position: "top",
                        fill: "#D9822B",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#C9C9C2"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    name="Scheduled"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#2C6E49"
                    strokeWidth={2.5}
                    fill="url(#completedFill)"
                    dot={{ r: 3, fill: "#2C6E49", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name="Completed"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "flex", gap: 16, padding: "4px 4px 16px" }}>
              <Legend swatch="#2C6E49" label="Completed" />
              <Legend swatch="#C9C9C2" dashed label="Scheduled" />
            </div>
          </section>

          {/* Right: checklist */}
          <section
            style={{
              background: "#fff",
              border: "1px solid #EDEDE9",
              borderRadius: 16,
              padding: "20px 20px 8px",
              maxHeight: 560,
              overflowY: "auto",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>
              Exercises
            </h2>

            {sortedDays.map((day) => (
              <div key={day.date} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: "6px 4px",
                    position: "sticky",
                    top: 0,
                    background: "#fff",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {day.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#8A8A83" }}>
                    {formatShort(day.date)}
                  </span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {day.exercises.map((exercise) => (
                    <ExerciseRow
                      key={exercise.id}
                      day={day}
                      exercise={exercise}
                      today={today}
                      onToggle={handleToggle}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .workout-schedule-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function Legend({ swatch, label, dashed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 14,
          height: dashed ? 0 : 3,
          borderTop: dashed ? `2px dashed ${swatch}` : "none",
          background: dashed ? "transparent" : swatch,
          borderRadius: 2,
        }}
      />
      <span style={{ fontSize: 12, color: "#6B6B65" }}>{label}</span>
    </div>
  );
}