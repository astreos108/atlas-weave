import { browserOptions } from "./runtime.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch(browserOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const stored = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
  );
const source = () => import("../src/model.js");
async function center(loc) {
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function drag(from, to) {
  const p = await center(from),
    q = typeof to.x === "number" ? to : await center(to);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
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
async function apply(text) {
  await showSource();
  await page
    .getByRole("textbox", { name: "Mermaid source", exact: true })
    .fill(text);
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await page.waitForTimeout(300);
}
try {
  await page.addInitScript(() =>
    localStorage.setItem("rea-whimsical-snap", "false"),
  );
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178");
  await page.locator(".node").first().waitFor();
  assert.equal(await page.locator("header,.rea-panel,aside").count(), 0);
  await apply(
    'flowchart LR\n  a["First"]\n  b["Second"]\n  %% board-layout: {"version":1,"nodes":{"a":{"x":150,"y":150},"b":{"x":500,"y":250}}}',
  );
  await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
  let a = page.getByRole("button", { name: "Edit First", exact: true }),
    b = page.getByRole("button", { name: "Edit Second", exact: true });
  await a.dblclick();
  const edit = page.getByRole("textbox", { name: "Shape text", exact: true });
  await edit.fill('[[Note]] "A" & [B] | ;');
  await edit.press("Enter");
  await page.waitForTimeout(250);
  a = page.getByRole("button", {
    name: 'Edit [[Note]] "A" & [B] | ;',
    exact: true,
  });
  await a.waitFor();
  assert.ok((await stored()).includes("#quot;"));
  await a.dblclick();
  await edit.fill("Do not save this");
  await edit.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Edit Do not save this", exact: true })
      .count(),
    0,
  );
  await a.click();
  await drag(
    page.getByRole("button", {
      name: "Drag right connection handle",
      exact: true,
    }),
    b,
  );
  const { parse } = await source();
  assert.equal(parse(await stored()).edges.length, 1);
  // Edge has a generous clickable hit area and edits its label in place.
  await page.locator(".rea-edge-hit").first().click({ force: true });
  await page
    .getByRole("button", { name: "Edit connection label", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Connection text", exact: true })
    .fill("Because it matters");
  await page
    .getByRole("textbox", { name: "Connection text", exact: true })
    .press("Enter");
  await page.waitForTimeout(250);
  assert.equal(parse(await stored()).edges[0].label, "Because it matters");
  // Dragging a connector into open space creates a linked shape.
  await b.click();
  await drag(
    page.getByRole("button", {
      name: "Drag bottom connection handle",
      exact: true,
    }),
    { x: 1050, y: 650 },
  );
  assert.equal(parse(await stored()).nodes.length, 3);
  assert.equal(parse(await stored()).edges.length, 2);
  // Cancelled drags and self drops do not leave nodes, edges, or previews behind.
  await b.click();
  const before = await stored(),
    p = await center(
      page.getByRole("button", {
        name: "Drag left connection handle",
        exact: true,
      }),
    );
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(400, 600, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(await stored(), before);
  assert.equal(await page.locator(".rea-preview").isVisible(), false);
  await b.click();
  await drag(
    page.getByRole("button", {
      name: "Drag left connection handle",
      exact: true,
    }),
    b,
  );
  assert.equal(await stored(), before);
  // Shape controls float beside the selection; color/type and duplication persist.
  await b.click();
  await page.getByRole("button", { name: "Shape color", exact: true }).click();
  await page
    .getByRole("button", { name: "Color #d1fae5", exact: true })
    .click();
  await page.waitForTimeout(250);
  assert.equal(
    parse(await stored()).nodes.find((n) => n.id === "b").fill,
    "#d1fae5",
  );
  await page
    .getByRole("combobox", { name: "Shape type", exact: true })
    .selectOption("diamond");
  await page.waitForTimeout(250);
  assert.equal(
    parse(await stored()).nodes.find((n) => n.id === "b").shape,
    "diamond",
  );
  await page
    .getByRole("button", { name: "Duplicate shape (⌘D)", exact: true })
    .click();
  await page.waitForTimeout(250);
  assert.equal(parse(await stored()).nodes.length, 4);
  await page.getByRole("button", { name: "Delete shape", exact: true }).click();
  await page.waitForTimeout(250);
  assert.equal(parse(await stored()).nodes.length, 3);
  // Source validation, undo and export remain available under More.
  const valid = await stored();
  await showSource();
  await page
    .getByRole("textbox", { name: "Mermaid source", exact: true })
    .fill("invalid syntax");
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await page
    .locator(".rea-source-error")
    .filter({ hasText: "Check your syntax" })
    .waitFor();
  assert.equal(await stored(), valid);
  await page.getByRole("button", { name: "Close source", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(250);
  assert.equal(parse(await stored()).nodes.length, 4);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForTimeout(250);
  assert.equal(parse(await stored()).nodes.length, 3);
  await more();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Markdown", exact: true })
    .click();
  assert.ok((await downloading).suggestedFilename().endsWith(".md"));
  // Both theme controls affect all floating controls and survive reopening.
  await more();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  assert.equal(await page.locator(".rea").getAttribute("data-theme"), "dark");
  assert.equal(
    await page
      .locator(".rea-canvas")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(29, 28, 28)",
  );
  await page.screenshot({ path: "research/intuitive-dark.png" });
  await page.reload();
  await page.locator(".node").first().waitFor();
  assert.equal(await page.locator(".rea").getAttribute("data-theme"), "dark");
  await more();
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  assert.equal(
    await page
      .locator(".rea-canvas")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(255, 253, 245)",
  );
  await page
    .getByRole("button", { name: "More board options", exact: true })
    .click();
  await page.screenshot({ path: "research/intuitive-light.png" });

  await more();
  await page
    .getByRole("button", { name: "Present board", exact: true })
    .click();
  await page.getByRole("button", { name: "Next idea", exact: true }).waitFor();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".rea-presenter").isVisible(), false);
  const savedBeforeTypeSwitch = await stored();
  await apply("sequenceDiagram\nAlice->>Bob: Hello");
  await page.locator(".actor").first().waitFor();
  await page
    .getByRole("button", { name: "Add rectangle (R)", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Mermaid source", exact: true })
      .inputValue(),
    "sequenceDiagram\nAlice->>Bob: Hello",
  );
  await page.getByRole("button", { name: "Close source", exact: true }).click();
  await apply(
    'flowchart LR\n  x["Start"]\n  y["End"]\n  %% board-layout: {"version":1,"nodes":{"x":{"x":150,"y":150},"y":{"x":500,"y":250}}}',
  );
  await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect shapes (C)", exact: true })
    .click();
  await drag(
    page.getByRole("button", { name: "Edit Start", exact: true }),
    page.getByRole("button", { name: "Edit End", exact: true }),
  );
  assert.equal(parse(await stored()).edges.length, 1);
  await page.getByRole("button", { name: "Edit Start", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("textbox", { name: "Shape text", exact: true })
    .fill("Keyboard text");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  assert.equal(
    parse(await stored()).nodes.find((n) => n.id === "x").label,
    "Keyboard text",
  );
  await apply(savedBeforeTypeSwitch);
  await page.setViewportSize({ width: 600, height: 800 });
  await more();
  await page.screenshot({ path: "research/intuitive-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: no header/sidebar, inline shape and edge text, handle drag connections, linked shape creation, cancel/self drop, floating colors and types, duplicate/delete, source validation, undo/redo, export, light/dark persistence, narrow viewport.",
  );
} catch (e) {
  await page.screenshot({ path: "research/interactions-failure.png" });
  console.log(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}
