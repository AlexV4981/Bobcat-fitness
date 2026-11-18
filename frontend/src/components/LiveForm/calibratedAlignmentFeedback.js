import { LEGS, legAlignment, alignmentColor, ALIGNMENT_GREEN_DEGREES, ALIGNMENT_RED_DEGREES } from './alignment.js';
import { visibleBodyAlignment, standingProjectionChange } from './visibleFormMetrics.js';

const EDGES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];

export class CalibratedAlignmentFeedback {
  constructor(reference) {this.reference=reference;this.pause();}
  pause() {this.channels={};}
  score(name,error,at) {
    const held=this.channels[name] ?? {since:at,at,error};
    const alpha=1-Math.exp(-Math.max(0,at-held.at)/180);
    held.error+=alpha*(error-held.error);held.at=at;this.channels[name]=held;
    return {error:held.error,confirmed:at-held.since>=250};
  }
  analyze(points,at,phase,rep,metrics) {
    const neutral=(message,reason)=>{
      this.pause();return {state:'uncertain',message,points,checkedEdges:[],phase,rep,
        metrics:{...metrics,formTrackingValid:false,view:'unconfirmed',formCheck:'calibrated_visible_squat_alignment',depthAssessed:false,feedbackReason:reason}};
    };
    const sample=legAlignment(points),body=visibleBodyAlignment(points);
    if(!sample || !body)return neutral('Keep both shoulders, hips, knees and ankles visible.','body_alignment_uncertain');
    const target=this.reference.body;
    //rotation loses front-view information; side-to-side lean and uneven shoulders are scored below
    if(target && (body.shoulderSpan/target.shoulderSpan<.45 || body.shoulderSpan/target.shoulderSpan>1.8
      || body.hipSpan/target.hipSpan<.4 || body.hipSpan/target.hipSpan>2))
      return neutral('Face the camera so the visible alignment checks can run.','front_view_uncertain');
    const signed={},raw={};
    for(const leg of LEGS){
      signed[leg.name]=sample.angles[leg.name]-this.reference.angles[leg.name];
      //allow normal outward projection during descent; grade larger outward deviations too
      raw[leg.name]=signed[leg.name]>=0?signed[leg.name]:Math.max(0,-signed[leg.name]-30);
    }
    for(const key of ['torsoLean','shoulderTilt','hipTilt'])raw[key]=target?Math.abs(body[key]-target[key]):0;
    const projection=standingProjectionChange(points,this.reference,body);
    //convert the projection cue to color-score units; never label this as a joint angle
    raw.torsoProjection=Math.max(0,projection.change-.15)/.25*15;
    const scores=Object.fromEntries(Object.entries(raw).map(([key,error])=>[key,this.score(key,error,at)]));
    const confirmed=Object.values(scores).every(score=>score.confirmed);
    const errors=Object.fromEntries(Object.entries(scores).map(([key,score])=>[key,score.error]));
    const worst=Math.max(...Object.values(errors));
    const label=value=>value<=ALIGNMENT_GREEN_DEGREES?'good':value>=ALIGNMENT_RED_DEGREES?'issue':'caution';
    const edgeErrors={};
    //body posture propagates consistently; a local knee deviation stays on its own leg
    const bodyError=Math.max(errors.torsoLean,errors.shoulderTilt,errors.hipTilt,errors.torsoProjection);
    for(const edge of EDGES)edgeErrors[edge.join(',')]=bodyError;
    for(const leg of LEGS)for(const edge of [[leg.hip,leg.knee],[leg.knee,leg.ankle]])edgeErrors[edge.join(',')]=Math.max(errors[leg.name],bodyError);
    const edgeStates={},edgeColors={};
    for(const [key,error] of Object.entries(edgeErrors)){
      edgeStates[key]=confirmed?label(error):'uncertain';
      if(confirmed)edgeColors[key]=alignmentColor(error);
    }
    const state=!confirmed?'uncertain':worst<=ALIGNMENT_GREEN_DEGREES?'good':worst>=ALIGNMENT_RED_DEGREES?'issue':'uncertain';
    const dominant=Object.keys(errors).sort((a,b)=>errors[b]-errors[a])[0];
    const cues={left:signed.left<0?'Left knee moves far outward from its calibrated path.':'Left knee moves inward from its calibrated path.',
      right:signed.right<0?'Right knee moves far outward from its calibrated path.':'Right knee moves inward from its calibrated path.',
      torsoLean:'Your torso is leaning sideways from your standing reference.',
      shoulderTilt:'Your shoulders are uneven compared with your standing reference.',
      hipTilt:'Your hips are uneven compared with your standing reference.',
      torsoProjection:'Your upper-body projection changed from your upright reference. Stand tall and face the camera.'};
    const message=!confirmed?'Checking visible alignment…':worst<=ALIGNMENT_GREEN_DEGREES?'Visible alignment is close to your reference. Depth and arm technique are not assessed.':cues[dominant];
    return {state,message,points,checkedEdges:EDGES,edgeStates,edgeColors,phase,rep,
      metrics:{...metrics,formTrackingValid:true,view:'front',formCheck:'calibrated_visible_squat_alignment',depthAssessed:false,
        alignmentAngles:sample.angles,calibratedAngles:this.reference.angles,
        alignmentErrorDegrees:{left:errors.left,right:errors.right},signedAlignmentChangeDegrees:signed,
        bodyAlignment:body,bodyAlignmentErrors:{torsoLean:errors.torsoLean,shoulderTilt:errors.shoulderTilt,hipTilt:errors.hipTilt},
        overallAngularErrorDegrees:Math.max(errors.left,errors.right,errors.torsoLean,errors.shoulderTilt,errors.hipTilt),
        overallAlignmentSeverity:worst/15,standingProjectionChange:projection.change,standingProjectionAssessed:projection.assessed,projectionSeverity:errors.torsoProjection/15,
        edgeSeverity:Object.fromEntries(Object.entries(edgeErrors).map(([key,error])=>[key,error/15])),dominantAlignmentCheck:dominant,
        colorScope:'Body posture tints the skeleton; knee errors add severity to the corresponding leg. No independent arm-technique or squat-depth assessment.',
        feedbackReason:confirmed?null:'alignment_confirming'}};
  }
}
