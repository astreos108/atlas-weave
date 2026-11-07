import { simplify } from "./connector-routing.js";
export function crossesBox(a, b, n, pad = 12) {
  const left = n.x - n.width / 2 - pad,
    right = n.x + n.width / 2 + pad,
    top = n.y - n.height / 2 - pad,
    bottom = n.y + n.height / 2 + pad;
  return a.y === b.y
    ? a.y > top &&
        a.y < bottom &&
        Math.max(a.x, b.x) > left &&
        Math.min(a.x, b.x) < right
    : a.x === b.x
      ? a.x > left &&
        a.x < right &&
        Math.max(a.y, b.y) > top &&
        Math.min(a.y, b.y) < bottom
      : false;
}
export function avoidObstacles(points, obstacles) {
  const hits = (ps) =>
    obstacles.reduce(
      (sum, n) =>
        sum + ps.slice(1).filter((p, i) => crossesBox(ps[i], p, n)).length,
      0,
    );
  if (points.length < 3 || !obstacles.length || !hits(points)) return points;
  // Only actual blockers choose detour extents. A distant new thought must not
  // stretch existing routes to the bounds of the entire board.
  const blockers = obstacles.filter((n) =>
    points.slice(1).some((p, i) => crossesBox(points[i], p, n)),
  );
  const a = points[0],
    p = points[1],
    q = points.at(-2),
    b = points.at(-1),
    xs = blockers.flatMap((n) => [
      n.x - n.width / 2 - 24,
      n.x + n.width / 2 + 24,
    ]),
    ys = blockers.flatMap((n) => [
      n.y - n.height / 2 - 24,
      n.y + n.height / 2 + 24,
    ]);
  let best = points,
    score = Infinity;
  const candidates = [points];
  for (const x of [Math.min(...xs), Math.max(...xs)])
    candidates.push([a, p, { x, y: p.y }, { x, y: q.y }, q, b]);
  for (const y of [Math.min(...ys), Math.max(...ys)])
    candidates.push([a, p, { x: p.x, y }, { x: q.x, y }, q, b]);
  for (const candidate of candidates) {
    const ps = simplify(candidate),
      length = ps
        .slice(1)
        .reduce((s, p, i) => s + Math.hypot(p.x - ps[i].x, p.y - ps[i].y), 0),
      s = hits(ps) * 1e7 + length + ps.length * 8;
    if (s < score) {
      score = s;
      best = ps;
    }
  }
  return best;
}
export function roundedPath(points, radius = 9) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1],
      u = Math.hypot(b.x - a.x, b.y - a.y),
      v = Math.hypot(c.x - b.x, c.y - b.y),
      r = Math.min(radius, u / 2, v / 2);
    if (!u || !v) continue;
    const p = {
        x: b.x + ((a.x - b.x) * r) / u,
        y: b.y + ((a.y - b.y) * r) / u,
      },
      q = { x: b.x + ((c.x - b.x) * r) / v, y: b.y + ((c.y - b.y) * r) / v };
    d += ` L ${p.x} ${p.y} Q ${b.x} ${b.y} ${q.x} ${q.y}`;
  }
  return d + ` L ${points.at(-1).x} ${points.at(-1).y}`;
}
