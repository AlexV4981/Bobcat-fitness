import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorkoutForm from "./components/WorkoutForm.jsx";
import WorkoutSheet from "./components/WorkoutSheet.jsx";
import RestTimer from "./components/RestTimer.jsx";
import History from "./components/History.jsx";
import ConfirmDialog from "../components/WorkoutCrud/ConfirmDialog.jsx";
import { generateWorkout, ENV_API_KEY } from "./lib/api.js";
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

/**
 * AI Workout page = Create + Update (and Read/Delete of the open workout).
 *
 *   Create   "Build my workout" makes an unsaved draft; "Save workout" inserts it.
 *   Read     saved workouts are listed under the form; the Workouts tab can open one here.
 *   Update   Edit (options menu) turns the sheet into an editor; Regenerate refills a saved workout.
 *            Both leave unsaved changes until "Save changes".
 *   Delete   options menu -> confirm -> row removed.
 *
 * Props:
 *   intent    { id, mode: "view" | "edit" } when the Workouts tab redirected here
 *   isGuest   guests can generate but can't save (no database access)
 */
export default function AIWorkoutPage({ intent = null, isGuest = false }) {
  const [apiKey, setApiKey] = useState(() => ENV_API_KEY || storage.get(KEYS.apiKey, ""));
  const [rows, setRows] = useState([]); // saved workouts, database shape
  const [listError, setListError] = useState("");
  const [workout, setWorkout] = useState(SAMPLE); // the working copy shown on the right
  const [dirty, setDirty] = useState(false); // working copy differs from what's saved
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [loading, setLoading] = useState(false); // generating
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); // generator form error
  const [message, setMessage] = useState(null); // { type: "ok" | "err", text } shown on the sheet
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [restEnd, setRestEnd] = useState(null);
  const lastOptions = useRef(null);
  const editBackup = useRef(null);

  const history = useMemo(() => rows.map(workoutFromRow).filter(Boolean), [rows]);

  const confirmDiscard = () => !dirty || window.confirm("You have unsaved changes. Discard them?");

  const saveKey = (key) => {
    setApiKey(key);
    storage.set(KEYS.apiKey, key);
  };

  // Show a workout in view or edit mode, discarding whatever was on screen.
  const open = useCallback((w, nextMode = "view") => {
    setWorkout(w);
    setDirty(false);
    setMode(nextMode);
    editBackup.current = nextMode === "edit" ? { workout: w, dirty: false } : null;
    lastOptions.current = w.meta?.options ?? null;
    setMessage(null);
    setError("");
  }, []);

  // ---------------- Read ----------------
  useEffect(() => {
    let active = true;
    listWorkouts()
      .then((r) => active && setRows(r))
      .catch((err) => active && setListError(err.message || "Couldn't load your saved workouts."));
    return () => {
      active = false;
    };
  }, []);

  // Redirected from the Workouts tab: open that workout (in edit mode if asked).
  useEffect(() => {
    if (!intent?.id) return;
    let active = true;
    getWorkout(intent.id)
      .then((row) => {
        if (!active) return;
        if (!row) return setMessage({ type: "err", text: "That workout no longer exists." });
        const w = workoutFromRow(row);
        if (!w) {
          return setMessage({
            type: "err",
            text: "That workout wasn't made with the AI generator, so it can't be opened here.",
          });
        }
        open(w, intent.mode === "edit" ? "edit" : "view");
      })
      .catch((err) => active && setMessage({ type: "err", text: err.message || "Couldn't open that workout." }));
    return () => {
      active = false;
    };
  }, [intent, open]);

  const pick = (w) => {
    if (w.id === workout.id || !confirmDiscard()) return;
    open(w);
  };

  // ---------------- Create (generate a draft) ----------------
  const build = async (opts, { replace = false } = {}) => {
    setError("");
    const key = ENV_API_KEY || opts.apiKey || apiKey;
    if (!key) {
      setError("Add your API key at the top first.");
      document.getElementById("apiKey")?.focus();
      return;
    }
    if (!confirmDiscard()) return;
    if (!ENV_API_KEY && key !== apiKey) saveKey(key);

    const { apiKey: _omit, ...options } = opts; // never store the key with the workout
    lastOptions.current = { ...options, apiKey: key };

    setLoading(true);
    setMessage(null);
    try {
      const generated = withIds(await generateWorkout(key, opts));
      setWorkout((prev) =>
        replace && !prev.isSample
          ? // Regenerate: same workout (same row), new contents
            { ...generated, id: prev.id, createdAt: prev.createdAt, scheduledDate: prev.scheduledDate, done: [], meta: { ...prev.meta, options } }
          : { ...generated, createdAt: Date.now(), scheduledDate: localToday(), done: [], meta: { options } },
      );
      setDirty(true);
      setMode("view");
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
        <WorkoutForm apiKey={apiKey} onSaveKey={saveKey} onSubmit={build} loading={loading} error={error}>
          {isGuest && <p className="hint">Guests can build workouts but can't save them. Sign in to save and edit.</p>}
          {listError && (
            <div className="err" role="alert">
              {listError}
            </div>
          )}
          <History items={history} activeId={workout.id} onPick={pick} />
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
