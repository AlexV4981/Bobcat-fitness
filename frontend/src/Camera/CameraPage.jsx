import { useEffect, useRef, useState } from "react";
import WebcamConnection from "../components/WebCam/WebcamConnection";
import {
  CAMERA_ID,
  finishExerciseSet,
  saveExerciseRep,
  undoExerciseRep,
} from "../components/WebCam/WebcamUtils";
import "./CameraPage.css";

import { logCompletedSet } from "../lib/workoutLog";

/**
 * CameraPage
 * ---------------------------------------------------------------------------
 * Live workout space: the webcam feed on the left, and on the right a manual
 * rep counter, exercise picker and the history of sets saved this session.
 *
 * The exercise picker and the current rep count are local to this page. The
 * saved-set history is owned by App so it survives switching sidebar pages
 * (this page unmounts when you leave it, which also releases the camera).
 *
 * Reps are counted automatically: the backend watches the pose stream and
 * counts full-range reps (see Webcam_utilities/rep_counter.py), saving each one
 * like a Count Rep click. This page polls it for the live count. Count Rep and
 * Undo remain as manual corrections, and Save Completed Set advances the output
 * folder. The history remains local UI state.
 *
 * @param {Object} props
 * @param {Array<{id: number, exercise: string, reps: number, timestamp: string}>} [props.history]
 *   Sets saved so far this session, newest first.
 * @param {(record: Object) => void} props.onSaveSet - Called with a new record
 *   when the user saves a completed set.
 */

// Values become backend folder/file names, e.g. Push-Up_Set1/Push-Up_Rep1.json.
const EXERCISE_OPTIONS = [
  { value: "Push-Up", label: "Push-ups 🧱" },
  { value: "Pull-Up", label: "Pull-ups 🦾" },
  { value: "Squat", label: "Squats 🦵" },
  { value: "Sit-Up", label: "Sit-ups 🧘" },
];

const POLL_INTERVAL_MS = 300;

//what to tell the user for each phase the backend reports while it is tracking a body
const PHASE_LABELS = {
  waiting: "Get into the starting position",
  ready: "Ready",
  moving: "In motion",
  peak: "Full range, now return to start",
};

//"Push-Up" and "Push-up" are the same exercise
const sameExercise = (a, b) =>
  a.toLowerCase().replace(/[^a-z]/g, "") === b.toLowerCase().replace(/[^a-z]/g, "");

const cameraUrl = (path) => `/api/camera/${encodeURIComponent(CAMERA_ID)}/${path}`;

