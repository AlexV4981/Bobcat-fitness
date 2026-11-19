import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProgram,programPrompt,PROGRAM_SCHEMA} from './workoutProgram.js';
import {onRequestPost} from '../functions/api/ai-workout.js';

const wk=(...pairs)=>pairs.map(([sets,reps])=>({sets,reps}));
const rawProgram=(weekly,notes)=>({
  title:'Test Plan',summary:'s',intensity:'Moderate',progression:'Add reps.',
  weekNotes:notes,
  days:[{name:'Day 1',focus:'Upper',durationMin:45,warmup:[{name:'Jog',detail:'2 min'}],
    blocks:[{name:'Main',rounds:1,exercises:[{name:'Row',restSec:60,cue:'Brace.',weekly}]}],
    cooldown:[{name:'Stretch',detail:'1 min'}]}],
});

test('pads short programs from the last normal week, not the deload week',()=>{
  const notes=[{focus:'a',note:'',deload:false},{focus:'b',note:'',deload:false},{focus:'c',note:'',deload:false},{focus:'d',note:'',deload:true}];
  const p=normalizeProgram(rawProgram(wk([3,'8'],[3,'10'],[4,'10'],[2,'8']),notes),6);
  assert.equal(p.weekNotes.length,6);
  assert.equal(p.weekNotes[5].deload,false);
  const weekly=p.days[0].blocks[0].exercises[0].weekly;
  assert.equal(weekly.length,6);
  assert.deepEqual(weekly[5],{sets:4,reps:'10'});
});

test('trims programs that run longer than requested',()=>{
  const notes=Array.from({length:8},(_,i)=>({focus:'w'+i,note:'',deload:false}));
  const p=normalizeProgram(rawProgram(wk(...Array.from({length:8},()=>[3,'8'])),notes),4);
  assert.equal(p.weekNotes.length,4);
  assert.equal(p.days[0].blocks[0].exercises[0].weekly.length,4);
});

test('circuits always use one set per round',()=>{
  const raw=rawProgram(wk([3,'10']),[{focus:'a',note:'',deload:false}]);
  raw.days[0].blocks[0].rounds=3;
  const p=normalizeProgram(raw,2);
  assert.deepEqual(p.days[0].blocks[0].exercises[0].weekly.map(w=>w.sets),[1,1]);
});

test('rejects replies that are not a usable program',()=>{
  assert.equal(normalizeProgram(null,4),null);
  assert.equal(normalizeProgram({title:'x',days:[]},4),null);
  assert.equal(normalizeProgram({title:'x',days:[{name:'d',blocks:[{exercises:[{name:''}]}]}]},4),null);
});

test('prompt names weeks and days; schema requires weekly progression',()=>{
  const prompt=programPrompt({weeks:6,daysPerWeek:4,goal:'strength',focus:'full body',level:'beginner',duration:45,equipment:['dumbbells'],notes:''});
  assert.match(prompt,/Weeks: 6/);
  assert.match(prompt,/Training days per week: 4/);
  const ex=PROGRAM_SCHEMA.properties.days.items.properties.blocks.items.properties.exercises.items;
  assert.ok(ex.required.includes('weekly'));
});

// Full function: signed-in user, KV limiter, Gemini reply, all faked.
function fakeEnv() {
  const memory=new Map();
  return {
    VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public',
    WORKOUT_KEY:'workout-secret',
    AI_RATE_LIMITS:{get:async k=>JSON.parse(memory.get(k)||'null'),put:async(k,v)=>memory.set(k,v)},
  };
}
const request=(body)=>new Request('https://example.test/api/ai-workout',{
  method:'POST',headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify(body),
});
const base={goal:'strength',focus:'full body',level:'intermediate',duration:45,equipment:['dumbbells'],notes:''};

test('program mode sends a schema and returns a normalized program',async()=>{
  const original=globalThis.fetch;
  let geminiBody;
  globalThis.fetch=async(url,init)=>{
    if(String(url).includes('/auth/v1/user')) return Response.json({id:'user-1'});
    geminiBody=JSON.parse(init.body);
    const raw=rawProgram(wk([3,'8']),[{focus:'a',note:'',deload:false}]);
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(raw)}]}}]});
  };
  try {
    const res=await onRequestPost({request:request({...base,mode:'program',weeks:5,daysPerWeek:3}),env:fakeEnv()});
    assert.equal(res.status,200);
    const p=await res.json();
    assert.equal(p.type,'program');
    assert.equal(p.weeks,5);
    assert.equal(p.weekNotes.length,5);
    assert.ok(geminiBody.generationConfig.responseSchema);
    assert.match(geminiBody.contents[0].parts[0].text,/Training days per week: 3/);
    assert.equal(JSON.stringify(p).includes('workout-secret'),false);
  } finally{globalThis.fetch=original;}
});

test('program mode clamps weeks and days to safe ranges',async()=>{
  const original=globalThis.fetch;
  let prompt;
  globalThis.fetch=async(url,init)=>{
    if(String(url).includes('/auth/v1/user')) return Response.json({id:'user-1'});
    prompt=JSON.parse(init.body).contents[0].parts[0].text;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(rawProgram(wk([3,'8']),[]))}]}}]});
  };
  try {
    const res=await onRequestPost({request:request({...base,mode:'program',weeks:99,daysPerWeek:1}),env:fakeEnv()});
    assert.equal((await res.json()).weeks,12);
    assert.match(prompt,/Weeks: 12/);
    assert.match(prompt,/Training days per week: 2/);
  } finally{globalThis.fetch=original;}
});

test('program mode still requires sign-in',async()=>{
  const req=new Request('https://example.test/api/ai-workout',{method:'POST',body:JSON.stringify({...base,mode:'program'})});
  const res=await onRequestPost({request:req,env:fakeEnv()});
  assert.equal(res.status,401);
});

test('a garbled program reply becomes a clear 502',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url)=>String(url).includes('/auth/v1/user')
    ?Response.json({id:'user-1'})
    :Response.json({candidates:[{content:{parts:[{text:'{"title":"x","days":[]}'}]}}]});
  try {
    const res=await onRequestPost({request:request({...base,mode:'program'}),env:fakeEnv()});
    assert.equal(res.status,502);
  } finally{globalThis.fetch=original;}
});

test('single workouts are unchanged and send no schema',async()=>{
  const original=globalThis.fetch;
  let geminiBody;
  globalThis.fetch=async(url,init)=>{
    if(String(url).includes('/auth/v1/user')) return Response.json({id:'user-1'});
    geminiBody=JSON.parse(init.body);
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({title:'One',warmup:[],blocks:[],cooldown:[]})}]}}]});
  };
  try {
    const res=await onRequestPost({request:request(base),env:fakeEnv()});
    assert.equal(res.status,200);
    assert.equal((await res.json()).title,'One');
    assert.equal(geminiBody.generationConfig.responseSchema,undefined);
  } finally{globalThis.fetch=original;}
});
