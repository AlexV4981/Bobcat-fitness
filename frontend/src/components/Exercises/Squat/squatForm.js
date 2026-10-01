/**
 * Squat (barbell back squat) form data + drawing functions.
 * ---------------------------------------------------------------------------
 * Pure data/geometry: no React. `draw(t, { mode, on })` returns { svg, cards,
 * goodDepth } for one frame, where t is eased progress (0 = standing, 1 =
 * bottom), mode is a key from `modes` and `on` maps indicator keys to booleans.
 */

import { G, R, B, N, fx } from "../svgKit.js";

export const phases = ["Standing", "Descending", "Bottom", "Driving up"];

const YREF = 256.3; // y of the parallel line in both views

function depthWord(rel){return rel>=6?'Below parallel':rel>=-4?'At parallel':'Above parallel';}

export function drawSide(t,{mode:m,on}){
  const tt=m==='half'?t*0.6:t;
  const Ls=88,Lt=98,Lb=92,ball={x:350,y:350},barX=317;
  const fa=m==='heels'?tt*0.3:0;
  const rot=function(x,y){const dx=x-ball.x,dy=y-ball.y;return {x:ball.x+dx*Math.cos(fa)-dy*Math.sin(fa),y:ball.y+dx*Math.sin(fa)+dy*Math.cos(fa)};};
  const heel=rot(272,350),ankle=rot(300,334);
  const ths=tt*0.49+(m==='heels'?tt*0.1:0);
  const knee={x:ankle.x+Ls*Math.sin(ths),y:ankle.y-Ls*Math.cos(ths)};
  const tht=tt*1.66;
  const hip={x:knee.x-Lt*Math.sin(tht),y:knee.y-Lt*Math.cos(tht)};
  let phi=Math.asin(Math.max(-0.3,Math.min(0.96,(barX-hip.x)/Lb)));
  if(m==='chest')phi+=0.3*tt;
  const sh={x:hip.x+Lb*Math.sin(phi),y:hip.y-Lb*Math.cos(phi)};
  const nrm={x:-Math.cos(phi),y:-Math.sin(phi)};
  const mid={x:(hip.x+sh.x)/2,y:(hip.y+sh.y)/2};
  const bulge=m==='chest'?26*tt:0;
  const ctrl={x:mid.x+nrm.x*bulge,y:mid.y+nrm.y*bulge};
  const ha=phi*0.35,hd={x:Math.sin(ha),y:-Math.cos(ha)};
  const neck={x:sh.x+hd.x*14,y:sh.y+hd.y*14},head={x:sh.x+hd.x*30,y:sh.y+hd.y*30};
  const bp={x:sh.x,y:sh.y-4};
  const el={x:sh.x-20,y:sh.y+24+tt*4},hand={x:sh.x+3,y:sh.y-3};
  const rel=hip.y-YREF;
  const dCol=t>0.9?((m==='half'||rel<-4)?R:G):B;
  const bOk=Math.abs(sh.x-barX)<=12;
  const bCol=bOk?G:(t>0.3?R:B);
  const hl=heel.y<346;
  const badSpine=m==='chest'&&tt>0.3;
  let s='<line x1="60" y1="350" x2="620" y2="350" stroke="var(--fg-line)" stroke-width="1"/>';
  if(on.depth){
    s+='<line x1="110" y1="'+fx(YREF)+'" x2="560" y2="'+fx(YREF)+'" stroke="'+dCol+'" stroke-width="1.5" stroke-dasharray="6 5"/>';
    s+='<text class="fg-label" x="566" y="'+fx(YREF+4)+'">Parallel</text>';
  }
  if(on.bar){
    s+='<line x1="'+barX+'" y1="20" x2="'+barX+'" y2="350" stroke="'+B+'" stroke-width="1.5" stroke-dasharray="6 5"/>';
    s+='<text class="fg-label" x="'+(barX-20)+'" y="374">Bar path</text>';
  }
  s+='<circle cx="'+fx(bp.x)+'" cy="'+fx(bp.y)+'" r="26" fill="var(--fg-bg)" stroke="var(--fg-line)" stroke-width="1.5"/>';
  s+='<polyline points="'+fx(heel.x)+','+fx(heel.y)+' 350,350 364,350" fill="none" stroke="var(--fg-ink)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
  s+='<polyline points="'+fx(ankle.x)+','+fx(ankle.y)+' '+fx(knee.x)+','+fx(knee.y)+' '+fx(hip.x)+','+fx(hip.y)+'" fill="none" stroke="var(--fg-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
  if(m==='chest'){
    s+='<path d="M'+fx(hip.x)+' '+fx(hip.y)+' Q'+fx(ctrl.x)+' '+fx(ctrl.y)+' '+fx(sh.x)+' '+fx(sh.y)+'" fill="none" stroke="var(--fg-ink)" stroke-width="8" stroke-linecap="round"/>';
  }else{
    s+='<line x1="'+fx(hip.x)+'" y1="'+fx(hip.y)+'" x2="'+fx(sh.x)+'" y2="'+fx(sh.y)+'" stroke="var(--fg-ink)" stroke-width="8" stroke-linecap="round"/>';
  }
  s+='<line x1="'+fx(sh.x)+'" y1="'+fx(sh.y)+'" x2="'+fx(neck.x)+'" y2="'+fx(neck.y)+'" stroke="var(--fg-ink)" stroke-width="6" stroke-linecap="round"/>';
  s+='<circle cx="'+fx(head.x)+'" cy="'+fx(head.y)+'" r="13" fill="var(--fg-fill)" stroke="var(--fg-ink)" stroke-width="3"/>';
  s+='<polyline points="'+fx(sh.x)+','+fx(sh.y)+' '+fx(el.x)+','+fx(el.y)+' '+fx(hand.x)+','+fx(hand.y)+'" fill="none" stroke="var(--fg-soft)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
  s+='<circle cx="'+fx(bp.x)+'" cy="'+fx(bp.y)+'" r="4.5" fill="var(--fg-ink)"/>';
  s+='<circle cx="'+fx(knee.x)+'" cy="'+fx(knee.y)+'" r="5" fill="var(--fg-fill)" stroke="var(--fg-ink)" stroke-width="2"/>';
  s+='<circle cx="'+fx(hip.x)+'" cy="'+fx(hip.y)+'" r="5" fill="var(--fg-fill)" stroke="var(--fg-ink)" stroke-width="2"/>';
  if(on.depth){
    s+='<circle cx="'+fx(hip.x)+'" cy="'+fx(hip.y)+'" r="11" fill="none" stroke="'+dCol+'" stroke-width="2.5"/>';
  }
  if(on.spine){
    const sc=badSpine?R:G;
    if(m==='chest'){
      s+='<path d="M'+fx(hip.x)+' '+fx(hip.y)+' Q'+fx(ctrl.x)+' '+fx(ctrl.y)+' '+fx(sh.x)+' '+fx(sh.y)+'" fill="none" stroke="'+sc+'" stroke-width="3" stroke-linecap="round"/>';
    }else{
      s+='<line x1="'+fx(hip.x)+'" y1="'+fx(hip.y)+'" x2="'+fx(sh.x)+'" y2="'+fx(sh.y)+'" stroke="'+sc+'" stroke-width="3" stroke-linecap="round"/>';
    }
    s+='<text class="fg-label" x="'+fx(mid.x-40)+'" y="'+fx(mid.y+4)+'" text-anchor="end">'+(m==='chest'?'Rounded back':'Neutral spine')+'</text>';
  }
  if(on.bar){
    s+='<circle cx="'+fx(bp.x)+'" cy="'+fx(bp.y)+'" r="8" fill="none" stroke="'+bCol+'" stroke-width="2.5"/>';
  }
  if(on.heel){
    s+='<circle cx="'+fx(heel.x)+'" cy="'+fx(heel.y)+'" r="7" fill="none" stroke="'+(hl?R:G)+'" stroke-width="2.5"/>';
    s+='<text class="fg-label" x="'+(barX-32)+'" y="374" text-anchor="end">'+(hl?'Heel lifting':'Heel down')+'</text>';
  }
  const cards=[
    ['Torso angle',Math.round(phi*57.3)+'\u00b0',badSpine?'bad':''],
    ['Hips vs knees',depthWord(rel),t>0.9?((m==='half'||rel<-4)?'bad':'good'):''],
    ['Bar vs mid-foot',bOk?'Over mid-foot':'Drifting ahead',t>0.3?(bOk?'good':'bad'):''],
    ['Heels',hl?'Lifting':'Flat',hl?'bad':'']
  ];
  return {svg:s,cards:cards,goodDepth:(t>0.9&&rel>=-4&&m!=='half')};
}

