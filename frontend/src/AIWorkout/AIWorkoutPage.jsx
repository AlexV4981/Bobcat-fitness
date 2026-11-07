import { useCallback, useRef, useState } from "react";
import WorkoutForm from "./components/WorkoutForm.jsx";
import WorkoutSheet from "./components/WorkoutSheet.jsx";
import RestTimer from "./components/RestTimer.jsx";
import History from "./components/History.jsx";
import { generateWorkout, ENV_API_KEY } from "./lib/api.js";
import { storage, KEYS } from "./lib/storage.js";
import { SAMPLE_WORKOUT } from "./lib/sample.js";
import "./AIWorkoutPage.css";

const MAX_HISTORY = 10;

export default function AIWorkoutPage() {
  const [apiKey, setApiKey] = useState(() => ENV_API_KEY || storage.get(KEYS.apiKey, ""));
  const [history, setHistory] = useState(() => storage.get(KEYS.history, []));
  const [workout, setWorkout] = useState(() => history[0] || SAMPLE_WORKOUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restEnd, setRestEnd] = useState(null);
  const lastOptions = useRef(null);

  const persistHistory = (next) => {
    setHistory(next);
    storage.set(KEYS.history, next);
  };

  // Put a workout at the top of history (replacing an older copy of itself)
  const upsert = (w) => {
    if (w.isSample) return;
    persistHistory([w, ...history.filter((x) => x.createdAt !== w.createdAt)].slice(0, MAX_HISTORY));
  };

  const saveKey = (key) => {
    setApiKey(key);
    storage.set(KEYS.apiKey, key);
  };

  const build = async (opts) => {
    setError("");
    const key = ENV_API_KEY || opts.apiKey;
    if (!key) {
      setError("Add your API key at the top first.");
      document.getElementById("apiKey")?.focus();
      return;
    }
    if (!ENV_API_KEY && key !== apiKey) saveKey(key);
    lastOptions.current = opts;

    setLoading(true);
    try {
      const w = await generateWorkout(key, opts);
      const full = { ...w, createdAt: Date.now(), done: [] };
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

  const startRest = useCallback((seconds) => setRestEnd(Date.now() + seconds * 1000), []);

  return (
    <div className="aw">
      <header className="brand">
        <p className="eyebrow">
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1>Build a workout</h1>
        <p className="sub">AI workouts built around your gear and your time.</p>
      </header>

      <div className="wrap">
        <WorkoutForm apiKey={apiKey} onSaveKey={saveKey} onSubmit={build} loading={loading} error={error}>
          <History items={history} onPick={setWorkout} />
        </WorkoutForm>

        <WorkoutSheet
          workout={workout}
          loading={loading}
          onToggleDone={toggleDone}
          onRest={startRest}
          onRegenerate={() => lastOptions.current && build(lastOptions.current)}
        />
      </div>

      <RestTimer
        endAt={restEnd}
        onAddTime={() => setRestEnd((t) => t + 15000)}
        onClose={() => setRestEnd(null)}
      />
    </div>
  );
}
