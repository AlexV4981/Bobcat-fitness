import { useEffect, useState } from 'react';
import { MAX_FRAME_AGE_MS } from './formAnalysis';
const JOINTS=[[11,'Left shoulder'],[12,'Right shoulder'],[23,'Left hip'],[24,'Right hip'],[25,'Left knee'],[26,'Right knee'],[27,'Left ankle'],[28,'Right ankle']];
export default function TrackingDebug({ sample,repCount=0 }) {
  const [now,setNow]=useState(()=>performance.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(performance.now()),250);return()=>clearInterval(timer);},[]);
  if (!sample) return <div id="live-form-debug" className="live-form-debug">Start the camera to see tracking diagnostics.</div>;
  const age=Math.max(0,Math.round(now-sample.capturedAt)), stale=age>MAX_FRAME_AGE_MS;
  const {metrics={}}=sample;
  return <div id="live-form-debug" className="live-form-debug">
    <p><strong>Tracking diagnostics</strong> · Reps in set: <strong data-diagnostic-reps>{repCount}</strong> · {sample.width} × {sample.height} · {sample.delegate} · Pose {sample.inference} ms · Update interval {sample.interval} ms · Sample age {age} ms</p>
    <p>{stale?'Diagnostic snapshot is stale; do not treat these joints as current.':'Diagnostic snapshot is fresh.'} {sample.message}</p>
    <p>View: {metrics.view ?? 'unconfirmed'} · Tracked leg: {metrics.side ?? '—'} · Phase: {sample.phase}
      {' · '}Projected knee angle: {Number.isFinite(metrics.kneeAngle)?`${metrics.kneeAngle.toFixed(1)}°`:'—'}
      {' · '}Squat depth: unassessed</p>
    {metrics.countingReason && <p>Counter: {metrics.countingReason.replaceAll('_',' ')} · Form feedback: {metrics.feedbackReason?.replaceAll('_',' ') ?? 'inward-knee check active'}</p>}
    {metrics.kneeInwardDrift && <p>Inward change from standing, as % of foot spacing: left {(metrics.kneeInwardDrift.left*100).toFixed(1)}% · right {(metrics.kneeInwardDrift.right*100).toFixed(1)}%</p>}
    <p>Coordinates are in the camera image before mirroring. Hidden joints cannot supply form corrections. Gray means unassessed, not bad form.</p>
    <div className="live-form-debug-scroll"><table><thead><tr><th>Joint</th><th>X / Y pixels</th><th>Visibility / presence</th><th>Usable</th></tr></thead>
      <tbody>{JOINTS.map(([id,name])=>{
        const raw=sample.landmarks[id],p=sample.points[id];
        const score=n=>Number.isFinite(n)?`${Math.round(n*100)}%`:'—';
        return <tr key={id}><td>{name}</td><td>{p?`${Math.round(p.x)} / ${Math.round(p.y)}`:'—'}</td><td>{score(raw?.visibility)} / {score(raw?.presence)}</td><td>{p?'Visible estimate':'Hidden / uncertain'}</td></tr>;
      })}</tbody></table></div>
    <p>Model confidence is not a measurement of joint accuracy. The front-view check observes inward knee movement in the image. It does not measure anatomical knee angles, squat depth, spinal rounding or heel loading.</p>
  </div>;
}