export function drawFront(t,{mode:m,on}){
  const cx=340,ay=334,Ls=88,Lt=98,Lb=92;
  const ths=t*0.49,tht=t*1.66;
  const kY=ay-Ls*Math.cos(ths),hY=kY-Lt*Math.cos(tht);
  let phi=0.157+0.69*t,sY=hY-Lb*Math.cos(phi);
  const off=m==='cave'?45-22*t:45+25*t;
  const rel=hY-YREF;
  const over=off>=48;
  const kCol=t>0.35?(over?G:R):N;
  const dCol=t>0.9?(rel<-4?R:G):B;
  let s='<line x1="120" y1="350" x2="560" y2="350" stroke="var(--fg-line)" stroke-width="1"/>';
  if(on.depth){
    s+='<line x1="140" y1="'+fx(YREF)+'" x2="540" y2="'+fx(YREF)+'" stroke="'+dCol+'" stroke-width="1.5" stroke-dasharray="6 5"/>';
    s+='<text class="fg-label" x="546" y="'+fx(YREF+4)+'">Parallel</text>';
  }
  if(on.knee){
    s+='<line x1="'+(cx-58)+'" y1="350" x2="'+(cx-58)+'" y2="120" stroke="'+B+'" stroke-width="1.5" stroke-dasharray="6 5"/>';
    s+='<line x1="'+(cx+58)+'" y1="350" x2="'+(cx+58)+'" y2="120" stroke="'+B+'" stroke-width="1.5" stroke-dasharray="6 5"/>';
    s+='<text class="fg-label" x="'+(cx+66)+'" y="126">Toe line</text>';
  }
  [-1,1].forEach(function(k){
    s+='<ellipse cx="'+(cx+k*62)+'" cy="344" rx="20" ry="7" transform="rotate('+(k*20)+' '+(cx+k*62)+' 344)" fill="var(--fg-bg)" stroke="var(--fg-ink)" stroke-width="3"/>';
    s+='<polyline points="'+(cx+k*58)+','+ay+' '+fx(cx+k*off)+','+fx(kY)+' '+(cx+k*30)+','+fx(hY)+'" fill="none" stroke="var(--fg-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
  });
  s+='<line x1="'+(cx-30)+'" y1="'+fx(hY)+'" x2="'+(cx+30)+'" y2="'+fx(hY)+'" stroke="var(--fg-ink)" stroke-width="8" stroke-linecap="round"/>';
  s+='<line x1="'+cx+'" y1="'+fx(hY)+'" x2="'+cx+'" y2="'+fx(sY)+'" stroke="var(--fg-ink)" stroke-width="8" stroke-linecap="round"/>';
  s+='<line x1="'+(cx-40)+'" y1="'+fx(sY)+'" x2="'+(cx+40)+'" y2="'+fx(sY)+'" stroke="var(--fg-ink)" stroke-width="7" stroke-linecap="round"/>';
  s+='<circle cx="'+cx+'" cy="'+fx(sY-28)+'" r="13" fill="var(--fg-fill)" stroke="var(--fg-ink)" stroke-width="3"/>';
  s+='<line x1="'+(cx-115)+'" y1="'+fx(sY-3)+'" x2="'+(cx+115)+'" y2="'+fx(sY-3)+'" stroke="var(--fg-soft)" stroke-width="4" stroke-linecap="round"/>';
  [-1,1].forEach(function(k){
    s+='<rect x="'+(k<0?cx-125:cx+115)+'" y="'+fx(sY-31)+'" width="10" height="56" rx="2" fill="var(--fg-bg)" stroke="var(--fg-line)" stroke-width="1.5"/>';
    s+='<polyline points="'+(cx+k*40)+','+fx(sY)+' '+(cx+k*54)+','+fx(sY+26)+' '+(cx+k*72)+','+fx(sY-3)+'" fill="none" stroke="var(--fg-soft)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    s+='<circle cx="'+fx(cx+k*off)+'" cy="'+fx(kY)+'" r="5" fill="var(--fg-fill)" stroke="var(--fg-ink)" stroke-width="2"/>';
    s+='<circle cx="'+(cx+k*30)+'" cy="'+fx(hY)+'" r="5" fill="var(--fg-fill)" stroke="var(--fg-ink)" stroke-width="2"/>';
    if(on.knee)s+='<circle cx="'+fx(cx+k*off)+'" cy="'+fx(kY)+'" r="11" fill="none" stroke="'+kCol+'" stroke-width="2.5"/>';
  });
  if(on.depth)s+='<circle cx="'+cx+'" cy="'+fx(hY)+'" r="11" fill="none" stroke="'+dCol+'" stroke-width="2.5"/>';
  const cards=[
    ['Knees vs toes',over?'Over toes':'Caving in',t>0.35?(over?'good':'bad'):''],
    ['Hips vs knees',depthWord(rel),t>0.9?(rel<-4?'bad':'good'):'']
  ];
  return {svg:s,cards:cards,goodDepth:(t>0.9&&rel>=-4)};
}

