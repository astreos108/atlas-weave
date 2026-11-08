import { browserOptions } from "./runtime.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { serialize, parse } from "../src/model.js";
const browser = await chromium.launch(browserOptions),
  page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(8000);
const source = serialize({
  direction: "LR",
  nodes: [
    {
      id: "a",
      label: "Thought",
      shape: "rect",
      fill: "#dbeafe",
      stroke: "#94a3b8",
      position: { x: 450, y: 330 },
      size: { width: 760, height: 360 },
    },
    {
      id: "b",
      label: "Target",
      shape: "rect",
      fill: "#d1fae5",
      stroke: "#94a3b8",
      position: { x: 1100, y: 330 },
      size: { width: 240, height: 160 },
    },
    {
      id: "f",
      label: "Frame title",
      shape: "frame",
      fill: "#ffffff",
      stroke: "#94a3b8",
      position: { x: 650, y: 350 },
      size: { width: 1300, height: 600 },
      members: ["a", "b"],
    },
  ],
  edges: [
    {
      from: "a",
      to: "b",
      label: "",
      routing: "orthogonal",
      fromSide: "right",
      toSide: "left",
      toRatio: 0.3,
    },
  ],
});
const field = page.getByRole("textbox", { name: "Shape text", exact: true });
const model = () =>
  page
    .evaluate(
      () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
    )
    .then(parse);
const node = (id) => page.locator(`.node[id*="flowchart-${id}-"]`);
async function selectEdge() {
  const p = await page
    .locator(".rea-edge-hit")
    .first()
    .evaluate((el) => {
      const p = el.getPointAtLength(el.getTotalLength() / 2);
      return new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM()).toJSON();
    });
  await page.mouse.click(p.x, p.y);
}
try {
  await page.addInitScript(
    (source) =>
      localStorage.setItem(
        "rea-whimsical-board-v1",
        JSON.stringify({ source, title: "Live writing" }),
      ),
    source,
  );
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5199");
  await node("a").waitFor();
  await node("a").dblclick();
  await field.fill("Toggle");
  await field.press("ControlOrMeta+a");
  await field.press("ControlOrMeta+b");
  assert.equal(await field.locator("strong").textContent(), "Toggle");
  await field.press("ControlOrMeta+i");
  assert.equal(await field.locator("em").textContent(), "Toggle");
  await field.press("ControlOrMeta+Shift+h");
  assert.equal(await field.locator("mark").textContent(), "Toggle");
  await field.fill("Start");
  await field.press("ControlOrMeta+End");
  await field.press("ControlOrMeta+b");
  assert.ok(!(await field.textContent()).includes("**"));
  await page.keyboard.type(" bold");
  assert.equal(await field.locator("strong").textContent(), " bold");
  await field.fill(
    "Live **bold** and *italic* ==highlight== [[Folder/Note|Note title]]",
  );
  assert.equal(await field.locator("strong").textContent(), "bold");
  assert.equal(await field.locator("em").textContent(), "italic");
  assert.equal(await field.locator("mark").textContent(), "highlight");
  assert.equal(await field.locator("a").textContent(), "Note title");
  await field.press("ControlOrMeta+a");
  await field.evaluate((el) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "**Replacement**\n==Clean==" },
    });
    el.dispatchEvent(event);
  });
  assert.equal(
    await field.evaluate((el) => el.value),
    "**Replacement**\n==Clean==",
  );
  await field.fill(
    "Live **bold** and *italic* ==highlight== [[Folder/Note|Note title]]",
  );
  assert.ok(!(await field.textContent()).includes("**"));
  assert.ok((await field.evaluate((el) => el.value)).includes("**bold**"));
  assert.equal(
    await field.evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(
    await field.evaluate((el) =>
      el.closest(".node").getAttribute("aria-label"),
    ),
    "Edit Thought",
  );
  await field.fill("Linked words");
  await field.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Web link", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Link target", exact: true })
    .fill("https://example.com");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  assert.equal(await field.locator("a").textContent(), "Linked words");
  assert.equal(
    await field.evaluate((el) => el.value),
    "[Linked words](https://example.com)",
  );
  await field.press("Escape");
  assert.equal(
    (await model()).nodes.find((n) => n.id === "a").label,
    "Thought",
  );
  // Auto-fit changes both dimensions while retaining position and the other shape.
  await node("a").click();
  const before = await model();
  const edge = page.getByRole("button", {
      name: "Resize e corner",
      exact: true,
    }),
    box = await edge.boundingBox();
  await edge.dblclick({
    position: { x: box.width / 2, y: box.height / 2 + 14 },
    force: true,
  });
  await page.waitForTimeout(200);
  const after = await model(),
    a = after.nodes.find((n) => n.id === "a");
  assert.ok(a.size.width < 760);
  assert.ok(a.size.height < 360);
  assert.deepEqual(a.position, before.nodes.find((n) => n.id === "a").position);
  assert.deepEqual(
    after.nodes.find((n) => n.id === "b"),
    before.nodes.find((n) => n.id === "b"),
  );
  // Frame editing occupies its header text, not a frame-sized field.
  await node("f").locator(".rea-node-text").dblclick({ force: true });
  assert.ok(await field.locator("div").count());
  const fb = await node("f").boundingBox(),
    tb = await field.boundingBox();
  assert.ok(tb.width < fb.width * 0.5);
  assert.ok(tb.height < fb.height * 0.25);
  await field.press("Escape");
  // Endpoint magnets use raw pointer coordinates, rather than a broad grid-rounded area.
  await selectEdge();
  let handle = page.getByRole("button", {
      name: "Reconnect target endpoint",
      exact: true,
    }),
    h = await handle.boundingBox(),
    target = await node("b").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y + target.height / 2 + 2, {
    steps: 12,
  });
  await page.waitForTimeout(80);
  assert.ok(await page.locator(".rea-connector-snap").count());
  const color = await page
    .locator(".rea-connector-guide")
    .first()
    .evaluate((el) => getComputedStyle(el).stroke);
  assert.equal(color, "rgb(22, 166, 160)");
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.equal((await model()).edges[0].toRatio, 0);
  await selectEdge();
  handle = page.getByRole("button", {
    name: "Reconnect target endpoint",
    exact: true,
  });
  h = await handle.boundingBox();
  target = await node("b").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y + target.height / 2 + 12, {
    steps: 10,
  });
  await page.waitForTimeout(80);
  assert.equal(await page.locator(".rea-connector-snap").count(), 0);
  await page.mouse.up();
  await page.waitForTimeout(150);
  assert.notEqual((await model()).edges[0].toRatio, 0);
  assert.equal(await page.locator(".rea-connector-guide").count(), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "research/live-writing.png" });
  console.log(
    "PASS: live styled DOM in the shape, hidden Markdown syntax, safe editable link targets, compact frame title, two-axis auto-fit, teal endpoint guides and narrow/free attachment ratios.",
  );
} catch (e) {
  console.log(await page.locator("body").innerText(), errors);
  await page.screenshot({ path: "research/live-writing-failure.png" });
  throw e;
} finally {
  await browser.close();
}
