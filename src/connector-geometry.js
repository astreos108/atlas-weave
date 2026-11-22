import { avoidObstacles, crossesBox } from "./smart-routing.js";
import {
  attachment,
  manualRoute,
  nearestAttachment,
  pathGeometry,
  pathMidpoint,
  SIDES,
  simplify,
} from "./connector-routing.js";

export function boundary(node, toward) {
  const dx = toward.x - node.x,
    dy = toward.y - node.y;
  if (!dx && !dy) return { x: node.x, y: node.y };
  const hw = Math.max(1, node.width / 2),
    hh = Math.max(1, node.height / 2);
  const t =
    node.shape === "diamond"
      ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
      : Math.min(
          dx ? hw / Math.abs(dx) : Infinity,
          dy ? hh / Math.abs(dy) : Infinity,
        );
  return { x: node.x + dx * t, y: node.y + dy * t };
}
function leavesPort(from, to, normal) {
  return !!to && (to.x - from.x) * normal.x + (to.y - from.y) * normal.y > 0;
}

function clearsEndpointBoxes(points, a, b, from, to) {
  return (
    points.length > 1 &&
    leavesPort(points[0], points[1], from) &&
    leavesPort(points.at(-1), points.at(-2), to) &&
    points
      .slice(1)
      .every(
        (point, i) =>
          !crossesBox(points[i], point, a, 0) &&
          !crossesBox(points[i], point, b, 0),
      )
  );
}

function detourEndpoints(a, b, start, p, q, end, from, to) {
  const xs = [
    Math.min(a.x - a.width / 2, b.x - b.width / 2) - 45,
    Math.max(a.x + a.width / 2, b.x + b.width / 2) + 45,
  ];
  const ys = [
    Math.min(a.y - a.height / 2, b.y - b.height / 2) - 45,
    Math.max(a.y + a.height / 2, b.y + b.height / 2) + 45,
  ];
  const candidates = [
    [{ x: p.x, y: q.y }],
    [{ x: q.x, y: p.y }],
    ...xs.map((x) => [
      { x, y: p.y },
      { x, y: q.y },
    ]),
    ...ys.map((y) => [
      { x: p.x, y },
      { x: q.x, y },
    ]),
  ];
  for (const x of xs)
    for (const y of ys) {
      candidates.push([
        { x, y: p.y },
        { x, y },
        { x: q.x, y },
      ]);
      candidates.push([
        { x: p.x, y },
        { x, y },
        { x, y: q.y },
      ]);
    }
  let best = null,
    bestCost = Infinity;
  for (const turns of candidates) {
    const points = [start, p, ...turns, q, end];
    const compact = simplify(points);
    if (!clearsEndpointBoxes(compact, a, b, from, to)) continue;
    const cost = compact
      .slice(1)
      .reduce(
        (length, point, i) =>
          length +
          Math.hypot(point.x - compact[i].x, point.y - compact[i].y) +
          12,
        0,
      );
    if (cost < bestCost) {
      best = points;
      bestCost = cost;
    }
  }
  return best;
}

function portLead(port, normal, other, distance) {
  const axis = normal.x ? "x" : "y";
  const across = axis === "x" ? "y" : "x";
  const span = axis === "x" ? other.width : other.height;
  const acrossSpan = axis === "x" ? other.height : other.width;
  const gap = (other[axis] - port[axis]) * normal[axis] - span / 2;
  const limit =
    Math.abs(port[across] - other[across]) < acrossSpan / 2 && gap > 0
      ? Math.min(distance, gap / 2)
      : distance;
  return { x: port.x + normal.x * limit, y: port.y + normal.y * limit };
}

