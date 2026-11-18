export default function CalibrationPrompt({status}) {
  if(status.phase==='countdown')return <div className="live-form-guide">
    <div className="live-form-guide-caption" role="status"><strong className="live-form-countdown">{status.seconds || 'Stand tall'}</strong><span>Get ready · lower your arms and settle your stance</span></div>
  </div>;
  return <div className="live-form-tpose-prompt" role="status"><strong>T-pose</strong><span>Arms out · hold 2 seconds</span></div>;
}

export function CalibrationStatus({status}) {
  const locked=['countdown','active'].includes(status.phase);
  const title=status.phase==='active'?'Calibrated · visible alignment colors':status.phase==='countdown'?'T-pose saved · get ready':status.phase==='holding'?'Hold your T-pose steady':'T-pose · arms out';
  return <div className={`live-form-calibration-status${locked?' live-form-calibration-status--locked':''}${status.phase==='active'?' live-form-start':''}`} role="status">
    <strong>{title}</strong>
    <span>{status.phase==='active'?'Body posture tints the whole skeleton; knee deviation colors its own leg. Depth and individual arm technique are not graded.':status.message}</span>
    {['positioning','holding'].includes(status.phase) && <progress aria-label="T-pose hold progress" value={status.progress} max="1" />}
  </div>;
}
