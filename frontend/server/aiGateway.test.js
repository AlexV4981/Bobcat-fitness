import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyObject,authorizeAndLimit,generateJson} from './aiGateway.js';

test('rejects oversized and invalid payloads',async()=>{
  assert.equal(await bodyObject(new Request('https://example.test',{method:'POST',body:'not-json'})),null);
  assert.equal(await bodyObject(new Request('https://example.test',{method:'POST',body:'{"a":1}'}),3),null);
});

test('fails closed if no authenticated user',async()=>{
  const result=await authorizeAndLimit(new Request('https://example.test/api/ai-diet',{method:'POST'}),{});
  assert.equal(result.response.status,401);
});

test('requires KV and a server secret even when a token is supplied',async()=>{
  const result=await authorizeAndLimit(new Request('https://example.test/api/ai-diet',{method:'POST',headers:{Authorization:'Bearer valid-token'}}),{
    VITE_SUPABASE_URL:'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public',
  });
  assert.equal(result.response.status,503);
});

test('enforces authenticated per-user daily quota and cooldown',async()=>{
  const original=globalThis.fetch;
  const memory=new Map();
  globalThis.fetch=async()=>Response.json({id:'user-1'});
  const env={
    VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public',
    GEMINI_API_KEY:'server-secret',
    AI_RATE_LIMITS:{
      get:async k=>JSON.parse(memory.get(k)||'null'),
      put:async(k,v)=>memory.set(k,v),
    },
  };
  try {
    const request=new Request('https://example.test/api/ai-diet',{method:'POST',headers:{Authorization:'Bearer demo-token'}});
    const first=await authorizeAndLimit(request,env);
    assert.equal(first.userId,'user-1');
    const second=await authorizeAndLimit(request,env);
    assert.equal(second.response.status,429);
  } finally{globalThis.fetch=original;}
});

test('reports upstream usage limit without exposing the secret',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response('',{status:429});
  try {
    const result=await generateJson({GEMINI_API_KEY:'do-not-expose'},{system:'system',prompt:'prompt'});
    assert.equal(result.response.status,429);
    assert.equal((await result.response.text()).includes('do-not-expose'),false);
  } finally{globalThis.fetch=original;}
});
