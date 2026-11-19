export const visible = (p) => Boolean(p && Number.isFinite(p.x) && Number.isFinite(p.y)
  && p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99
  && Number.isFinite(p.visibility) && p.visibility >= 0.75
  && (p.presence === undefined || p.presence >= 0.75));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function angle(a,b,c) {
  const ab = distance(a,b), cb = distance(c,b);
  if (ab < 1 || cb < 1) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, ((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))/(ab*cb))))*180/Math.PI;
}
export const unknown = (message, points = [], metrics = {}) => ({ state: 'uncertain', message, points, checkedEdges: [], phase: 'waiting', rep: false, metrics });
