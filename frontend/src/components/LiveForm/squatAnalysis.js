import { angle, distance, unknown } from './poseGeometry.js';
import { FrontalSquatFeedback } from './frontalSquatFeedback.js';

const COUNT_BEND_ANGLE=125;
const SIDES = [[11,23,25,27], [12,24,26,28]];
export const SQUAT_JOINTS = new Set(SIDES.flat());

//count an observed movement cycle separately from the front-view knee-path checks
export class SquatAnalysis {
  constructor() { this.reset(); }
  reset() {
    this.frontal=new FrontalSquatFeedback();
    this.side=null; this.bones=null; this.reference=null; this.phase='waiting'; this.standSince=null;
    this.startedAt=null; this.bendSince=null; this.reachedBend=false; this.minKnee=180;
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
    const reference=this.reference;
    const geometryOK=reference
      ? bones.every((n,i)=>n>=Math.max(8,reference.bones[i]*.25) && n<=reference.bones[i]*1.8)
      : [thigh,shin].every(n=>n>=torso*.35 && n<=torso*1.8);
    if (!geometryOK) return fail('Leg geometry is uncertain. Keep your legs clear of obstructions.',{trackingValid:false,trackingReason:'joint_geometry'});
    if (this.bones && bones.some((n,i)=>Math.abs(n/this.bones[i]-1)>.35)) {
      return fail('Joint proportions changed. Waiting for consistent tracking.',{trackingValid:false,trackingReason:'joint_jump'});
    }
    this.bones=bones;
    const knee=angle(h,k,a);
    if (!Number.isFinite(knee)) return fail('Knee position is uncertain.');
    const hipDrop=reference?(h.y-reference.hipY)/(reference.bones[1]+reference.bones[2]):0;

    let rep=false;
    if (knee>=160 && (!reference || hipDrop<=.08)) {
      this.standSince ??= at;
      if (at-this.standSince>=120) {
        if (this.phase!=='waiting' && this.phase!=='ready') rep=this.reachedBend && at-this.startedAt>=700;
        this.phase='ready'; this.startedAt=null; this.reachedBend=false;
        this.bendSince=null; this.minKnee=180;
        //learn the ordinary standing pose automatically and keep it fixed while moving
        if (!this.reference) this.reference={bones:[...bones],hipY:h.y};
        else {
          this.reference.bones=this.reference.bones.map((n,i)=>n*.9+bones[i]*.1);
          this.reference.hipY=this.reference.hipY*.9+h.y*.1;
        }
      }
    } else {
      this.standSince=null;
      if (this.phase==='ready' && knee<145 && hipDrop>=.08) {this.phase='descending';this.startedAt=at;}
      if (this.phase!=='waiting' && this.phase!=='ready') {
        this.minKnee=Math.min(this.minKnee,knee);
        //count a clear sustained bend and hip drop independently of knee-path feedback
        if (knee<=COUNT_BEND_ANGLE && hipDrop>=.15) {
          this.bendSince ??= at;
          if (at-this.bendSince>=120) this.reachedBend=true;
        } else this.bendSince=null;
        this.phase=knee>this.minKnee+8?'ascending':knee<=COUNT_BEND_ANGLE?'bottom':'descending';
      }
    }
    const viewLength=this.reference?.bones[0] ?? torso;
    const metrics={side:side[0]===11?'left':'right',kneeAngle:knee,hipDrop,trackingValid:true,
      countingReason:rep?'completed_cycle':this.phase==='waiting'?'need_standing':this.phase==='ready'?'waiting_for_bend':this.reachedBend?'waiting_for_return':'need_sustained_bend'};
    return this.frontal.analyze(points,at,this.phase,rep,metrics,viewLength);
  }
}
