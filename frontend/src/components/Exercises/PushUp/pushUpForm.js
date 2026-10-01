/**
 * Push-up form data + drawing functions.
 * ---------------------------------------------------------------------------
 * Pure data/geometry: no React. `draw(t, { mode, on, p })` returns
 * { svg, cards, ok } for one frame, where t is eased progress (0 = start
 * position, 1 = deepest/top position), p is raw loop progress (0-1), mode is a
 * key from `modes` and `on` maps indicator keys to booleans.
 */

import { G, R, B, N, TP, TS, SF, DASH, ang, ik, ln, pl, ci, tx, ground } from "../svgKit.js";

export const phases = ["Top position", "Lowering", "Bottom", "Pushing up"];

export function drawPush(t,{mode:m,on}){
  const tt=m==='half'?t*0.5:t;
  const Lb=250,T={x:210,y:346},Hp={x:441,y:350};
  const Sy=247+72*tt,dy=T.y-Sy,S={x:T.x+Math.sqrt(Lb*Lb-dy*dy),y:Sy};
  const u={x:(S.x-T.x)/Lb,y:(S.y-T.y)/Lb},n={x:-u.y,y:u.x};
  const A=m==='sag'?30:m==='pike'?-34:0;
  const P=function(f){const o=A*Math.sin(Math.PI*f);return {x:T.x+u.x*Lb*f+n.x*o,y:T.y+u.y*Lb*f+n.y*o};};
  const hip=P(0.55),head={x:S.x+u.x*32,y:S.y+u.y*32};
  const cs=ik(S,Hp,52,52),E=cs[0].x<cs[1].x?cs[0]:cs[1];
  const eA=ang(S,E,Hp);
  const dev=Math.abs(A)*0.99,lineOk=dev<10;
  const deep=S.y>=314;
  const dCol=t>0.9?(deep?G:R):B;
  let s=ground();
  if(on.depth)s+=ln({x:380,y:319},{x:560,y:319},dCol,1.5,DASH)+tx(566,323,'Target depth');
  if(on.hands)s+=ln({x:Hp.x,y:350},{x:Hp.x,y:222},B,1.5,DASH)+tx(Hp.x,208,'Hands under shoulders','middle');
  if(on.line)s+=ln(T,{x:S.x+u.x*45,y:S.y+u.y*45},B,1.5,DASH)+tx(196,340,'Straight line','end');
  s+=pl([P(0),P(0.07),P(0.3),P(0.55),P(0.78),P(1)],TP,8);
  s+=ci(head,13,SF,TP,3);
  s+=pl([S,E,Hp],TS,6);
  s+=ci(Hp,5,TP,'none',0);
  s+=ci(P(0.3),4.5,SF,TP,2)+ci(hip,4.5,SF,TP,2);
  if(on.line)s+=ci(hip,11,'none',lineOk?G:R,2.5);
  if(on.depth)s+=ci(S,11,'none',dCol,2.5);
  const cards=[
    ['Body line',lineOk?'Straight':(A>0?'Sagging':'Piking'),lineOk?'good':'bad'],
    ['Elbow angle',Math.round(eA)+'\u00b0',''],
    ['Depth',deep?'Chest near floor':'Not deep yet',t>0.9?(deep?'good':'bad'):'']
  ];
  return {svg:s,cards:cards,ok:(t>0.9&&deep&&lineOk)};
}

