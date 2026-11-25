import test from "node:test";
import assert from "node:assert/strict";
import { annotationSize } from "../src/domain/text-annotation.js";
import { parse, serialize } from "../src/model.js";
const measure = (text) => text.length * 8;
test("annotations grow horizontally, honor explicit newlines and wrap only at a chosen width", () => {
  const n = { label: "A long canvas heading", textSize: 16 };
  const natural = annotationSize(n, measure);
  assert.ok(natural.width > 160);
  assert.equal(natural.height, 24);
  assert.ok(
    annotationSize({ ...n, label: n.label + "\nAnother line" }, measure)
      .height > 24,
  );
  const wrapped = annotationSize({ ...n, textWrap: true, width: 80 }, measure);
  assert.equal(wrapped.width, 80);
  assert.ok(wrapped.height > 24);
});
test("annotation wrap mode and tight bounds survive Mermaid round trips", () => {
  const m = {
    direction: "LR",
    nodes: [
      {
        id: "a",
        label: "Label",
        shape: "text",
        textWrap: true,
        size: { width: 48, height: 24 },
        position: { x: 80, y: 100 },
        fill: "#ffffff",
        stroke: "#000000",
      },
    ],
    edges: [],
  };
  const source = serialize(m),
    result = parse(source);
  assert.equal(result.nodes[0].textWrap, true);
  assert.deepEqual(result.nodes[0].size, { width: 48, height: 24 });
  assert.equal(
    parse(source.replace('"textWrap":true', '"textWrap":"yes"')),
    null,
  );
});