export const views = {
  side: {
    draw: drawSide,
    desc: "Side view of a barbell back squat with guides for depth, spine angle, bar path and heel contact.",
    modes: [
      ["good", "Correct form"],
      ["heels", "Mistake: heels lifting"],
      ["chest", "Mistake: chest falls forward"],
      ["half", "Mistake: stopping too high"],
    ],
    inds: [
      ["depth", "Depth line"],
      ["spine", "Spine and torso"],
      ["bar", "Bar path"],
      ["heel", "Heels"],
    ],
    good: [
      "Feet shoulder-width, toes turned out slightly. Brace your core and keep the bar over mid-foot.",
      "Push hips back and down together. Knees track over toes and the chest stays up.",
      "Hips reach knee level or just below. Heels stay flat and the back stays neutral.",
      "Drive up through the whole foot. Hips and chest rise at the same rate.",
    ],
    bad: {
      heels: [
        "Heels lifting",
        "Heels rise, so weight shifts onto the toes. Try more ankle mobility work or slightly elevated heels.",
      ],
      chest: [
        "Chest falls forward",
        "The torso folds forward and the bar drifts ahead of mid-foot, which overloads the lower back.",
      ],
      half: [
        "Stopping too high",
        "Hips stay above knee level, so the squat is too shallow to load the legs fully.",
      ],
    },
  },
  front: {
    draw: drawFront,
    desc: "Front view of a barbell back squat with guides for depth and knee tracking over the toes.",
    modes: [["good", "Correct form"], ["cave", "Mistake: knees caving in"]],
    inds: [["depth", "Depth line"], ["knee", "Knee tracking"]],
    good: [
      "Feet shoulder-width, toes turned out slightly. Brace your core and keep the bar over mid-foot.",
      "Push hips back and down together. Knees track over toes and the chest stays up.",
      "Hips reach knee level or just below. Heels stay flat and the back stays neutral.",
      "Drive up through the whole foot. Hips and chest rise at the same rate.",
    ],
    bad: {
      cave: [
        "Knees caving in",
        "Knees drift inward past the toe line. Push them out in line with the toes.",
      ],
    },
  },
};
