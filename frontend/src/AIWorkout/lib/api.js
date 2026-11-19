import {aiRequestHeaders} from '../../lib/aiAuth.js';

// Calls the same-origin Cloudflare Pages Function. The Gemini API key never
// appears in a browser bundle, request body, or browser storage.
export async function generateWorkout(options) {
  let res;
  try {
    res=await fetch('/api/ai-workout',{
      method:'POST',
      headers:await aiRequestHeaders(),
      body:JSON.stringify(options),
    });
  } catch(e) {
    if(e?.message?.includes('Sign in')) throw e;
    throw new Error('Could not reach the workout service. Check your connection.');
  }
  const result=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(result.detail||'Workout generation is currently unavailable.');
  if(!result?.title||!Array.isArray(result?.blocks)) throw new Error('Incomplete workout returned.');
  return result;
}

// Multi-week program from the same Cloudflare Function (mode: "program").
// The server normalizes the reply so every week has notes and every exercise has weekly sets/reps.
export async function generateProgram(options) {
  let res;
  try {
    res=await fetch('/api/ai-workout',{
      method:'POST',
      headers:await aiRequestHeaders(),
      body:JSON.stringify({...options,mode:'program'}),
    });
  } catch(e) {
    if(e?.message?.includes('Sign in')) throw e;
    throw new Error('Could not reach the workout service. Check your connection.');
  }
  const result=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(result.detail||'Program generation is currently unavailable.');
  if(result?.type!=='program'||!Array.isArray(result?.days)||!result.days.length||!Array.isArray(result?.weekNotes)) {
    throw new Error('Incomplete program returned. Please retry.');
  }
  return result;
}
