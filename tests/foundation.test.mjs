import test from "node:test";
import assert from "node:assert/strict";
import { alignMove } from "../src/alignment.js";
import { decodeClipboard } from "../src/clipboard.js";
import { avoidObstacles, crossesBox } from "../src/smart-routing.js";
test("alignment finds edge and center matches using a zoom-adjusted threshold", () => {
  const a = alignMove(
    { x: 104, y: 207, width: 80, height: 60 },
    [{ x: 100, y: 400, width: 80, height: 60 }],
    6,
  );
  assert.equal(a.x, -4);
  assert.equal(a.y, 0);
  assert.equal(a.guides[0].axis, "x");
});
test("clipboard recognizes Mermaid and bound Excalidraw objects without treating JSON as text", () => {
  assert.equal(
    decodeClipboard("flowchart LR\n a[Hello] --> b[World]").model.nodes.length,
    2,
  );
  const d = decodeClipboard(
    JSON.stringify({
      type: "excalidraw/clipboard",
      elements: [
        { id: "a", type: "rectangle", x: 10, y: 20, width: 100, height: 80 },
        { id: "b", type: "diamond", x: 200, y: 30, width: 100, height: 80 },
        { type: "text", containerId: "a", text: "Hello 😀" },
        {
          type: "arrow",
          startBinding: { elementId: "a" },
          endBinding: { elementId: "b" },
        },
      ],
    }),
  );
  assert.equal(d.model.nodes[0].label, "Hello 😀");
  assert.equal(d.model.edges.length, 1);
  assert.throws(
    () => decodeClipboard('{"private":"unknown"}'),
    /private clipboard/,
  );
});
test("automatic elbows detour around an intervening shape", () => {
  const obstacle = { x: 200, y: 100, width: 80, height: 100 },
    points = [
      { x: 0, y: 100 },
      { x: 30, y: 100 },
      { x: 370, y: 100 },
      { x: 400, y: 100 },
    ],
    route = avoidObstacles(points, [obstacle]);
  assert.ok(route.slice(1).every((p, i) => !crossesBox(route[i], p, obstacle)));
  assert.deepEqual(route[0], points[0]);
  assert.deepEqual(route.at(-1), points.at(-1));
});
