import { serialize, nextId } from "./model.js";
export const MAP_PATTERNS = {
  radial: "Brainstorm a central topic into themed branches.",
  tree: "Organize a hierarchy, outline, or learning objective.",
  concept: "Explain relationships with labeled cross-links.",
  decision: "Show choices, criteria, and outcomes.",
  project: "Map goals, deliverables, dependencies, and next actions.",
  mechanism: "Trace causes, intermediate steps, effects, and feedback.",
  comparison: "Compare alternatives using shared criteria.",
};
const COLORS = [
  ["#ede9fe", "#a78bfa"],
  ["#d1fae5", "#6ee7b7"],
  ["#dbeafe", "#93c5fd"],
  ["#fef3c7", "#fbbf24"],
  ["#ffe4e6", "#fda4af"],
];
export function appendBranch(
  model,
  parentId,
  branches,
  { radial = false } = {},
) {
  const parent = model.nodes.find((n) => n.id === parentId);
  if (!parent) throw new Error("Parent node does not exist");
  let count = model.nodes.length;
  function walk(items, base, depth = 1, angle = 0) {
    if (depth > 8) throw new Error("Maximum map depth is 8");
    for (let i = 0; i < items.length; i++) {
      if (++count > 300)
        throw new Error("Use multiple boards for more than 300 nodes");
      const item = items[i];
      if (!item || typeof item.label !== "string" || !item.label.trim())
        throw new Error("Every branch needs a label");
      const id = nextId(model),
        theta =
          depth === 1
            ? (i / Math.max(1, items.length)) * Math.PI * 2 - Math.PI / 2
            : angle + (i - (items.length - 1) / 2) * 0.35,
        color = COLORS[i % COLORS.length],
        position = radial
          ? {
              x: Math.round((base.position?.x || 0) + Math.cos(theta) * 380),
              y: Math.round((base.position?.y || 0) + Math.sin(theta) * 280),
            }
          : model.direction === "TD"
            ? {
                x: (base.position?.x || 0) + (i - (items.length - 1) / 2) * 320,
                y: (base.position?.y || 0) + 240,
              }
            : {
                x: (base.position?.x || 0) + 360,
                y: (base.position?.y || 0) + (i - (items.length - 1) / 2) * 180,
              };
      position.x = Math.round(position.x / 20) * 20;
      position.y = Math.round(position.y / 20) * 20;
      const node = {
        id,
        size: { width: 280, height: 120 },
        label: item.label,
        shape: "rect",
        fill: color[0],
        stroke: color[1],
        position,
        ...(item.link ? { link: item.link } : {}),
      };
      model.nodes.push(node);
      model.edges.push({
        from: base.id,
        to: id,
        label: item.relationship || "",
        routing: "auto",
        color: color[1],
      });
      if (item.children?.length) walk(item.children, node, depth + 1, theta);
    }
  }
  walk(branches, parent);
  return model;
}
export function createMap({ kind = "radial", root, branches = [] }) {
  if (!MAP_PATTERNS[kind]) throw new Error("Unknown map pattern");
  if (typeof root !== "string" || !root.trim())
    throw new Error("Map root is required");
  const model = {
    direction: kind === "decision" || kind === "mechanism" ? "TD" : "LR",
    nodes: [
      {
        id: "root",
        label: root,
        shape: kind === "decision" ? "diamond" : "round",
        fill: "#ede9fe",
        stroke: "#a78bfa",
        position: { x: 0, y: 0 },
        size: { width: 280, height: 120 },
      },
    ],
    edges: [],
  };
  appendBranch(model, "root", branches, { radial: kind === "radial" });
  return serialize(model);
}
