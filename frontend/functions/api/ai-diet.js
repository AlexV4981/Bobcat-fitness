import {json,failure,bodyObject,limitedText,authorizeAndLimit,generateJson} from '../../server/aiGateway.js';

const SYSTEM=`You are a helpful fitness nutrition assistant, not a medical professional.
Answer concisely and avoid diagnoses and extreme dietary restrictions.
Return ONLY a JSON object with:
"ai_response": string,
"updated_dpo": null OR an object containing
  "version": "1.0", "goal": string, "source_workout_title": string,
  "daily_calorie_target": integer, "daily_protein_target_g": integer,
  "weekly_schedule": array of seven objects {day,calories,protein,carbs,fats,meals:[strings]},
  "action_checklist": array of strings.
Generate updated_dpo only when the user requests a plan or supplies a workout to plan for.
The seven days must be Monday through Sunday. Do not include markdown fences.`;

export async function onRequestPost({request,env}) {
  const body=await bodyObject(request);
  if(!body) return failure('Invalid or oversized request.',400);
  const fitness_goal=limitedText(body.fitness_goal,120);
  const workout_plan=limitedText(body.workout_plan,2000);
  if(!fitness_goal||!workout_plan) return failure('A fitness goal and a message are required.',400);
  const auth=await authorizeAndLimit(request,env);
  if(auth.response) return auth.response;
  try {
    const prompt=JSON.stringify({
      fitness_goal,workout_plan,
      wpo_summary:limitedText(body.wpo_summary,1700),
      current_dpo:body.current_dpo && typeof body.current_dpo==='object'?
        JSON.stringify(body.current_dpo).slice(0,2500):null,
    });
    const r=await generateJson(env,{system:SYSTEM,prompt,maxTokens:3200,temperature:0.5});
    if(r.response) return r.response;
    if(typeof r.data?.ai_response!=='string') return failure('The AI returned an incomplete nutrition response.',502);
    const dpo=r.data.updated_dpo;
    if(dpo!=null && (!Array.isArray(dpo.weekly_schedule)||!Array.isArray(dpo.action_checklist))) {
      return failure('The AI returned an incomplete plan. Please retry.',502);
    }
    return json({ai_response:r.data.ai_response.slice(0,7000),updated_dpo:dpo??null});
  } catch(e) {
    console.error('AI diet function failed',e?.name||'Error');
    return failure('Nutrition assistant is temporarily unavailable.',502);
  }
}
