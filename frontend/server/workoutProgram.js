// Server-only helpers for multi-week AI workout programs. NEVER import from src/.
//
// The model writes each training day ONCE. Every exercise carries a `weekly` array
// (one {sets, reps} per week), so a 12-week program stays small and reliable instead
// of repeating whole workouts week after week.

import {limitedText} from './aiGateway.js';

export const PROGRAM_SYSTEM=`You are an experienced strength and conditioning coach. Design one complete, safe, realistic multi-week training program.
Rules:
- The program repeats the same set of training days every week. Write each training day ONCE.
- Use ONLY the requested equipment. If "bodyweight only" is the sole item, use no equipment except household items like a chair or table.
- Each training day must fit the session length (warm-up + main work + rest + cool-down).
- Write exactly the requested number of training days. Split them sensibly for the focus (for example full body x3, upper/lower x4, push/pull/legs x6). Do not train the same muscles hard on back-to-back days.
- Progressive overload: every exercise has a "weekly" array with EXACTLY one {sets, reps} entry per week, in week order. Progress gradually by adding reps, then sets, then a harder variation or load cue (for example "8 @ RPE 8").
- Programs of 4 weeks or more include a lighter deload week (fewer sets, easier reps), usually every 4th week. Mark it in weekNotes with deload = true.
- "weekNotes" has EXACTLY one entry per week, in order, each with a short focus (2-4 words) and one sentence of guidance.
- For circuits, set rounds > 1 and sets = 1 in every weekly entry; put the between-round rest on the last exercise.
- Match volume and difficulty to the level. Give a regression in the cue when a move is hard for the level.
- Cues are one short sentence about form. Respect any injuries or constraints in the notes. Do not give medical advice.`;

const item={type:'OBJECT',properties:{name:{type:'STRING'},detail:{type:'STRING'}},required:['name','detail']};

export const PROGRAM_SCHEMA={
  type:'OBJECT',
  properties:{
    title:{type:'STRING'},
    summary:{type:'STRING'},
    intensity:{type:'STRING'},
    progression:{type:'STRING'},
    weekNotes:{type:'ARRAY',items:{type:'OBJECT',
      properties:{focus:{type:'STRING'},note:{type:'STRING'},deload:{type:'BOOLEAN'}},
      required:['focus','note','deload']}},
    days:{type:'ARRAY',items:{type:'OBJECT',
      properties:{
        name:{type:'STRING'},
        focus:{type:'STRING'},
        durationMin:{type:'INTEGER'},
        warmup:{type:'ARRAY',items:item},
        blocks:{type:'ARRAY',items:{type:'OBJECT',
          properties:{
            name:{type:'STRING'},
            rounds:{type:'INTEGER'},
            exercises:{type:'ARRAY',items:{type:'OBJECT',
              properties:{
                name:{type:'STRING'},
                restSec:{type:'INTEGER'},
                cue:{type:'STRING'},
                weekly:{type:'ARRAY',items:{type:'OBJECT',
                  properties:{sets:{type:'INTEGER'},reps:{type:'STRING'}},required:['sets','reps']}},
              },
              required:['name','restSec','cue','weekly']}},
          },
          required:['name','rounds','exercises']}},
        cooldown:{type:'ARRAY',items:item},
      },
      required:['name','focus','durationMin','warmup','blocks','cooldown']}},
  },
  required:['title','summary','intensity','progression','weekNotes','days'],
};

export function programPrompt(options) {
  return [
    `Build a ${options.weeks}-week training program.`,
    `Weeks: ${options.weeks}`,
    `Training days per week: ${options.daysPerWeek}`,
    `Goal: ${options.goal}`,
    `Focus: ${options.focus}`,
    `Level: ${options.level}`,
    `Session length: ${options.duration} minutes`,
    `Equipment available: ${options.equipment.join(', ')}`,
    `Notes from the athlete: ${options.notes||'none'}`,
  ].join('\n');
}

const int=(v,min,max,fallback)=>{
  const n=Math.round(Number(v));
  return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};

const items=(list)=>(Array.isArray(list)?list:[])
  .map(x=>({name:limitedText(x?.name,80),detail:limitedText(x?.detail,80)}))
  .filter(x=>x.name)
  .slice(0,8);

// If the model returns fewer weeks than asked for, extra weeks continue the plan:
// they repeat the last normal (non-deload) week instead of copying a deload week.
const EXTRA_WEEK={focus:'Keep progressing',note:"Repeat last week's numbers and add a rep wherever it felt easy.",deload:false};

/**
 * Cleans up what the model returned: exactly `weeks` week notes, exactly `weeks`
 * weekly entries per exercise, sane numbers, trimmed text. Returns null when the
 * reply is not a usable program.
 */
export function normalizeProgram(raw,weeks) {
  if(!raw || typeof raw!=='object' || typeof raw.title!=='string' || !Array.isArray(raw.days)) return null;

  const notes=(Array.isArray(raw.weekNotes)?raw.weekNotes:[]).slice(0,weeks).map(n=>({
    focus:limitedText(n?.focus,60)||'Train',
    note:limitedText(n?.note,240),
    deload:n?.deload===true,
  }));
  const written=notes.length;
  const lastNormal=(count)=>{
    for(let i=Math.min(count,written)-1;i>=0;i--) if(!notes[i].deload) return i;
    return Math.max(0,count-1);
  };
  while(notes.length<weeks) notes.push({...EXTRA_WEEK});

  const fitWeekly=(weekly,rounds)=>{
    const list=(Array.isArray(weekly)?weekly:[]).slice(0,weeks).map(w=>({
      sets:rounds>1?1:int(w?.sets,1,10,3),
      reps:limitedText(String(w?.reps??''),40)||'10',
    }));
    if(!list.length) list.push({sets:rounds>1?1:3,reps:'10'});
    const source=list[lastNormal(list.length)];
    while(list.length<weeks) list.push({...source});
    return list;
  };

  const days=raw.days.slice(0,7).map((d,di)=>({
    name:limitedText(d?.name,80)||`Day ${di+1}`,
    focus:limitedText(d?.focus,80),
    durationMin:int(d?.durationMin,10,120,45),
    warmup:items(d?.warmup),
    blocks:(Array.isArray(d?.blocks)?d.blocks:[]).slice(0,6).map(b=>{
      const rounds=int(b?.rounds,1,10,1);
      return {
        name:limitedText(b?.name,60)||'Main work',
        rounds,
        exercises:(Array.isArray(b?.exercises)?b.exercises:[]).slice(0,10)
          .map(e=>({
            name:limitedText(e?.name,80),
            restSec:int(e?.restSec,0,600,60),
            cue:limitedText(e?.cue,200),
            weekly:fitWeekly(e?.weekly,rounds),
          }))
          .filter(e=>e.name),
      };
    }).filter(b=>b.exercises.length),
    cooldown:items(d?.cooldown),
  })).filter(d=>d.blocks.length);

  if(!days.length) return null;
  return {
    type:'program',
    title:limitedText(raw.title,100)||'Training program',
    summary:limitedText(raw.summary,400),
    intensity:limitedText(raw.intensity,40)||'Moderate',
    progression:limitedText(raw.progression,400),
    weeks,
    weekNotes:notes,
    days,
  };
}
