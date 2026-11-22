import { chromium } from "@playwright/test";
import { browserOptions } from "./runtime.mjs";
import assert from "node:assert/strict";
import { parse, serialize, INITIAL } from "../src/model.js";
const browser = await chromium.launch(browserOptions);
const page = await browser.newPage();
page.setDefaultTimeout(8000);
page.on("pageerror", (error) => console.log(error.message));
try {
  const initial = parse(INITIAL);
  initial.nodes[0].label = String.raw`Flow $x_i + y_j$`;
  initial.nodes[1].label = "$$a\n+b$$";
  initial.edges[0].label = String.raw`$\Delta P$`;
  await page.addInitScript(
    (source) =>
      localStorage.setItem(
        "rea-whimsical-board-v1",
        JSON.stringify({ source, title: "Math round trip" }),
      ),
    serialize(initial),
  );
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5199");
  await page.locator(".rea-diagram svg .node").first().waitFor();
  const result = await page.evaluate(async () => {
    const { createLayout } = await import("/src/layout.js");
    const { parse, INITIAL } = await import("/src/model.js");
    const { exportSelection, svgToPng } = await import("/src/clipboard.js");
    const { createRichSurface } = await import("/src/rich-text-surface.js");
    const model = parse(INITIAL);
    model.nodes[0].label = String.raw`Flow $x_i + y_j$ and **bold**`;
    model.nodes[1].label = "$$a\n+b$$";
    model.edges[0].label = String.raw`$\Delta P$`;
    let calls = 0;
    const svg = document.querySelector(".rea-diagram svg");
    const layout = createLayout(
      svg,
      model,
      (el) => model.nodes.find((n) => el.id.includes(`flowchart-${n.id}-`))?.id,
      {
        renderMath: (source, display) => {
          calls++;
          const el = document.createElement("span");
          el.className = "native-math-test";
          el.dataset.display = String(display);
          el.textContent = source;
          return el;
        },
      },
    );
    const initial = calls;
    layout.move(model.nodes[0].id, { x: 150, y: 120 });
    layout.redraw();
    layout.resize(model.nodes[0].id, { width: 360, height: 160 });
    const cached = calls === initial;
    const n = layout.nodes.get(model.nodes[0].id);
    const input = createRichSurface(document, { value: n.label }).input;
    const preserved = input.value === n.label && !input.querySelector("em");
    const block = "$$x_i + y_j\n+z_k$$";
    const blockInput = createRichSurface(document, { value: block }).input;
    const blockPreserved =
      blockInput.value === block && !blockInput.querySelector("em");
    n.label = String.raw`$\alpha$`;
    layout.resize(n.id, { width: 360, height: 160 });
    const exported = exportSelection(svg, layout, [], null, "#ffffff");
    const png = await svgToPng(exported, document);
    return {
      png: png.type,
      svgMath: exported.text.includes("native-math-test"),
      initial,
      cached,
      preserved,
      blockPreserved,
      updated: n.mathEl.textContent,
      nodeMath: svg.querySelectorAll(".node .native-math-test").length,
      edgeMath: svg.querySelectorAll(".rea-wire-labels .native-math-test")
        .length,
      display: svg.querySelector('[data-display="true"]').textContent,
    };
  });
  assert.equal(result.png, "image/png");
  assert.ok(result.svgMath);
  assert.equal(result.initial, 3);
  assert.ok(result.cached);
  assert.ok(result.preserved);
  assert.ok(result.blockPreserved);
  assert.equal(result.updated, String.raw`\alpha`);
  assert.equal(result.nodeMath, 2);
  assert.equal(result.edgeMath, 1);
  assert.equal(result.display, "a\n+b");
  console.log(
    "PASS: inline/display math projection, connector equations, cached rerouting, source edits and TeX-safe rich editing.",
  );
} catch (error) {
  console.log(await page.locator("body").innerText());

  throw error;
} finally {
  await browser.close();
}
