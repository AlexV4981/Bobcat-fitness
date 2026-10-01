import { useState } from "react";
import WebcamConnection from "../components/WebCam/WebcamConnection";
import "./CameraPage.css";

/**
 * CameraPage
 * ---------------------------------------------------------------------------
 * Live workout space: the webcam feed on the left, and on the right a manual
 * rep counter, exercise picker and the history of sets saved this session.
 * (Moved here from the WebcamProcessing branch's App.jsx, logic unchanged.)
 *
 * The exercise picker and the current rep count are local to this page. The
 * saved-set history is owned by App so it survives switching sidebar pages
 * (this page unmounts when you leave it, which also releases the camera).
 *
 * Data source: manual counting for now. TODO(api): POST each saved set to the
 * backend, and replace the Count Rep button with the webcam rep detector.
 *
 * @param {Object} props
 * @param {Array<{id: number, exercise: string, reps: number, timestamp: string}>} [props.history]
 *   Sets saved so far this session, newest first.
 * @param {(record: Object) => void} props.onSaveSet - Called with a new record
 *   when the user saves a completed set.
 */

const EXERCISE_OPTIONS = [
  { value: "Push-up", label: "Push-ups 🧱" },
  { value: "Pull-up", label: "Pull-ups 🦾" },
  { value: "Squat", label: "Squats 🦵" },
  { value: "Sit-up", label: "Sit-ups 🧘" },
];

export default function CameraPage({ history = [], onSaveSet }) {
  const [currentExercise, setCurrentExercise] = useState("Push-up");
  const [repCount, setRepCount] = useState(0);
  
  const incrementReps = () => setRepCount((prev) => prev + 1);
  const decrementReps = () => setRepCount((prev) => (prev > 0 ? prev - 1 : 0));

  const handleFinishWorkout = () => {
    if (repCount === 0) {
      alert("Do at least 1 rep before finishing!");
      return;
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

      <div className="cam-grid">
        <section className="cam-video" aria-label="Camera stream">
          <div className="cam-video-bar">
            <span className="cam-live-dot" aria-hidden="true" />
            <span>Camera Stream Monitoring View</span>
          </div>
          <div className="cam-video-stage">
            <WebcamConnection />
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