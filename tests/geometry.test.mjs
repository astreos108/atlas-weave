import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapText } from "../src/layout.js";
import { routeConnection, wireGeometry } from "../src/connector-geometry.js";
import { crossesBox } from "../src/smart-routing.js";
test("orthogonal routes have only horizontal or vertical segments for every side pair", () => {
  const a = { x: 0, y: 0, width: 120, height: 80 },
    b = { x: 300, y: 200, width: 140, height: 90 };
  for (const fromSide of ["left", "right", "top", "bottom"])
    for (const toSide of ["left", "right", "top", "bottom"]) {
      const { points } = wireGeometry(a, b, false, {
        routing: "orthogonal",
        fromSide,
        toSide,
      });
      for (let i = 1; i < points.length; i++)
        assert.ok(
          points[i].x === points[i - 1].x || points[i].y === points[i - 1].y,
        );
    }
});
test("wrapping handles paragraphs and long unspaced tokens within the width", () => {
  const lines = wrapText(
    "A small thought with words\n\nverylongunbrokenidentifier",
    64,
  );
  assert.ok(lines.includes(""));
  for (const line of lines) assert.ok(line.length * 8 <= 64);
  assert.equal(
    lines.join("").replace(/ /g, ""),
    "Asmallthoughtwithwordsverylongunbrokenidentifier",
  );
});

test("center attachments approach the facing edge as a target moves past the source", () => {
  const source = {
    id: "a",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    shape: "rect",
  };
  const edge = { routing: "auto", fromSide: "right", fromRatio: 0, toRatio: 0 };
  for (const target of [
    { ...source, id: "b", x: 220 },
    { ...source, id: "b", x: -220 },
    { ...source, id: "b", x: 10, y: 105 },
  ]) {
    const { points } = routeConnection(source, target, edge, [source, target]);
    assert.ok(points[1].x > points[0].x);
    const end = points.at(-1);
    assert.deepEqual(
      end,
      target.y
        ? { x: target.x, y: target.y - target.height / 2 }
        : {
            x: target.x - (Math.sign(target.x) * target.width) / 2,
            y: target.y,
          },
    );
    for (const [index, point] of points.slice(1).entries()) {
      assert.ok(!crossesBox(points[index], point, source, 0));
      assert.ok(!crossesBox(points[index], point, target, 0));
    }
  }
});
