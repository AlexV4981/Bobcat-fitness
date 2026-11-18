import { unknown } from './poseGeometry.js';
import { FrontalSquatFeedback } from './frontalSquatFeedback.js';
import { SquatLegCycle } from './squatLegCycle.js';

const LEGS={left:[11,23,25,27],right:[12,24,26,28]};
export const SQUAT_JOINTS=new Set(Object.values(LEGS).flat());
const PHASE_ORDER=['waiting','ready','descending','ascending','bottom'];
const FAILURE_ORDER=['joint_jump','joint_geometry','counter_torso_change','counter_torso_geometry','body_framing','joints_missing'];

//share one rep event while keeping each leg's reference and partial cycle separate
export class SquatAnalysis {
  constructor() {this.reset();}
  reset() {
    this.legs=Object.fromEntries(Object.entries(LEGS).map(([name,joints])=>[name,new SquatLegCycle(joints)]));
    this.frontal=new FrontalSquatFeedback();this.lastCountAt=-Infinity;
  }
  analyze(points,_landmarks,_width,height,at,jumpedJoints=[]) {
    const results=Object.fromEntries(Object.entries(this.legs).map(([name,leg])=>[name,leg.analyze(points,height,at,jumpedJoints)]));
    const usable=Object.entries(results).filter(([,result])=>result.metrics.trackingValid);
    //a delayed return from the other leg cannot count the same overlapping cycle twice
    const completed=usable.filter(([,result])=>result.rep && result.cycleStartedAt>this.lastCountAt);
    const rep=completed.length>0;
    if(rep)this.lastCountAt=at;
    const reasons=Object.values(results).map(result=>result.metrics.trackingReason);
    const trackingReason=usable.length?undefined:FAILURE_ORDER.find(reason=>reasons.includes(reason));
    const formGeometryReason=['joint_jump','joint_geometry'].find(reason=>reasons.includes(reason));
    const phase=rep?'ready':PHASE_ORDER.filter(value=>usable.some(([,result])=>result.phase===value)).at(-1)??'waiting';
    const average=key=>usable.reduce((sum,[,result])=>sum+result.metrics[key],0)/usable.length;
    const metrics={trackingValid:usable.length>0,trackingReason,formGeometryReason,
      side:usable.length===2?'both':usable[0]?.[0]??null,
      countedSide:rep?(completed.length===2?'both':completed[0][0]):null,
      legTracking:Object.fromEntries(Object.entries(results).map(([name,result])=>[name,{...result.metrics,phase:result.phase}])),
      countingReason:rep?'completed_cycle':usable.some(([,result])=>result.metrics.countingReason==='waiting_for_return')?'waiting_for_return':phase==='ready'?'waiting_for_bend':phase==='waiting'?'need_standing':'need_sustained_bend'};
    if(!usable.length){this.frontal.reset();return unknown('Keep a leg visible and stand tall',points,metrics);}
    metrics.kneeAngle=average('kneeAngle');metrics.hipDrop=average('hipDrop');
    if(formGeometryReason){
      this.frontal.clearCandidates();return {...unknown('Leg tracking unclear',points,metrics),phase,rep};
    }
    const viewLength=usable.reduce((sum,[,result])=>sum+result.viewLength,0)/usable.length;
    return this.frontal.analyze(points,at,phase,rep,metrics,viewLength);
  }
}