export function drawPushF(t,{mode:m,on}){
  const cx=340;
  const sy=247+72*t;
  const dl=m==='uneven'?10*t:0;
  const hw=m==='wide'?104:64,sw=52;
  const off=m==='flare'?54:26;
  const SL={x:cx-sw,y:sy+dl},SR={x:cx+sw,y:sy-dl};
  const HL={x:cx-hw,y:350},HR={x:cx+hw,y:350};
  const elbow=function(S,H,sg){
    const dx=H.x-S.x,dy=H.y-S.y,d=Math.sqrt(dx*dx+dy*dy);
    let px=dy/d,py=-dx/d;
    if(px*sg<0){px=-px;py=-py;}
    return {x:(S.x+H.x)/2+px*off*t,y:(S.y+H.y)/2+py*off*t};
  };
  const EL=elbow(SL,HL,-1),ER=elbow(SR,HR,1);
  const flare=Math.asin(Math.min(1,Math.abs(EL.x-SL.x)/52))*57.3;
  const flareOk=flare<=58;
  const handOk=hw>=56&&hw<=76;
  const shOk=dl<4;
  const hipY=346-0.55*(346-sy);
  const HiL={x:cx-34,y:hipY},HiR={x:cx+34,y:hipY};
  const head={x:cx,y:(SL.y+SR.y)/2-6};
  const mid=(SL.y+SR.y)/2;
  let s=ground();
  if(on.shoulders)s+=ln({x:cx-150,y:mid},{x:cx+150,y:mid},B,1.5,DASH)+tx(cx+156,mid+4,'Shoulders level');
  if(on.hands){
    s+=ln({x:HL.x,y:350},{x:HL.x,y:296},B,1.5,DASH)+ln({x:HR.x,y:350},{x:HR.x,y:296},B,1.5,DASH);
    s+=tx(HR.x+10,292,'Hand width');
  }
  if(on.elbows)s+=tx(90,228,'Elbows about 45\u00b0');
  s+=ln(HiL,{x:cx-20,y:346},TS,6)+ln(HiR,{x:cx+20,y:346},TS,6);
  s+=ln(SL,HiL,TP,7)+ln(SR,HiR,TP,7)+ln(HiL,HiR,TP,7)+ln(SL,SR,TP,8);
  s+=ci(head,14,SF,TP,3);
  s+=pl([SL,EL,HL],TS,6)+pl([SR,ER,HR],TS,6);
  s+=ci(HL,5,TP,'none',0)+ci(HR,5,TP,'none',0);
  s+=ci(EL,4.5,SF,TP,2)+ci(ER,4.5,SF,TP,2);
  if(on.shoulders){
    const sc=t>0.15?(shOk?G:R):N;
    s+=ci(SL,10,'none',sc,2.5)+ci(SR,10,'none',sc,2.5);
  }
  if(on.elbows){
    const ec=t>0.3?(flareOk?G:R):N;
    s+=ci(EL,10,'none',ec,2.5)+ci(ER,10,'none',ec,2.5);
  }
  if(on.hands){
    const hc=handOk?G:R;
    s+=ci(HL,10,'none',hc,2.5)+ci(HR,10,'none',hc,2.5);
  }
  const cards=[
    ['Shoulders',shOk?'Level':'Uneven',shOk?'':'bad'],
    ['Elbow flare',t>0.3?Math.round(flare)+'\u00b0':'\u2014',(t>0.3&&!flareOk)?'bad':''],
    ['Hand width',handOk?'Just outside shoulders':(hw>76?'Too wide':'Too narrow'),handOk?'':'bad']
  ];
  return {svg:s,cards:cards,ok:(t>0.9&&flareOk&&shOk&&handOk)};
}

export const views = {
  side: {
    draw: drawPush,
    desc: "Side view of a push-up with guides for body line, depth and hand position.",
    modes: [
      ["good", "Correct form"],
      ["sag", "Mistake: hips sagging"],
      ["pike", "Mistake: hips too high"],
      ["half", "Mistake: not going deep enough"],
    ],
    inds: [["line", "Body line"], ["depth", "Depth"], ["hands", "Hands under shoulders"]],
    good: [
      "Hands under shoulders, body in one straight line from head to heels. Brace your core and glutes.",
      "Lower as one piece. Elbows angle back about 45 degrees from the body instead of flaring wide.",
      "Chest stops a fist above the floor. Hips stay level with the shoulders and heels.",
      "Press the floor away and keep the body line rigid all the way to lockout.",
    ],
    bad: {
      sag: [
        "Hips sagging",
        "Hips drop toward the floor, which stresses the lower back. Squeeze your glutes and brace your abs.",
      ],
      pike: [
        "Hips too high",
        "Hips rise above the shoulder-to-heel line, which shortens the range and unloads the chest.",
      ],
      half: [
        "Not deep enough",
        "The body stops far above the floor, so the chest and triceps do little work. Lower until your chest is a fist from the floor.",
      ],
    },
  },
  front: {
    draw: drawPushF,
    desc: "Front view of a push-up with guides for shoulder level, elbow tuck and hand width.",
    modes: [
      ["good", "Correct form"],
      ["flare", "Mistake: elbows flaring"],
      ["uneven", "Mistake: uneven shoulders"],
      ["wide", "Mistake: hands too wide"],
    ],
    inds: [["shoulders", "Shoulders level"], ["elbows", "Elbow tuck"], ["hands", "Hand width"]],
    good: [
      "Hands just outside the shoulders, shoulders level and head in line with the spine.",
      "Lower with both shoulders moving together. Elbows tuck at about 45 degrees instead of pointing straight out.",
      "Chest near the floor, elbows still tucked, shoulders level left to right.",
      "Press up evenly through both hands and keep the elbow angle the same.",
    ],
    bad: {
      flare: [
        "Elbows flaring",
        "Elbows point straight out in a T shape, which stresses the shoulders. Tuck them to about 45 degrees.",
      ],
      uneven: [
        "Uneven shoulders",
        "One shoulder drops lower than the other, so one arm does more of the work. Keep the shoulders level.",
      ],
      wide: [
        "Hands too wide",
        "Hands far outside the shoulders push the elbows out and strain the joint. Place them just outside shoulder width.",
      ],
    },
  },
};
