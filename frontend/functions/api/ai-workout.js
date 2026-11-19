import {json,failure,bodyObject,limitedText,authorizeAndLimit,generateJson} from '../../server/aiGateway.js';
import {PROGRAM_SYSTEM,PROGRAM_SCHEMA,programPrompt,normalizeProgram} from '../../server/workoutProgram.js';

const SYSTEM=`You are an experienced strength and conditioning coach. Return ONLY JSON,
without markdown fences, describing one safe workout session. Use only the requested equipment.
Respect duration, fitness level and limitations; do not provide medical advice.
The exact output shape is:
{ "title":string, "summary":string, "durationMin":integer, "intensity":string,
  "warmup":[{"name":string,"detail":string}],
  "blocks":[{"name":string,"rounds":integer,
             "exercises":[{"name":string,"sets":integer,"reps":string,
                           "restSec":integer,"cue":string}]}],
  "cooldown":[{"name":string,"detail":string}] }.
Include safe variations for beginners and concise form cues.`;

export async function onRequestPost({request,env}) {
  const input=await bodyObject(request,9000);
  if(!input) return failure('Invalid or oversized request.',400);
  const equipment=Array.isArray(input.equipment)?
    input.equipment.slice(0,12).map(x=>limitedText(x,70)).filter(Boolean):[];
  const options={
    goal:limitedText(input.goal,80),
    focus:limitedText(input.focus,80),
    level:limitedText(input.level,60),
    duration:Math.min(90,Math.max(10,Math.round(Number(input.duration)||45))),
    equipment:equipment.length?equipment:['bodyweight only'],
    notes:limitedText(input.notes,800),
  };
  if(!options.goal||!options.focus||!options.level) return failure('Workout goal, focus and level are required.',400);
  const isProgram=input.mode==='program';
  if(isProgram) {
    options.weeks=Math.min(12,Math.max(2,Math.round(Number(input.weeks)||6)));
    options.daysPerWeek=Math.min(6,Math.max(2,Math.round(Number(input.daysPerWeek)||3)));
  }
  const auth=await authorizeAndLimit(request,env,'workout');
  if(auth.response) return auth.response;
  if(isProgram) return generateProgram(env,options);
  try {
    const r=await generateJson(env,{feature:'workout',system:SYSTEM,prompt:JSON.stringify(options),maxTokens:2600,temperature:0.7});
    if(r.response) return r.response;
    const w=r.data;
    if(typeof w?.title!=='string'||!Array.isArray(w.blocks)||!Array.isArray(w.warmup)||!Array.isArray(w.cooldown)) {
      return failure('The AI returned an incomplete workout. Please retry.',502);
    }
    return json(w);
  } catch(e) {
    console.error('AI workout function failed',e?.name||'Error');
    return failure('Workout assistant is temporarily unavailable.',502);
  }
}

// Multi-week program: one request, each training day written once with week-by-week sets/reps.
async function generateProgram(env,options) {
  try {
    const r=await generateJson(env,{
      feature:'workout',
      system:PROGRAM_SYSTEM,
      prompt:programPrompt(options),
      schema:PROGRAM_SCHEMA,
      maxTokens:16000,
      temperature:0.7,
    });
    if(r.response) return r.response;
    const program=normalizeProgram(r.data,options.weeks);
    if(!program) return failure('The AI returned an incomplete program. Please retry.',502);
    return json(program);
  } catch(e) {
    console.error('AI program function failed',e?.name||'Error');
    return failure('Workout assistant is temporarily unavailable.',502);
  }
}
