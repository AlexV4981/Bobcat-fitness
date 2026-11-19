import { angle, distance } from './poseGeometry.js';

const LEGS=[{name:'left',hip:23,knee:25,ankle:27},{name:'right',hip:24,knee:26,ankle:28}];
const REQUIRED=[11,12,23,24,25,26,27,28];

//check visible inward knee movement, not squat depth or a medical knee angle
export class FrontalSquatFeedback {
  constructor() {this.reset();}
  reset() {this.reference=null;this.standingAt=null;this.candidates={};}
  clearCandidates() {this.candidates={};}
  analyze(points,at,phase,rep,metrics,viewLength) {
    const neutral=(message,reason,clearReference=false)=>{
      this.clearCandidates();this.standingAt=null;
      if(clearReference)this.reference=null;
      return {state:'uncertain',message,points,checkedEdges:[],phase,rep,
        metrics:{...metrics,view:'unconfirmed',formCheck:'frontal_inward_knee_drift',depthAssessed:false,feedbackReason:reason}};
    };
    if(!REQUIRED.every(id=>points[id]))return neutral('Movement tracking active. Show both hips, knees and ankles for knee-path feedback.','bilateral_joints_missing');
    const sl=points[11],sr=points[12],hl=points[23],hr=points[24],al=points[27],ar=points[28];
    const shoulderSpan=Math.abs(sl.x-sr.x),hipSpan=Math.abs(hl.x-hr.x),ankleSpan=Math.abs(al.x-ar.x);
    const shoulderRatio=shoulderSpan/viewLength,hipRatio=hipSpan/viewLength;
    const torsoRatio=distance(sl,hl)/distance(sr,hr);
    const shinRatio=distance(points[25],al)/distance(points[26],ar);
    const ordered=Math.sign(hl.x-hr.x)===Math.sign(al.x-ar.x);
    const front=shoulderRatio>=.45 && shoulderRatio<=1.3 && hipRatio>=.15 && hipRatio<=1.1
      && torsoRatio>=.65 && torsoRatio<=1.55 && shinRatio>=.65 && shinRatio<=1.55
      && Math.abs(sl.y-sr.y)<=shoulderSpan*.3 && Math.abs(hl.y-hr.y)<=hipSpan*.4 && ordered;
    metrics={...metrics,shoulderRatio,hipRatio,view:front?'front':'unconfirmed',formCheck:'frontal_inward_knee_drift',depthAssessed:false,feedbackReason:null};
    if(!front)return neutral('Face the camera squarely with both legs visible. Rep tracking continues.','front_view_uncertain',true);
    if(ankleSpan<Math.max(12,viewLength*.2))return neutral('Foot spacing is unclear in the image. Knee-path feedback paused.','foot_spacing_uncertain',true);
    const center=(hl.x+hr.x)/2;
    const offsets={};
    for(const leg of LEGS){
      const h=points[leg.hip],k=points[leg.knee],a=points[leg.ankle],length=distance(h,a);
      if(length<viewLength*.25 || a.y-h.y<viewLength*.2)return neutral('Leg positions are unclear. Knee-path feedback paused.','leg_projection_uncertain');
      const residual=((k.x-h.x)*(a.y-h.y)-(k.y-h.y)*(a.x-h.x))/length;
      offsets[leg.name]=Math.sign(center-h.x)*residual/ankleSpan;
    }
    const standing=phase==='ready' && LEGS.every(leg=>angle(points[leg.hip],points[leg.knee],points[leg.ankle])>=160);
    //learn normal standing alignment automatically; no T-pose or body measurements
    if(standing){
      this.standingAt ??= at;
      if(at-this.standingAt>=250){
        if(!this.reference)this.reference={offsets:{...offsets},ankleSpan};
        else {
          for(const leg of LEGS)this.reference.offsets[leg.name]=this.reference.offsets[leg.name]*.9+offsets[leg.name]*.1;
          this.reference.ankleSpan=this.reference.ankleSpan*.9+ankleSpan*.1;
        }
      }
      this.clearCandidates();
      return {state:'uncertain',message:this.reference?'Ready. Face the screen and squat comfortably.':'Stand normally for a moment to establish your knee paths.',
        points,checkedEdges:[],phase,rep,metrics:{...metrics,feedbackReason:'standing_reference'}};
    }
    this.standingAt=null;
    if(!this.reference)return neutral('Start standing normally while facing the camera, then squat.','standing_reference_required');
    if(phase==='waiting' || phase==='ready')return neutral('Waiting for a clear squat movement.','movement_required');
    if(Math.abs(ankleSpan/this.reference.ankleSpan-1)>.2)return neutral('Foot spacing changed. Return to standing to refresh the knee-path reference.','stance_changed',true);
    const edgeStates={},checkedEdges=[],legStates={},drift={};
    for(const leg of LEGS){
      const delta=offsets[leg.name]-this.reference.offsets[leg.name];drift[leg.name]=delta;
      //these prototype margins use foot spacing; borderline and large outward paths stay unassessed
      const candidate=delta>=.10?'issue':delta<=.04 && delta>=-.35?'good':'uncertain';
      let held=this.candidates[leg.name];
      if(!held || held.state!==candidate)held=this.candidates[leg.name]={state:candidate,at};
      const state=at-held.at>=250?candidate:'uncertain';legStates[leg.name]=state;
      for(const edge of [[leg.hip,leg.knee],[leg.knee,leg.ankle]]){checkedEdges.push(edge);edgeStates[edge.join(',')]=state;}
    }
    const issues=LEGS.filter(leg=>legStates[leg.name]==='issue').map(leg=>leg.name);
    const allGood=LEGS.every(leg=>legStates[leg.name]==='good');
    const state=issues.length?'issue':allGood?'good':'uncertain';
    const message=issues.length?`${issues.join(' and ')} knee appears to move inward. Keep it tracking with your foot.`
      :allGood?'No inward knee drift observed in this check.':'Checking knee paths. Borderline or unassessed movement stays gray.';
    return {state,message,points,checkedEdges,edgeStates,phase,rep,
      metrics:{...metrics,kneeInwardDrift:drift,kneePathStates:legStates,feedbackReason:state==='uncertain'?'knee_path_unconfirmed':null}};
  }
}
