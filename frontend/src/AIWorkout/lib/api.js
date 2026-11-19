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
