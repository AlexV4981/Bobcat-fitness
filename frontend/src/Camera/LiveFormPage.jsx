import { useState } from 'react';
import BrowserCamera from '../components/LiveForm/BrowserCamera';
import { logCompletedSet } from '../lib/workoutLog';
import './CameraPage.css';

export default function LiveFormPage({ history=[], onSaveSet, session, onNavigate }) {
  const [exercise,setExercise]=useState('Squat'), [reps,setReps]=useState(0);
  const [error,setError]=useState(''), [saving,setSaving]=useState(false);
  const [debugExpanded,setDebugExpanded]=useState(false);
  const [cameraSession,setCameraSession]=useState(0);
  async function save() {
    if (!reps || saving) return;
    const record={id:Date.now(),exercise,reps,timestamp:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})};
    //reset the tracking sequence before starting the next set
    setCameraSession(n=>n+1); setSaving(true); setError('');
    onSaveSet?.(record); setReps(0);
    try { await logCompletedSet({exercise,reps,session}); }
    catch(e) { setError(`Set saved in session history, but not to your account: ${e.message}`); }
    finally { setSaving(false); }
  }
  return <div className="cam">
    <header className="page-header"><div><p className="page-header-date">Live workout space</p><h1 className="page-header-title">Live form feedback</h1></div></header>
    <div className={`cam-grid${debugExpanded ? " cam-grid--debug" : ""}`}>
      <section className="cam-video" aria-label="Camera and form feedback">
        <div className="cam-video-bar">On-device movement tracking · Preview</div>
        <BrowserCamera repCount={reps} debugExpanded={debugExpanded} onToggleDebug={()=>setDebugExpanded(value=>!value)} resetToken={cameraSession} exercise={exercise} onRep={()=>setReps(n=>n+1)} />
      </section>
      <section className="card cam-tracker">
        <div className="cam-field"><label className="cam-label" htmlFor="live-exercise">Exercise</label>
          <select id="live-exercise" className="cam-select" value={exercise} disabled={saving} onChange={e=>{setExercise(e.target.value);setReps(0);}}>
            {['Push-Up','Pull-Up','Squat','Sit-Up'].map(name=><option key={name}>{name}</option>)}
          </select>
        </div>
        <p className="cam-tracking-status">{exercise==='Squat'
          ? 'Face the camera with your whole body and both feet visible. Stand normally for a moment, then squat comfortably. Colors check inward knee drift from your standing path; squat depth and overall form are not assessed.'
          : exercise==='Push-Up'
          ? 'Front-facing skeleton preview is available. Push-up form checks and automatic counting are not yet available in this workflow.'
          : 'Skeleton preview is available. Automatic form checks and rep counting for this exercise are not available yet.'}</p>
        <div className="cam-counter"><div className="cam-counter-label">Reps completed</div><div className="cam-counter-number" aria-live="polite">{reps}</div></div>
        <p className="cam-tracking-status">{exercise==='Squat' ? 'Automatic count follows standing, bending and returning to standing. Green means the inward-knee check passed; it does not certify squat depth or complete form. Check the count before saving.' : 'Use the manual counter for this exercise.'}</p>
        <div className="cam-actions">
          <button className="cam-btn cam-btn--primary" disabled={saving} onClick={()=>setReps(n=>n+1)}>＋ Manual rep</button>
          <button className="cam-btn cam-btn--ghost" disabled={!reps || saving} onClick={()=>setReps(n=>Math.max(0,n-1))}>－ Undo</button>
        </div>
        <button className="cam-btn cam-btn--save" disabled={!reps || saving} onClick={save}>{saving?'Saving…':'Save completed set'}</button>
        {error && <p className="camera-error" role="alert">{error}</p>}
        <div className="cam-history"><div className="cam-history-head"><span className="cam-label">Session history</span><span>{history.length} sets</span></div>
          {history.length ? <ul className="cam-history-list">{history.map(log=><li key={log.id} className="cam-history-item"><span>{log.exercise} · {log.timestamp}</span><span className="cam-history-badge">{log.reps} reps</span></li>)}</ul> : <p className="cam-history-empty">Completed sets appear here.</p>}
        </div>
        <button className="cam-btn cam-btn--recovery" onClick={()=>onNavigate?.('AI Dieting')}>Fuel your recovery · AI Dieting</button>
      </section>
    </div>
  </div>;
}
