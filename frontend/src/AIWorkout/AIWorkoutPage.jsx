import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorkoutForm from "./components/WorkoutForm.jsx";
import WorkoutSheet from "./components/WorkoutSheet.jsx";
import ProgramSheet from "./components/ProgramSheet.jsx";
import RestTimer from "./components/RestTimer.jsx";
import History from "./components/History.jsx";
import ConfirmDialog from "../components/WorkoutCrud/ConfirmDialog.jsx";
import { generateProgram, generateWorkout } from "./lib/api.js";
import { KEYS } from "./lib/storage.js";
import { SAMPLE_PROGRAM } from "./lib/sample.js";
import {
  createWorkout,
  deleteWorkout,
  getWorkout,
  listWorkouts,
  setExerciseCompleted,
  updateWorkout,
} from "../services/workoutService.js";
import {
  cleanWorkout,
  isProgram,
  localToday,
  validateProgram,
  validateWorkout,
  withIds,
  withProgramIds,
  workoutFromRow,
} from "../lib/workoutPlan.js";
import "./AIWorkoutPage.css";

// The page opens on an example program; the form can build programs or single workouts.
const SAMPLE = withProgramIds(SAMPLE_PROGRAM);

/**
 * AI Workout page = Create + Update (and Read/Delete of the open workout).
 *
 *   Create   "Build my workout" makes an unsaved draft; "Save workout" inserts it.
 *   Read     saved workouts are listed under the form; the Workouts tab can open one here.
 *   Update   Edit (options menu) turns the sheet into an editor; Regenerate refills a saved workout.
 *            Both leave unsaved changes until "Save changes".
 *   Delete   options menu -> confirm -> row removed.
 *
 * Multi-week programs (workout.type === "program") use the same flow and the same table:
 * build -> save -> check off -> regenerate/delete. They are shown by ProgramSheet and can't be
 * opened in the field editor (their sets/reps change week by week).
 *
 * Props:
 *   intent    { id, mode: "view" | "edit" } when the Workouts tab redirected here
 *   isGuest   guests can view sample; sign-in required for AI generation and saving
 */
export default function AIWorkoutPage({ intent = null, isGuest = false }) {
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
  // Bumped whenever a different workout/program is shown, so the program view resets to the
  // next session then, but not when the same program is saved or checked off.
  const [viewKey, setViewKey] = useState(0);
  const lastOptions = useRef(null);
  const editBackup = useRef(null);

  const history = useMemo(() => rows.map(workoutFromRow).filter(Boolean), [rows]);

  const confirmDiscard = () => !dirty || window.confirm("You have unsaved changes. Discard them?");

  // Delete any Gemini key saved by the old browser-direct integration.
  // New AI generation uses the authenticated Cloudflare Functions instead.
  useEffect(() => {
    try { localStorage.removeItem(KEYS.apiKey); } catch { /* storage might be disabled */ }
  }, []);

  // Show a workout in view or edit mode, discarding whatever was on screen.
  const open = useCallback((w, nextMode = "view") => {
    setWorkout(w);
    setViewKey((k) => k + 1);
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
        // Programs have no field editor yet, so they always open in view mode.
        open(w, intent.mode === "edit" && !isProgram(w) ? "edit" : "view");
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
    if (!confirmDiscard()) return;

    // Store only workout options. Never collect or forward a Gemini key.
    const options = opts;
    lastOptions.current = options;

    setLoading(true);
    setMessage(null);
    try {
      const generated =
        options.mode === "program"
          ? withProgramIds(await generateProgram(options))
          : withIds(await generateWorkout(options));
      setWorkout((prev) =>
        replace && !prev.isSample
          ? // Regenerate: same workout (same row), new contents
            { ...generated, id: prev.id, createdAt: prev.createdAt, scheduledDate: prev.scheduledDate, done: [], meta: { ...prev.meta, options } }
          : { ...generated, createdAt: Date.now(), scheduledDate: localToday(), done: [], meta: { options } },
      );
      setViewKey((k) => k + 1);
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
    const program = isProgram(workout);
    const cleaned = program ? { ...workout, title: (workout.title ?? "").trim() } : cleanWorkout(workout);
    const problem = program ? validateProgram(cleaned) : validateWorkout(cleaned);
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
        text: wasSaved
          ? "Changes saved."
          : `${program ? "Program" : "Workout"} saved. You can find it in the Workouts tab.`,
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
  const canRegenerate = Boolean(lastOptions.current);

  return (
    <div className="aw">
      <header className="brand">
        <p className="eyebrow">
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1>Build a workout plan</h1>
        <p className="sub">Multi-week programs or single workouts, built around your gear and your time.</p>
      </header>

      <div className="wrap">
        <WorkoutForm onSubmit={build} loading={loading} error={error}>
          {isGuest && <p className="hint">Sign in to generate AI programs and workouts and save your plans.</p>}
          {listError && (
            <div className="err" role="alert">
              {listError}
            </div>
          )}
          <History items={history} activeId={workout.id} onPick={pick} />
        </WorkoutForm>

        {isProgram(workout) ? (
          <ProgramSheet
            key={viewKey}
            program={workout}
            loading={loading}
            dirty={dirty}
            saving={saving}
            message={message}
            canRegenerate={canRegenerate}
            onToggleDone={toggleDone}
            onRest={startRest}
            onRegenerate={() => lastOptions.current && build(lastOptions.current, { replace: true })}
            onChange={handleChange}
            onSave={save}
            onDelete={requestDelete}
          />
        ) : (
          <WorkoutSheet
            workout={workout}
            loading={loading}
            mode={mode}
            dirty={dirty}
            saving={saving}
            message={message}
            canRegenerate={canRegenerate}
            onToggleDone={toggleDone}
            onRest={startRest}
            onRegenerate={() => lastOptions.current && build(lastOptions.current, { replace: true })}
            onChange={handleChange}
            onEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSave={save}
            onDelete={requestDelete}
          />
        )}
      </div>

      <RestTimer
        endAt={restEnd}
        onAddTime={() => setRestEnd((t) => t + 15000)}
        onClose={() => setRestEnd(null)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title={isSaved ? `Delete “${workout.title}”?` : `Discard this ${isProgram(workout) ? "program" : "draft"}?`}
        message={
          isSaved
            ? "This permanently removes the workout and its progress. It can't be undone."
            : `This ${isProgram(workout) ? "program" : "workout"} hasn't been saved, so it will be lost.`
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
