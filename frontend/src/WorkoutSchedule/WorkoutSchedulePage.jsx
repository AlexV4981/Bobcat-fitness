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

// ----------------------------- Preset Workout Categories & Plans -----------------------------
const INITIAL_PRESET_PLANS = [
  {
    id: "strength- foundations",
    category: "Strength & Power",
    name: "Strength Foundations — Week 1-4",
    subtitle: "4-Week Compound Progression",
    startDate: "2026-09-01",
    endDate: "2026-09-28",
    icon: "🏋️‍♂️",
    status: "Active",
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
    ],
  },
  {
    id: "hypertrophy-upper",
    category: "Hypertrophy",
    name: "Upper Body Hypertrophy",
    subtitle: "High Volume Muscle Building",
    startDate: "2026-10-01",
    endDate: "2026-10-28",
    icon: "💪",
    status: "In Progress",
    days: [
      {
        date: "2026-10-01",
        label: "Chest & Biceps",
        exercises: [
          { id: "h1", name: "Incline Dumbbell Press", sets: 4, reps: "10-12", completed: true },
          { id: "h2", name: "Cable Curls", sets: 3, reps: "12-15", completed: true },
        ],
      },
    ],
  },
  {
    id: "cardio-hiit",
    category: "Cardio & Stamina",
    name: "HIIT & Core Conditioning",
    subtitle: "Fat Burn & Athleticism",
    startDate: "2026-11-01",
    endDate: "2026-11-14",
    icon: "🔥",
    status: "Upcoming",
    days: [],
  },
  {
    id: "endurance-5k",
    category: "Endurance",
    name: "5K Speed & Base Build",
    subtitle: "Aerobic Running Progression",
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    icon: "🏃‍♂️",
    status: "Upcoming",
    days: [],
  },
];

const CHART_COLORS = {
  green: "#768e5b",
  orange: "#B8641A",
  greyLine: "#C9C9C2",
  tickText: "#8A8A83",
  axisLine: "#E4E4DE",
  grid: "#F0F0EC",
};

// ----------------------------- Helper Functions -----------------------------
function localToday() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toDate(d) {
  return new Date(`${d}T00:00:00`);
}

