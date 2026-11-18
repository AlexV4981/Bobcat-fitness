import { angle, distance, unknown } from './poseGeometry.js';
import { FrontalSquatFeedback } from './frontalSquatFeedback.js';

const COUNT_BEND_ANGLE=125;
const SIDES = [[11,23,25,27], [12,24,26,28]];
export const SQUAT_JOINTS = new Set(SIDES.flat());

//count an observed movement cycle separately from the front-view knee-path checks
export class SquatAnalysis {
  constructor(calibration=null) { this.calibration=calibration; this.reset(); }
  reset() {
    this.frontal=this.calibration?null:new FrontalSquatFeedback();
    this.side=null; this.bones=null; this.reference=null; this.phase='waiting'; this.standSince=null;
    this.startedAt=null; this.bendSince=null; this.reachedBend=false; this.minKnee=180; this.maxDrop=0;
  }
  analyze(points, landmarks, width, height, at) {
    const fail=(message,metrics={})=>{this.reset();return unknown(message,points,metrics);};
    const candidates=SIDES.filter(side=>side.every(i=>points[i]));
    if (!candidates.length) return fail('Keep a shoulder, hip, knee and ankle visible on the same side.');
    //keep the same usable leg through a cycle instead of switching for small confidence changes
    const side=candidates.find(chain=>chain[0]===this.side) ?? candidates.sort((a,b)=>
      b.reduce((sum,i)=>sum+landmarks[i].visibility,0)-a.reduce((sum,i)=>sum+landmarks[i].visibility,0))[0];
    if (this.side!==null && this.side!==side[0]) this.reset();
    this.side=side[0];
    const [s,h,k,a]=side.map(i=>points[i]);
    const torso=distance(s,h), thigh=distance(h,k), shin=distance(k,a);
    if (torso<height*.09 || a.y-s.y<height*.25 || s.y>=h.y-torso*.2 || k.y>=a.y) {
      return fail('Keep your whole body visible with a level camera around hip height.',{trackingValid:false,trackingReason:'body_framing'});
    }
    const bones=[torso,thigh,shin];
    //a bent limb can look shorter in the image; compare with standing lengths instead of the current torso
    if(!this.reference){
      const captured=this.calibration?.standing?.[side[0]===11?'left':'right'];
      if(captured)this.reference={bones:[...captured.bones],hipY:captured.hipY,ankle:{...a}};
    }
    const reference=this.reference;
    const geometryOK=reference
      ? bones.every((n,i)=>n>=Math.max(8,reference.bones[i]*.25) && n<=reference.bones[i]*1.8)
      : [thigh,shin].every(n=>n>=torso*.35 && n<=torso*1.8);
    if (!geometryOK) {
      const legsOK=reference && bones.slice(1).every((n,i)=>n>=Math.max(8,reference.bones[i+1]*.25) && n<=reference.bones[i+1]*1.8);
      return fail('Counter geometry is uncertain. Keep your body visible.',{trackingValid:false,trackingReason:legsOK?'counter_torso_geometry':'joint_geometry'});
    }
    if (this.bones && bones.some((n,i)=>Math.abs(n/this.bones[i]-1)>.35)) {
      const legsChanged=bones.slice(1).some((n,i)=>Math.abs(n/this.bones[i+1]-1)>.35);
      return fail('Joint proportions changed. Waiting for consistent tracking.',{trackingValid:false,trackingReason:legsChanged?'joint_jump':'counter_torso_change'});
    }
    this.bones=bones;
    const knee=angle(h,k,a);
    if (!Number.isFinite(knee)) return fail('Knee position is uncertain.');
    const legLength=reference?reference.bones[1]+reference.bones[2]:thigh+shin;
    //subtract ankle movement so translating the whole image does not look like a squat
    const hipDrop=reference?(h.y-reference.hipY-(a.y-reference.ankle.y))/legLength:0;
    //front-view knees can stay nearly straight in 2D while the thigh projects shorter
    const projectedBend=Boolean(reference && thigh<=reference.bones[1]*.85
      && distance(a,reference.ankle)<=legLength*.10);
    const bent=(knee<=COUNT_BEND_ANGLE && hipDrop>=.15) || (projectedBend && hipDrop>=.20);

    let rep=false;
    if (knee>=160 && (!reference || hipDrop<=.08)) {
      this.standSince ??= at;
      if (at-this.standSince>=120) {
        if (this.phase!=='waiting' && this.phase!=='ready') rep=this.reachedBend && at-this.startedAt>=700;
        this.phase='ready'; this.startedAt=null; this.reachedBend=false;
        this.bendSince=null; this.minKnee=180; this.maxDrop=0;
        //learn the ordinary standing pose automatically and keep it fixed while moving
        if (!this.reference) this.reference={bones:[...bones],hipY:h.y,ankle:{...a}};
        else {
          this.reference.bones=this.reference.bones.map((n,i)=>n*.9+bones[i]*.1);
          this.reference.hipY=this.reference.hipY*.9+h.y*.1;
          this.reference.ankle={x:this.reference.ankle.x*.9+a.x*.1,y:this.reference.ankle.y*.9+a.y*.1};
        }
      }
    } else {
      this.standSince=null;
      if (this.phase==='ready' && (knee<145 || projectedBend) && hipDrop>=.08) {this.phase='descending';this.startedAt=at;}
      if (this.phase!=='waiting' && this.phase!=='ready') {
        this.minKnee=Math.min(this.minKnee,knee);
        this.maxDrop=Math.max(this.maxDrop,hipDrop);
        //either bend signal still needs a sustained low position and a complete return
        if (bent) {
          this.bendSince ??= at;
          if (at-this.bendSince>=120) this.reachedBend=true;
        } else this.bendSince=null;
        this.phase=knee>this.minKnee+8 || hipDrop<this.maxDrop-.04?'ascending':bent?'bottom':'descending';
      }
    }
    const viewLength=this.reference?.bones[0] ?? torso;
    const metrics={side:side[0]===11?'left':'right',kneeAngle:knee,hipDrop,trackingValid:true,projectedBend,countingBendSignal:bent?(knee<=COUNT_BEND_ANGLE?'knee_angle':'hip_drop_projection'):null,
      countingReason:rep?'completed_cycle':this.phase==='waiting'?'need_standing':this.phase==='ready'?'waiting_for_bend':this.reachedBend?'waiting_for_return':'need_sustained_bend'};
    if(this.calibration)return {...unknown('Movement cycle tracked.',points,metrics),phase:this.phase,rep};
    return this.frontal.analyze(points,at,this.phase,rep,metrics,viewLength);
  }
}