export default function CameraPage({ history = [], onSaveSet, session }) {
  const [currentExercise, setCurrentExercise] = useState("Push-Up");
  const [repCount, setRepCount] = useState(0);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [phase, setPhase] = useState("waiting");
  const [tracking, setTracking] = useState(false);

  //lets the poller ignore a reply that belongs to the previously selected exercise
  const exerciseRef = useRef(currentExercise);

  //tells the backend counter which exercise to watch (this also zeroes its count)
  useEffect(() => {
    exerciseRef.current = currentExercise;
    fetch(cameraUrl("exercise"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercise: currentExercise }),
    }).catch((error) => console.error("Unable to select exercise", error));
  }, [currentExercise]);

  //polls the backend for the automatic count
  useEffect(() => {
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(cameraUrl("reps"));
        if (!response.ok) throw new Error(`reps ${response.status}`);
        const state = await response.json();
        console.log("rep poll", state, exerciseRef.current);   // temporary
        if (cancelled || !sameExercise(state.exercise, exerciseRef.current)) return;
        setRepCount(state.reps);
        setPhase(state.phase);
        setTracking(state.tracking);
        } catch (error) {
          console.error("rep poll failed", error);              // was: catch {
          if (!cancelled) setTracking(false);
        }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const incrementReps = async () => {
    setRecordingError("");
    try {
      // Increase the visible count only after a JSON file was saved successfully.
      // If no pose met the movement threshold, show the backend error instead.
      await saveExerciseRep(CAMERA_ID);
      setRepCount((prev) => prev + 1);
    } catch (error) {
      setRecordingError(error.message);
    }
  };
  const decrementReps = async () => {
    if (repCount === 0) return;
    setRecordingError("");
    try {
      // Remove the corresponding JSON before reducing the visible rep count.
      await undoExerciseRep(CAMERA_ID);
      setRepCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      setRecordingError(error.message);
    }
  };

  const handleFinishWorkout = async () => {
    if (repCount === 0) {
      alert("Do at least 1 rep before finishing!");
      return;
    }
    setRecordingError("");
    try {
      // Advance the backend set first; retain UI counts if that request fails.
      await finishExerciseSet(CAMERA_ID);
    } catch (error) {
      setRecordingError(error.message);
      return;
    }
    // Also save the set to the user's account (linked to the plan attempt, if any).
    // A failure here shows a message but doesn't lose the set locally.
    try {
      await logCompletedSet({ exercise: currentExercise, reps: repCount, session });
    } catch (error) {
      setRecordingError(`Set saved locally, but not to your account: ${error.message}`);
    }
    onSaveSet?.({
      id: Date.now(),
      exercise: currentExercise,
      reps: repCount,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
    setRepCount(0);
  };

  return (
    <div className="cam">
      <header className="page-header">
        <div>
          <p className="page-header-date">Live workout space</p>
          <h1 className="page-header-title">{currentExercise} Training</h1>
        </div>
      </header>

      <div className={`cam-grid${debugExpanded ? " cam-grid--debug" : ""}`}>
        <section className="cam-video" aria-label="Camera stream">
          <div className="cam-video-bar">
            <span className="cam-live-dot" aria-hidden="true" />
            <span>Camera Stream Monitoring View</span>
          </div>
          <div className="cam-video-stage">
            <WebcamConnection
              exercise={currentExercise}
              debugExpanded={debugExpanded}
              onToggleDebug={() => setDebugExpanded((expanded) => !expanded)}
            />
          </div>
        </section>

        <section className="card cam-tracker">
          <div className="cam-field">
            <label className="cam-label" htmlFor="cam-exercise">Select Target Movement</label>
            <select
              id="cam-exercise"
              className="cam-select"
              value={currentExercise}
              onChange={(e) => {
                setCurrentExercise(e.target.value);
                setRepCount(0);
              }}
            >
              {EXERCISE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="cam-counter" role="status" aria-live="polite">
            <div className="cam-counter-label">Reps Completed</div>
            <div className="cam-counter-number">{repCount}</div>
          </div>

          <p className="cam-label" aria-live="polite">
            {tracking ? PHASE_LABELS[phase] ?? "Tracking" : "No body detected. Start the camera and step into view"}
          </p>

          <div className="cam-actions">
            <button type="button" className="cam-btn cam-btn--primary" onClick={incrementReps}>
              ＋ Count Rep
            </button>
            <button type="button" className="cam-btn cam-btn--ghost" onClick={decrementReps}>
              － Undo
            </button>
          </div>
          <button type="button" className="cam-btn cam-btn--save" onClick={handleFinishWorkout}>
            Save Completed Set
          </button>

          {recordingError && <p className="camera-error" role="alert">{recordingError}</p>}

          <div className="cam-history">
            <div className="cam-history-head">
              <span className="cam-label">📜 Session History Results</span>
              <span className="cam-history-count">{history.length} {history.length === 1 ? "Set" : "Sets"}</span>
            </div>
            {history.length === 0 ? (
              <p className="cam-history-empty">No historical entries recorded for this workout track.</p>
            ) : (
              <ul className="cam-history-list">
                {history.map((log) => (
                  <li key={log.id} className="cam-history-item">
                    <div>
                      <span className="cam-history-name">{log.exercise}</span>
                      <span className="cam-history-time">{log.timestamp}</span>
                    </div>
                    <span className="cam-history-badge">{log.reps} Reps</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
