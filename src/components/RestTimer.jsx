import { useEffect, useRef, useState } from "react";
import { fmtClock } from "../lib/format.js";

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    navigator.vibrate?.(300);
  } catch {
    /* audio not available */
  }
}

// `request` is { seconds, id } — a new id restarts the timer
export default function RestTimer({ request, onClose }) {
  const [endAt, setEndAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const beeped = useRef(false);

  useEffect(() => {
    if (!request) return;
    setEndAt(Date.now() + request.seconds * 1000);
    beeped.current = false;
  }, [request]);

  useEffect(() => {
    if (!endAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endAt]);

  if (!endAt) return null;

  const left = Math.round((endAt - now) / 1000);
  const over = left <= 0;
  if (over && !beeped.current) {
    beeped.current = true;
    beep();
  }

  const addTime = () => {
    setEndAt((e) => e + 15000);
    beeped.current = false;
  };

  const stop = () => {
    setEndAt(null);
    onClose();
  };

  return (
    <div className={`timer${over ? " over" : ""}`}>
      <span>Rest</span>
      <b>{fmtClock(left)}</b>
      <button type="button" onClick={addTime}>+15s</button>
      <button type="button" onClick={stop}>Done</button>
    </div>
  );
}
