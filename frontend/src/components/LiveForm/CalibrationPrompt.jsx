export default function CalibrationPrompt({status}) {
  if(status.phase==='countdown')return <div className="live-form-guide">
    <div className="live-form-guide-caption" role="status"><strong className="live-form-countdown">{status.seconds || 'Stand tall'}</strong><span>Get ready · lower your arms · feet about shoulder-width apart</span></div>
  </div>;
  return <div className="live-form-tpose-prompt" role="status"><strong>T-pose</strong><span>Arms out · feet about shoulder-width apart · hold 2 seconds</span></div>;
}

export function CalibrationStatus({status}) {
  const locked=['countdown','active'].includes(status.phase);
  const title=status.phase==='active'?'Calibrated':status.phase==='countdown'?'T-pose saved · get ready':status.phase==='holding'?'Hold your T-pose steady':'T-pose · arms out';
  return <div className={`live-form-calibration-status${locked?' live-form-calibration-status--locked':''}${status.phase==='active'?' live-form-start':''}`} role="status">
    <strong>{title}</strong>
    {status.phase!=='active' && <span>{status.message}</span>}
    {['positioning','holding'].includes(status.phase) && <progress aria-label="T-pose hold progress" value={status.progress} max="1" />}
  </div>;
}
