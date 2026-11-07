import {
  moveNodes,
  removeNodes,
  createFrame,
  arrangeNodes,
} from "./domain/board-actions.js";
import { parse, serialize, readBoard } from "./model.js";
import { createMap, appendBranch } from "./map-patterns.js";
import { BRIDGE_CAPABILITIES } from "./bridge-contract.js";
export function safeVaultPath(path, extension) {
  if (
    typeof path !== "string" ||
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path
      .split("/")
      .some((p) => !p || p === "." || p === ".." || p.startsWith(".")) ||
    !path.endsWith(`.${extension}`)
  )
    throw new Error(
      `Use a vault-relative .${extension} path without hidden or parent directories`,
    );
  return path;
}
const NODE_FIELDS = [
    "label",
    "shape",
    "fill",
    "stroke",
    "position",
    "size",
    "link",
    "members",
  ],
  EDGE_FIELDS = BRIDGE_CAPABILITIES.edgeFields;
function pickChanges(changes, fields) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes))
    throw new Error("changes must be an object");
  for (const k of Object.keys(changes))
    if (!fields.includes(k)) throw new Error(`Unsupported field: ${k}`);
  return structuredClone(changes);
}
export function validateModel(model) {
  if (
    !model ||
    !Array.isArray(model.nodes) ||
    !Array.isArray(model.edges) ||
    model.nodes.length > 300 ||
    model.edges.length > 1000
  )
    throw new Error("Invalid model or board exceeds size limits");
  const ids = new Set();
  for (const node of model.nodes) {
    if (
      !/^\w+$/.test(node.id) ||
      ids.has(node.id) ||
      typeof node.label !== "string" ||
      node.label.length > 10000 ||
      !["rect", "round", "diamond", "frame"].includes(node.shape) ||
      !/^#[a-fA-F0-9]{6}$/.test(node.fill) ||
      !/^#[a-fA-F0-9]{6}$/.test(node.stroke)
    )
      throw new Error("Invalid node");
    ids.add(node.id);
  }
  for (const e of model.edges) {
    if (
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      typeof e.label !== "string" ||
      e.label.length > 10000 ||
      (e.color !== undefined && !/^#[a-fA-F0-9]{6}$/.test(e.color))
    )
      throw new Error("Invalid edge");
  }
  const source = serialize(model),
    roundTrip = parse(source);
  if (!roundTrip) throw new Error("Invalid geometry or link metadata");
  return source;
}
export function applyOperations(source, operations) {
  const model = parse(source);
  if (!model)
    throw new Error(
      "This diagram is source-only; use board_replace_source for an intentional whole-source edit",
    );
  if (
    !Array.isArray(operations) ||
    !operations.length ||
    operations.length > 300
  )
    throw new Error("Supply 1–300 operations");
  for (const op of operations) {
    switch (op.type) {
      case "add_node": {
        const n = op.node;
        if (!n || model.nodes.some((x) => x.id === n.id))
          throw new Error("New node ID must be unique");
        model.nodes.push({
          shape: "rect",
          fill: "#ede9fe",
          stroke: "#a78bfa",
          ...pickChanges(n, ["id", ...NODE_FIELDS]),
        });
        break;
      }
      case "update_node": {
        const n = model.nodes.find((n) => n.id === op.id);
        if (!n) throw new Error("Node does not exist");
        Object.assign(n, pickChanges(op.changes, NODE_FIELDS));
        break;
      }
      case "remove_node":
        if (!model.nodes.some((n) => n.id === op.id))
          throw new Error("Node does not exist");
        removeNodes(model, [op.id]);
        break;
      case "add_edge":
        model.edges.push({
          label: "",
          routing: "auto",
          ...pickChanges(op.edge, EDGE_FIELDS),
        });
        break;
      case "update_edge": {
        const e = model.edges[op.index];
        if (!e) throw new Error("Edge index does not exist");
        Object.assign(e, pickChanges(op.changes, EDGE_FIELDS));
        break;
      }
      case "remove_edge":
        if (!Number.isInteger(op.index) || !model.edges[op.index])
          throw new Error("Edge index does not exist");
        model.edges.splice(op.index, 1);
        break;
      case "move_nodes":
        if (!Array.isArray(op.ids)) throw new Error("ids must be an array");
        moveNodes(model, op.ids, op.dx, op.dy);
        break;
      case "create_frame":
        createFrame(model, op);
        break;
      case "arrange":
        arrangeNodes(model, op.ids, op.mode);
        break;
      case "remove_frame":
        if (model.nodes.find((n) => n.id === op.id)?.shape !== "frame")
          throw new Error("Frame does not exist");
        removeNodes(model, [op.id]);
        break;
      default:
        throw new Error(`Unknown operation: ${op.type}`);
    }
  }
  return validateModel(model);
}
export function expandedSource(source, args) {
  const m = parse(source);
  if (!m) throw new Error("Branch expansion requires an editable flowchart");
  appendBranch(m, args.parentId, args.branches, { radial: args.radial });
  return validateModel(m);
}
export function newBoardSource(args) {
  if (!!args.source === !!args.map)
    throw new Error("Supply exactly one of source or map");
  return args.map
    ? createMap(args.map)
    : (readBoard(args.source) || args.source).trim();
}
