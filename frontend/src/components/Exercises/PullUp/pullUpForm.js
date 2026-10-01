/**
 * Pull-up form data + drawing functions.
 * ---------------------------------------------------------------------------
 * Pure data/geometry: no React. `draw(t, { mode, on, p })` returns
 * { svg, cards, ok } for one frame, where t is eased progress (0 = start
 * position, 1 = deepest/top position), p is raw loop progress (0-1), mode is a
 * key from `modes` and `on` maps indicator keys to booleans.
 */

import { G, R, B, N, TP, TS, SF, DASH, lerp, ang, ik, ln, pl, ci, tx } from "../svgKit.js";

export const phases = ["Dead hang", "Pulling up", "Top", "Lowering"];

export function drawPull(t,{mode:m,on,p}){
  const tt=m==='short'?t*0.72:m==='hang'?0.15+0.85*t:t;
  const Hd={x:340,y:44},S0={x:340,y:143.5},S1={x:302,y:54};
  const Sp={x:lerp(S0.x,S1.x,tt),y:lerp(S0.y,S1.y,tt)};
  const th=0.02+0.25*tt;
  const hip0={x:Sp.x+88*Math.sin(th),y:Sp.y+88*Math.cos(th)};
  const knee0={x:hip0.x+7.5,y:hip0.y+74.6};
  const ank0={x:knee0.x-26.2,y:knee0.y+70.3};
  const head0={x:Sp.x+8,y:Sp.y-30};
  const sw=m==='swing'?0.32*Math.sin(p*Math.PI*4):0;
  const rot=function(q){const dx=q.x-Hd.x,dy=q.y-Hd.y;return {x:Hd.x+dx*Math.cos(sw)-dy*Math.sin(sw),y:Hd.y+dx*Math.sin(sw)+dy*Math.cos(sw)};};
  const S=rot(Sp),hip=rot(hip0),knee=rot(knee0),ank=rot(ank0),head=rot(head0);
  const cs=ik(S,Hd,52,48),E=cs[0].y>cs[1].y?cs[0]:cs[1];
  const eA=ang(S,E,Hd);
  const chin={x:head.x,y:head.y+12};
  const chinOk=chin.y<=38;
  const cCol=t>0.9?(chinOk?G:R):B;
  const hCol=t<0.06?(eA>=165?G:R):N;
  const swOk=Math.abs(hip.x-340)<=45;
  let s='';
  if(on.swing)s+=ln({x:340,y:44},{x:340,y:385},B,1.5,DASH)+tx(352,66,'No swing');
  if(on.chin)s+=ln({x:250,y:38},{x:430,y:38},cCol,1.5,DASH)+tx(436,42,'Chin over bar');
  s+=ci(Hd,6,'var(--fg-bg)',TP,2.5);
  s+=pl([hip,knee,ank],TP,7);
  s+=ln(S,hip,TP,8);
  s+=ln(S,head,TP,6);
  s+=ci(head,13,SF,TP,3);
  s+=pl([S,E,Hd],TS,5);
  s+=ci(Hd,5,TP,'none',0);
  s+=ci(knee,4.5,SF,TP,2)+ci(hip,4.5,SF,TP,2)+ci(E,4.5,SF,TP,2);
  if(on.chin)s+=ci(chin,7,'none',cCol,2.5);
  if(on.hang){
    s+=ci(E,10,'none',hCol,2.5);
    if(t<0.12)s+=tx(E.x+16,E.y+4,'Full hang');
  }
  if(on.swing)s+=ci(hip,10,'none',swOk?G:R,2.5);
  const swDeg=Math.round(Math.abs(sw)*57.3);
  const cards=[
    ['Chin vs bar',chinOk?'Above bar':'Below bar',t>0.9?(chinOk?'good':'bad'):''],
    ['Elbow angle',Math.round(eA)+'\u00b0',''],
    ['Body swing',swDeg+'\u00b0',swDeg>8?'bad':'']
  ];
  return {svg:s,cards:cards,ok:(t>0.9&&chinOk&&swOk)};
}

