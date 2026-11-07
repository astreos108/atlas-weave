import { browserOptions } from "./runtime.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { parse } from "../src/model.js";
const browser = await chromium.launch(browserOptions),
  context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(8000);
const src = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
    ),
  model = async () => parse(await src());
const paste = async (text) =>
  page.locator(".rea-canvas").evaluate((el, text) => {
    el.focus();
    const d = new DataTransfer();
    d.setData("text/plain", text);
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: d,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);
try {
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178");
  await page.locator(".node").first().waitFor();
  await page.getByRole("button", { name: "Rename board", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Board name", exact: true })
    .fill("Smooth foundation");
  await page
    .getByRole("textbox", { name: "Board name", exact: true })
    .press("Enter");
  assert.equal(
    await page
      .getByRole("button", { name: "Rename board", exact: true })
      .innerText(),
    "Smooth foundation",
  );
  const count = (await model()).nodes.length;
  await paste('flowchart LR\n x["Clipboard 😀"] --> y["Editable"]');
  await page.waitForTimeout(500);
  assert.equal((await model()).nodes.length, count + 2);
  assert.equal(await page.locator(".rea-selected").count(), 2);
  // Plain copy/paste is Mermaid and retains a selected subgraph.
  await page.locator(".rea-canvas").focus();
  await page.keyboard.press("ControlOrMeta+c");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(parse(copied).nodes.length, 2);
  await page.locator(".rea-canvas").focus();
  console.log("copy PNG");
  await page.keyboard.press("ControlOrMeta+Shift+c");
  await page.waitForTimeout(1500);
  const png = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return items.flatMap((i) => i.types);
  });
  assert.ok(
    png.includes("image/png"),
    await page.locator(".rea-status").innerText(),
  );
  console.log("copy SVG");
  await page.mouse.click(1200, 800, { button: "right" });
  await page
    .getByRole("button", { name: "Copy as SVG", exact: true })
    .last()
    .click();
  await page.waitForTimeout(300);
  const svg = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("Clipboard 😀"));
  assert.ok(!svg.includes("A little idea"));
  assert.ok(!svg.includes("rea-quick-add"));
  // Native Board text copying remains editable and additive.
  console.log("paste roundtrip");
  await paste(copied);
  await page.waitForTimeout(400);
  assert.equal((await model()).nodes.length, count + 4);
  await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
  await page.waitForTimeout(300);
  console.log("quick add");
  await page.mouse.click(1000, 800);
  await page
    .getByRole("button", { name: "Edit Editable", exact: true })
    .first()
    .click();
  const body = await page
      .getByRole("button", { name: "Edit Editable", exact: true })
      .first()
      .boundingBox(),
    toolbar = await page
      .getByRole("toolbar", { name: "Selection options" })
      .boundingBox();
  assert.ok(
    toolbar.y + toolbar.height <= body.y || toolbar.y >= body.y + body.height,
  );
  await page
    .getByRole("button", { name: "Add idea top", exact: true })
    .click({ force: true });
  await page
    .getByRole("textbox", { name: "Shape text", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal((await model()).nodes.length, count + 5);
  // Pan completely away; recovery must stay available.
  await page.locator(".rea-canvas").hover({ position: { x: 1000, y: 700 } });
  await page.mouse.wheel(7000, 7000);
  await page
    .getByRole("button", { name: "Zoom to content", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Zoom to content", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal(
    await page
      .getByRole("button", { name: "Zoom to content", exact: true })
      .isVisible(),
    false,
  );
  // World-grid phase matches the SVG origin at arbitrary pan/zoom.
  const phase = await page.evaluate(() => {
    const c = document.querySelector(".rea-canvas"),
      r = c.getBoundingClientRect(),
      s = getComputedStyle(c),
      size = parseFloat(s.backgroundSize),
      [x, y] = s.backgroundPosition.split(" ").map(parseFloat),
      m = document.querySelector(".rea-diagram svg").getScreenCTM();
    return [
      (((m.e - r.left - x - size / 2) % size) + size) % size,
      (((m.f - r.top - y - size / 2) % size) + size) % size,
      size,
    ];
  });
  assert.ok(phase.slice(0, 2).every((x) => Math.min(x, phase[2] - x) < 0.02));
  const guidePage = await context.newPage();
  await guidePage.addInitScript(() =>
    localStorage.setItem(
      "rea-whimsical-board-v1",
      JSON.stringify({
        source:
          'flowchart LR\\n a["Snap A"]\\n b["Snap B"]\\n %% board-layout: {"version":2,"nodes":{"a":{"x":300,"y":300,"width":160,"height":80},"b":{"x":700,"y":460,"width":160,"height":80}}}'.replaceAll(
            "\\n",
            "\n",
          ),
        title: "Grid verification",
      }),
    ),
  );
  await guidePage.goto(
    process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178",
  );
  await guidePage
    .getByRole("button", { name: "Edit Snap A", exact: true })
    .waitFor();
  const a = await guidePage
      .getByRole("button", { name: "Edit Snap A", exact: true })
      .boundingBox(),
    b = await guidePage
      .getByRole("button", { name: "Edit Snap B", exact: true })
      .boundingBox();
  await guidePage.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await guidePage.mouse.down();
  await guidePage.mouse.move(b.x + b.width / 2 + 3, a.y + a.height / 2 + 30, {
    steps: 12,
  });
  await guidePage.waitForTimeout(80);
  assert.ok((await guidePage.locator(".rea-guides line").count()) > 0);
  await guidePage.mouse.up();
  await guidePage.waitForTimeout(100);
  assert.equal(await guidePage.locator(".rea-guides line").count(), 0);
  const saved = parse(
    await guidePage.evaluate(
      () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
    ),
  );
  assert.equal(saved.nodes[0].position.x, 700);
  assert.equal(saved.nodes[0].position.y % 20, 0);
  await guidePage.screenshot({ path: "research/grid-alignment.png" });
  await guidePage.close();
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "research/smooth-foundation.png" });
  console.log(
    "PASS: floating rename, automatic additive Mermaid paste, editable copy, selected PNG clipboard, standalone SVG clipboard, quick-add, unobtrusive toolbar, offscreen recovery.",
  );
} catch (e) {
  console.log(await page.locator("body").innerText());
  await page.screenshot({ path: "research/foundation-failure.png" });
  throw e;
} finally {
  await browser.close();
}
