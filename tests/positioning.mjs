import { browserOptions } from "./runtime.mjs";
import { parse } from "../src/model.js";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch(browserOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const source = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
  );
const positions = (s) => JSON.parse(s.split("%% board-layout: ")[1]).nodes;
async function more() {
  if (!(await page.getByRole("menu", { name: "Board options" }).isVisible()))
    await page
      .getByRole("button", { name: "More board options", exact: true })
      .click();
}
async function showSource() {
  await more();
  await page
    .getByRole("button", { name: "Mermaid source", exact: true })
    .click();
}
const center = async (locator) => {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function drag(locator, dx, dy) {
  const p = await center(locator);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  return p;
}
try {
  await page.addInitScript(() =>
    localStorage.setItem("rea-whimsical-snap", "false"),
  );
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178");
  await page.locator(".node").first().waitFor();
  const node = page.getByRole("button", {
      name: "Edit A little idea",
      exact: true,
    }),
    other = page.getByRole("button", {
      name: "Edit Make some space",
      exact: true,
    });
  const start = await center(node),
    otherStart = await center(other),
    path = await page.locator(".rea-wires path").first().getAttribute("d");
  await drag(node, 100, -150);
  await page.waitForFunction(() =>
    localStorage.getItem("rea-whimsical-board-v1")?.includes("board-layout"),
  );
  const end = await center(node);
  assert.ok(Math.abs(end.x - start.x - 100) < 2);
  assert.ok(Math.abs(end.y - start.y + 150) < 2);
  assert.notEqual(
    await page.locator(".rea-wires path").first().getAttribute("d"),
    path,
  );
  const otherEnd = await center(other);
  assert.ok(Math.abs(otherStart.x - otherEnd.x) < 2);
  assert.ok(Math.abs(otherStart.y - otherEnd.y) < 2);
  const moved = await source(),
    saved = positions(moved);
  assert.equal(Object.keys(saved).length, 4);
  // Comments still validate in Mermaid itself, and positions restore on reopening.
  await page.reload();
  await node.waitFor();
  await showSource();
  assert.equal(await page.locator(".rea-source").inputValue(), moved);
  await page.getByRole("button", { name: "Apply changes" }).click();
  assert.equal(await page.locator(".rea-source-error").innerText(), "");
  // A second drag after zooming must use world coordinates; undo returns the exact source.
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await drag(node, 60, 60);
  assert.notEqual(await source(), moved);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(await source(), moved);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForTimeout(200);
  assert.notEqual(await source(), moved);
  // Existing shapes stay put when a shape is added or its label size changes.
  const fixed = positions(await source());
  await page
    .getByRole("button", { name: "Add rectangle (R)", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".node").length === 5,
  );
  for (const [id, p] of Object.entries(fixed))
    assert.deepEqual(positions(await source())[id], p);
  await page.locator(".node").last().dblclick();
  await page
    .getByRole("textbox", { name: "Shape text", exact: true })
    .fill("A much longer thought, in the same place");
  await page
    .getByRole("textbox", { name: "Shape text", exact: true })
    .press("Enter");
  await page.waitForTimeout(200);
  for (const [id, p] of Object.entries(fixed))
    assert.deepEqual(positions(await source())[id], p);
  await more();
  await page.getByRole("button", { name: "Auto layout", exact: true }).click();
  await page.waitForTimeout(200);
  assert.ok(parse(await source()).nodes.every((n) => !n.position));
  // Blank boards can create their first shape, and negative positions remain visible after Fit.
  await showSource();
  await page.locator(".rea-source").fill("flowchart LR");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".node").length === 0,
  );
  await page
    .getByRole("button", { name: "Add decision (D)", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".node").length === 1,
  );
  await drag(page.locator(".node"), -400, -300);
  await page.getByTitle("Fit diagram", { exact: true }).click();
  const b = await page.locator(".node").boundingBox();
  assert.ok(
    b.x >= 0 && b.y >= 0 && b.x + b.width <= 1440 && b.y + b.height <= 960,
  );
  await page.screenshot({ path: "research/free-positioning.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: drag, connected edges, stationary neighbors, comment validation, reopening, zoom, undo/redo, stable add/edit, automatic reset, blank board, negative coordinates and fit.",
  );
} catch (e) {
  await page.screenshot({ path: "research/positioning-failure.png" });
  throw e;
} finally {
  await browser.close();
}
