/**
 * Sit-up form data + drawing functions.
 * ---------------------------------------------------------------------------
 * Pure data/geometry: no React. `draw(t, { mode, on, p })` returns
 * { svg, cards, ok } for one frame, where t is eased progress (0 = start
 * position, 1 = deepest/top position), p is raw loop progress (0-1), mode is a
 * key from `modes` and `on` maps indicator keys to booleans.
 */

import { G, R, B, N, TP, TS, SF, DASH, lerp, ang, ik, ln, pl, ci, tx, ground } from "../svgKit.js";

export const phases = ["Lying down", "Curling up", "Top", "Lowering"];

export function drawSit(t,{mode:m,on}){
  const tt=m==='half'?t*0.4:t;
  const Hp={x:330,y:338},al=0.02+1.56*tt,Lt=95;
  const td={x:-Math.cos(al),y:-Math.sin(al)},dh={x:-td.x,y:-td.y},fr={x:-td.y,y:td.x};
  const S={x:Hp.x+Lt*td.x,y:Hp.y+Lt*td.y};
  const pull=m==='neck';
  const be=al+(pull?0.7*Math.min(1,tt*3):0);
  const hd={x:-Math.cos(be),y:-Math.sin(be)};
  const head={x:S.x+hd.x*30,y:S.y+hd.y*30};
  const F=m==='straight'?{x:498,y:344}:{x:430,y:344};
  const cs=ik(Hp,F,85,85),K=cs[0].y<cs[1].y?cs[0]:cs[1];
  const kA=ang(Hp,K,F);
  const up=al>=1.36;
  const rCol=t>0.9?(up?G:R):B;
  const nBad=pull&&tt>0.15;
  const lOk=kA>=60&&kA<=125;
  let s=ground();
  if(on.range)s+=ln({x:Hp.x,y:350},{x:Hp.x,y:150},B,1.5,DASH)+tx(Hp.x+8,156,'Upright');
  s+=pl([Hp,K,F],TP,7);
  s+=ln({x:F.x-6,y:346},{x:F.x+20,y:346},TP,8);
  s+=ln(Hp,S,TP,8);
  s+=ln(S,head,TP,6);
  s+=ci(head,13,SF,TP,3);
  if(pull){
    const fw={x:-hd.y,y:hd.x};
    const Ee={x:head.x+fw.x*30,y:head.y+fw.y*30},hand={x:head.x-fw.x*12,y:head.y-fw.y*12};
    s+=pl([S,Ee,hand],TS,5);
  }else{
    s+=ln({x:S.x+fr.x*8,y:S.y+fr.y*8},{x:S.x+dh.x*40+fr.x*8,y:S.y+dh.y*40+fr.y*8},TS,5);
  }
  s+=ci(K,4.5,SF,TP,2)+ci(Hp,4.5,SF,TP,2);
  if(on.range)s+=ci(S,11,'none',rCol,2.5);
  if(on.neck)s+=ln(S,head,nBad?R:G,3.5)+tx(head.x,head.y-24,nBad?'Neck flexing':'Neutral neck','middle');
  if(on.legs)s+=ci(K,11,'none',lOk?G:R,2.5)+tx(K.x+16,K.y-8,lOk?'Knees bent':'Legs straight');
  const deg=Math.round(Math.min(al,1.57)*57.3);
  const cards=[
    ['Torso angle',deg+'\u00b0',t>0.9?(up?'good':'bad'):''],
    ['Knee angle',Math.round(kA)+'\u00b0',lOk?'':'bad'],
    ['Neck',nBad?'Pulling':'Neutral',nBad?'bad':'']
  ];
  return {svg:s,cards:cards,ok:(t>0.9&&up&&!nBad)};
}

