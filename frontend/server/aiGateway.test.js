import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyObject,authorizeAndLimit,generateJson,featureSettings} from './aiGateway.js';

test('rejects oversized and invalid payloads',async()=>{
  assert.equal(await bodyObject(new Request('https://example.test',{method:'POST',body:'not-json'})),null);
  assert.equal(await bodyObject(new Request('https://example.test',{method:'POST',body:'{"a":1}'}),3),null);
});

test('fails closed if no authenticated user',async()=>{
  const result=await authorizeAndLimit(new Request('https://example.test/api/ai-diet',{method:'POST'}),{},'diet');
  assert.equal(result.response.status,401);
});

test('requires KV and a server secret even when a token is supplied',async()=>{
  const result=await authorizeAndLimit(new Request('https://example.test/api/ai-diet',{method:'POST',headers:{Authorization:'Bearer valid-token'}}),{
    VITE_SUPABASE_URL:'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public',
  },'diet');
  assert.equal(result.response.status,503);
});

test('enforces authenticated per-user daily quota and cooldown',async()=>{
  const original=globalThis.fetch;
  const memory=new Map();
  globalThis.fetch=async()=>Response.json({id:'user-1'});
  const env={
    VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public',
    DIETING_KEY:'diet-server-secret',WORKOUT_KEY:'workout-server-secret',
    AI_RATE_LIMITS:{
      get:async k=>JSON.parse(memory.get(k)||'null'),
      put:async(k,v)=>memory.set(k,v),
    },
  };
  try {
    const request=new Request('https://example.test/api/ai-diet',{method:'POST',headers:{Authorization:'Bearer demo-token'}});
    const first=await authorizeAndLimit(request,env,'diet');
    assert.equal(first.userId,'user-1');
    const second=await authorizeAndLimit(request,env);
    assert.equal(second.response.status,429);
  } finally{globalThis.fetch=original;}
});

test('reports upstream usage limit without exposing the secret',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response('',{status:429});
  try {
    const result=await generateJson({DIETING_KEY:'do-not-expose'},{feature:'diet',system:'system',prompt:'prompt'});
    assert.equal(result.response.status,429);
    assert.equal((await result.response.text()).includes('do-not-expose'),false);
  } finally{globalThis.fetch=original;}
});

test('selects different private keys for diet and workout without a shared key',()=>{
  const env={DIETING_KEY:'diet-secret',WORKOUT_KEY:'workout-secret',VITE_MODEL:'gemini-2.5-flash'};
  assert.deepEqual(featureSettings(env,'diet'),{apiKey:'diet-secret',model:'gemini-2.5-flash'});
  assert.deepEqual(featureSettings(env,'workout'),{apiKey:'workout-secret',model:'gemini-2.5-flash'});
  assert.throws(()=>featureSettings(env,'invalid'));
});

test('uses separate Gemini keys and optional model overrides on server calls',async()=>{
  const original=globalThis.fetch;
  const seen=[];
  globalThis.fetch=async(url,init)=>{
    seen.push({url:String(url),apiKey:init.headers['x-goog-api-key']});
    return Response.json({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]});
  };
  try {
    const env={DIETING_KEY:'private-diet',WORKOUT_KEY:'private-workout',
      DIETING_MODEL:'gemini-2.5-flash',WORKOUT_MODEL:'gemini-2.5-flash-lite'};
    const args={system:'system',prompt:'prompt'};
    assert.deepEqual((await generateJson(env,{...args,feature:'diet'})).data,{ok:true});
    assert.deepEqual((await generateJson(env,{...args,feature:'workout'})).data,{ok:true});
    assert.equal(seen[0].apiKey,'private-diet');
    assert.equal(seen[1].apiKey,'private-workout');
    assert.ok(seen[0].url.endsWith('/gemini-2.5-flash:generateContent'));
    assert.ok(seen[1].url.endsWith('/gemini-2.5-flash-lite:generateContent'));
  }finally{globalThis.fetch=original;}
});
