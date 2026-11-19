import { useState } from 'react';
import { diagnosticsSummary } from './diagnosticsRecording';

export default function RecordingControls({ recording,running,ready=false }) {
  const [copyStatus,setCopyStatus]=useState('');
  const active=recording.phase==='countdown' || recording.phase==='recording';
  const report=recording.report,summary=report?diagnosticsSummary(report):'';
  function download() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;
    link.download=`bobcat-camera-diagnostics-${report.created_at.replace(/[:.]/g,'-')}.json`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function copy() {
    try {await navigator.clipboard.writeText(summary);setCopyStatus('Summary copied.');}
    catch {setCopyStatus('Select the saved summary below and copy it.');}
  }
  return <section className="live-form-recording" style={{marginTop:12}} aria-label="Diagnostics recording">
    <div className="live-form-recording-actions" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button className="cam-btn cam-btn--ghost" disabled={!running || !ready || active} onClick={()=>{setCopyStatus('');recording.begin();}}>{report?'Record new 60 seconds':'Record 60 seconds'}</button>
      {active && <button className="cam-btn cam-btn--ghost" onClick={()=>recording.finish()}>Stop recording</button>}
      {report && <><button className="cam-btn cam-btn--ghost" onClick={download}>Download diagnostics</button><button className="cam-btn cam-btn--ghost" onClick={copy}>Copy saved summary</button></>}
    </div>
    <p role="status">{recording.phase==='countdown'?`Recording starts in ${recording.seconds}s. Get into position.`:
      recording.phase==='recording'?`Recording: ${recording.seconds}s remaining · ${recording.frames} frames. Perform your squats.`:
      report?`Recording saved in this page: ${report.summary.frames} frames. Walking toward the screen will not change it.`:
      !ready?'Finish calibration and wait for the start chime before recording.':'Record up to 60 seconds after a 5-second countdown. Press Stop recording after your last rep. Numeric readings only; no video.'}</p>
    {report && <><p>Download before leaving or refreshing this page. A new recording replaces this one.</p><textarea style={{width:'100%',boxSizing:'border-box'}} aria-label="Saved diagnostics summary" value={summary} readOnly rows={13} /><p role="status">{copyStatus}</p></>}
  </section>;
}
