import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapText, wireGeometry } from "../src/layout.js";
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
