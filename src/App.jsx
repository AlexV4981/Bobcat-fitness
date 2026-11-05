import { useCallback, useRef, useState } from "react";
import WorkoutForm from "./components/WorkoutForm.jsx";
import WorkoutSheet from "./components/WorkoutSheet.jsx";
import RestTimer from "./components/RestTimer.jsx";
import History from "./components/History.jsx";
import { generateWorkout, ENV_API_KEY } from "./lib/api.js";
import { storage, KEYS } from "./lib/storage.js";
import { SAMPLE_WORKOUT } from "./lib/sample.js";

const MAX_HISTORY = 10;

export default function App() {
  const [apiKey, setApiKey] = useState(() => ENV_API_KEY || storage.get(KEYS.apiKey, ""));
  const [history, setHistory] = useState(() => storage.get(KEYS.history, []));
  const [workout, setWorkout] = useState(() => history[0] || SAMPLE_WORKOUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rest, setRest] = useState(null);
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
    done.has(i) ? done.delete(i) : done.add(i);
    const next = { ...workout, done: [...done] };
    setWorkout(next);
    upsert(next);
  };

  const startRest = useCallback((seconds) => setRest({ seconds, id: Date.now() }), []);

  return (
    <>
      <header className="brand">
        <p className="eyebrow">Workout builder</p>
        <h1>Bobcat Fitness</h1>
        <p className="sub">Workouts built around your gear and your time.</p>
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

      <RestTimer request={rest} onClose={() => setRest(null)} />
    </>
  );
}
