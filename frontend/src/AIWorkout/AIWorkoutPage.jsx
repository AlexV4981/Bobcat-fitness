import { useCallback, useRef, useState } from "react";
import WorkoutForm from "./components/WorkoutForm.jsx";
import WorkoutSheet from "./components/WorkoutSheet.jsx";
import ProgramSheet from "./components/ProgramSheet.jsx";
import RestTimer from "./components/RestTimer.jsx";
import History from "./components/History.jsx";
import { generateWorkout, generateProgram } from "./lib/api.js";
import { storage, KEYS } from "./lib/storage.js";
import { SAMPLE_PROGRAM } from "./lib/sample.js";
import { sessionKey } from "./lib/format.js";
import "./AIWorkoutPage.css";

const MAX_HISTORY = 10;

// Older versions saved an API key in the browser. Keys now live on the server only.
storage.remove(KEYS.legacyApiKey);

export default function AIWorkoutPage() {
  const [history, setHistory] = useState(() => storage.get(KEYS.history, []));
  // `workout` holds either a single workout or a multi-week program (type: "program")
  const [workout, setWorkout] = useState(() => history[0] || SAMPLE_PROGRAM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restEnd, setRestEnd] = useState(null);
  const lastOptions = useRef(null);
  const [today] = useState(() =>
    new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
  );

  const persistHistory = (next) => {
    setHistory(next);
    storage.set(KEYS.history, next);
  };

  // Put a workout at the top of history (replacing an older copy of itself)
  const upsert = (w) => {
    if (w.isSample) return;
    persistHistory([w, ...history.filter((x) => x.createdAt !== w.createdAt)].slice(0, MAX_HISTORY));
  };

  const build = async (opts) => {
    setError("");
    lastOptions.current = opts;

    setLoading(true);
    try {
      const full =
        opts.mode === "program"
          ? { ...(await generateProgram(opts)), type: "program", createdAt: Date.now(), done: {} }
          : { ...(await generateWorkout(opts)), type: "single", createdAt: Date.now(), done: [] };
      setWorkout(full);
      upsert(full);
      if (window.innerWidth < 860) document.querySelector(".sheet")?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDone = (i) => {
    const done = new Set(workout.done || []);
    if (done.has(i)) done.delete(i);
    else done.add(i);
    const next = { ...workout, done: [...done] };
    setWorkout(next);
    upsert(next);
  };

  // Programs store checked exercises per session: { "week-day": [exercise indexes] }
  const toggleProgramDone = (week, day, i) => {
    const key = sessionKey(week, day);
    const done = new Set(workout.done?.[key] || []);
    if (done.has(i)) done.delete(i);
    else done.add(i);
    const next = { ...workout, done: { ...workout.done, [key]: [...done] } };
    setWorkout(next);
    upsert(next);
  };

  const startRest = useCallback((seconds) => setRestEnd(Date.now() + seconds * 1000), []);

  return (
    <div className="aw">
      <header className="brand">
        <p className="eyebrow">{today}</p>
        <h1>Build a workout plan</h1>
        <p className="sub">Multi-week programs or single workouts, built around your gear and your time.</p>
      </header>

      <div className="wrap">
        <WorkoutForm onSubmit={build} loading={loading} error={error}>
          <History items={history} onPick={setWorkout} />
        </WorkoutForm>

        {workout.type === "program" ? (
          <ProgramSheet
            key={workout.createdAt || "sample"}
            program={workout}
            loading={loading}
            onToggleDone={toggleProgramDone}
            onRest={startRest}
            onRegenerate={() => lastOptions.current && build(lastOptions.current)}
          />
        ) : (
          <WorkoutSheet
            workout={workout}
            loading={loading}
            onToggleDone={toggleDone}
            onRest={startRest}
            onRegenerate={() => lastOptions.current && build(lastOptions.current)}
          />
        )}
      </div>

      <RestTimer
        endAt={restEnd}
        onAddTime={() => setRestEnd((t) => t + 15000)}
        onClose={() => setRestEnd(null)}
      />
    </div>
  );
}
