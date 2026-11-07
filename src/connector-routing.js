export const GRID = 20;
export const snapValue = (value, enabled = true) =>
  enabled ? Math.round(value / GRID) * GRID : value;
export const snapPoint = (p, enabled = true) => ({
  x: snapValue(p.x, enabled),
  y: snapValue(p.y, enabled),
});
export const SIDES = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};
export function attachment(node, side, ratio = 0) {
  const v = SIDES[side],
    r = node.shape === "diamond" ? 0 : ratio;
  return {
    x: node.x + (v.x * node.width) / 2 + (v.y ? (r * node.width) / 2 : 0),
    y: node.y + (v.y * node.height) / 2 + (v.x ? (r * node.height) / 2 : 0),
  };
}
export function nearestAttachment(node, p) {
  const dx = (p.x - node.x) / (node.width / 2 || 1),
    dy = (p.y - node.y) / (node.height / 2 || 1);
  const side =
    Math.abs(dx) > Math.abs(dy)
      ? dx >= 0
        ? "right"
        : "left"
      : dy >= 0
        ? "bottom"
        : "top";
  return {
    side,
    ratio:
      node.shape === "diamond"
        ? 0
        : Math.max(-0.85, Math.min(0.85, SIDES[side].x ? dy : dx)),
  };
}
export function simplify(points) {
  const result = [];
  for (const p of points) {
    if (result.length && p.x === result.at(-1).x && p.y === result.at(-1).y)
      continue;
    while (result.length > 1) {
      const a = result.at(-2),
        b = result.at(-1);
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))
        result.pop();
      else break;
    }
    result.push({ ...p });
  }
  return result;
}
export function manualRoute(a, b, edge) {
  const first = edge.waypoints[0],
    last = edge.waypoints.at(-1),
    from = edge.fromSide || nearestAttachment(a, first).side,
    to = edge.toSide || nearestAttachment(b, last).side,
    start = attachment(a, from, edge.fromRatio),
    end = attachment(b, to, edge.toRatio);
  const result = [start];
  for (let i = 0; i < edge.waypoints.length; i++) {
    const p = edge.waypoints[i],
      prev = result.at(-1);
    if (prev.x !== p.x && prev.y !== p.y) {
      const horizontal =
        i === 0
          ? !!SIDES[from].x
          : result.length > 1
            ? result.at(-2).y === prev.y
            : Math.abs(p.x - prev.x) > Math.abs(p.y - prev.y);
      result.push(horizontal ? { x: p.x, y: prev.y } : { x: prev.x, y: p.y });
    }
    result.push({ ...p });
  }
  const prev = result.at(-1);
  if (prev.x !== end.x && prev.y !== end.y)
    result.push(
      SIDES[to].x ? { x: prev.x, y: end.y } : { x: end.x, y: prev.y },
    );
  result.push(end);
  return simplify(result);
}
export function dragSegment(original, index, p) {
  const points = original.map((p) => ({ ...p })),
    a = points[index],
    b = points[index + 1],
    horizontal = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
  if (points.length === 2)
    return horizontal
      ? [points[0], { x: a.x, y: p.y }, { x: b.x, y: p.y }, points[1]]
      : [points[0], { x: p.x, y: a.y }, { x: p.x, y: b.y }, points[1]];
  if (index === 0 || index === points.length - 2) {
    const shiftedA = horizontal ? { x: a.x, y: p.y } : { x: p.x, y: a.y },
      shiftedB = horizontal ? { x: b.x, y: p.y } : { x: p.x, y: b.y };
    return index === 0
      ? [a, shiftedA, shiftedB, ...points.slice(1)]
      : [...points.slice(0, -1), shiftedA, shiftedB, b];
  }
  if (horizontal) {
    a.y = p.y;
    b.y = p.y;
  } else {
    a.x = p.x;
    b.x = p.x;
  }
  return points;
}
export function dragBend(original, index, p) {
  const points = original.map((p) => ({ ...p })),
    before = points[index - 1],
    at = points[index],
    after = points[index + 1],
    leftHorizontal = before.y === at.y,
    rightHorizontal = after.y === at.y;
  points[index] = { ...p };
  if (index > 1) {
    if (leftHorizontal) before.y = p.y;
    else before.x = p.x;
  }
  if (index < points.length - 2) {
    if (rightHorizontal) after.y = p.y;
    else after.x = p.x;
  }
  return points;
}
export function pathMidpoint(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  let half = length / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (half <= segment)
      return {
        x: a.x + (b.x - a.x) * (segment ? half / segment : 0),
        y: a.y + (b.y - a.y) * (segment ? half / segment : 0),
      };
    half -= segment;
  }
  return points[0];
}
export function pathGeometry(points) {
  return {
    points,
    d: points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" "),
    label: pathMidpoint(points),
  };
}
export function edgeLink(item) {
  return (
    item?.link ||
    item?.label?.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/)?.[1] ||
    null
  );
}
