import { distance, angle } from './poseGeometry.js';

//these are front-view projections; forward lean, depth and arm technique are not measured
export function visibleBodyAlignment(points) {
  if(![11,12,23,24].every(id=>points[id]))return null;
  const sl=points[11],sr=points[12],hl=points[23],hr=points[24];
  const shoulderSpan=Math.abs(sl.x-sr.x),hipSpan=Math.abs(hl.x-hr.x);
  const shoulder={x:(sl.x+sr.x)/2,y:(sl.y+sr.y)/2},hip={x:(hl.x+hr.x)/2,y:(hl.y+hr.y)/2};
  if(shoulderSpan<12 || hipSpan<8 || hip.y-shoulder.y<10)return null;
  const deg=180/Math.PI;
  return {shoulderTilt:Math.atan2(sl.y-sr.y,shoulderSpan)*deg,
    hipTilt:Math.atan2(hl.y-hr.y,hipSpan)*deg,
    torsoLean:Math.atan2(shoulder.x-hip.x,hip.y-shoulder.y)*deg,
    shoulderSpan,hipSpan,torsoLength:(distance(sl,hl)+distance(sr,hr))/2};
}

//a standing projection change is a cue, not a measured forward/backward angle
export function standingProjectionChange(points,reference,body) {
  const target=reference.body,standing=reference.standing;
  if(!target || !standing || ![23,24,25,26,27,28].every(id=>points[id]))return {change:0,assessed:false};
  const legLength=(standing.left.bones[1]+standing.left.bones[2]+standing.right.bones[1]+standing.right.bones[2])/2;
  const hipY=(points[23].y+points[24].y)/2,targetHipY=(standing.left.hipY+standing.right.hipY)/2;
  const tall=[[23,25,27],[24,26,28]].every(([h,k,a])=>angle(points[h],points[k],points[a])>=160);
  if(!tall || Math.abs(hipY-targetHipY)>legLength*.10)return {change:0,assessed:false};
  const ratio=(body.torsoLength/body.hipSpan)/(target.torsoLength/target.hipSpan);
  return {change:Math.max(0,1-ratio),assessed:true};
}

//compare ankle spacing with the calibrated shoulder width without relearning a wide stance
export function calibratedStanceWidth(points,reference,body) {
  if(![11,12,23,24,27,28].every(id=>points[id]))return {assessed:false,ratio:0,excess:0};
  const target=reference.body;
  let shoulderWidth=Math.hypot(points[11].x-points[12].x,points[11].y-points[12].y);
  if(target){
    const hipWidth=target.hipSpan/Math.cos(target.hipTilt*Math.PI/180);
    const scale=distance(points[23],points[24])/hipWidth;
    shoulderWidth=target.shoulderSpan/Math.cos(target.shoulderTilt*Math.PI/180)*scale;
  }
  const ankleWidth=Math.abs(points[27].x-points[28].x);
  if(!Number.isFinite(shoulderWidth) || shoulderWidth<12 || !Number.isFinite(body.shoulderSpan))return {assessed:false,ratio:0,excess:0};
  const ratio=ankleWidth/shoulderWidth;
  return {assessed:true,ratio,excess:Math.max(0,ratio-1.05),ankleWidth,shoulderWidth};
}
