import { visible, distance, angle, unknown } from './poseGeometry.js';
import { CalibratedAlignmentFeedback } from './calibratedAlignmentFeedback.js';
import { SquatAnalysis, SQUAT_JOINTS } from './squatAnalysis.js';
export { visible, angle } from './poseGeometry.js';
//check positions in the camera image without using model z or world coordinates
export const MAX_FRAME_AGE_MS = 180;
export const CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const SIDES = [[11,13,15,23,25,27], [12,14,16,24,26,28]];

export class FormAnalysis {
  constructor() { this.calibration=null; this.reset(); }
  setCalibration(reference) { this.calibration=reference; this.reset(); }
  reset() { this.previous = null; this.candidate = null; this.candidateAt = 0; this.lastAt = null; this.repPhase = 'waiting'; this.repAt = 0; this.trackedSide = null; this.previousBones = null; this.squat=new SquatAnalysis(); this.feedback=this.calibration?new CalibratedAlignmentFeedback(this.calibration):null; this.exercise=null; }
  pause() { this.reset(); }
  analyze(landmarks, width, height, capturedAt, now, exercise = 'Push-Up') {
    if (this.exercise!==exercise) {this.reset();this.exercise=exercise;}
    const gap = this.lastAt !== null ? capturedAt-this.lastAt : Infinity;
    if (gap > MAX_FRAME_AGE_MS || gap <= 0) {this.reset();this.exercise=exercise;}
    this.lastAt = capturedAt;
    if (!Number.isFinite(now-capturedAt) || now-capturedAt < 0 || now-capturedAt > MAX_FRAME_AGE_MS) {
      this.pause(); return unknown('Tracking delayed · paused');
    }
    const points = landmarks.map(p => visible(p) ? { x:p.x*width,y:p.y*height } : null);
    //hide sudden jumps instead of keeping an old point or guessing a replacement
    let jumped = false;const jumpedJoints=[];
    if (this.previous && gap < MAX_FRAME_AGE_MS) {
      const limit = Math.hypot(width,height)*(0.035 + gap/1000*1.2);
      points.forEach((p,i) => {
        if (p && this.previous[i] && distance(p,this.previous[i]) > limit) {
          points[i]=null;
          if(exercise!=='Squat')jumped=true;
          else if(SQUAT_JOINTS.has(i))jumpedJoints.push(i);
        }
      });
    }
    //use these raw detections for the next comparison so tracking can recover after a jump
    this.previous = landmarks.map(p => visible(p) ? {x:p.x*width,y:p.y*height} : null);
    const fail = (message) => { this.candidate=null; this.repPhase='waiting'; this.trackedSide=null; this.previousBones=null; this.squat.reset(); this.feedback?.pause(); return unknown(message,points); };
    if (jumped) return fail('Tracking changed · keep body visible');
    if (exercise === 'Squat') {
      const movement=this.squat.analyze(points,landmarks,width,height,capturedAt,jumpedJoints);
      if(!this.feedback)return movement;
      const geometryReason=movement.metrics.formGeometryReason;
      if(geometryReason){
        this.feedback.pause();
        return {...unknown('Leg tracking unclear · stand upright',points,
          {...movement.metrics,formTrackingValid:false,feedbackReason:geometryReason==='joint_geometry'?'leg_geometry_uncertain':'joint_jump_uncertain'}),phase:movement.phase,rep:movement.rep};
      }
      //rep-count framing can pause while confident posture observations remain assessable
      return this.feedback.analyze(points,capturedAt,movement.phase,movement.rep,
        {...movement.metrics,counterPaused:movement.metrics.trackingValid===false,countingMessage:movement.message});
    }
    if (exercise !== 'Push-Up') return fail('Skeleton preview only. Form checks for this exercise are not available yet.');
    const candidates = SIDES.filter(side => side.every(i => points[i]));
    if (!candidates.length) return fail('Keep shoulder, elbow, wrist, hip, knee and ankle visible.');
    //need the other shoulder visible so we can reject a clearly front-facing view
    if (!points[11] || !points[12]) return fail('Turn side-on and keep both shoulders visible.');
    const side = candidates.sort((a,b) => b.reduce((sum,i)=>sum+landmarks[i].visibility,0)-a.reduce((sum,i)=>sum+landmarks[i].visibility,0))[0];
    if (this.trackedSide !== null && this.trackedSide !== side[0]) {
      this.candidate=null; this.repPhase='waiting'; this.previousBones=null;
    }
    this.trackedSide=side[0];
    const [s,e,w,h,k,a] = side.map(i=>points[i]);
    const torso = distance(s,h);
    if (torso < height*0.09 || distance(points[11],points[12]) > torso*0.65
        || Math.abs(a.x-s.x) < width*0.35 || Math.abs(a.y-s.y) > Math.abs(a.x-s.x)*0.7) {
      return fail('Use a side view of a floor push-up, with your whole body in frame.');
    }
    const bones = [distance(s,e),distance(e,w),torso,distance(h,k),distance(k,a)];
    if (bones.some(n=>n < torso*0.22 || n > torso*1.8)) return fail('Joint geometry is uncertain. Reposition so joints are clear.');
    if (this.previousBones && bones.some((n,i)=>Math.abs(n/this.previousBones[i]-1)>0.35)) {
      return fail('Joint proportions changed. Waiting for consistent tracking.');
    }
    this.previousBones=bones;
    const knee = angle(h,k,a), hip = angle(s,h,a), elbow = angle(s,e,w);
    if (![knee,hip,elbow].every(Number.isFinite) || knee < 155) return fail('Standard push-up check needs a visible, extended leg.');
    //leave borderline alignment uncertain instead of forcing a correction
    const candidate = hip >= 170 ? 'good' : hip <= 150 ? 'issue' : 'uncertain';
    if (candidate !== this.candidate) { this.candidate=candidate; this.candidateAt=capturedAt; }
    const state = capturedAt-this.candidateAt >= 250 ? candidate : 'uncertain';
    //only count a full extended -> bent -> extended arm cycle
    //reset an unfinished cycle if tracking drops so separate poses do not become a rep
    let rep = false;
    if (this.repPhase === 'waiting' && elbow >= 155) { this.repPhase='ready'; this.repAt=capturedAt; }
    else if (this.repPhase === 'ready' && elbow <= 100) this.repPhase='bent';
    else if (this.repPhase === 'bent' && elbow >= 155) {
      rep = capturedAt-this.repAt >= 500;
      this.repPhase='ready'; this.repAt=capturedAt;
    }
    return { state, points, checkedEdges: [[side[0],side[3]],[side[3],side[4]],[side[4],side[5]]],
      message: state === 'good' ? 'Checked body line is aligned.' : state === 'issue' ? 'Bring shoulders, hips and ankles into one line.' : 'Checking body line…',
      phase: this.repPhase, rep };
  }
}

