import test from "node:test";
import assert from "node:assert/strict";
import { mathSegments } from "../src/math-text.js";
import { inlineRuns, paragraphRuns } from "../src/text-format.js";
import { serialize, parse } from "../src/model.js";

test("math delimiters preserve TeX, code, escaped currency and unfinished input", () => {
  const input =
    String.raw`Pressure $\Delta P$ and $$\frac{Q}{R}$$; \$5 and \`$code$\``.replaceAll(
      "\\`",
      "`",
    );
  assert.deepEqual(
    mathSegments(input).filter((p) => p.math),
    [
      { text: String.raw`\Delta P`, math: true, display: false },
      { text: String.raw`\frac{Q}{R}`, math: true, display: true },
    ],
  );
  assert.deepEqual(mathSegments("$unfinished"), [{ text: "$unfinished" }]);
  assert.equal(mathSegments("$$a\n+b$$")[0].display, true);
  assert.ok(!mathSegments("`$x$`").some((p) => p.math));
});

test("Mermaid round trip retains equations in node and connector labels", () => {
  const source = serialize({
    direction: "LR",
    nodes: [
      {
        id: "a",
        shape: "rect",
        fill: "#ffffff",
        stroke: "#cbd5e1",
        label: String.raw`$\Delta P$`,
      },
      {
        id: "b",
        shape: "rect",
        fill: "#ffffff",
        stroke: "#cbd5e1",
        label: "$$a\n+b$$",
      },
    ],
    edges: [{ from: "a", to: "b", label: String.raw`$Q=\frac{\Delta P}{R}$` }],
  });
  const model = parse(source);
  assert.equal(model.nodes[0].label, String.raw`$\Delta P$`);
  assert.equal(model.nodes[1].label, "$$a\n+b$$");
  assert.equal(model.edges[0].label, String.raw`$Q=\frac{\Delta P}{R}$`);
});

test("LaTeX subscripts and Markdown syntax remain literal inside equations", () => {
  const tex = String.raw`$x_i + y_j + \text{**literal**}$`;
  assert.deepEqual(inlineRuns(tex), [
    {
      text: tex,
      latex: String.raw`x_i + y_j + \text{**literal**}`,
      display: false,
    },
  ]);
  assert.ok(inlineRuns("**Flow $Q$**").every((r) => r.bold));
  assert.equal(
    paragraphRuns("$$x_i+y_j\n+z_k$$")
      .flat()
      .map((r) => r.text)
      .join("\n"),
    "$$x_i+y_j\n+z_k$$",
  );
});

test("escaped currency does not become a formula beside real math", () => {
  const runs = inlineRuns(String.raw`\$5 and \$10; $x_i$`);
  assert.equal(runs.filter((r) => r.latex !== undefined).length, 1);
  assert.equal(runs.find((r) => r.latex !== undefined).latex, "x_i");
});
