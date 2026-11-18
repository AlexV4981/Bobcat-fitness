export default function TrackingDebug({sample}) {
  const percent=n=>Number.isFinite(n)?`${(n*100).toFixed(1)}%`:'—';
  return <div style={{overflowX:'auto'}}>
    <p>Last counter sample: {sample?.metrics?.countingReason?.replaceAll('_',' ')??'waiting for fresh data'} · Green describes alignment, not counter readiness.</p>
    <table><thead><tr><th>Leg</th><th>Phase / reason</th><th>Knee 2D</th><th>Hip drop</th><th>Front drop</th><th>Thigh ratio</th><th>Foot drift</th><th>Bend signal</th></tr></thead>
      <tbody>{['left','right'].map(side=>{
        const m=sample?.metrics?.legTracking?.[side]??{};
        return <tr key={side}><td>{side}</td><td>{m.phase??'—'} · {(m.cycleHeld?'brief projection pause':m.trackingReason??m.countingReason??'waiting').replaceAll('_',' ')}{m.bendBlocker?` / ${m.bendBlocker.replaceAll('_',' ')}`:''}</td>
          <td>{Number.isFinite(m.kneeAngle)?`${m.kneeAngle.toFixed(1)}°`:'—'}</td><td>{percent(m.hipDrop)}</td><td>{percent(m.projectionDrop)}</td><td>{percent(m.thighRatio)}</td><td>{percent(m.footDrift)}</td><td>{m.bendSignal??'not confirmed'}</td></tr>;
      })}</tbody></table>
    <p>These are image-plane projections, not measured depth or anatomical 3D angles.</p>
    <p>Record after calibration: stand upright, then do comfortable squats with hands clasped in front. Include a slight left/right turn only if comfortable. Numeric joints and reasons only; no video.</p>
  </div>;
}
