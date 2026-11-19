import { useCallback, useEffect, useRef, useState } from "react";
import WorkoutForm from "./components/WorkoutForm.jsx";
import WorkoutSheet from "./components/WorkoutSheet.jsx";
import RestTimer from "./components/RestTimer.jsx";
import History from "./components/History.jsx";
import { generateWorkout } from "./lib/api.js";
import { storage, KEYS } from "./lib/storage.js";
import { SAMPLE_WORKOUT } from "./lib/sample.js";
import {
  createWorkout,
  deleteWorkout,
  getWorkout,
  listWorkouts,
  setExerciseCompleted,
  updateWorkout,
} from "../services/workoutService.js";
import { cleanWorkout, localToday, validateWorkout, withIds, workoutFromRow } from "../lib/workoutPlan.js";
import "./AIWorkoutPage.css";

const SAMPLE = withIds(SAMPLE_WORKOUT);

export default function AIWorkoutPage() {
  const [history, setHistory] = useState(() => storage.get(KEYS.history, []));
  const [workout, setWorkout] = useState(() => history[0] || SAMPLE_WORKOUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restEnd, setRestEnd] = useState(null);
  const lastOptions = useRef(null);
  const editBackup = useRef(null);

  const history = useMemo(() => rows.map(workoutFromRow).filter(Boolean), [rows]);

  const confirmDiscard = () => !dirty || window.confirm("You have unsaved changes. Discard them?");

  // Remove any API key previously stored by the old browser-direct implementation.
  useEffect(() => {
    try {localStorage.removeItem(KEYS.apiKey);} catch { /* storage can be disabled */ }
  }, []);

  // Show a workout in view or edit mode, discarding whatever was on screen.
  const open = useCallback((w, nextMode = "view") => {
    setWorkout(w);
    setDirty(false);
    setMode(nextMode);
    editBackup.current = nextMode === "edit" ? { workout: w, dirty: false } : null;
    lastOptions.current = w.meta?.options ?? null;
    setMessage(null);
    setError("");
    lastOptions.current = opts;

    setLoading(true);
    setMessage(null);
    try {
      const w = await generateWorkout(opts);
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

  // ---------------- Update ----------------
  const handleChange = (next) => {
    setWorkout(next);
    setDirty(true);
  };

  const startEdit = () => {
    editBackup.current = { workout, dirty };
    setMessage(null);
    setMode("edit");
  };

  const cancelEdit = () => {
    const backup = editBackup.current;
    if (backup) {
      setWorkout(backup.workout);
      setDirty(backup.dirty);
    }
    setMessage(null);
    setMode("view");
  };

  // Saves a new workout (insert) or an existing one (update).
  const save = async () => {
    setMessage(null);
    if (isGuest) {
      setMessage({ type: "err", text: "Sign in with an account to save workouts." });
      return;
    }
    const cleaned = cleanWorkout(workout);
    const problem = validateWorkout(cleaned);
    if (problem) {
      setMessage({ type: "err", text: problem });
      return;
    }

    setSaving(true);
    try {
      const wasSaved = Boolean(cleaned.id);
      const row = wasSaved ? await updateWorkout(cleaned.id, cleaned) : await createWorkout(cleaned);
      setRows((prev) => (wasSaved ? prev.map((r) => (r.id === row.id ? row : r)) : [row, ...prev]));
      setWorkout(workoutFromRow(row));
      setDirty(false);
      setMode("view");
      setMessage({
        type: "ok",
        text: wasSaved ? "Changes saved." : "Workout saved. You can find it in the Workouts tab.",
      });
    } catch (err) {
      setMessage({ type: "err", text: err.message || "Couldn't save the workout." });
    } finally {
      setSaving(false);
    }
  };

  // Checking off an exercise on a saved, unedited workout is stored right away;
  // on a draft or unsaved edits it is stored with the next save.
  const toggleDone = async (id) => {
    const prevDone = workout.done || [];
    const wasDone = prevDone.includes(id);
    setWorkout((w) => ({ ...w, done: wasDone ? prevDone.filter((x) => x !== id) : [...prevDone, id] }));

    const row = rows.find((r) => r.id === workout.id);
    if (!workout.id || dirty || !row) return;
    try {
      const updated = await setExerciseCompleted(row, id, !wasDone);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      setWorkout((w) => ({ ...w, done: prevDone }));
      setMessage({ type: "err", text: "Couldn't update your progress. Try again." });
    }
  };

  // ---------------- Delete ----------------
  const requestDelete = () => {
    setDeleteError("");
    setConfirmingDelete(true);
  };

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const wasSaved = Boolean(workout.id);
      if (wasSaved) {
        await deleteWorkout(workout.id);
        setRows((prev) => prev.filter((r) => r.id !== workout.id));
      }
      const next = history.find((h) => h.id !== workout.id);
      if (next) open(next);
      else {
        open(SAMPLE);
        lastOptions.current = null;
      }
      setConfirmingDelete(false);
      setMessage({ type: "ok", text: wasSaved ? "Workout deleted." : "Draft discarded." });
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete the workout.");
    } finally {
      setDeleting(false);
    }
  };

  const startRest = useCallback((seconds) => setRestEnd(Date.now() + seconds * 1000), []);
  const cancelDelete = useCallback(() => setConfirmingDelete(false), []);

  const isSaved = Boolean(workout.id);

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
        <WorkoutForm onSubmit={build} loading={loading} error={error}>
          <History items={history} onPick={setWorkout} />
        </WorkoutForm>

        <WorkoutSheet
          workout={workout}
          loading={loading}
          mode={mode}
          dirty={dirty}
          saving={saving}
          message={message}
          canRegenerate={Boolean(lastOptions.current)}
          onToggleDone={toggleDone}
          onRest={startRest}
          onRegenerate={() => lastOptions.current && build(lastOptions.current, { replace: true })}
          onChange={handleChange}
          onEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSave={save}
          onDelete={requestDelete}
        />
      </div>

      <RestTimer
        endAt={restEnd}
        onAddTime={() => setRestEnd((t) => t + 15000)}
        onClose={() => setRestEnd(null)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title={isSaved ? `Delete “${workout.title}”?` : "Discard this draft?"}
        message={
          isSaved
            ? "This permanently removes the workout and its progress. It can't be undone."
            : "This workout hasn't been saved, so it will be lost."
        }
        confirmLabel={isSaved ? "Delete" : "Discard"}
        busy={deleting}
        error={deleteError}
        onConfirm={doDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
