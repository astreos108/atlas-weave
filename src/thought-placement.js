import { GRID, SIDES, snapPoint } from "./connector-routing.js";

const CLEARANCE = 40;
const overlaps = (a, b) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + CLEARANCE &&
  Math.abs(a.y - b.y) < (a.height + b.height) / 2 + CLEARANCE;

export function placeConnectedThought(parent, nodes, side, snap, drop) {
  const size = { width: parent.width, height: parent.height };
  const direction = SIDES[side] || SIDES.right;
  const axis = direction.x ? "x" : "y";
  const across = axis === "x" ? "y" : "x";
  const span = axis === "x" ? size.width : size.height;
  const acrossSpan = axis === "x" ? size.height : size.width;
  const occupied = [...nodes].filter((node) => node.shape !== "frame");
  const boxAt = (point) => ({ ...size, ...snapPoint(point, snap) });
  const clear = (box) => !occupied.some((node) => overlaps(box, node));
  const origin = drop
    ? { x: drop.x, y: drop.y }
    : {
        x: parent.x + direction.x * (span + 80),
        y: parent.y + direction.y * (span + 80),
      };
  const first = boxAt(origin);
  if (clear(first)) return first;

  // Search both neighboring slots in the same row before extending the branch.
  const step = Math.ceil((acrossSpan + CLEARANCE) / GRID) * GRID;
  for (let offset = 1; offset <= 3; offset++)
    for (const sign of [-1, 1]) {
      const candidate = boxAt({
        ...origin,
        [across]: origin[across] + offset * sign * step,
      });
      if (clear(candidate)) return candidate;
    }

  const sign = direction[axis];
  let box = first;
  for (let i = 0; i <= occupied.length; i++) {
    const blockers = occupied.filter((node) => overlaps(box, node));
    if (!blockers.length) return box;
    const boundary = Math.max(
      ...blockers.map(
        (node) =>
          sign * node[axis] +
          (span + (axis === "x" ? node.width : node.height)) / 2,
      ),
    );
    box = boxAt({
      ...box,
      [axis]: sign * (boundary + CLEARANCE + GRID),
    });
  }
  return box;
}

export function duplicateOffset(nodes, occupied, snap) {
  const bounds = (axis, size) => [
    Math.min(...nodes.map((n) => n.position[axis] - n.size[size] / 2)),
    Math.max(...nodes.map((n) => n.position[axis] + n.size[size] / 2)),
  ];
  const [left, right] = bounds("x", "width");
  const [top, bottom] = bounds("y", "height");
  const gap = GRID;
  const obstacles = occupied.map(
    ({ position: { x, y }, size: { width, height } }) => ({
      left: x - width / 2 - right - gap,
      right: x + width / 2 - left + gap,
      top: y - height / 2 - bottom - gap,
      bottom: y + height / 2 - top + gap,
    }),
  );
  const boundary = (value, outward) =>
    snap ? Math[outward](value / GRID) * GRID : value;
  const xs = new Set([0]),
    ys = new Set([0]);
  for (const box of obstacles) {
    xs.add(boundary(box.left, "floor"));
    xs.add(boundary(box.right, "ceil"));
    ys.add(boundary(box.top, "floor"));
    ys.add(boundary(box.bottom, "ceil"));
  }
  let best = { x: 0, y: 0 },
    distance = Infinity;
  for (const x of xs)
    for (const y of ys) {
      const d = x * x + y * y;
      if (
        d >= distance ||
        obstacles.some(
          (b) => x > b.left && x < b.right && y > b.top && y < b.bottom,
        )
      )
        continue;
      best = { x, y };
      distance = d;
    }
  return best;
}
