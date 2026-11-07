import { browserOptions } from "./runtime.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { serialize, parse } from "../src/model.js";
const browser = await chromium.launch(browserOptions),
  context = await browser.newContext({
    viewport: { width: 1500, height: 1100 },
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(8000);
const source = serialize({
  direction: "LR",
  nodes: [
    {
      id: "a",
      label: "Short text",
      shape: "rect",
      fill: "#ffffff",
      stroke: "#9a8ab0",
      position: { x: 350, y: 300 },
      size: { width: 320, height: 160 },
    },
    {
      id: "b",
      label: "Another",
      shape: "rect",
      fill: "#ffffff",
      stroke: "#9a8ab0",
      position: { x: 350, y: 550 },
      size: { width: 320, height: 120 },
    },
    {
      id: "f",
      label: "Frame title",
      shape: "frame",
      fill: "#dbeafe",
      stroke: "#9a8ab0",
      position: { x: 550, y: 400 },
      size: { width: 1000, height: 700 },
      members: ["a", "b"],
    },
  ],
  edges: [],
});
const saved = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
    ),
  model = async () => parse(await saved());
const input = page.getByRole("textbox", { name: "Shape text", exact: true });
try {
  await page.addInitScript(
    (source) =>
      localStorage.setItem(
        "rea-whimsical-board-v1",
        JSON.stringify({ source, title: "Text editing" }),
      ),
    source,
  );
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178");
  const node = () => page.locator('.node[id*="flowchart-a-"]');
  await node().waitFor();
  await node().dblclick();
  const nb = await node().boundingBox(),
    ib = await input.boundingBox();
  assert.ok(ib.height > nb.height * 0.8, "editor fills shape height");
  assert.equal(await page.locator(".rea-character-count").isVisible(), false);
  await input.fill("Draft across applications");
  const other = await context.newPage();
  await other.goto("about:blank");
  await page.bringToFront();
  assert.equal(await input.inputValue(), "Draft across applications");
  await other.close();
  await input.fill("selected");
  await input.press("ControlOrMeta+a");
  await input.press("(");
  assert.equal(await input.inputValue(), "(selected)");
  await input.press("ControlOrMeta+z");
  assert.equal(await input.inputValue(), "selected");
  await input.press("ControlOrMeta+Shift+z");
  assert.equal(await input.inputValue(), "(selected)");
  await input.press("Escape");
  await page
    .getByRole("button", { name: "More board options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Character counter", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Character target", exact: true })
    .fill("10");
  await page
    .getByRole("spinbutton", { name: "Character target", exact: true })
    .press("Tab");
  await page
    .getByRole("button", { name: "More board options", exact: true })
    .click();
  await node().dblclick();
  await input.fill("Text can exceed the target freely");
  assert.equal(
    await page.locator(".rea-character-count").innerText(),
    "33 / 10",
  );
  await input.fill("one\ntwo\nthree");
  await input.press("ControlOrMeta+a");
  await page
    .getByRole("button", { name: "Numbered list", exact: true })
    .click();
  assert.equal(await input.inputValue(), "1. one\n2. two\n3. three");
  await input.press("ControlOrMeta+End");
  await input.press("Enter");
  assert.ok((await input.inputValue()).endsWith("4. "));
  const text =
    "**Bold** and *italic* ==marked== [[Folder/My Note|Visible title]] [Site](https://example.com)\nSecond paragraph\nJustified words that wrap across more than one display line and remain readable, with enough additional material to exercise the overflow indicator and still retain every character when the shape is fitted to its content";
  await input.fill(text);
  await input.evaluate((el) => el.setSelectionRange(0, 4));
  await page
    .getByRole("combobox", { name: "Text alignment", exact: true })
    .selectOption("left");
  const second = text.indexOf("Second"),
    third = text.indexOf("Justified");
  await input.evaluate(
    (el, start) => el.setSelectionRange(start, start + 6),
    second,
  );
  await input.press("ArrowRight");
  await page
    .getByRole("combobox", { name: "Text alignment", exact: true })
    .selectOption("right");
  await input.evaluate(
    (el, start) => el.setSelectionRange(start, start + 6),
    third,
  );
  await input.press("ArrowRight");
  await page
    .getByRole("combobox", { name: "Text alignment", exact: true })
    .selectOption("justify");
  await input.press("ControlOrMeta+Enter");
  await page.waitForTimeout(300);
  assert.deepEqual(
    (await model()).nodes.find((n) => n.id === "a").textAlignments,
    ["left", "right", "justify"],
  );
  assert.ok(await node().locator('tspan[font-weight="600"]').count());
  assert.ok(await node().locator('tspan[font-style="italic"]').count());
  assert.ok(await node().locator(".rea-text-marks rect").count());
  assert.ok((await node().textContent()).includes("Visible title"));
  assert.equal(
    await node().locator('a[data-text-link="https://example.com"]').count(),
    1,
  );
  assert.equal(await node().locator(".rea-text-truncated").count(), 1);
  await node().click();
  const grip = page.getByRole("button", {
      name: "Resize e corner",
      exact: true,
    }),
    g = await grip.boundingBox();
  await grip.dblclick({
    position: { x: g.width / 2, y: g.height / 2 + 14 },
    force: true,
  });
  await page.waitForTimeout(250);
  assert.equal(await node().locator(".rea-text-truncated").count(), 0);
  assert.ok((await model()).nodes.find((n) => n.id === "a").size.width > 320);
  // Double-click empty frame interior creates a member without renaming the frame.
  const frame = page.locator('.node[id*="flowchart-f-"]'),
    fb = await frame.boundingBox(),
    count = (await model()).nodes.length;
  await page.mouse.dblclick(fb.x + fb.width * 0.85, fb.y + fb.height * 0.45);
  await page.waitForTimeout(250);
  const next = await model();
  assert.equal(next.nodes.length, count + 1);
  assert.equal(next.nodes.find((n) => n.id === "f").label, "Frame title");
  assert.equal(next.nodes.find((n) => n.id === "f").members.length, 3);
  // Reuse a view as Obsidian does when navigating pages, retaining cursor and draft.
  await page.evaluate(async (source) => {
    const { mount } = await import("/src/canvas.js");
    const host = document.createElement("div");
    host.className = "rea-test-session";
    host.style.height = "900px";
    document.body.replaceChildren(host);
    window.sessionBoard = mount(host, {
      source,
      title: "Session",
      save: async (s) => (window.sessionSource = s),
    });
  }, source);
  await page
    .getByRole("button", { name: "Edit Short text", exact: true })
    .dblclick();
  await input.fill("Persistent page draft");
  await input.evaluate((el) => el.setSelectionRange(5, 10));
  await page.evaluate(async () => {
    const session = window.sessionBoard.getEditorSession();
    await window.sessionBoard.flush();
    window.sessionBoard.destroy();
    const { mount } = await import("/src/canvas.js");
    window.sessionBoard = mount(document.querySelector(".rea-test-session"), {
      source: window.sessionSource,
      title: "Session",
      editorSession: session,
      save: async () => {},
    });
  });
  await input.waitFor();
  assert.equal(await input.inputValue(), "Persistent page draft");
  assert.deepEqual(
    await input.evaluate((el) => [el.selectionStart, el.selectionEnd]),
    [5, 10],
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "research/text-editing.png" });
  console.log(
    "PASS: full-shape editor, blur/app-switch draft, wrapping pairs, optional soft counter, consistent lists, inline Markdown/links, per-paragraph alignment, edge auto-fit, frame interior quick-add, restored editor session.",
  );
} catch (e) {
  console.log(await page.locator("body").innerText(), errors);
  console.log(
    await page.locator(".node").evaluateAll((els) =>
      els.map((e) => ({
        id: e.id,
        aria: e.getAttribute("aria-label"),
        box: e.getBoundingClientRect().toJSON(),
      })),
    ),
  );
  await page.screenshot({ path: "research/text-editing-failure.png" });
  throw e;
} finally {
  await browser.close();
}
