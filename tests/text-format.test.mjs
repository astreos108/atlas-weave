import test from "node:test";
import assert from "node:assert/strict";
import {
  inlineRuns,
  richLines,
  characterCount,
  wrapSelection,
  listLines,
  continueList,
  indentList,
} from "../src/text-format.js";
import { gridLayers } from "../src/grid.js";
import { parse, serialize } from "../src/model.js";
test("inline Markdown retains semantic formatting and only safe links", () => {
  const runs = inlineRuns(
    "**Bold *nested*** ==mark== [[Path/Note|Alias]] [Web](https://example.com) [bad](javascript:alert(1))",
  );
  assert.ok(runs.some((r) => r.bold));
  assert.ok(runs.some((r) => r.bold && r.italic));
  assert.ok(runs.some((r) => r.highlight));
  assert.ok(runs.some((r) => r.internal && r.text === "Alias"));
  assert.ok(runs.some((r) => r.link === "https://example.com"));
  assert.ok(!runs.some((r) => r.link?.startsWith("javascript:")));
  assert.equal(inlineRuns("[[Path/Note]]")[0].text, "Note");
  assert.equal(
    inlineRuns("[[Path/Note]]", () => "Resolved title")[0].text,
    "Resolved title",
  );
});
test("soft count measures visible characters rather than UTF-16 code units", () => {
  assert.equal(characterCount("👨‍👩‍👧👍🏽a"), 3);
});
test("formatting operations preserve unselected text and continue consistent lists", () => {
  assert.deepEqual(wrapSelection("before word after", 7, 11, "(", ")"), {
    value: "before (word) after",
    start: 8,
    end: 12,
  });
  assert.equal(
    listLines("untouched\none\ntwo", 10, 17, true),
    "untouched\n1. one\n2. two",
  );
  assert.equal(continueList("3. third", 8, 8).value, "3. third\n4. ");
  assert.equal(continueList("3. ", 3, 3).value, "");
});
test("wrapping preserves paragraph identity and styling across lines", () => {
  const lines = richLines(
    "**alpha beta gamma**\nnext",
    50,
    (s) => s.length * 6,
  );
  assert.ok(lines.length > 2);
  assert.ok(lines[0].runs[0].bold);
  assert.equal(lines.at(-1).paragraph, 1);
});
test("fixed zoom grid levels always share the exact world origin", () => {
  for (const zoom of [0.05, 0.1, 0.25, 0.5, 1, 2, 3])
    for (const pan of [
      { x: 0, y: 0 },
      { x: -185.5, y: 97.25 },
    ]) {
      const layers = gridLayers(zoom, pan);
      assert.ok(layers.some((l) => l.visible));
      for (const l of layers) {
        assert.equal(l.x + l.size / 2, pan.x);
        assert.equal(l.y + l.size / 2, pan.y);
        assert.ok(!l.visible || l.size >= 8);
      }
      assert.equal(layers[1].size / layers[0].size, 5);
    }
});
test("per-paragraph alignment round trips in version 5 and malformed values are rejected", () => {
  const m = parse('flowchart LR\n a["One\\nTwo"]');
  m.nodes[0].textAlignments = ["left", "right", "justify"];
  const source = serialize(m);
  assert.ok(source.includes('"version":5'));
  assert.deepEqual(
    parse(source).nodes[0].textAlignments,
    m.nodes[0].textAlignments,
  );
  assert.equal(parse(source.replace('"justify"', '"malformed"')), null);
});

test("outline numbering follows each requested sequence and renumbers branches", () => {
  const source =
    "Topic\n  Subtopic\n    Detail\n      Example\n        Minor\n          Point\n      Next Example\n    Next Detail\n  Next Subtopic\nNext Topic";
  const traditional = listLines(source, 0, source.length, true, "traditional");
  assert.equal(
    traditional,
    "I. Topic\n  A. Subtopic\n    1. Detail\n      a. Example\n        (1) Minor\n          (a) Point\n      b. Next Example\n    2. Next Detail\n  B. Next Subtopic\nII. Next Topic",
  );
  const shorter =
    "Topic\n  Subtopic\n    Detail\n      Example\n  Next Subtopic\nNext Topic";
  const mixed = listLines(shorter, 0, shorter.length, true, "mixed");
  assert.equal(
    mixed,
    "1. Topic\n  i. Subtopic\n    a. Detail\n      (1) Example\n  ii. Next Subtopic\n2. Next Topic",
  );
  const decimal = listLines(shorter, 0, shorter.length, true, "decimal");
  assert.equal(
    decimal,
    "1. Topic\n  1.1. Subtopic\n    1.1.1. Detail\n      1.1.1.1. Example\n  1.2. Next Subtopic\n2. Next Topic",
  );
  const next = continueList("1. Topic", 8, 8, "decimal");
  const nested = indentList(next.value, next.start, next.end, false, "decimal");
  assert.equal(nested.value, "1. Topic\n  1.1. ");
  assert.equal(nested.start, nested.value.length);
  const outdented = indentList(nested.value, nested.start, nested.end, true);
  assert.equal(outdented.value, "1. Topic\n2. ");
});
