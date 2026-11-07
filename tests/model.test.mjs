import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL,
  parse,
  serialize,
  readBoard,
  replaceBoard,
  encode,
  decode,
  nextId,
} from "../src/model.js";
test("visual operations round trip without changing labels, shapes, edges, or colors", () => {
  const m = parse(INITIAL);
  assert.equal(m.nodes.length, 4);
  assert.deepEqual(parse(serialize(m)), m);
  m.nodes[0].label = '[[Note]] "ideas" & [links] | ;';
  m.edges[0].label = "A | B;";
  assert.deepEqual(parse(serialize(m)), m);
  assert.equal(nextId(m), "n1");
});
test("unsupported syntax stays source-only, rather than being overwritten", () => {
  for (const s of [
    "sequenceDiagram\nAlice->>Bob: hi",
    'flowchart LR\na["ok"]\nclassDef foo fill:red',
    'flowchart LR\na["ok"]\na -.-> missing',
  ])
    assert.equal(parse(s), null);
});
test("replace first Mermaid block preserves surrounding Markdown and later diagrams", () => {
  const md =
    "# Note\n\n```mermaid\nflowchart LR\n```\n\nKeep [[links]]\n```mermaid\nflowchart TD\n```";
  const updated = replaceBoard(md, INITIAL);
  assert.equal(readBoard(updated), INITIAL);
  assert.ok(updated.endsWith("Keep [[links]]\n```mermaid\nflowchart TD\n```"));
});
test("label entities are reversible", () => {
  const s = 'A "quote" & #quot; [label] |;';
  assert.equal(decode(encode(s)), s);
});
test("free positions round trip as Mermaid comments, including negative coordinates", () => {
  const m = parse(INITIAL);
  m.nodes[0].position = { x: -225.5, y: 500 };
  m.nodes[1].position = { x: 850, y: -100 };
  const source = serialize(m);
  assert.match(source, /%% board-layout:/);
  assert.deepEqual(parse(source), m);
  assert.equal(parse(source.replace('"version":1', '"version":999')), null);
  assert.equal(parse(source.replace('"x":-225.5', '"x":1e999')), null);
});

test("resizes, routing, label widths, colors and multiline labels round trip", () => {
  const m = parse(INITIAL);
  m.nodes[0].position = { x: 100, y: 200 };
  m.nodes[0].size = { width: 300, height: 170 };
  Object.assign(m.edges[0], {
    color: "#3b82f6",
    routing: "orthogonal",
    labelWidth: 160,
    fromSide: "bottom",
    label: "A long thought\nwith a second line",
  });
  const source = serialize(m);
  assert.match(source, /linkStyle 0 stroke:#3b82f6/);
  assert.deepEqual(parse(source), m);
  assert.equal(parse(source.replace('"width":300', '"width":-1')), null);
  assert.equal(
    parse(source.replace('"routing":"orthogonal"', '"routing":"bogus"')),
    null,
  );
});
test("common Mermaid imports with inline shapes become editable without losing edges", () => {
  const m = parse("flowchart TD; A[Start]-->B{Decision}\nB-->|Yes| C([Done])");
  assert.equal(m.nodes.length, 3);
  assert.equal(m.nodes[1].shape, "diamond");
  assert.equal(m.nodes[2].shape, "round");
  assert.equal(m.edges[1].label, "Yes");
  assert.deepEqual(parse(serialize(m)), m);
});
test("manual routes, label offsets, endpoint ratios and note links round trip", () => {
  const m = parse(INITIAL);
  m.nodes[0].link = "Study/Immunity#Innate response";
  Object.assign(m.edges[0], {
    routing: "auto",
    waypoints: [
      { x: 20, y: -100 },
      { x: 400, y: -100 },
    ],
    fromRatio: 0.5,
    toRatio: -0.5,
    labelOffset: { x: 40, y: 60 },
    labelFontSize: 20,
    link: "Study/Immunity#^mechanism",
  });
  const source = serialize(m);
  assert.match(source, /"version":3/);
  assert.deepEqual(parse(source), m);
  assert.equal(
    parse(source.replace('"labelFontSize":20', '"labelFontSize":500')),
    null,
  );
  assert.equal(parse(source.replace('"fromRatio":0.5', '"fromRatio":2')), null);
});