export function drawPose(ctx, result) {
  const { points, checkedEdges, state } = result;
  const colored = new Set(checkedEdges.map(([a,b])=>`${a},${b}`));
  const jointColors={},jointSeverity={};
  ctx.lineWidth = Math.max(5,ctx.canvas.width/150);
  for (const [a,b] of CONNECTIONS) {
    if (!points[a] || !points[b]) continue;
    const segmentState=result.edgeStates?.[`${a},${b}`] ?? (colored.has(`${a},${b}`)?state:'uncertain');
    ctx.strokeStyle=result.edgeColors?.[`${a},${b}`] ?? (segmentState==='good'?'#39ed88':segmentState==='issue'?'#ff6262':'#b9c3d0');
    if(segmentState!=='uncertain' && (result.edgeColors?.[`${a},${b}`] || segmentState==='good' || segmentState==='issue')){
      const severity=result.edgeSeverity?.[`${a},${b}`] ?? (segmentState==='issue'?1:segmentState==='caution'?.5:0);
      for(const id of [a,b])if(severity>=(jointSeverity[id] ?? -1)){jointSeverity[id]=severity;jointColors[id]=ctx.strokeStyle;}
    }
    ctx.beginPath(); ctx.moveTo(points[a].x,points[a].y); ctx.lineTo(points[b].x,points[b].y); ctx.stroke();
  }
  for (const [id,point] of points.entries()) {
    if (!point) continue;
    ctx.fillStyle=jointColors[id] ?? '#b9c3d0'; ctx.beginPath(); ctx.arc(point.x,point.y,Math.max(3,ctx.canvas.width/200),0,Math.PI*2); ctx.fill();
  }
}