export function drawSitF(t,{mode:m,on}){
  const cx=340;
  const pull=m==='neck',twist=m==='twist',lift=m==='feet';
  const sy=lerp(318,176,t),w=lerp(30,48,t);
  const tilt=twist?0.3*t:0;
  const SL={x:cx-w*Math.cos(tilt),y:sy+w*Math.sin(tilt)},SR={x:cx+w*Math.cos(tilt),y:sy-w*Math.sin(tilt)};
  const pk=Math.min(1,t*3);
  const r=lerp(11,14,t)*(pull?1+0.18*pk:1);
  const head={x:cx+(twist?12*t:0),y:sy-lerp(14,30,t)+(pull?16*pk:0)};
  const HiL={x:cx-30,y:338},HiR={x:cx+30,y:338};
  const KL={x:cx-48,y:268},KR={x:cx+48,y:268};
  const lf=lift?24*t:0;
  const FL={x:cx-46,y:346-lf},FR={x:cx+46,y:346-lf};
  const shOk=tilt<0.1,fOk=lf<6,nBad=pull&&t>0.15;
  let s=ground();
  if(on.shoulders)s+=ln({x:cx-110,y:sy},{x:cx+110,y:sy},B,1.5,DASH)+tx(cx+116,sy+4,'Shoulders level');
  s+=ln(SL,HiL,TP,7)+ln(SR,HiR,TP,7)+ln(HiL,HiR,TP,7)+ln(SL,SR,TP,8);
  s+=ci(head,r,SF,TP,3);
  if(pull){
    const EL={x:SL.x-34,y:SL.y-18},ER={x:SR.x+34,y:SR.y-18};
    s+=pl([SL,EL,{x:head.x-r-6,y:head.y+2}],TS,5)+pl([SR,ER,{x:head.x+r+6,y:head.y+2}],TS,5);
  }else{
    s+=ln({x:cx-w*0.75,y:sy+8},{x:cx+w*0.75,y:sy+24},TS,5)+ln({x:cx+w*0.75,y:sy+8},{x:cx-w*0.75,y:sy+24},TS,5);
  }
  s+=pl([HiL,KL,FL],TP,7)+pl([HiR,KR,FR],TP,7);
  s+=ci(KL,4.5,SF,TP,2)+ci(KR,4.5,SF,TP,2);
  if(on.shoulders){
    const sc=t>0.15?(shOk?G:R):N;
    s+=ci(SL,10,'none',sc,2.5)+ci(SR,10,'none',sc,2.5);
  }
  if(on.neck){
    s+=ln({x:cx,y:sy},head,nBad?R:G,3.5)+tx(head.x,head.y-r-12,nBad?'Neck flexing':'Neutral neck','middle');
  }
  if(on.feet){
    s+=ci(FL,9,'none',fOk?G:R,2.5)+ci(FR,9,'none',fOk?G:R,2.5)+tx(cx,372,fOk?'Feet down':'Feet lifting','middle');
  }
  const cards=[
    ['Shoulders',shOk?'Square':'Twisting',(t>0.3&&!shOk)?'bad':''],
    ['Neck',nBad?'Pulling':'Neutral',nBad?'bad':''],
    ['Feet',fOk?'Anchored':'Lifting',fOk?'':'bad']
  ];
  return {svg:s,cards:cards,ok:(t>0.9&&shOk&&!nBad&&fOk)};
}

export const views = {
  side: {
    draw: drawSit,
    desc: "Side view of a sit-up with guides for torso angle, neck position and knee bend.",
    modes: [
      ["good", "Correct form"],
      ["neck", "Mistake: pulling on the neck"],
      ["straight", "Mistake: legs straight"],
      ["half", "Mistake: shoulders barely lift"],
    ],
    inds: [["range", "Upright torso"], ["neck", "Neck"], ["legs", "Knees"]],
    good: [
      "Lie back with knees bent and feet flat. Cross your arms on your chest and tuck your chin slightly.",
      "Curl up one section at a time, leading with the chest. Your neck stays in line with your spine.",
      "Reach an upright torso with your abs, not by pulling on your neck or throwing your arms.",
      "Lower slowly, keeping your feet anchored and your lower back in contact with the floor.",
    ],
    bad: {
      neck: [
        "Pulling on the neck",
        "Yanking the head forward strains the neck and lets the abs off the hook. Keep the neck long and the hands light.",
      ],
      straight: [
        "Legs straight",
        "With straight legs the hip flexors take over and tug on the lower back. Keep the knees bent.",
      ],
      half: [
        "Shoulders barely lift",
        "The shoulders barely leave the floor, so the range of motion is too small to work the abs fully.",
      ],
    },
  },
  front: {
    draw: drawSitF,
    desc: "Front view of a sit-up with guides for shoulder level, neck position and feet contact.",
    modes: [
      ["good", "Correct form"],
      ["neck", "Mistake: pulling on the neck"],
      ["twist", "Mistake: twisting"],
      ["feet", "Mistake: feet lifting"],
    ],
    inds: [["shoulders", "Shoulders level"], ["neck", "Neck"], ["feet", "Feet"]],
    good: [
      "Knees bent, feet flat and hip-width apart. Cross your arms on your chest.",
      "Curl up evenly. Shoulders stay level and the head stays in line with the spine.",
      "Sit tall with shoulders level over the hips and feet still flat.",
      "Lower slowly and evenly while your feet stay anchored.",
    ],
    bad: {
      neck: [
        "Pulling on the neck",
        "Elbows flare and the head is dragged forward, which strains the neck. Keep the hands light.",
      ],
      twist: [
        "Twisting",
        "The torso rotates to one side, which turns it into a different movement. Keep both shoulders square.",
      ],
      feet: [
        "Feet lifting",
        "Feet lift off the floor, so the hip flexors take over. Keep your feet anchored.",
      ],
    },
  },
};
