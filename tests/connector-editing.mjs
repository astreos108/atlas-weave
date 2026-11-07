import { browserOptions } from "./runtime.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { parse } from "../src/model.js";
const browser = await chromium.launch(browserOptions),
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const source = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
    ),
  model = async () => parse(await source());
const center = async (l) => {
  const b = await l.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function drag(l, delta) {
  const p = await center(l);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(
    delta.target?.x ?? p.x + (delta.x || 0),
    delta.target?.y ?? p.y + (delta.y || 0),
    { steps: 15 },
  );
  await page.mouse.up();
  await page.waitForTimeout(300);
}
async function edge() {
  const p = await page
    .locator('[data-edge="0"] .rea-edge-hit')
    .evaluate((el) => {
      for (const t of [0.25, 0.5, 0.75, 0.1, 0.9]) {
        const p = el.getPointAtLength(el.getTotalLength() * t),
          s = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
        if (document.elementFromPoint(s.x, s.y)?.closest("[data-edge]"))
          return { x: s.x, y: s.y };
      }
      throw new Error("No visible point on connector");
    });
  await page.mouse.click(p.x, p.y);
}

try {
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178");
  await page.locator(".node").first().waitFor();
  await page
    .getByRole("button", { name: "More board options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mermaid source", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Mermaid source", exact: true })
    .fill(
      'flowchart LR\n a["Alpha"]\n b["Beta"]\n c["Gamma"]\n a -->|A label| b\n %% board-layout: {"version":1,"nodes":{"a":{"x":200,"y":300},"b":{"x":650,"y":300},"c":{"x":950,"y":600}}}',
    );
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
  await page.waitForTimeout(250);
  await edge();
  await drag(
    page.getByRole("button", { name: "Drag connector segment 1", exact: true }),
    { y: -150 },
  );
  assert.ok((await model()).edges[0].waypoints.length > 0);
  assert.equal((await model()).edges[0].routing, "orthogonal");
  await page
    .getByRole("button", { name: "Reconnect target endpoint", exact: true })
    .waitFor();
  const gamma = await center(
    page.getByRole("button", { name: "Edit Gamma", exact: true }),
  );
  await drag(
    page.getByRole("button", {
      name: "Reconnect target endpoint",
      exact: true,
    }),
    { target: gamma },
  );
  assert.equal((await model()).edges[0].to, "c");
  assert.equal((await model()).edges[0].label, "A label");
  const before = await source();
  await drag(
    page.getByRole("button", {
      name: "Reconnect target endpoint",
      exact: true,
    }),
    { target: { x: 1300, y: 850 } },
  );
  assert.equal(await source(), before);
  await page.locator('[data-edge="0"] .rea-wire-label').waitFor();
  await drag(page.locator('[data-edge="0"] .rea-wire-label'), { x: 50, y: 90 });
  assert.ok((await model()).edges[0].labelOffset);
  const movedLabel = await source();
  await page.reload();
  await page.locator(".node").first().waitFor();
  assert.equal(await source(), movedLabel);
  await edge();
  await page
    .getByRole("button", { name: "Reset connector route", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal((await model()).edges[0].waypoints, undefined);
  await page.getByRole("button", { name: "Edit Alpha", exact: true }).click();
  await drag(page.getByRole("button", { name: "Edit Alpha", exact: true }), {
    x: 67,
    y: 43,
  });
  const p = (await model()).nodes.find((n) => n.id === "a").position;
  assert.equal(p.x % 20, 0);
  assert.equal(p.y % 20, 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "research/connector-editing.png" });
  console.log(
    "PASS: straight-to-orthogonal grip, reconnect target without losing label, blank-drop cancel, movable label, reopening, reset route, grid snapping.",
  );
} catch (e) {
  console.log(await page.locator("body").innerText());
  await page.screenshot({ path: "research/connector-editing-failure.png" });
  throw e;
} finally {
  await browser.close();
}
