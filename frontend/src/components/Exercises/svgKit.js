/**
 * svgKit
 * ---------------------------------------------------------------------------
 * Shared helpers for the exercise form animations: indicator colors, tiny
 * SVG string builders, 2-bone IK, and the loop timing curve. No React, no DOM,
 * so everything here can be unit-tested in plain Node.
 *
 * Colors that carry meaning (good / bad / guide) are fixed hex values so they
 * read the same on every card tint. Everything else is a CSS variable defined
 * on `.fg` in ExerciseFormGuide.css, which falls back to the app tokens in
 * HomePage.css (--ink, --ink-soft, --bg, --surface, ...).
 */

export const G = "#1D9E75"; // good
export const R = "#E24B4A"; // mistake
export const B = "#378ADD"; // guide line / not yet evaluated
export const N = "var(--fg-soft)"; // neutral
export const TP = "var(--fg-ink)";
export const TS = "var(--fg-soft)";
export const SF = "var(--fg-fill)";
export const DASH = ' stroke-dasharray="6 5"';

export const fx = (n) => n.toFixed(1);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Angle in degrees at b, between segments b->a and b->c. */
export function ang(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const d = (v1x * v2x + v1y * v2y) / (Math.sqrt(v1x * v1x + v1y * v1y) * Math.sqrt(v2x * v2x + v2y * v2y));
  return Math.acos(Math.max(-1, Math.min(1, d))) * 57.296;
}

/** Two-bone IK: both candidate joint positions between A and C for bone lengths L1, L2. */
export function ik(A, C, L1, L2) {
  const dx = C.x - A.x, dy = C.y - A.y, D = Math.sqrt(dx * dx + dy * dy), d = Math.min(D, L1 + L2 - 0.01);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a)), ux = dx / D, uy = dy / D;
  return [{ x: A.x + ux * a - uy * h, y: A.y + uy * a + ux * h }, { x: A.x + ux * a + uy * h, y: A.y + uy * a - ux * h }];
}

const pt = (p) => fx(p.x) + "," + fx(p.y);

export const ln = (a, b, col, w, extra) =>
  '<line x1="' + fx(a.x) + '" y1="' + fx(a.y) + '" x2="' + fx(b.x) + '" y2="' + fx(b.y) + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"' + (extra || "") + "/>";

export const pl = (pts, col, w) =>
  '<polyline points="' + pts.map(pt).join(" ") + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';

export const ci = (p, r, fill, stroke, w) =>
  '<circle cx="' + fx(p.x) + '" cy="' + fx(p.y) + '" r="' + fx(r) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + w + '"/>';

export const tx = (x, y, s, anchor) =>
  '<text class="fg-label" x="' + fx(x) + '" y="' + fx(y) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : "") + ">" + s + "</text>";

export const ground = () =>
  '<line x1="100" y1="350" x2="600" y2="350" stroke="var(--fg-line)" stroke-width="1"/>';

/**
 * Loop progress p (0-1) -> eased movement amount t (0-1).
 * 0-36% going down/up, 36-50% hold, 50-86% return, 86-100% rest.
 */
export function tOf(p) {
  const e = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  if (p < 0.36) return e(p / 0.36);
  if (p < 0.5) return 1;
  if (p < 0.86) return 1 - e((p - 0.5) / 0.36);
  return 0;
}

/** Which of the 4 phase labels applies at (t, p). */
export function phaseIndex(t, p) {
  if (t < 0.03) return 0;
  if (p < 0.36) return 1;
  if (p < 0.5) return 2;
  if (p < 0.86) return 3;
  return 0;
}
