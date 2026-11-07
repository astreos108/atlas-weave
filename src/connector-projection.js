import { simplify } from "./connector-routing.js";
/** Ports and lanes are a projection. Explicit saved attachment ratios remain authoritative. */
export function projectedEdges(edges, nodes) {
  const result = edges.map((e) => ({ ...e })),
    groups = new Map();
  for (const [index, e] of result.entries()) {
    const a = nodes.get(e.from),
      b = nodes.get(e.to);
    if (!a || !b) continue;
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    for (const [prefix, n, other, side] of [
      [
        "from",
        a,
        b,
        e.fromSide ||
          (horizontal
            ? b.x >= a.x
              ? "right"
              : "left"
            : b.y >= a.y
              ? "bottom"
              : "top"),
      ],
      [
        "to",
        b,
        a,
        e.toSide ||
          (horizontal
            ? b.x >= a.x
              ? "left"
              : "right"
            : b.y >= a.y
              ? "top"
              : "bottom"),
      ],
    ]) {
      e[prefix + "Side"] = side;
      const key = n.id + ":" + side;
      const bucket = groups.get(key) || [];
      bucket.push({
        index,
        prefix,
        coordinate: ["left", "right"].includes(side) ? other.y : other.x,
      });
      groups.set(key, bucket);
    }
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.coordinate - b.coordinate || a.index - b.index);
    group.forEach((slot, i) => {
      const e = result[slot.index];
      if (e[slot.prefix + "Ratio"] === undefined)
        e[slot.prefix + "Ratio"] =
          group.length === 1
            ? 0
            : (i - (group.length - 1) / 2) *
              Math.min(0.32, 1.4 / (group.length - 1));
      e._lane = (e._lane || 0) + (i - (group.length - 1) / 2) * 18;
    });
  }
  return result;
}
export function insetEndpoints(points, gap = 9) {
  if (points.length < 2) return points;
  const ps = points.map((p) => ({ ...p }));
  for (const [i, j] of [
    [0, 1],
    [ps.length - 1, ps.length - 2],
  ]) {
    const a = ps[i],
      b = points[j],
      distance = Math.hypot(b.x - a.x, b.y - a.y),
      d = Math.min(gap, distance / 3);
    if (distance) {
      a.x += ((b.x - a.x) * d) / distance;
      a.y += ((b.y - a.y) * d) / distance;
    }
  }
  return ps;
}
export function separateLane(points, previous) {
  if (points.length < 4) return points;
  const overlap = (ps) => {
    let count = 0;
    for (let i = 1; i < ps.length - 2; i++) {
      const a = ps[i],
        b = ps[i + 1];
      for (const route of previous)
        for (let j = 0; j < route.length - 1; j++) {
          const c = route[j],
            d = route[j + 1];
          if (
            (a.x === b.x &&
              c.x === d.x &&
              a.x === c.x &&
              Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
                Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) >
                12) ||
            (a.y === b.y &&
              c.y === d.y &&
              a.y === c.y &&
              Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
                Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) >
                12)
          )
            count++;
        }
    }
    return count;
  };
  if (!overlap(points)) return points;
  let best = points,
    score = overlap(points);
  for (const distance of [16, -16, 32, -32, 48, -48]) {
    const candidate = points.map((p) => ({ ...p }));
    for (let i = 1; i < candidate.length - 2; i++) {
      const a = candidate[i],
        b = candidate[i + 1];
      if (a.x === b.x) {
        a.x += distance;
        b.x += distance;
      } else if (a.y === b.y) {
        a.y += distance;
        b.y += distance;
      }
    }
    const n = overlap(candidate);
    if (n < score) {
      best = candidate;
      score = n;
    }
    if (!n) break;
  }
  return simplify(best);
}
/** Horizontal crossings hop over earlier vertical lines; endpoints/junctions never hop. */
export function connectorPath(points, previous, radius = 9) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i],
      end = points[i + 1],
      length = Math.hypot(end.x - start.x, end.y - start.y),
      next = points[i + 2],
      previousPoint = points[i - 1],
      startR = previousPoint
        ? Math.min(
            radius,
            length / 2,
            Math.hypot(start.x - previousPoint.x, start.y - previousPoint.y) /
              2,
          )
        : 0,
      endR = next
        ? Math.min(
            radius,
            length / 2,
            Math.hypot(next.x - end.x, next.y - end.y) / 2,
          )
        : 0;
    if (!length) continue;
    const finish = {
      x: end.x + ((start.x - end.x) * endR) / length,
      y: end.y + ((start.y - end.y) * endR) / length,
    };
    if (start.y === end.y) {
      const direction = Math.sign(end.x - start.x),
        min = Math.min(start.x, end.x) + startR + 9,
        max = Math.max(start.x, end.x) - endR - 9,
        crossings = [];
      for (const route of previous)
        for (let j = 0; j < route.length - 1; j++) {
          const a = route[j],
            b = route[j + 1];
          if (
            a.x === b.x &&
            a.x > min &&
            a.x < max &&
            start.y > Math.min(a.y, b.y) + 9 &&
            start.y < Math.max(a.y, b.y) - 9 &&
            !crossings.some((x) => Math.abs(x - a.x) < 16)
          )
            crossings.push(a.x);
        }
      crossings.sort((a, b) => (a - b) * direction);
      for (const x of crossings)
        d += ` L ${x - direction * 6} ${start.y} Q ${x} ${start.y - 11} ${x + direction * 6} ${start.y}`;
    }
    d += ` L ${finish.x} ${finish.y}`;
    if (next) {
      const nextLength = Math.hypot(next.x - end.x, next.y - end.y);
      if (nextLength)
        d += ` Q ${end.x} ${end.y} ${end.x + ((next.x - end.x) * endR) / nextLength} ${end.y + ((next.y - end.y) * endR) / nextLength}`;
    }
  }
  return d;
}
