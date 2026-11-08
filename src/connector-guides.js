import { nearestAttachment, attachment } from "./connector-routing.js";
/** A screen-pixel threshold keeps magnets small at every zoom; Alt bypasses them. */
export function magneticAttachment(node, p, zoom = 1, enabled = true, toward) {
  const hit = nearestAttachment(node, p);
  if (
    toward &&
    Math.abs(p.x - node.x) < node.width * 0.18 &&
    Math.abs(p.y - node.y) < node.height * 0.18
  ) {
    hit.side = nearestAttachment(node, toward).side;
    hit.ratio = Math.max(
      -1,
      Math.min(
        1,
        ["left", "right"].includes(hit.side)
          ? (p.y - node.y) / (node.height / 2)
          : (p.x - node.x) / (node.width / 2),
      ),
    );
  }
  const span = ["left", "right"].includes(hit.side) ? node.height : node.width;
  const candidates = [0, -0.5, 0.5];
  let ratio = hit.ratio,
    snapped = false;
  if (enabled && node.shape !== "diamond")
    for (const r of candidates)
      if (
        ((Math.abs(hit.ratio - r) * span) / 2) * zoom <=
        Math.min(4, span * zoom * 0.04)
      ) {
        ratio = r;
        snapped = true;
        break;
      }
  return { ...hit, ratio, snapped, point: attachment(node, hit.side, ratio) };
}
export function connectorAlignment(p, anchors, zoom = 1, enabled = true) {
  const point = { ...p },
    guides = [];
  if (!enabled) return { point, guides };
  for (const axis of ["x", "y"]) {
    const other = axis === "x" ? "y" : "x";
    const matches = anchors
      .filter((a) => Math.abs(a[axis] - p[axis]) * zoom <= 4)
      .sort(
        (a, b) => Math.abs(a[axis] - p[axis]) - Math.abs(b[axis] - p[axis]),
      );
    if (matches.length) {
      const a = matches[0];
      point[axis] = a[axis];
      guides.push({
        axis,
        value: a[axis],
        start: Math.min(p[other], a[other]) - 20,
        end: Math.max(p[other], a[other]) + 20,
        kind: "connector",
      });
    }
  }
  return { point, guides };
}
export function attachmentGuides(node, hit) {
  if (!hit.snapped) return [];
  const p = hit.point;
  return [
    {
      axis: ["left", "right"].includes(hit.side) ? "y" : "x",
      value: ["left", "right"].includes(hit.side) ? p.y : p.x,
      start: ["left", "right"].includes(hit.side)
        ? node.x - node.width / 2
        : node.y - node.height / 2,
      end: ["left", "right"].includes(hit.side)
        ? node.x + node.width / 2
        : node.y + node.height / 2,
      kind: "connector",
      point: p,
    },
  ];
}
