import { useState } from "react";
import BrowserCamera from "../components/LiveForm/BrowserCamera";
import { logCompletedSet } from "../lib/workoutLog";
import "./CameraPage.css";

//keep the workout layout while the camera worker handles pose tracking in the browser
const EXERCISE_OPTIONS = [
  { value: "Push-Up", label: "Push-ups" },
  { value: "Pull-Up", label: "Pull-ups" },
  { value: "Squat", label: "Squats" },
  { value: "Sit-Up", label: "Sit-ups" },
];

export default function CameraPage({ history = [], onSaveSet, session, onNavigate }) {
  const [currentExercise, setCurrentExercise] = useState("Squat");
  const [repCount, setRepCount] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cameraSession, setCameraSession] = useState(0);

  const incrementReps = () => setRepCount((count) => count + 1);
  const decrementReps = () => setRepCount((count) => Math.max(0, count - 1));

  const handleFinishWorkout = async () => {
    if (repCount === 0 || saving) return;
    const record = {
      id: Date.now(), exercise: currentExercise, reps: repCount,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    //save the session entry before the account request so a failed request cannot lose the set
    setSaving(true);
    setRecordingError("");
    setCameraSession((value) => value + 1);
    onSaveSet?.(record);
    setRepCount(0);
    try {
      await logCompletedSet({ exercise: currentExercise, reps: record.reps, session });
    } catch (error) {
      setRecordingError(`Set saved in session history, but not to your account: ${error.message}`);
    } finally {
      setSaving(false);
    }
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
            <span>Movement capture</span>
          </div>
          <div className="cam-video-stage">
            <BrowserCamera
              exercise={currentExercise}
              resetToken={cameraSession}
              onRep={incrementReps}
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
              disabled={saving}
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

          <p className="cam-tracking-status">
            {currentExercise === "Squat"
              ? "Face the screen with your whole body and both feet visible. Stand normally for a moment, then squat. Automatic counting follows a bend and return to standing."
              : "Skeleton preview is available. Use Count Rep for this exercise; automatic counting and form checks are not available yet."}
          </p>
          {currentExercise === "Squat" && <p className="cam-tracking-status">
            Colors check inward knee movement only. Squat depth and overall form are not assessed. Check your count before saving.
          </p>}

          <div className="cam-actions">
            <button type="button" className="cam-btn cam-btn--primary" disabled={saving} onClick={incrementReps}>
              ＋ Count Rep
            </button>
            <button type="button" className="cam-btn cam-btn--ghost" disabled={!repCount || saving} onClick={decrementReps}>
              － Undo
            </button>
          </div>
          <button type="button" className="cam-btn cam-btn--save" disabled={!repCount || saving} onClick={handleFinishWorkout}>
            {saving ? "Saving…" : "Save Completed Set"}
          </button>

          {recordingError && <p className="camera-error" role="alert">{recordingError}</p>}

          <div className="cam-diet-shortcut" style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #eee' }}>
            <button
              type="button"
              className="cam-btn"
              onClick={() => onNavigate?.('AI Dieting')}
              style={{
                width: '100%',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🥗 Fuel Your Recovery (AI Diet)</span>
            </button>
          </div>

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
