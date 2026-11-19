// Server-only Cloudflare Pages Functions utility. NEVER import from src/ or bundle into Vite.
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
export function json(data,status=200) {return new Response(JSON.stringify(data),{status,headers});}
export function failure(message,status=400) {return json({detail:message},status);}
export async function bodyObject(request,maxBytes=12000) {
  const len=Number(request.headers.get('content-length')||'0');
  if(len>maxBytes) return null;
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>maxBytes) return null;
  try {const obj=JSON.parse(raw);return obj && typeof obj==='object' && !Array.isArray(obj)?obj:null;}
  catch {return null;}
}
export function limitedText(value,max) {return typeof value==='string'?value.trim().slice(0,max):'';}

// Each AI feature uses its OWN server-side Gemini secret: DIETING_KEY or WORKOUT_KEY.
// No API key is ever sent to the browser.
export function featureSettings(env,feature) {
  if(feature!=='diet' && feature!=='workout') throw new Error('Unsupported AI feature');
  const apiKey=feature==='diet'?env.DIETING_KEY:env.WORKOUT_KEY;
  const model=(feature==='diet'?env.DIETING_MODEL:env.WORKOUT_MODEL)||env.GEMINI_MODEL||env.VITE_MODEL||'gemini-2.5-flash';
  return {apiKey,model};
}

// Users must authenticate before making calls that consume someone else's Gemini quota.
// Cloudflare KV is a small, best-effort daily usage brake; its eventual consistency does
// not provide a strict globally atomic quota. Keep an upstream Gemini project quota too.
export async function authorizeAndLimit(request,env,feature) {
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) return {response:failure('Cross-origin requests are not permitted.',403)};
  const bearer=request.headers.get('authorization')||'';
  if(!/^Bearer [^\s]+$/i.test(bearer)) return {response:failure('Sign in to use AI features. Guest camera mode is still available.',401)};
  const url=env.VITE_SUPABASE_URL;
  const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const selected=featureSettings(env,feature);
  if(!url || !key || !selected.apiKey || !env.AI_RATE_LIMITS) {
    return {response:failure('AI service configuration is not complete.',503)};
  }
  let user;
  try {
    const r=await fetch(new URL('/auth/v1/user',url),{
      headers:{apikey:key,Authorization:bearer,Accept:'application/json'},
    });
    if(!r.ok) return {response:failure('Your session is invalid. Sign in again.',401)};
    user=await r.json();
    if(!user?.id) return {response:failure('Your session is invalid. Sign in again.',401)};
  } catch {return {response:failure('Authentication service temporarily unavailable.',503)};}
  const now=Date.now();
  const keyName='ai:'+user.id+':'+new Date(now).toISOString().slice(0,10);
  try {
    const count=(await env.AI_RATE_LIMITS.get(keyName,{type:'json'}))||{n:0,last:0};
    if(count.n>=6) return {response:failure('Daily AI demo limit reached. Try again tomorrow.',429)};
    if(now-count.last<12000) return {response:failure('Please wait a few seconds before another AI request.',429)};
    // Demo-scale, approximate limit; parallel requests can race because KV is eventually consistent.
    await env.AI_RATE_LIMITS.put(keyName,JSON.stringify({n:count.n+1,last:now}),{expirationTtl:172800});
  } catch {return {response:failure('AI usage protection is unavailable.',503)};}
  return {userId:user.id};
}

export async function generateJson(env,{feature,system,prompt,maxTokens=1800,temperature=0.5}) {
  const {apiKey,model}=featureSettings(env,feature);
  if(!apiKey) throw Error('Missing private Gemini secret');
  if(!/^[a-zA-Z0-9._-]{3,80}$/.test(model)) throw Error('Invalid server-side model setting');
  const resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:system}]},
      contents:[{role:'user',parts:[{text:prompt}]}],
      generationConfig:{responseMimeType:'application/json',temperature,maxOutputTokens:maxTokens},
    }),
  });
  if(!resp.ok) {
    console.error('Gemini upstream status',resp.status);
    if(resp.status===429) return {response:failure('The AI provider is at its usage limit. Please try later.',429)};
    return {response:failure('The AI provider is currently unavailable.',502)};
  }
  const data=await resp.json();
  const content=(data?.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p.text==='string').map(p=>p.text).join('');
  try{return {data:JSON.parse(content)};} catch {return {response:failure('The AI returned an invalid response. Please retry.',502)};}
}
