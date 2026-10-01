import { useCallback, useEffect, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * useExerciseAnimation
 * ---------------------------------------------------------------------------
 * Drives the looping rep animation.
 *
 * @param {Object} [options]
 * @param {boolean} [options.autoPlay=true] - Play while true, pause while false.
 *   Reacts to changes (e.g. play on hover), but the user's own play/pause
 *   click wins until this prop changes again. Always paused when the user
 *   prefers reduced motion.
 * @param {number} [options.duration=6500] - Milliseconds per full rep loop.
 * @param {number} [options.startAt=0] - Initial loop position in [0, 1). Useful
 *   for a static thumbnail (0.43 is the bottom/top of the rep).
 * @returns {{ p: number, playing: boolean, toggle: () => void, scrub: (p: number) => void }}
 *   `p` is loop progress in [0, 1). `scrub` pauses and jumps to a position.
 */
export default function useExerciseAnimation({ autoPlay = true, duration = 6500, startAt = 0 } = {}) {
  const [p, setP] = useState(startAt);
  const [playing, setPlaying] = useState(() => autoPlay && !prefersReducedMotion());

  useEffect(() => {
    setPlaying(autoPlay && !prefersReducedMotion());
  }, [autoPlay]);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = 0;
    const tick = (ts) => {
      if (last) setP((prev) => (prev + (ts - last) / duration) % 1);
      last = ts;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  const toggle = useCallback(() => setPlaying((v) => !v), []);
  const scrub = useCallback((next) => {
    setPlaying(false);
    setP(next);
  }, []);

  return { p, playing, toggle, scrub };
}