const DURATION_MS=60000;
const COUNTDOWN_MS=5000;
const MAX_FRAMES=2400;
const round=value=>Number.isFinite(value)?Math.round(value*1000)/1000:null;
const counts=values=>values.reduce((result,value)=>{if(value)result[value]=(result[value]??0)+1;return result;},{});
const percentile=(values,fraction)=>values.length?values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*fraction)-1]:null;

export class DiagnosticsRecording {
  constructor(exercise,now,userAgent='') {
    this.exercise=exercise; this.startAt=now+COUNTDOWN_MS; this.endAt=this.startAt+DURATION_MS;
    this.createdAt=new Date().toISOString(); this.userAgent=userAgent; this.frames=[]; this.events=[];
    this.finished=false; this.lastFeedback='';this.calibrations=[];this.lastCalibrationReference=null;this.counterReferences=[];this.lastCounterReferences={};
  }
  phase(now) {return this.finished?'complete':now<this.startAt?'countdown':'recording';}
  tick(now) {if(!this.finished && now>=this.endAt)this.finish(now,'time_limit');}
  noteFeedback(feedback,now) {
    this.tick(now);
    if(this.finished || now<this.startAt || this.events.length>=1000)return;
    const key=`${feedback.state}:${feedback.message}`;
    if(key===this.lastFeedback)return;
    this.lastFeedback=key;
    this.events.push({at_ms:round(now-this.startAt),state:feedback.state,message:feedback.message});
  }
  append(sample,now) {
    this.tick(now);
    if(this.finished || now<this.startAt || sample.capturedAt<this.startAt)return;
    const {result,landmarks}=sample;
    if(sample.calibrationReference && result.metrics?.calibrationLocked && sample.calibrationReference!==this.lastCalibrationReference){
      this.lastCalibrationReference=sample.calibrationReference;
      if(this.calibrations.length<4)this.calibrations.push({at_ms:round(sample.capturedAt-this.startAt),reference:JSON.parse(JSON.stringify(sample.calibrationReference))});
    }
    for(const [side,reference] of Object.entries(sample.counterReferences??{})){
      if(reference && reference!==this.lastCounterReferences[side] && this.counterReferences.length<16){
        this.lastCounterReferences[side]=reference;
        this.counterReferences.push({at_ms:round(sample.capturedAt-this.startAt),side,reference:JSON.parse(JSON.stringify(reference))});
      }
    }
    this.frames.push({
      captured_ms:round(sample.capturedAt-this.startAt),received_ms:round(now-this.startAt),
      frame_age_ms:round(now-sample.capturedAt),inference_ms:round(sample.inferenceMs),interval_ms:round(sample.interval),
      delegate:sample.delegate,width:sample.width,height:sample.height,
      state:result.state,message:result.message,phase:result.phase,rep:result.rep===true,metrics:{...result.metrics},
      joints:landmarks.map((p,id)=>({id,x:round(p.x),y:round(p.y),visibility:round(p.visibility),presence:round(p.presence),usable:Boolean(result.points[id])})),
    });
    if(this.frames.length>=MAX_FRAMES)this.finish(now,'sample_limit');
  }
  finish(now,reason='stopped') {
    if(this.finished)return;
    this.finished=true;this.durationMs=Math.max(0,Math.min(DURATION_MS,now-this.startAt));this.reason=reason;
  }
  report() {
    if(!this.finished)throw new Error('Stop the recording before exporting it.');
    const timings=key=>this.frames.map(frame=>frame[key]).filter(Number.isFinite);
    const states={good:0,issue:0,uncertain:0};
    this.frames.forEach(frame=>states[frame.state]++);
    return {format:'bobcat-camera-diagnostics',version:1,created_at:this.createdAt,exercise:this.exercise,
      user_agent:this.userAgent,counter_algorithm:'front_projection',counter_revision:'bounded_thigh_pause_150ms',counter_references:this.counterReferences,calibration_references:this.calibrations,duration_ms:round(this.durationMs),stop_reason:this.reason,
      scope:'Numeric image-plane joint estimates; no video, calibrated metric depth or ground-truth accuracy measurements.',
      summary:{calibration_phases:counts(this.frames.map(frame=>frame.metrics.calibrationPhase)),calibration_pause_reasons:counts(this.frames.map(frame=>frame.metrics.calibrationReason)),movement_phases:counts(this.frames.map(frame=>frame.phase)),feedback_pause_reasons:counts(this.frames.map(frame=>frame.metrics.feedbackReason)),
        counting_reasons:counts(this.frames.map(frame=>frame.metrics.countingReason)),
        leg_counting_reasons:Object.fromEntries(['left','right'].map(side=>[side,counts(this.frames.map(frame=>frame.metrics.legTracking?.[side]?.trackingReason ?? frame.metrics.legTracking?.[side]?.countingReason))])),
        uncertain_messages:counts(this.frames.filter(frame=>frame.state==='uncertain').map(frame=>frame.message)),
        frames:this.frames.length,automatic_reps:this.frames.filter(frame=>frame.rep).length,returned_frame_states:states,
        inference_p50_ms:percentile(timings('inference_ms'),.5),inference_p95_ms:percentile(timings('inference_ms'),.95),
        frame_age_p50_ms:percentile(timings('frame_age_ms'),.5),frame_age_p95_ms:percentile(timings('frame_age_ms'),.95),
        interval_p95_ms:percentile(timings('interval_ms'),.95)},frames:this.frames,events:this.events};
  }
}

export function diagnosticsSummary(report) {
  const s=report.summary,phases=s.movement_phases ?? counts(report.frames.map(frame=>frame.phase)),reasons=s.feedback_pause_reasons ?? counts(report.frames.map(frame=>frame.metrics.feedbackReason));
  const messages=s.uncertain_messages ?? counts(report.frames.filter(frame=>frame.state==='uncertain').map(frame=>frame.message));
  const listing=map=>Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([name,count])=>`${name}: ${count}`).join('; ') || 'none';
  const display=value=>value===null?'—':`${Math.round(value)} ms`;
  return `Bobcat camera diagnostics\nExercise: ${report.exercise}\nRecorded: ${report.created_at}\nDuration: ${(report.duration_ms/1000).toFixed(1)} seconds\nStop reason: ${report.stop_reason}\nReturned frames: ${s.frames}\nAutomatic reps during recording: ${s.automatic_reps}\nPose p50 / p95: ${display(s.inference_p50_ms)} / ${display(s.inference_p95_ms)}\nFrame age p50 / p95: ${display(s.frame_age_p50_ms)} / ${display(s.frame_age_p95_ms)}\nUpdate interval p95: ${display(s.interval_p95_ms)}\nReturned-frame states: green ${s.returned_frame_states.good}, red ${s.returned_frame_states.issue}, uncertain ${s.returned_frame_states.uncertain}\nCalibration phases: ${listing(s.calibration_phases ?? {})}\nCalibration pause reasons: ${listing(s.calibration_pause_reasons ?? {})}\nMovement phases: ${listing(phases)}\nCounter reasons: ${listing(s.counting_reasons ?? {})}\nLeft leg: ${listing(s.leg_counting_reasons?.left ?? {})}\nRight leg: ${listing(s.leg_counting_reasons?.right ?? {})}\nForm feedback pause reasons: ${listing(reasons)}\nMost frequent uncertain messages: ${listing(messages)}\nUncertain includes intermediate colors and unassessed frames; it does not always mean tracking failed.\n${report.scope}`;
}
