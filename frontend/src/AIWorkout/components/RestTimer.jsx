import { useEffect, useState } from "react";
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

/**
 * Bottom countdown bar.
 * @param {number|null} endAt  timestamp (ms) when the rest ends; null hides the bar
 * @param {() => void} onAddTime  adds 15 seconds
 * @param {() => void} onClose
 */
export default function RestTimer({ endAt, onAddTime, onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!endAt) return undefined;
    let beeped = false;
    const tick = () => {
      const left = Math.round((endAt - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0 && !beeped) {
        beeped = true;
        beep();
      }
    };
    const id = setInterval(tick, 250);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [endAt]);

  if (!endAt || secondsLeft === null) return null;

  return (
    <div className={`timer${secondsLeft <= 0 ? " over" : ""}`}>
      <span>Rest</span>
      <b>{fmtClock(secondsLeft)}</b>
      <button type="button" onClick={onAddTime}>+15s</button>
      <button type="button" onClick={onClose}>Done</button>
    </div>
  );
}