function autoWireGeometry(a, b, edge) {
  if (edge.routing === "orthogonal") {
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y),
      from =
        edge.fromSide ||
        (horizontal
          ? b.x >= a.x
            ? "right"
            : "left"
          : b.y >= a.y
            ? "bottom"
            : "top"),
      to =
        edge.toSide ||
        (horizontal
          ? b.x >= a.x
            ? "left"
            : "right"
          : b.y >= a.y
            ? "top"
            : "bottom");
    const start = attachment(a, from, edge.fromRatio),
      end = attachment(b, to, edge.toRatio),
      u = SIDES[from],
      v = SIDES[to],
      facingDistance = (end.x - start.x) * u.x + (end.y - start.y) * u.y,
      stub =
        u.x === -v.x && u.y === -v.y && facingDistance >= 0
          ? Math.min(28, facingDistance / 2)
          : 28,
      p = portLead(start, u, b, stub),
      q = portLead(end, v, a, stub);
    const between = (a, b) =>
      Math.max(
        Math.min(a, b),
        Math.min(Math.max(a, b), (a + b) / 2 + (edge._lane || 0)),
      );
    let middle;
    if (u.x && v.x) {
      if (u.x === -v.x && (q.x - p.x) * u.x >= 0) {
        const x = between(p.x, q.x);
        middle = [
          { x, y: p.y },
          { x, y: q.y },
        ];
      } else {
        const y = Math.min(a.y - a.height / 2, b.y - b.height / 2) - 45;
        middle = [
          { x: p.x, y },
          { x: q.x, y },
        ];
      }
    } else if (u.y && v.y) {
      if (u.y === -v.y && (q.y - p.y) * u.y >= 0) {
        const y = between(p.y, q.y);
        middle = [
          { x: p.x, y },
          { x: q.x, y },
        ];
      } else {
        const x = Math.max(a.x + a.width / 2, b.x + b.width / 2) + 45;
        middle = [
          { x, y: p.y },
          { x, y: q.y },
        ];
      }
    } else middle = [u.x ? { x: q.x, y: p.y } : { x: p.x, y: q.y }];
    let points = [start, p, ...middle, q, end];
    if (!clearsEndpointBoxes(simplify(points), a, b, u, v))
      points = detourEndpoints(a, b, start, p, q, end, u, v) || points;
    const label = pathMidpoint(points);
    return {
      d: points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" "),
      label,
      points,
    };
  }
  const start = edge.fromSide
      ? attachment(a, edge.fromSide, edge.fromRatio)
      : boundary(a, b),
    end = edge.toSide
      ? attachment(b, edge.toSide, edge.toRatio)
      : boundary(b, a);
  return {
    d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    points: [start, end],
  };
}
export function wireGeometry(a, b, self = false, edge = {}) {
  edge = {
    ...edge,
    fromSide:
      edge.fromSide ||
      (edge.fromRatio === 0 ? nearestAttachment(a, b).side : undefined),
    toSide:
      edge.toSide ||
      (edge.toRatio === 0 ? nearestAttachment(b, a).side : undefined),
  };
  let geo;
  if (edge.waypoints?.length) geo = pathGeometry(manualRoute(a, b, edge));
  else if (self) {
    const x = a.x + a.width / 2,
      y = a.y;
    geo = pathGeometry([
      { x, y: y - 12 },
      { x: x + 65, y: y - 12 },
      { x: x + 65, y: y + a.height / 2 + 45 },
      { x: x + 30, y: y + a.height / 2 + 45 },
      { x: x + 30, y: y + 12 },
      { x, y: y + 12 },
    ]);
  } else {
    let routing = edge.routing;
    if (routing === "auto") {
      const {
        points: [start, end],
      } = autoWireGeometry(a, b, { ...edge, routing: "straight" });
      const dx = end.x - start.x,
        dy = end.y - start.y;
      const facing = (side, x, y) =>
        !side ||
        (SIDES[side].x
          ? y === 0 && x * SIDES[side].x > 0
          : x === 0 && y * SIDES[side].y > 0);
      routing =
        (dx === 0 || dy === 0) &&
        facing(edge.fromSide, dx, dy) &&
        facing(edge.toSide, -dx, -dy)
          ? "straight"
          : "orthogonal";
    }
    geo = autoWireGeometry(a, b, {
      ...edge,
      routing,
    });
  }
  geo.baseLabel = { ...geo.label };
  if (edge.labelOffset)
    geo.label = {
      x: geo.label.x + edge.labelOffset.x,
      y: geo.label.y + edge.labelOffset.y,
    };
  return geo;
}
export function routeConnection(a, b, edge, nodes, self = false) {
  let geo = wireGeometry(a, b, self, edge);
  if (edge.waypoints?.length || !["auto", "orthogonal"].includes(edge.routing))
    return geo;
  const obstacles = [...nodes].filter(
    (n) =>
      n !== a &&
      n !== b &&
      n.id !== edge.from &&
      n.id !== edge.to &&
      n.shape !== "frame",
  );
  if (
    edge.routing === "auto" &&
    geo.points.length === 2 &&
    obstacles.some((n) => crossesBox(geo.points[0], geo.points[1], n))
  )
    geo = wireGeometry(a, b, self, { ...edge, routing: "orthogonal" });
  if (geo.points.length > 2) {
    const initial = simplify(geo.points);
    const detour = simplify(avoidObstacles(geo.points, obstacles));
    const from = initial[1] && {
      x: initial[1].x - initial[0].x,
      y: initial[1].y - initial[0].y,
    };
    const last = initial.at(-1),
      previous = initial.at(-2);
    const to = previous && { x: previous.x - last.x, y: previous.y - last.y };
    geo.points =
      from && to && clearsEndpointBoxes(detour, a, b, from, to)
        ? detour
        : initial;
    if (geo.points.length === 1) geo.points.push({ ...geo.points[0] });
    geo.baseLabel = pathMidpoint(geo.points);
    geo.label = {
      x: geo.baseLabel.x + (edge.labelOffset?.x || 0),
      y: geo.baseLabel.y + (edge.labelOffset?.y || 0),
    };
  }
  return geo;
}