export function drawPullF(t,{mode:m,on}){
  const cx=340,By=44;
  const hw=m==='wide'?100:52,swh=44;
  const bottom=By+Math.sqrt(99.5*99.5-(hw-swh)*(hw-swh));
  const sy=lerp(bottom,52,t);
  const dl=m==='uneven'?12*t:0;
  const shrugS=m==='shrug'?8*(1-t):0;
  const neck=30-(m==='shrug'?14*(1-t):0);
  const SL={x:cx-swh,y:sy+dl-shrugS},SR={x:cx+swh,y:sy-dl-shrugS};
  const HL={x:cx-hw,y:By},HR={x:cx+hw,y:By};
  const avg=(SL.y+SR.y)/2;
  const head={x:cx+dl*0.8,y:avg-neck};
  const chin={x:head.x,y:head.y+13};
  const chinOk=chin.y<=38;
  const cCol=t>0.9?(chinOk?G:R):B;
  const eo=function(S,H,sg){const cs=ik(S,H,52,48);return cs[0].x*sg>cs[1].x*sg?cs[0]:cs[1];};
  const EL=eo(SL,HL,-1),ER=eo(SR,HR,1);
  const shOk=dl<4;
  const shrugged=m==='shrug'&&t<0.6;
  const gripOk=hw<=70;
  const HiL={x:cx-30,y:avg+88},HiR={x:cx+30,y:avg+88};
  let s=ln({x:cx-120,y:By},{x:cx+120,y:By},TS,6);
  if(on.chin)s+=ln({x:cx-120,y:38},{x:cx+120,y:38},cCol,1.5,DASH)+tx(cx+128,42,'Chin over bar');
  if(on.shoulders)s+=ln({x:cx-120,y:avg},{x:cx+120,y:avg},B,1.5,DASH)+tx(cx+128,avg+16,'Shoulders level');
  if(on.grip)s+=tx(cx-hw-10,30,'Grip width','end');
  s+=ln(HiL,{x:cx-14,y:avg+233},TP,7)+ln(HiR,{x:cx+14,y:avg+233},TP,7);
  s+=ln(SL,HiL,TP,7)+ln(SR,HiR,TP,7)+ln(HiL,HiR,TP,7)+ln(SL,SR,TP,8);
  s+=ci(head,13,SF,TP,3);
  s+=pl([SL,EL,HL],TS,5)+pl([SR,ER,HR],TS,5);
  s+=ci(HL,5.5,TP,'none',0)+ci(HR,5.5,TP,'none',0);
  s+=ci(EL,4.5,SF,TP,2)+ci(ER,4.5,SF,TP,2);
  if(on.chin)s+=ci(chin,7,'none',cCol,2.5);
  if(on.shoulders){
    const sc=(shOk&&!shrugged)?G:(t>0.15||shrugged?R:N);
    s+=ci(SL,10,'none',sc,2.5)+ci(SR,10,'none',sc,2.5);
  }
  if(on.grip){
    const gc=gripOk?G:R;
    s+=ci(HL,10,'none',gc,2.5)+ci(HR,10,'none',gc,2.5);
  }
  const cards=[
    ['Chin vs bar',chinOk?'Above bar':'Below bar',t>0.9?(chinOk?'good':'bad'):''],
    ['Shoulders',!shOk?'Uneven':(shrugged?'Shrugged':'Level'),(!shOk||shrugged)?'bad':''],
    ['Grip width',gripOk?'Just outside shoulders':'Too wide',gripOk?'':'bad']
  ];
  return {svg:s,cards:cards,ok:(t>0.9&&chinOk&&shOk&&gripOk)};
}

export const views = {
  side: {
    draw: drawPull,
    desc: "Side view of a pull-up with guides for chin over the bar, full hang and body swing.",
    modes: [
      ["good", "Correct form"],
      ["swing", "Mistake: swinging"],
      ["short", "Mistake: chin stays below bar"],
      ["hang", "Mistake: no full hang"],
    ],
    inds: [["chin", "Chin over bar"], ["hang", "Full hang"], ["swing", "No swing"]],
    good: [
      "Start from a full hang with straight arms and shoulders pulled down, away from your ears.",
      "Pull your elbows down toward your ribs. Keep the body still, with no swinging.",
      "Chin clears the bar without craning your neck. Pause briefly at the top.",
      "Lower under control back to a full hang. Take about as long as the pull.",
    ],
    bad: {
      swing: [
        "Swinging",
        "Swinging builds momentum and takes the work away from your back. Squeeze your glutes and stay still.",
      ],
      short: [
        "Chin below bar",
        "The chin never clears the bar. Pull until your chin passes it without reaching with your neck.",
      ],
      hang: [
        "No full hang",
        "Arms stay bent at the bottom, which cuts the range short. Lower to fully straight arms every rep.",
      ],
    },
  },
  front: {
    draw: drawPullF,
    desc: "Front view of a pull-up with guides for chin over the bar, shoulder level and grip width.",
    modes: [
      ["good", "Correct form"],
      ["uneven", "Mistake: uneven pull"],
      ["wide", "Mistake: grip too wide"],
      ["shrug", "Mistake: shoulders shrugged"],
    ],
    inds: [["chin", "Chin over bar"], ["shoulders", "Shoulders"], ["grip", "Grip width"]],
    good: [
      "Hang with hands just outside the shoulders and shoulders pulled down, away from the ears.",
      "Drive the elbows down and in. Both shoulders rise together and stay level.",
      "Chin clears the bar with shoulders level and the neck relaxed.",
      "Lower evenly to a full hang, keeping the shoulders active instead of shrugging.",
    ],
    bad: {
      uneven: [
        "Uneven pull",
        "One shoulder rises higher than the other, so one arm does more work. Pull evenly with both sides.",
      ],
      wide: [
        "Grip too wide",
        "A very wide grip shortens the range and loads the shoulders awkwardly. Hold the bar just outside shoulder width.",
      ],
      shrug: [
        "Shoulders shrugged",
        "Shoulders creep up toward the ears in the hang, which leaves the joint unprotected. Pull the shoulder blades down first.",
      ],
    },
  },
};
