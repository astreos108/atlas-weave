import test from "node:test";
import assert from "node:assert/strict";
import {
  createSaveQueue,
  createKeyedQueue,
} from "../src/workflows/save-queue.js";
import {
  createFrame,
  moveNodes,
  arrangeNodes,
  removeNodes,
} from "../src/domain/board-actions.js";
import { resizeBox } from "../src/domain/resize-box.js";
import { parse, serialize } from "../src/model.js";
import {
  projectedEdges,
  connectorPath,
  insetEndpoints,
} from "../src/connector-projection.js";
const fixture = () => ({
  direction: "LR",
  nodes: [
    {
      id: "a",
      label: "A",
      shape: "rect",
      fill: "#ffffff",
      stroke: "#cbd5e1",
      position: { x: 200, y: 200 },
      size: { width: 160, height: 80 },
    },
    {
      id: "b",
      label: "B",
      shape: "rect",
      fill: "#ffffff",
      stroke: "#cbd5e1",
      position: { x: 500, y: 400 },
      size: { width: 160, height: 80 },
    },
  ],
  edges: [
    {
      from: "a",
      to: "b",
      label: "",
      waypoints: [
        { x: 350, y: 200 },
        { x: 350, y: 400 },
      ],
    },
  ],
});
test("failed saves reject flush; a later successful edit restores persistence", async () => {
  let fail = true;
  const q = createSaveQueue(async () => {
    if (fail) throw new Error("conflict");
  });
  q.enqueue("work");
  await assert.rejects(q.flush(), /conflict/);
  fail = false;
  q.enqueue("recovered");
  await q.flush();
});
test("external writes are serialized per board and failure does not poison the queue", async () => {
  const serial = createKeyedQueue(),
    seen = [];
  await Promise.all([
    serial("a", async () => {
      seen.push(1);
      await new Promise((r) => setTimeout(r, 5));
      seen.push(2);
    }),
    serial("a", async () => seen.push(3)),
  ]);
  assert.deepEqual(seen, [1, 2, 3]);
  await assert.rejects(
    serial("a", async () => {
      throw new Error("fail");
    }),
  );
  await serial("a", async () => seen.push(4));
});
test("true frame membership survives Mermaid; moving a frame moves members and internal routes; removing frame keeps contents", () => {
  const m = fixture();
  createFrame(m, { id: "f", ids: ["a", "b"], label: "Mechanism" });
  assert.equal(parse(serialize(m)).nodes[0].shape, "frame");
  const before = structuredClone(m);
  moveNodes(m, ["f"], 40, 60);
  for (const n of m.nodes)
    assert.equal(
      n.position.x,
      before.nodes.find((p) => p.id === n.id).position.x + 40,
    );
  assert.equal(m.edges[0].waypoints[0].y, 260);
  removeNodes(m, ["f"]);
  assert.equal(m.nodes.length, 2);
  assert.equal(m.edges.length, 1);
});
test("arrangement aligns exact edges without treating spatial bands as frames", () => {
  const m = fixture();
  arrangeNodes(m, ["a", "b"], "left");
  assert.equal(m.nodes[0].position.x, m.nodes[1].position.x);
});
test("edge resizing snaps the dragged edge and keeps the opposite edge fixed", () => {
  const box = { x: 200, y: 200, width: 160, height: 80 };
  const r = resizeBox(box, "e", { x: 33, y: 90 }, { snap: true });
  assert.equal(r.x - r.width / 2, 120);
  assert.equal(r.x + r.width / 2, 320);
  assert.equal(r.height, 80);
  assert.equal(r.y, 200);
});
test("multiple connectors get distinct ports; crossing hops and endpoint gaps remain projection only", () => {
  const m = fixture(),
    nodes = new Map(
      m.nodes.map((n) => [n.id, { ...n, ...n.position, ...n.size }]),
    );
  const edges = projectedEdges(
    [
      { from: "a", to: "b" },
      { from: "a", to: "b" },
    ],
    nodes,
  );
  assert.notEqual(edges[0].fromRatio, edges[1].fromRatio);
  const ps = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ],
    d = connectorPath(ps, [
      [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
    ]);
  assert.match(d, /Q 50 39/);
  assert.equal(insetEndpoints(ps)[0].x, 9);
  assert.equal(ps[0].x, 0);
});

test("simple subgraphs import as editable frames while nested syntax remains source-only", () => {
  const m = parse(
    'flowchart LR\nsubgraph f["Group"]\na["One"]\nb["Two"]\na --> b\nend',
  );
  assert.equal(m.nodes.find((n) => n.id === "f").shape, "frame");
  assert.deepEqual(m.nodes.find((n) => n.id === "f").members, ["a", "b"]);
  assert.equal(
    parse('flowchart LR\nsubgraph f\nsubgraph g\na["One"]\nend\nend'),
    null,
  );
});
