import test from "node:test";
import assert from "node:assert/strict";
import {
  magneticAttachment,
  connectorAlignment,
  attachmentGuides,
} from "../src/connector-guides.js";
test("small midpoint magnets use screen distance, preserve free ratios, and allow Alt bypass", () => {
  const n = { x: 200, y: 200, width: 400, height: 400, shape: "rect" };
  for (const zoom of [0.25, 0.5, 1, 2]) {
    const hit = magneticAttachment(n, { x: 400, y: 200 + 2 / zoom }, zoom);
    assert.equal(hit.ratio, 0);
    assert.ok(hit.snapped);
    assert.equal(attachmentGuides(n, hit)[0].kind, "connector");
    const free = magneticAttachment(n, { x: 400, y: 200 + 7 / zoom }, zoom);
    assert.equal(free.snapped, false);
    assert.notEqual(free.ratio, 0);
    assert.equal(
      magneticAttachment(n, { x: 400, y: 202 }, zoom, false).snapped,
      false,
    );
  }
  assert.equal(
    magneticAttachment(n, { x: 400, y: 399 }, 1, false).ratio,
    0.995,
  );
});
test("connector alignments distinguish close axes from free movement and clear when bypassed", () => {
  const p = { x: 302, y: 197 },
    anchors = [{ x: 300, y: 200 }];
  const aligned = connectorAlignment(p, anchors, 1);
  assert.deepEqual(aligned.point, { x: 300, y: 200 });
  assert.equal(aligned.guides.length, 2);
  assert.ok(aligned.guides.every((g) => g.kind === "connector"));
  assert.deepEqual(connectorAlignment(p, anchors, 1, false), {
    point: p,
    guides: [],
  });
  assert.equal(
    connectorAlignment({ x: 310, y: 210 }, anchors, 1).guides.length,
    0,
  );
});
