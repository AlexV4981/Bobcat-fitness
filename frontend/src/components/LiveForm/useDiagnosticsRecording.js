import { useCallback, useEffect, useRef, useState } from 'react';
import { DiagnosticsRecording } from './diagnosticsRecording';

export default function useDiagnosticsRecording(exercise,resetToken,running) {
  const recording=useRef(null), [status,setStatus]=useState({phase:'idle',seconds:0,frames:0,report:null});
  const refresh=useCallback(()=>{
    const session=recording.current;
    if(!session)return;
    const now=performance.now();session.tick(now);
    const phase=session.phase(now);
    setStatus(previous=>phase==='complete' && previous.report?previous:({phase,seconds:Math.max(0,Math.ceil(((phase==='countdown'?session.startAt:session.endAt)-now)/1000)),
      frames:session.frames.length,report:session.finished?(previous.report ?? session.report()):null}));
  },[]);
  const finish=useCallback((reason='stopped')=>{
    const session=recording.current;
    if(!session || session.finished)return;
    session.finish(performance.now(),reason);refresh();
  },[refresh]);
  useEffect(()=>{
    const timer=setInterval(refresh,250);
    return()=>clearInterval(timer);
  },[refresh]);
  useEffect(()=>{
    if(!running)finish('camera_stopped');
  },[running,finish]);
  useEffect(()=>()=>finish('exercise_or_set_changed'),[exercise,resetToken,finish]);
  const begin=()=>{
    recording.current=new DiagnosticsRecording(exercise,performance.now(),navigator.userAgent);
    setStatus({phase:'countdown',seconds:5,frames:0,report:null});
  };
  const frame=useCallback((sample,now)=>recording.current?.append(sample,now),[]);
  const feedback=useCallback((next,now)=>recording.current?.noteFeedback(next,now),[]);
  return {...status,begin,finish,frame,feedback};
}
