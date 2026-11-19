import { useEffect, useRef, useState } from 'react';
import { FormAnalysis, drawPose, MAX_FRAME_AGE_MS } from './formAnalysis';
import './liveForm.css';

export default function BrowserCamera({ exercise, onRep, resetToken }) {
  const videoRef = useRef(null), canvasRef = useRef(null), active = useRef(null);
  const exerciseRef = useRef(exercise), onRepRef = useRef(onRep);
  const contextRef=useRef(`${exercise}:${resetToken}`);
  const [running,setRunning] = useState(false), [starting,setStarting] = useState(false);
  const [error,setError] = useState(''), [feedback,setFeedback] = useState({state:'uncertain',message:'Start the camera to check your movement.'});
  useEffect(() => { exerciseRef.current=exercise; onRepRef.current=onRep; }, [exercise,onRep]);
  useEffect(() => {
    contextRef.current=`${exercise}:${resetToken}`;
    const task=active.current;
    if (task) {
      task.analysis.pause(); task.shown=false;
      const canvas=canvasRef.current; canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    }
  }, [exercise,resetToken]);
  function publishFeedback(next) {
    const context=contextRef.current;
    setFeedback(previous=>previous.state===next.state && previous.message===next.message && previous.context===context
      ? previous : {state:next.state,message:next.message,context});
  }
  const displayedFeedback=feedback.context && feedback.context!==`${exercise}:${resetToken}`
    ? {state:'uncertain',message:'Waiting for a fresh movement check.'} : feedback;
  function stop() {
    const task=active.current;
    active.current=null;
    if (task) {
      task.worker?.terminate(); task.stream?.getTracks().forEach(track=>track.stop());
      cancelAnimationFrame(task.raf); clearTimeout(task.startTimer);
    }
    if (videoRef.current) videoRef.current.srcObject=null;
    const canvas=canvasRef.current;
    canvas?.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    setRunning(false); setStarting(false);
    publishFeedback({state:'uncertain',message:'Camera stopped.'});
  }
  useEffect(() => () => {
    const task=active.current; active.current=null;
    task?.worker?.terminate(); task?.stream?.getTracks().forEach(t=>t.stop());
    cancelAnimationFrame(task?.raf); clearTimeout(task?.startTimer);
  }, []);
  async function start() {
    if (active.current) return;
    const task={analysis:new FormAnalysis(),busy:false,ready:false,lastVideoTime:-1,lastResult:0,lastSent:0,shown:false};
    active.current=task; setStarting(true); setError('');
    publishFeedback({state:'uncertain',message:'Preparing on-device tracking…'});
    const fail = (message) => { if (active.current===task) { stop(); setError(message); } };
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap) throw new Error('This browser needs secure camera and worker support. Try a current Chrome, Edge or Safari browser over HTTPS.');
      task.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:540},frameRate:{ideal:30}},audio:false});
      if (active.current!==task) { task.stream.getTracks().forEach(t=>t.stop()); return; }
      const video=videoRef.current;
      video.srcObject=task.stream; await video.play();
      if (active.current!==task) return;
      task.stream.getVideoTracks()[0].onended=()=>fail('Camera disconnected. Press Start camera to reconnect.');
      task.worker=new Worker(new URL('pose-worker.js',document.baseURI));
      task.startTimer=setTimeout(()=>fail('Tracking could not start. Check the connection while the model downloads, then try again.'),60000);
      task.worker.onerror=()=>fail('On-device tracking could not run in this browser. Try a current Chrome, Edge or Safari browser.');
      task.worker.onmessage=({data})=>{
        if (active.current!==task) { data.bitmap?.close(); return; }
        if (data.type==='error') { fail(`Tracking stopped: ${data.message}`); return; }
        if (data.type==='ready') {
          clearTimeout(task.startTimer); task.ready=true; task.delegate=data.delegate;
          setStarting(false); setRunning(true);
          publishFeedback({state:'uncertain',message:'Face the camera with your whole body and both feet visible, then stand normally for a moment.'});
          return;
        }
        if (data.type!=='result') return;
        task.busy=false;
        const now=performance.now(), canvas=canvasRef.current, ctx=canvas.getContext('2d');
        const age=now-data.capturedAt;
        const result=task.analysis.analyze(data.landmarks,data.bitmap.width,data.bitmap.height,data.capturedAt,now,exerciseRef.current==='Squat'?'Squat':'Preview');
        task.lastResult=data.capturedAt;
        if (!document.hidden && age<=MAX_FRAME_AGE_MS) {
          canvas.width=data.bitmap.width; canvas.height=data.bitmap.height;
          ctx.save(); ctx.translate(canvas.width,0); ctx.scale(-1,1);
          ctx.drawImage(data.bitmap,0,0); drawPose(ctx,result); ctx.restore(); task.shown=true;
          if (result.rep) onRepRef.current?.();
          publishFeedback(result);
        } else {
          ctx.clearRect(0,0,canvas.width,canvas.height); task.shown=false; task.analysis.pause();
          publishFeedback({state:'uncertain',message:'Tracking delayed. Form feedback paused; live preview continues.'});
        }
        data.bitmap.close();
        task.slowFrames=data.inferenceMs>MAX_FRAME_AGE_MS ? (task.slowFrames ?? 0)+1 : 0;
        if (task.delegate==='GPU' && task.slowFrames>=3) {
          //software graphics can start fine but still run slower than CPU inference through WASM
          task.ready=false; task.analysis.pause();
          task.worker.postMessage({type:'useCPU'});
          task.startTimer=setTimeout(()=>fail('Tracking could not restart. Press Start camera to retry.'),60000);
        }
      };
      task.worker.postMessage({type:'init'});
      const tick=async()=>{
        if (active.current!==task) return;
        task.raf=requestAnimationFrame(tick);
        const now=performance.now();
        if (task.shown && (document.hidden || now-task.lastResult>MAX_FRAME_AGE_MS)) {
          const c=canvasRef.current; c.getContext('2d').clearRect(0,0,c.width,c.height);
          task.shown=false; task.analysis.pause();
          publishFeedback({state:'uncertain',message:'Tracking uncertain. Feedback paused until fresh frames arrive.'});
        }
        if (!task.ready || task.busy || document.hidden || video.readyState<2 || video.currentTime===task.lastVideoTime || now-task.lastSent<33) return;
        task.busy=true; task.lastVideoTime=video.currentTime; task.lastSent=now;
        try {
          const bitmap=await createImageBitmap(video);
          if (active.current!==task) { bitmap.close(); return; }
          task.worker.postMessage({type:'frame',bitmap,capturedAt:now},[bitmap]);
        } catch (e) { fail(`Camera frame unavailable: ${e.message}`); }
      };
      task.raf=requestAnimationFrame(tick);
    } catch(e) { fail(e.message); }
  }
  return <div className="live-form-camera">
    <div className="live-form-stage">
      <video ref={videoRef} muted playsInline aria-label="Live mirrored camera preview" />
      <canvas ref={canvasRef} aria-label="Tracked skeleton and body alignment" />
      {!running && !starting && <p className="live-form-placeholder">Your camera preview appears here</p>}
    </div>
    <div className="live-form-controls">
      <button className="cam-btn cam-btn--primary" onClick={running || starting ? stop : start}>{starting ? 'Cancel startup' : running ? 'Stop camera' : 'Start camera'}</button>
      <p>Camera processing stays on this device. No calibration needed.</p>
    </div>
    <p className={`live-form-feedback live-form-feedback--${displayedFeedback.state}`} role="status">{displayedFeedback.message}</p>
    <p className="live-form-legend">Green: inward-knee check passed · Red: possible inward drift · Gray: unassessed or uncertain</p>
    {error && <p className="camera-error" role="alert">{error}</p>}
  </div>;
}
