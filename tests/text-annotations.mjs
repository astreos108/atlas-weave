import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { browserOptions } from "./runtime.mjs";
import { parse, serialize } from "../src/model.js";
const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const source = serialize({
    direction: "LR",
    nodes: [
      {
        id: "a",
        label: "Canvas heading",
        shape: "text",
        fill: "#ffffff",
        stroke: "#000000",
        position: { x: 300, y: 250 },
      },
      {
        id: "b",
        label: "A real shape",
        shape: "rect",
        fill: "#ffffff",
        stroke: "#000000",
        position: { x: 600, y: 450 },
      },
    ],
    edges: [],
  });
  await page.goto(
    new URL(
      "/session.html",
      process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5213",
    ).href,
  );
  await page.evaluate(async (source) => {
    const host = document.createElement("div");
    host.id = "app";
    document.body.append(host);
    const { mount } = await import("/src/canvas.js");
    window.mountAnnotation = mount;
    window.annotationBoard = mount(host, { source, save: async () => {} });
  }, source);
  const node = page.locator(".rea-text-node");
  await node.waitFor();
  assert.equal(
    await node
      .locator(".rea-shape-body")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  const initial = await node.boundingBox();
  await node.dblclick();
  const input = page.getByRole("textbox", { name: "Shape text", exact: true });
  await input.fill(
    "A much longer free floating canvas annotation that should grow on a single line",
  );
  const grown = await node.boundingBox();
  assert.ok(grown.width > initial.width * 2, "typing grows horizontally");
  assert.ok(Math.abs(grown.x - initial.x) < 3, "typing preserves left edge");
  assert.ok(grown.height < 40, "natural text does not wrap");
  await page.getByRole("button", { name: "Save text", exact: true }).click();
  await page.locator(".rea-live-foreign").waitFor({ state: "detached" });
  await node.click();
  assert.equal(await page.locator(".rea-handles").isVisible(), false);
  assert.equal(
    await page
      .getByRole("button", { name: "Shape color", exact: true })
      .isVisible(),
    false,
  );
  const handle = page.locator("[data-resize=e]");
  await handle.waitFor({ state: "visible" });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 300, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const saved = await page.evaluate(async () => {
    await window.annotationBoard.flush();
    return window.annotationBoard.getSource();
  });
  const n = parse(saved).nodes.find((n) => n.id === "a");
  assert.equal(n.textWrap, true);
  assert.ok(n.size.height > 24);
  await page.evaluate((source) => {
    window.annotationBoard.destroy();
    window.annotationBoard = window.mountAnnotation(
      document.querySelector("#app"),
      { source, save: async () => {} },
    );
  }, saved);
  await node.waitFor();
  const reopened = await node.boundingBox();
  assert.ok(
    reopened.height > 40,
    "manual width and wrapping survive reopening",
  );
  await node.dblclick();
  await input.fill("**Bold**\nSecond line");
  await page.getByRole("button", { name: "Save text", exact: true }).click();
  assert.ok(
    await node.locator('tspan[font-weight="600"]').count(),
    "rich formatting still renders",
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/atlas-free-floating-text.png" });
  console.log(
    "PASS: natural text growth, stable origin, no node controls, explicit width wrapping, reopen, and rich text.",
  );
} finally {
  await browser.close();
}
