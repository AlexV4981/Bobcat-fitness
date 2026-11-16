import { useState } from 'react';
import { diagnosticsSummary } from './diagnosticsRecording';

export default function RecordingControls({ recording,running }) {
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
  return <section className="live-form-recording" aria-label="Diagnostics recording">
    <div className="live-form-recording-actions">
      <button className="cam-btn cam-btn--ghost" disabled={!running || active} onClick={()=>{setCopyStatus('');recording.begin();}}>{report?'Record new 30 seconds':'Record 30 seconds'}</button>
      {active && <button className="cam-btn cam-btn--ghost" onClick={()=>recording.finish()}>Stop recording</button>}
      {report && <><button className="cam-btn cam-btn--ghost" onClick={download}>Download diagnostics</button><button className="cam-btn cam-btn--ghost" onClick={copy}>Copy saved summary</button></>}
    </div>
    <p role="status">{recording.phase==='countdown'?`Recording starts in ${recording.seconds}s. Get into position.`:
      recording.phase==='recording'?`Recording: ${recording.seconds}s remaining · ${recording.frames} frames. Perform your squats.`:
      report?`Recording saved in this page: ${report.summary.frames} frames. Walking toward the screen will not change it.`:
      'Record a 30-second movement sequence after a 5-second countdown. Numeric readings only; no video is recorded.'}</p>
    {report && <><p>Download before leaving or refreshing this page. A new recording replaces this one.</p><textarea aria-label="Saved diagnostics summary" value={summary} readOnly rows={13} /><p role="status">{copyStatus}</p></>}
  </section>;
}
