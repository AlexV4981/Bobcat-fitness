import { distance } from './poseGeometry.js';

export const LEGS=[{name:'left',hip:23,knee:25,ankle:27},{name:'right',hip:24,knee:26,ankle:28}];
export const ALIGNMENT_GREEN_DEGREES=3;
export const ALIGNMENT_RED_DEGREES=15;

//measure visible inward deviation from the hip-to-ankle line, not anatomical knee flexion
export function legAlignment(points) {
  if(![23,24,25,26,27,28].every(id=>points[id]))return null;
  const center=(points[23].x+points[24].x)/2;
  const ankleSpan=Math.abs(points[27].x-points[28].x);
  if(ankleSpan<12)return null;
  const angles={},offsets={};
  for(const leg of LEGS){
    const h=points[leg.hip],k=points[leg.knee],a=points[leg.ankle];
    const cross=(k.x-h.x)*(a.y-h.y)-(k.y-h.y)*(a.x-h.x);
    const dot=(k.x-h.x)*(a.x-h.x)+(k.y-h.y)*(a.y-h.y);
    const length=distance(h,a),inward=Math.sign(center-h.x);
    if(length<8 || dot<=0 || !inward)return null;
    angles[leg.name]=inward*Math.atan2(cross,dot)*180/Math.PI;
    offsets[leg.name]=inward*cross/length/ankleSpan;
  }
  return {angles,offsets,ankleSpan};
}

export function alignmentColor(errorDegrees) {
  if(!Number.isFinite(errorDegrees))return '#b9c3d0';
  const stops=[[3,[57,237,136]],[9,[255,207,71]],[15,[255,98,98]],[30,[255,54,79]],[60,[228,13,69]]];
  const value=Math.max(0,errorDegrees);
  if(value<=stops[0][0])return '#39ed88';
  let index=1;while(index<stops.length-1 && value>stops[index][0])index++;
  const [low,a]=stops[index-1],[high,b]=stops[index];
  let t=Math.max(0,Math.min(1,(value-low)/(high-low)));
  t=t*t*(3-2*t);
  return '#'+a.map((channel,i)=>Math.round(channel+(b[i]-channel)*t).toString(16).padStart(2,'0')).join('');
}
