import { angle, distance } from './poseGeometry.js';

//a complete cycle needs real hip/leg movement; arm position is not a counting rule
export class SquatLegCycle {
  constructor(joints) {this.joints=joints;this.reset();}
  reset() {
    this.bones=null;this.reference=null;this.phase='waiting';this.standSince=null;
    this.startedAt=null;this.bendSince=null;this.reachedBend=false;this.minKnee=180;this.maxDrop=0;this.geometryHoldSince=null;
  }
  analyze(points,height,at,jumpedJoints=[]) {
    const fail=(message,reason)=>{
      this.reset();return {phase:'waiting',rep:false,message,
        metrics:{trackingValid:false,trackingReason:reason,countingReason:'tracking_paused'}};
    };
    const [shoulder,hip,kneeId,ankleId]=this.joints,leg=[hip,kneeId,ankleId];
    if(leg.some(id=>jumpedJoints.includes(id)))return fail('Leg tracking changed','joint_jump');
    if(!leg.every(id=>points[id]))return fail('Keep leg visible','joints_missing');
    const h=points[hip],k=points[kneeId],a=points[ankleId],verticalSpan=a.y-h.y;
    const thigh=distance(h,k),shin=distance(k,a),reference=this.reference;
    const torso=points[shoulder]?distance(points[shoulder],h):reference?.bones[0]??verticalSpan*.55;
    if(verticalSpan<8 || (!reference && verticalSpan<height*.10) || k.y>=a.y)return fail('Keep hips and feet visible','body_framing');
    const lengths=[thigh,shin],geometryOK=reference
      ? lengths.every((n,i)=>n>=Math.max(8,reference.bones[i+1]*.25) && n<=reference.bones[i+1]*1.8)
      : lengths.every(n=>n>=Math.max(8,height*.025)) && thigh/shin>=.25 && thigh/shin<=4;
    if(!geometryOK){
      //brief thigh foreshortening pauses assessment; it cannot start or finish a rep
      const legLength=reference?reference.bones[1]+reference.bones[2]:0;
      const canHold=this.reachedBend && reference && this.bones
        && thigh>=Math.max(8,reference.bones[1]*.20) && thigh<reference.bones[1]*.25
        && shin>=reference.bones[2]*.60 && shin<=reference.bones[2]*1.4
        && Math.abs(thigh/this.bones[1]-1)<=.15 && Math.abs(shin/this.bones[2]-1)<=.15
        && distance(a,reference.ankle)<=legLength*.10;
      if(canHold){
        this.geometryHoldSince ??= at;
        if(at-this.geometryHoldSince<=150)return {phase:this.phase,rep:false,message:'Leg projection briefly unclear',
          metrics:{trackingValid:false,trackingReason:'joint_geometry',countingReason:'geometry_temporarily_unassessed',
            cycleHeld:true,geometryHoldMs:at-this.geometryHoldSince}};
      }
      return fail('Leg geometry unclear','joint_geometry');
    }
    this.geometryHoldSince=null;
    if(this.bones && lengths.some((n,i)=>Math.abs(n/this.bones[i+1]-1)>.35))return fail('Leg positions changed','joint_jump');
    this.bones=[torso,thigh,shin];
    const knee=angle(h,k,a);
    if(!Number.isFinite(knee))return fail('Knee position unclear','joint_geometry');
    const hipSpan=points[23] && points[24]?distance(points[23],points[24]):null;
    const legLength=reference?reference.bones[1]+reference.bones[2]:thigh+shin;
    //relative height rejects whole-image translation; hip width removes uniform image scaling
    const hipDrop=reference?(reference.verticalSpan-verticalSpan)/legLength:0;
    const imageScale=reference?.hipSpan>8 && hipSpan>8?hipSpan/reference.hipSpan:null;
    const scaleValid=imageScale!==null && imageScale>=.65 && imageScale<=1.5;
    const projectionDrop=reference && scaleValid?(reference.verticalSpan-verticalSpan/imageScale)/legLength:null;
    const thighRatio=reference && scaleValid?thigh/imageScale/reference.bones[1]:null;
    const footDrift=reference?distance(a,reference.ankle)/legLength:0;
    const projectionAvailable=scaleValid && footDrift<=.10;
    const projectedBend=projectionAvailable && thighRatio<=.85;
    const angularBend=knee<=125 && hipDrop>=.15;
    const frontalBend=projectedBend && projectionDrop>=.20;
    const bent=angularBend || frontalBend;
    const standingHeight=!reference || hipDrop<=.08 || (scaleValid && projectionDrop<=.08 && thighRatio>=.85);
    let rep=false,cycleStartedAt=null;
    if(knee>=160 && standingHeight){
      this.standSince ??= at;
      if(at-this.standSince>=120){
        if(this.phase!=='waiting' && this.phase!=='ready'){
          rep=this.reachedBend && at-this.startedAt>=700;if(rep)cycleStartedAt=this.startedAt;
        }
        this.phase='ready';this.startedAt=null;this.reachedBend=false;this.bendSince=null;this.minKnee=180;this.maxDrop=0;
        //learn counting references only from current upright observations, never from T-pose
        if(!this.reference)this.reference={bones:[torso,thigh,shin],hipY:h.y,verticalSpan,ankle:{...a},hipSpan};
        else{
          const smooth=(old,next)=>old*.9+next*.1;
          this.reference.bones=this.reference.bones.map((n,i)=>smooth(n,this.bones[i]));
          this.reference.hipY=smooth(this.reference.hipY,h.y);
          this.reference.verticalSpan=smooth(this.reference.verticalSpan,verticalSpan);
          this.reference.ankle={x:smooth(this.reference.ankle.x,a.x),y:smooth(this.reference.ankle.y,a.y)};
          if(hipSpan>8)this.reference.hipSpan=this.reference.hipSpan>8?smooth(this.reference.hipSpan,hipSpan):hipSpan;
        }
      }
    }else{
      this.standSince=null;
      if(this.phase==='ready' && ((knee<145 && hipDrop>=.08) || (projectedBend && projectionDrop>=.10))){this.phase='descending';this.startedAt=at;}
      if(this.phase!=='waiting' && this.phase!=='ready'){
        this.minKnee=Math.min(this.minKnee,knee);
        const drop=projectionAvailable?projectionDrop:hipDrop;this.maxDrop=Math.max(this.maxDrop,drop);
        if(bent){this.bendSince ??= at;if(at-this.bendSince>=120)this.reachedBend=true;}else this.bendSince=null;
        this.phase=knee>this.minKnee+8 || drop<this.maxDrop-.04?'ascending':bent?'bottom':'descending';
      }
    }
    const bendBlocker=bent?null:!reference?'need_standing':knee<=125?'need_hip_drop':!scaleValid?'need_both_hips':footDrift>.10?'feet_moving':thighRatio>.85?'need_thigh_shortening':'need_hip_drop';
    const countingReason=rep?'completed_cycle':this.phase==='waiting'?'need_standing':this.reachedBend?'waiting_for_return':
      this.phase==='ready'?'waiting_for_bend':!projectionAvailable && knee>125?'need_bend_or_clear_front_view':'need_sustained_bend';
    return {phase:this.phase,rep,cycleStartedAt,viewLength:this.reference?.bones[0]??torso,message:'Movement cycle tracked.',
      metrics:{kneeAngle:knee,hipDrop,projectionDrop,thighRatio,footDrift,imageScale,projectionAvailable,
        bendBlocker,bendSignal:angularBend?'knee_angle':frontalBend?'front_projection':null,shoulderVisible:Boolean(points[shoulder]),
        trackingValid:true,countingReason}};
  }
}
