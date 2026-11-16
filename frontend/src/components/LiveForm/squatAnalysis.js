import { angle, distance, unknown } from './poseGeometry.js';

const SIDES = [[11,23,25,27], [12,24,26,28]];
export const SQUAT_JOINTS = new Set(SIDES.flat());

//check the side-view depth target in the image, not every part of squat form
export class SquatAnalysis {
  constructor() { this.reset(); }
  reset() {
    this.side=null; this.bones=null; this.phase='waiting'; this.standSince=null;
    this.startedAt=null; this.bendSince=null; this.reachedBend=false; this.minKnee=180;
    this.hold=null; this.candidate=null; this.candidateAt=0;
  }
  analyze(points, landmarks, width, height, at) {
    const fail=(message,metrics={})=>{this.reset();return unknown(message,points,metrics);};
    const candidates=SIDES.filter(side=>side.every(i=>points[i]));
    if (!candidates.length) return fail('Keep a shoulder, hip, knee and ankle visible on the same side.');
    if (!points[11] || !points[12]) return fail('Use a side view with both shoulders visible.');
    //keep using the same side while its joints are usable
    //small confidence changes should not switch legs halfway through a rep
    const side=candidates.find(chain=>chain[0]===this.side) ?? candidates.sort((a,b)=>
      b.reduce((sum,i)=>sum+landmarks[i].visibility,0)-a.reduce((sum,i)=>sum+landmarks[i].visibility,0))[0];
    if (this.side!==null && this.side!==side[0]) this.reset();
    this.side=side[0];
    const [s,h,k,a]=side.map(i=>points[i]);
    const torso=distance(s,h), thigh=distance(h,k), shin=distance(k,a);
    if (torso<height*.09 || a.y-s.y<height*.25 || s.y>=h.y-torso*.2 || k.y>=a.y
      || distance(points[11],points[12])>torso*.65
      || (points[23] && points[24] && distance(points[23],points[24])>torso*.65)) {
      return fail('Place a level camera beside you, around hip height, with your whole body visible.',{view:'uncertain'});
    }
    const bones=[torso,thigh,shin];
    if ([thigh,shin].some(n=>n<torso*.35 || n>torso*1.8)) return fail('Leg geometry is uncertain. Keep your legs clear of obstructions.');
    if (this.bones && bones.some((n,i)=>Math.abs(n/this.bones[i]-1)>.35)) return fail('Joint proportions changed. Waiting for consistent tracking.');
    this.bones=bones;
    const knee=angle(h,k,a), depthOffset=(h.y-k.y)/thigh;
    const metrics={view:'side',side:side[0]===11?'left':'right',kneeAngle:knee,depthOffset};
    const opposite=SIDES.find(chain=>chain[0]!==this.side);
    if (opposite.every(i=>points[i])) {
      const otherKnee=angle(...opposite.slice(1).map(i=>points[i]));
      if (Math.abs(otherKnee-knee)>30) return fail('Leg estimates disagree. Turn side-on and keep both legs clear.',metrics);
    }
    if (!Number.isFinite(knee) || !Number.isFinite(depthOffset)) return fail('Knee position is uncertain.',metrics);

    let rep=false;
    if (knee>=160) {
      this.standSince ??= at;
      if (at-this.standSince>=120) {
        if (this.phase!=='waiting' && this.phase!=='ready') {
          rep=this.reachedBend && at-this.startedAt>=700;
        }
        this.phase='ready'; this.startedAt=null; this.reachedBend=false;
        this.bendSince=null; this.minKnee=180;
      }
    } else {
      this.standSince=null;
      if (this.phase==='ready' && knee<145) { this.phase='descending'; this.startedAt=at; }
      if (this.phase!=='waiting' && this.phase!=='ready') {
        this.minKnee=Math.min(this.minKnee,knee);
        if (knee<=115) {
          this.bendSince ??= at;
          if (at-this.bendSince>=120) this.reachedBend=true;
        } else this.bendSince=null;
        this.phase=knee>this.minKnee+8?'ascending':knee<=115?'bottom':'descending';
      }
    }
    //compare a held shallow squat with the depth target
    //do not flag normal descent just because it has not reached the target yet
    if (!this.hold || Math.abs(knee-this.hold.knee)>4 || Math.abs(depthOffset-this.hold.depthOffset)>.04) {
      this.hold={knee,depthOffset,at};
    }
    const active=this.phase!=='waiting' && this.phase!=='ready';
    const reachedTarget=knee<=115 && depthOffset>=-.12;
    const heldHigh=active && knee<140 && depthOffset<=-.30 && at-this.hold.at>=600;
    const candidate=active && reachedTarget?'good':heldHigh?'issue':'uncertain';
    if (candidate!==this.candidate) {this.candidate=candidate;this.candidateAt=at;}
    const state=at-this.candidateAt>=250?candidate:'uncertain';
    const messages={waiting:'Start standing, then perform a squat.',ready:'Ready. Squat within your comfortable range.',
      descending:'Lowering — checking the depth target.',bottom:'Checking squat depth…',ascending:'Rising — return to standing.'};
    return {state,points,checkedEdges:[[side[1],side[2]],[side[2],side[3]]],phase:this.phase,rep,metrics,
      message:state==='good'?'Parallel-depth target reached.':state==='issue'
        ?'Held above the parallel-depth target. Lower only within your comfortable range.'
        :messages[this.phase]};
  }
}
