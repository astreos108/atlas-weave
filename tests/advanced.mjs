import { browserOptions } from "./runtime.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { parse } from "../src/model.js";
const browser = await chromium.launch(browserOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
  );
const model = async () => parse(await saved());
const node = (label) =>
  page.getByRole("button", { name: `Edit ${label}`, exact: true });
const center = async (l) => {
  const b = await l.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function drag(from, to) {
  const a = typeof from.x === "number" ? from : await center(from);
  const b = typeof to.x === "number" ? to : await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}
async function more() {
  if (!(await page.getByRole("menu", { name: "Board options" }).isVisible()))
    await page
      .getByRole("button", { name: "More board options", exact: true })
      .click();
}
const fixture =
  'flowchart LR\n  a["Alpha"]\n  b["Beta"]\n  c["Gamma"]\n  a --> b\n  b --> c\n  %% board-layout: {"version":1,"nodes":{"a":{"x":200,"y":200},"b":{"x":500,"y":200},"c":{"x":900,"y":400}}}';
async function imported(text) {
  await more();
  await page
    .getByRole("button", { name: "Mermaid source", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Mermaid source", exact: true })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Mermaid source", exact: true })
    .fill(text);
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await page.waitForTimeout(400);
}
try {
  await page.addInitScript(() =>
    localStorage.setItem("rea-whimsical-snap", "false"),
  );
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178");
  await page.locator(".node").first().waitFor();
  await imported("```mermaid\n" + fixture + "\n```");
  assert.equal(await page.locator(".node").count(), 3);
  assert.equal((await model()).edges.length, 2);
  // Real corner resizing increases the geometry, keeps the opposing corner fixed, and survives reopening.
  await node("Alpha").click();
  const old = await node("Alpha").boundingBox(),
    handle = page.getByRole("button", {
      name: "Resize se corner",
      exact: true,
    }),
    h = await center(handle);
  await drag(handle, { x: h.x + 130, y: h.y + 80 });
  let changed = await node("Alpha").boundingBox();
  assert.ok(changed.width > old.width + 100);
  assert.ok(Math.abs(changed.x - old.x) < 2);
  assert.ok(Math.abs(changed.y - old.y) < 2);
  const resized = (await model()).nodes.find((n) => n.id === "a");
  assert.ok(resized.size.width > 150);
  const storedResize = await saved();
  await page.reload();
  await node("Alpha").waitFor();
  assert.equal(await saved(), storedResize);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); // Fresh view history intentionally has no undo; no data loss.
  // Box-select two shapes and move them as a single history entry while the third stays still.
  await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
  const a = await node("Alpha").boundingBox(),
    b = await node("Beta").boundingBox();
  const before = await model();
  await drag(
    { x: Math.min(a.x, b.x) - 20, y: Math.min(a.y, b.y) - 20 },
    {
      x: Math.max(a.x + a.width, b.x + b.width) + 20,
      y: Math.max(a.y + a.height, b.y + b.height) + 20,
    },
  );
  assert.equal(await page.locator(".rea-selected").count(), 2);
  await page
    .getByRole("button", { name: "Duplicate shapes (⌘D)", exact: true })
    .waitFor();
  const ac = await center(node("Alpha"));
  await drag(node("Alpha"), { x: ac.x + 60, y: ac.y + 70 });
  let moved = await model();
  const da = {
      x: moved.nodes[0].position.x - before.nodes[0].position.x,
      y: moved.nodes[0].position.y - before.nodes[0].position.y,
    },
    db = {
      x: moved.nodes[1].position.x - before.nodes[1].position.x,
      y: moved.nodes[1].position.y - before.nodes[1].position.y,
    };
  assert.ok(Math.abs(da.x - db.x) < 0.1 && Math.abs(da.y - db.y) < 0.1);
  assert.ok(da.x > 0 && da.y > 0);
  assert.deepEqual(moved.nodes[2].position, before.nodes[2].position);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(300);
  assert.deepEqual(
    (await model()).nodes.map((n) => n.position),
    before.nodes.map((n) => n.position),
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForTimeout(300);
  // Shift-click toggles members; duplicating a group also duplicates its internal links.
  await node("Alpha").click();
  await node("Beta").click({ modifiers: ["Shift"] });
  assert.equal(await page.locator(".rea-selected").count(), 2);
  await page
    .getByRole("button", { name: "Duplicate shapes (⌘D)", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal((await model()).nodes.length, 5);
  assert.equal((await model()).edges.length, 3);
  await page
    .getByRole("button", { name: "Delete shapes", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal((await model()).nodes.length, 3);
  assert.equal((await model()).edges.length, 2);
  // Color and routing persist as Mermaid linkStyle plus Board routing metadata.
  const edge = page.locator('[data-edge="0"]');
  await edge.locator(".rea-edge-hit").click({ force: true });
  await page
    .getByRole("combobox", { name: "Connector routing", exact: true })
    .selectOption("orthogonal");
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "Connection color", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connection color #3b82f6", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal((await model()).edges[0].routing, "orthogonal");
  assert.equal((await model()).edges[0].color, "#3b82f6");
  assert.match(await saved(), /linkStyle 0 stroke:#3b82f6/);
  assert.equal(
    await edge
      .locator(".rea-edge-line")
      .evaluate((el) => getComputedStyle(el).stroke),
    "rgb(59, 130, 246)",
  );
  const d = await edge.locator(".rea-edge-line").getAttribute("d"),
    numbers = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  for (let i = 2; i < numbers.length; i += 2)
    assert.ok(
      numbers[i] === numbers[i - 2] || numbers[i + 1] === numbers[i - 1],
    );
  await page
    .getByRole("combobox", { name: "Connection label width", exact: true })
    .selectOption("100");
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "Edit connection label", exact: true })
    .click();
  const text =
    "This is a much longer thought that needs to wrap gracefully\nAnd an explicit second paragraph";
  await page
    .getByRole("textbox", { name: "Connection text", exact: true })
    .fill(text);
  await page
    .getByRole("textbox", { name: "Connection text", exact: true })
    .press("Enter");
  await page.waitForTimeout(300);
  assert.equal((await model()).edges[0].label, text);
  assert.ok((await edge.locator("tspan").count()) > 2);
  const label = await edge.locator(".rea-wire-label").boundingBox();
  assert.ok(label.width <= 125);
  for (const loc of [node("Alpha"), node("Beta")]) {
    const b = await loc.boundingBox();
    assert.ok(
      label.x + label.width < b.x ||
        label.x > b.x + b.width ||
        label.y + label.height < b.y ||
        label.y > b.y + b.height,
    );
  } // 100 world units at <=1.2 zoom.
  const complete = await saved();
  await page.reload();
  await node("Alpha").waitFor();
  assert.equal(await saved(), complete);
  assert.equal((await model()).edges[0].labelWidth, 100);
  assert.ok((await page.locator('[data-edge="0"] tspan').count()) > 2);
  await page.screenshot({ path: "research/resize-groups-routing.png" });
  // Invalid pasted imports retain the existing board; common inline syntax is editable after import.
  await imported("not Mermaid at all");
  assert.equal(await saved(), complete);
  await page
    .locator(".rea-source-error")
    .filter({ hasText: "Check your syntax" })
    .waitFor();
  await page.getByRole("button", { name: "Close source", exact: true }).click();
  await imported(
    "flowchart TD\nA[Start] --> B{A question}\nB -->|Yes| C([Done])",
  );
  assert.equal(await page.locator(".node").count(), 3);
  await node("A question").click();
  await page
    .getByRole("button", { name: "Resize se corner", exact: true })
    .waitFor();
  // Keyboard select-all and panning leave Mermaid content intact.
  await page.locator(".rea-canvas").focus();
  await page.keyboard.press("Meta+a");
  assert.equal(await page.locator(".rea-selected").count(), 3);
  const beforePan = await saved();
  await page.keyboard.down("Space");
  await drag({ x: 1100, y: 700 }, { x: 1150, y: 740 });
  await page.keyboard.up("Space");
  assert.equal(await saved(), beforePan);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: paste import, resize/reopen, box select, group move/undo, Shift selection, group duplicate/delete with edges, connector color, right angles, multiline wrapping labels and width, persisted metadata, invalid import, editable inline Mermaid and keyboard/pan.",
  );
} catch (e) {
  await page.screenshot({ path: "research/advanced-failure.png" });
  console.log(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}