function formatShort(d) {
  if (!d) return "";
  return toDate(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isSameDay(a, b) {
  return a === b;
}

function isPast(dateStr, today) {
  return toDate(dateStr) < toDate(today);
}

function sortDays(days = []) {
  return [...days].sort((a, b) => toDate(a.date) - toDate(b.date));
}

function buildBurnupSeries(plan) {
  if (!plan || !plan.days) return [];
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
  if (!plan || !plan.days) return { total: 0, done: 0, pct: 0 };
  const allExercises = plan.days.flatMap((d) => d.exercises);
  const total = allExercises.length;
  const done = allExercises.filter((e) => e.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}

// ----------------------------- Recharts Subcomponents -----------------------------
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

// ----------------------------- Exercise Panel -----------------------------
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

// ----------------------------- Main Workout Schedule Component -----------------------------
export default function WorkoutSchedulePage({ today = localToday(), onToggleExercise }) {
  const [plans, setPlans] = useState(INITIAL_PRESET_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  // AI Chat state
  const [aiPrompt, setAiPrompt] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I'm your AI Workout Assistant. Tell me your target goals, muscle groups, or training styles to construct or edit presets!",
    },
  ]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId),
    [plans, selectedPlanId]
  );

  const burnupData = useMemo(() => buildBurnupSeries(activePlan), [activePlan]);
  const stats = useMemo(() => planStats(activePlan), [activePlan]);
  const sortedDays = useMemo(() => sortDays(activePlan?.days || []), [activePlan]);

  const handleToggle = (dateStr, exerciseId) => {
    if (!selectedPlanId) return;
    let nextCompleted = false;

    setPlans((prevPlans) =>
      prevPlans.map((plan) => {
        if (plan.id !== selectedPlanId) return plan;
        return {
          ...plan,
          days: plan.days.map((day) => {
            if (day.date !== dateStr) return day;
            return {
              ...day,
              exercises: day.exercises.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                nextCompleted = !ex.completed;
                return { ...ex, completed: nextCompleted };
              }),
            };
          }),
        };
      })
    );

    onToggleExercise?.(dateStr, exerciseId, nextCompleted);
  };

  const handleAiSubmit = (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    const userMsg = aiPrompt;
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setAiPrompt("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `I've analyzed "${userMsg}". Would you like me to auto-generate a new workout preset icon for your grid?`,
        },
      ]);
    }, 700);
  };

  const todayIndex = burnupData.findIndex((d) => d.date >= today);
  const todayLabel = todayIndex >= 0 ? burnupData[todayIndex].dateLabel : null;

  return (
    <div className="ws-page">
      {selectedPlanId && activePlan ? (
        /* ==================== DETAIL VIEW (Burnup Chart & Exercises) ==================== */
        <div className="ws-detail-view">
          <button className="ws-back-btn" onClick={() => setSelectedPlanId(null)}>
            ← Back to Workout Presets Grid
          </button>

          <header className="ws-header">
            <div className="ws-header-dates">
              {formatShort(activePlan.startDate)} – {formatShort(activePlan.endDate)}
            </div>
            <h1 className="ws-header-title">{activePlan.name}</h1>
          </header>

          <div className="ws-grid">
            {/* LEFT: Burnup Chart */}
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

            {/* RIGHT: Exercise Checklist */}
            <ExercisePanel days={sortedDays} today={today} onToggle={handleToggle} />
          </div>
        </div>
      ) : (
        /* ==================== MAIN MODULAR DASHBOARD (AI Left + Grid Right) ==================== */
        <div className="ws-dashboard-layout">
          {/* LEFT: AI Workout Planner */}
          <section className="ws-ai-section">
            <header className="ws-header">
              <span className="ws-badge">AI Assistant</span>
              <h1 className="ws-header-title">AI Planner</h1>
              <p className="ws-subtitle">Consult your coach to structure workout plans & routines.</p>
            </header>

            <div className="ws-card ws-ai-card">
              <div className="ws-chat-messages">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`ws-chat-bubble ${
                      m.sender === "ai" ? "ws-chat-ai" : "ws-chat-user"
                    }`}
                  >
                    {m.sender === "ai" && <div className="ws-chat-avatar">🤖</div>}
                    <div className="ws-chat-text">{m.text}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAiSubmit} className="ws-chat-form">
                <input
                  type="text"
                  placeholder="Ask AI for workout suggestions..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button type="submit" className="ws-send-btn">Send</button>
              </form>
            </div>
          </section>

          {/* RIGHT: Square Icon Preset Grid */}
          <section className="ws-presets-section">
            <header className="ws-header">
              <span className="ws-badge">Presets</span>
              <h1 className="ws-header-title">Workout Presets</h1>
              <p className="ws-subtitle">Select a plan preset to view its burnup chart and exercise log.</p>
            </header>

            <div className="ws-presets-grid">
              {plans.map((plan) => {
                const s = planStats(plan);
                return (
                  <div
                    key={plan.id}
                    className="ws-preset-card"
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div className="ws-preset-top">
                      <div className="ws-preset-icon">{plan.icon}</div>
                      <span className={`ws-status-badge ws-status-badge--${plan.status.toLowerCase().replace(" ", "-")}`}>
                        {plan.status}
                      </span>
                    </div>

                    <div className="ws-preset-body">
                      <span className="ws-preset-category">{plan.category}</span>
                      <h3 className="ws-preset-name">{plan.name}</h3>
                      <p className="ws-preset-sub">{plan.subtitle}</p>
                    </div>

                    <div className="ws-preset-footer">
                      <div className="ws-preset-progress-info">
                        <span>Progress</span>
                        <span>{s.pct}%</span>
                      </div>
                      <div className="ws-progress-bar">
                        <div
                          className="ws-progress-fill"
                          style={{ width: `${s.pct}%` }}
                        ></div>
                      </div>
                      <div className="ws-preset-count">
                        {s.done} / {s.total} completed
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}