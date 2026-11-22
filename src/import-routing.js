import { frameOwners } from "./domain/board-actions.js";
import {
  attachment,
  pathMidpoint,
  SIDES,
  simplify,
} from "./connector-routing.js";
import { crossesBox } from "./smart-routing.js";

// Reserve routes above and below horizontal groups (beside vertical groups).
// Keep the bends as editable waypoints in the pasted board.
export function routeImportedFrames(model, nodes) {
  const owners = frameOwners(model, nodes);
  const root = (id) => {
    while (owners.has(id)) id = owners.get(id).id;
    return id;
  };
  const vertical = ["TB", "TD", "BT"].includes(model.direction);
  const along = vertical ? "y" : "x";
  const across = vertical ? "x" : "y";
  const span = vertical ? "width" : "height";
  const shapes = [...nodes.values()].filter((node) => node.shape !== "frame");
  const ports = new Map();
  const lanes = [[], []];
  const bounds = [-1, 1].map((sign) =>
    Math.max(...[...nodes.values()].map((n) => n[across] * sign + n[span] / 2)),
  );
  const point = (a, b) => ({ [along]: a, [across]: b });
  const edges = model.edges.filter(
    (edge) =>
      !edge.waypoints?.length &&
      root(edge.from) !== root(edge.to) &&
      (owners.has(edge.from) ||
        owners.has(edge.to) ||
        nodes.get(edge.from)?.shape === "frame" ||
        nodes.get(edge.to)?.shape === "frame"),
  );
  edges.sort((a, b) => {
    const distance = (e) =>
      Math.abs(nodes.get(e.from)[along] - nodes.get(e.to)[along]);
    return distance(a) - distance(b);
  });
  function exit(node, lane, side, obstacles, toward) {
    const choices = [
      side,
      ...(vertical ? ["top", "bottom"] : ["left", "right"]),
    ];
    let best;
    for (const face of choices) {
      const key = node.id + ":" + face;
      const used = ports.get(key) || 0;
      const ratio =
        node.shape === "diamond"
          ? 0
          : [0, 0.28, -0.28, 0.54, -0.54, 0.76, -0.76][used % 7];
      const start = attachment(node, face, ratio);
      const normal = SIDES[face];
      const lead =
        face === side
          ? start
          : {
              x: start.x + normal.x * (22 + used * 8),
              y: start.y + normal.y * (22 + used * 8),
            };
      const end = point(lead[along], lane);
      const path = simplify([start, lead, end]);
      const hits = obstacles.reduce(
        (total, obstacle) =>
          total +
          path.slice(1).filter((p, i) => crossesBox(path[i], p, obstacle, 6))
            .length,
        0,
      );
      const score =
        hits * 1000000 +
        Math.abs(lead[along] - toward) * 0.08 +
        (face === side ? 0 : 38) +
        used * 8;
      if (!best || score < best.score)
        best = { face, ratio, key, path, end, score };
    }
    return best;
  }
  for (const [index, edge] of edges.entries()) {
    const from = nodes.get(edge.from),
      to = nodes.get(edge.to);
    if (!from || !to) continue;
    const sideIndex = index % 2;
    const sign = sideIndex ? 1 : -1;
    const side = vertical
      ? sign < 0
        ? "left"
        : "right"
      : sign < 0
        ? "top"
        : "bottom";
    const interval = [
      Math.min(from[along], to[along]) - 150,
      Math.max(from[along], to[along]) + 150,
    ];
    const levels = lanes[sideIndex];
    let level = levels.findIndex((slots) =>
      slots.every(([start, end]) => interval[1] < start || interval[0] > end),
    );
    if (level < 0) level = levels.push([]) - 1;
    levels[level].push(interval);
    const lane =
      sign * (bounds[sideIndex] + 58 + level * (vertical ? 175 : 54));
    const a = exit(
      from,
      lane,
      side,
      shapes.filter((node) => node !== from),
      to[along],
    );
    const b = exit(
      to,
      lane,
      side,
      shapes.filter((node) => node !== to),
      from[along],
    );
    if (a.score >= 1000000 || b.score >= 1000000) continue;
    for (const port of [a, b])
      ports.set(port.key, (ports.get(port.key) || 0) + 1);
    const points = simplify([...a.path, ...b.path.reverse()]);
    const center = pathMidpoint(points);
    const label = point((a.end[along] + b.end[along]) / 2, lane);
    Object.assign(edge, {
      routing: "orthogonal",
      fromSide: a.face,
      toSide: b.face,
      fromRatio: a.ratio,
      toRatio: b.ratio,
      waypoints: points.slice(1, -1),
      ...(edge.label
        ? { labelOffset: { x: label.x - center.x, y: label.y - center.y } }
        : {}),
    });
  }
}
