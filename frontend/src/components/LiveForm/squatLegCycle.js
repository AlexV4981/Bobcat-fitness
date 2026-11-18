import { angle, distance } from './poseGeometry.js';

const COUNT_BEND_ANGLE=125;
//each leg learns its own standing reference and must finish its own movement cycle
export class SquatLegCycle {
  constructor(joints) { this.joints=joints;this.reset(); }
  reset() {
    this.bones=null; this.reference=null; this.phase='waiting'; this.standSince=null;
    this.startedAt=null; this.bendSince=null; this.reachedBend=false; this.minKnee=180;
  }
  analyze(points, height, at, jumpedJoints=[]) {
    const fail=(message,metrics={})=>{
      const standing=this.reference;this.reset();
      //a torso-only pause keeps the counter's learned leg reference, never a partial cycle
      if(['counter_torso_geometry','counter_torso_change'].includes(metrics.trackingReason))this.reference=standing;
      return {phase:'waiting',rep:false,metrics:{trackingValid:false,...metrics,countingReason:'tracking_paused'},message};
    };
    if(this.joints.some(id=>jumpedJoints.includes(id)))return fail('Leg tracking changed',{trackingReason:'joint_jump'});
    if(!this.joints.every(id=>points[id]))return fail('Keep leg visible',{trackingReason:'joints_missing'});
    const [s,h,k,a]=this.joints.map(id=>points[id]);
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
    const hipDrop=reference?(h.y-reference.hipY)/(reference.bones[1]+reference.bones[2]):0;

    let rep=false,cycleStartedAt=null;
    if (knee>=160 && (!reference || hipDrop<=.08)) {
      this.standSince ??= at;
      if (at-this.standSince>=120) {
        if (this.phase!=='waiting' && this.phase!=='ready') {
          rep=this.reachedBend && at-this.startedAt>=700;
          if(rep)cycleStartedAt=this.startedAt;
        }
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
    const metrics={kneeAngle:knee,hipDrop,trackingValid:true,
      countingReason:rep?'completed_cycle':this.phase==='waiting'?'need_standing':this.phase==='ready'?'waiting_for_bend':this.reachedBend?'waiting_for_return':'need_sustained_bend'};
    return {phase:this.phase,rep,cycleStartedAt,metrics,viewLength,message:'Movement cycle tracked.'};
  }
}
