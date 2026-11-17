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
import WorkoutOptionsMenu from "../components/WorkoutCrud/WorkoutOptionsMenu";
import ConfirmDialog from "../components/WorkoutCrud/ConfirmDialog";
import StarterKitDialog from "./StarterKitDialog";
import { createStarterWorkouts, deleteWorkout, listWorkouts, setExerciseCompleted } from "../services/workoutService";
import { instantiateStarter, STARTER_PLANS } from "../lib/starterPlans";
import { daysOf, localToday, toSchedulePlan } from "../lib/workoutPlan";
import "./WorkoutSchedulePage.css";

const CHART_COLORS = {
  green: "#768e5b",
  orange: "#B8641A",
  greyLine: "#C9C9C2",
  tickText: "#8A8A83",
  axisLine: "#E4E4DE",
  grid: "#F0F0EC",
};

// ----------------------------- Helper Functions -----------------------------
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
export default function WorkoutSchedulePage({
  today = localToday(),
  onToggleExercise,
  onOpenWorkout, // (id, "view" | "edit") => redirect to the AI Workout page
  onNavigate,
  isGuest = false,
}) {
  const [rows, setRows] = useState([]); // workouts, database shape
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // plan awaiting confirmation
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [starterOpen, setStarterOpen] = useState(false);
  const [addingStarter, setAddingStarter] = useState(false);
  const [starterError, setStarterError] = useState("");

  // AI Chat state
  const [aiPrompt, setAiPrompt] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I'm your AI Workout Assistant. Tell me your target goals, muscle groups, or training styles to construct or edit presets!",
    },
  ]);

  // ---------------- Read ----------------
  useEffect(() => {
    let active = true;
    listWorkouts()
      .then((r) => active && setRows(r))
      .catch((err) => active && setLoadError(err.message || "Couldn't load your workouts."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const plans = useMemo(() => rows.map((r) => toSchedulePlan(r, today)), [rows, today]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId),
    [plans, selectedPlanId]
  );

  const burnupData = useMemo(() => buildBurnupSeries(activePlan), [activePlan]);
  const stats = useMemo(() => planStats(activePlan), [activePlan]);
  const sortedDays = useMemo(() => sortDays(activePlan?.days || []), [activePlan]);

  // ---------------- Update: tick an exercise on/off ----------------
  const handleToggle = async (dateStr, exerciseId) => {
    const row = rows.find((r) => r.id === selectedPlanId);
    const exercise = daysOf(row)
      .find((d) => d.date === dateStr)
      ?.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;

    const next = !exercise.completed;
    const patch = (completed) =>
      setRows((prev) =>
        prev.map((r) =>
          r.id !== row.id
            ? r
            : {
                ...r,
                plan_snapshot: daysOf(r).map((d) =>
                  d.date !== dateStr
                    ? d
                    : {
                        ...d,
                        exercises: d.exercises.map((e) => (e.id === exerciseId ? { ...e, completed } : e)),
                      }
                ),
              }
        )
      );

    setActionError("");
    patch(next); // optimistic
    onToggleExercise?.(dateStr, exerciseId, next);
    try {
      const updated = await setExerciseCompleted(row, exerciseId, next);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      patch(!next);
      setActionError(err.message || "Couldn't save your progress.");
    }
  };

  // ---------------- Edit (redirect) / Delete ----------------
  const editPlan = (plan) => onOpenWorkout?.(plan.id, "edit");
  const openPlan = (plan) => onOpenWorkout?.(plan.id, "view");

  const askDelete = (plan) => {
    setDeleteError("");
    setPendingDelete(plan);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteWorkout(pendingDelete.id);
      setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      if (selectedPlanId === pendingDelete.id) setSelectedPlanId(null);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete the workout.");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => setPendingDelete(null);

  // ---------------- Create: starter kit ----------------
  const addedStarterIds = useMemo(
    () => new Set(rows.map((r) => r.meta?.starterId).filter(Boolean)),
    [rows]
  );
  const allStartersAdded = STARTER_PLANS.every((p) => addedStarterIds.has(p.id));

  const openStarter = () => {
    setStarterError("");
    setStarterOpen(true);
  };
  const closeStarter = () => setStarterOpen(false);

  const addStarters = async (ids) => {
    setAddingStarter(true);
    setStarterError("");
    try {
      const picked = STARTER_PLANS.filter((p) => ids.includes(p.id)).map((p) => instantiateStarter(p, today));
      await createStarterWorkouts(picked);
      setRows(await listWorkouts()); // reload so new plans sort in with the AI-generated ones
      setStarterOpen(false);
    } catch (err) {
      setStarterError(err.message || "Couldn't add the starter plans.");
    } finally {
      setAddingStarter(false);
    }
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

          <header className="ws-header ws-detail-head">
            <div>
              <div className="ws-header-dates">
                {formatShort(activePlan.startDate)} – {formatShort(activePlan.endDate)}
              </div>
              <h1 className="ws-header-title">{activePlan.name}</h1>
            </div>
            <div className="ws-detail-actions">
              {activePlan.editable && (
                <button type="button" className="ws-open-btn" onClick={() => openPlan(activePlan)}>
                  Open in AI Workout →
                </button>
              )}
              <WorkoutOptionsMenu
                label={`Options for ${activePlan.name}`}
                onEdit={activePlan.editable ? () => editPlan(activePlan) : undefined}
                onDelete={() => askDelete(activePlan)}
              />
            </div>
          </header>
          {actionError && (
            <p className="ws-error" role="alert">
              {actionError}
            </p>
          )}

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
            <header className="ws-header ws-section-head">
              <div>
                <span className="ws-badge">Workouts</span>
                <h1 className="ws-header-title">My Workouts</h1>
                <p className="ws-subtitle">Open a workout to see its progress and exercise log, or use ⋯ to edit or delete it.</p>
              </div>
              {!isGuest && (
                <button type="button" className="ws-open-btn" onClick={openStarter} disabled={allStartersAdded && !loading}>
                  {allStartersAdded && !loading ? "Starter kit added" : "+ Starter kit"}
                </button>
              )}
            </header>

            {actionError && !selectedPlanId && (
              <p className="ws-error" role="alert">
                {actionError}
              </p>
            )}

            {plans.length === 0 && (
              <div className="ws-empty">
                {loading ? (
                  <p>Loading your workouts…</p>
                ) : loadError ? (
                  <p className="ws-error" role="alert">{loadError}</p>
                ) : isGuest ? (
                  <p>Guests can't save workouts. Sign in to build and keep your plans.</p>
                ) : (
                  <>
                    <p>No workouts yet. Build your own with AI, or start from a ready-made plan.</p>
                    <div className="ws-empty-actions">
                      <button type="button" className="ws-open-btn" onClick={() => onNavigate?.("ai-workout")}>
                        Build one with the AI generator →
                      </button>
                      <button type="button" className="ws-open-btn ws-open-btn--ghost" onClick={openStarter}>
                        Browse the starter kit
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

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
                      <div className="ws-preset-top-actions">
                        <span className={`ws-status-badge ws-status-badge--${plan.status.toLowerCase().replace(" ", "-")}`}>
                          {plan.status}
                        </span>
                        <WorkoutOptionsMenu
                          label={`Options for ${plan.name}`}
                          onEdit={plan.editable ? () => editPlan(plan) : undefined}
                          onDelete={() => askDelete(plan)}
                        />
                      </div>
                    </div>

                    <div className="ws-preset-body">
                      <span className="ws-preset-category">{plan.category}</span>
                      <h3 className="ws-preset-name">
                        <button type="button" className="ws-preset-open" onClick={() => setSelectedPlanId(plan.id)}>
                          {plan.name}
                        </button>
                      </h3>
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

      {starterOpen && (
        <StarterKitDialog
          addedIds={addedStarterIds}
          busy={addingStarter}
          error={starterError}
          onAdd={addStarters}
          onCancel={closeStarter}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.name ?? ""}”?`}
        message="This permanently removes the workout and its progress. It can't be undone."
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}


