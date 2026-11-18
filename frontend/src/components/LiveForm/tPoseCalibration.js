import { visible, angle, distance } from './poseGeometry.js';
import { legAlignment } from './alignment.js';
import { visibleBodyAlignment } from './visibleFormMetrics.js';

const REQUIRED=[11,12,13,14,15,16,23,24,25,26,27,28];
const BODY=[11,12,23,24,25,26,27,28];
const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};

function poseSample(points) {
  const alignment=legAlignment(points),body=visibleBodyAlignment(points);
  if(!alignment || !body)return null;
  const standing={};
  for(const [name,side] of [['left',[11,23,25,27]],['right',[12,24,26,28]]]){
    const [s,h,k,a]=side.map(id=>points[id]);
    standing[name]={bones:[distance(s,h),distance(h,k),distance(k,a)],hipY:h.y};
  }
  return {...alignment,standing,body};
}
function referenceFromSamples(samples,width,height) {
  const reference={angles:{},offsets:{},standing:{},ankleSpan:median(samples.map(sample=>sample.ankleSpan)),width,height};
  for(const leg of ['left','right']){
    reference.standing[leg]={bones:[0,1,2].map(i=>median(samples.map(sample=>sample.standing[leg].bones[i]))),hipY:median(samples.map(sample=>sample.standing[leg].hipY))};
    reference.angles[leg]=median(samples.map(sample=>sample.angles[leg]));
    reference.offsets[leg]=median(samples.map(sample=>sample.offsets[leg]));
  }
  reference.body=Object.fromEntries(['shoulderTilt','hipTilt','torsoLean','shoulderSpan','hipSpan','torsoLength'].map(key=>[key,median(samples.map(sample=>sample.body[key]))]));
  return reference;
}

export class TPoseCalibration {
  constructor() {this.reset();}
  reset() {
    this.phase='positioning';this.startedAt=null;this.lastAt=null;this.countdownAt=null;
    this.samples=[];this.readySamples=[];this.anchor=null;this.reference=null;this.tPoseReference=null;this.width=null;this.height=null;
    this.reason='positioning';this.message='T-pose: face the camera, extend both arms and hold for two seconds.';
  }
  invalidate() {
    if(this.phase==='active')return this.status();
    this.phase='positioning';this.startedAt=null;this.countdownAt=null;this.samples=[];this.readySamples=[];this.anchor=null;this.reference=null;this.tPoseReference=null;
    this.reason='tracking_interrupted';this.message='Show your full body and hold your arms out again.';
    return this.status();
  }
  status(now=null) {
    return {phase:this.phase,progress:this.phase==='holding'?Math.min(1,(this.lastAt-this.startedAt)/2000):0,
      seconds:this.phase==='countdown'?Math.max(0,Math.ceil((this.countdownAt+5000-now)/1000)):null,
      message:this.message,reason:this.reason,reference:this.reference};
  }
  update(landmarks,width,height,at,now) {
    if(this.width!==null && (width!==this.width || height!==this.height))this.reset();
    this.width=width;this.height=height;
    if(!Number.isFinite(now-at) || now-at<0 || now-at>180 || !Number.isFinite(at))return this.invalidate();
    if(this.lastAt!==null && (at<=this.lastAt || at-this.lastAt>180) && this.phase!=='active')this.invalidate();
    this.lastAt=at;
    if(this.phase==='active')return this.status(now);
    const points=landmarks.map(p=>visible(p)?{x:p.x*width,y:p.y*height}:null);
    if(this.phase==='countdown'){
      if(!BODY.every(id=>points[id]))return this.invalidate();
      const sample=poseSample(points);
      const standing=sample && [[23,25,27,'left'],[24,26,28,'right']].every(([h,k,a,leg])=>
        angle(points[h],points[k],points[a])>=160 && Math.abs(points[h].y-this.tPoseReference.standing[leg].hipY)<=this.tPoseReference.standing[leg].bones.slice(1).reduce((sum,n)=>sum+n,0)*.08);
      //allow a comfortable squat stance during get-ready, then freeze it before the start chime
      if(standing){
        const previous=this.readySamples.at(-1);
        if(previous && (at-previous.at>180 || Math.abs(sample.ankleSpan/previous.ankleSpan-1)>.05))this.readySamples=[];
        this.readySamples.push({...sample,at});
        if(this.readySamples.length>15)this.readySamples.shift();
        if(this.readySamples.length>=5 && at-this.readySamples[0].at>=250){
          this.reference=referenceFromSamples(this.readySamples,width,height);
          this.reference.body=this.tPoseReference.body;
        }
      }
      const stanceReady=Boolean(sample);
      if(now-this.countdownAt>=5000 && !stanceReady)this.message='Stand tall with both shoulders, hips, knees and ankles visible to start.';
      if(now-this.countdownAt>=5000 && stanceReady){
        this.phase='active';this.reason=null;this.message='Start your squats. Follow the knee-alignment colors.';
        return {...this.status(now),justStarted:true};
      }
      return this.status(now);
    }
    const reject=(message,reason)=>{this.phase='positioning';this.startedAt=null;this.samples=[];this.anchor=null;this.message=message;this.reason=reason;return this.status(now);};
    if(!REQUIRED.every(id=>points[id]))return reject('Show both arms, hips, knees and ankles.','joints_missing');
    const torso=(distance(points[11],points[23])+distance(points[12],points[24]))/2;
    const shoulderSpan=Math.abs(points[11].x-points[12].x);
    if(torso<20 || shoulderSpan<torso*.35 || shoulderSpan>torso*1.5)
      return reject('Face the camera with both shoulders visible.','front_view_uncertain');
    for(const [s,e,w,h,k,a] of [[11,13,15,23,25,27],[12,14,16,24,26,28]]){
      const reach=Math.abs(points[w].x-points[s].x);
      if(!(angle(points[s],points[e],points[w])>=150) || !(angle(points[h],points[k],points[a])>=155)
        || reach<torso*.55 || Math.abs(points[w].y-points[s].y)>reach*.5
        || Math.abs(points[e].y-points[s].y)>reach*.5)
        return reject('Keep your arms straight at shoulder height and stand tall.','tpose_posture');
    }
    if(Math.abs(points[11].y-points[12].y)>shoulderSpan*.3 || Math.abs(points[23].y-points[24].y)>torso*.15)
      return reject('Face the camera level, with both shoulders and hips visible.','body_tilt');
    const sample=poseSample(points);
    if(!sample)return reject('Keep both legs clear and your feet visible.','leg_alignment_uncertain');
    if(this.anchor && BODY.some(id=>distance(points[id],this.anchor[id])>Math.max(10,torso*.15)))return reject('Hold your T-pose still for two seconds.','hold_moved');
    if(this.startedAt===null){this.startedAt=at;this.anchor=points;}
    this.phase='holding';this.reason='holding';this.message='Hold your T-pose steady for two seconds.';
    this.samples.push(sample);
    if(at-this.startedAt>=2000 && this.samples.length>=15){
      this.reference=referenceFromSamples(this.samples,width,height);this.tPoseReference=this.reference;
      this.phase='countdown';this.reason=null;this.countdownAt=now;this.message='T-pose captured. Lower your arms and settle into your squat stance.';
      this.samples=[];this.anchor=null;
    }
    return this.status(now);
  }
}
