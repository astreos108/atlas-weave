import { browserOptions } from "./runtime.mjs";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { parse } from "../src/model.js";
const browser = await chromium.launch(browserOptions),
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(10000);
const source = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
    ),
  model = async () => parse(await source());
const center = async (el) => {
  const b = await el.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function apply(text) {
  await page
    .getByRole("button", { name: "More board options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mermaid source", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Mermaid source", exact: true })
    .fill(text);
  await page
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
  await page.waitForTimeout(250);
}
async function drag(el, dx, dy) {
  const p = await center(el);
  if ((await el.getAttribute("data-edge-grip")) === "true") {
    const side = await el.getAttribute("data-resize");
    if (["e", "w"].includes(side)) p.y += 14;
    else p.x += 14;
  }
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
try {
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5178");
  await page.locator(".node").first().waitFor();
  await apply(
    'flowchart LR\n a["First"]\n b["Second"]\n a -->|Cause| b\n %% board-layout: {"version":2,"nodes":{"a":{"x":200,"y":200,"width":160,"height":80},"b":{"x":600,"y":400,"width":160,"height":80}}}',
  );
  await page.getByRole("button", { name: "Edit First", exact: true }).click();
  const old = await page
    .getByRole("button", { name: "Edit First", exact: true })
    .boundingBox();
  await drag(
    page.getByRole("button", { name: "Resize e corner", exact: true }),
    60,
    70,
  );
  const after = await page
    .getByRole("button", { name: "Edit First", exact: true })
    .boundingBox();
  assert.ok(after.width > old.width + 40);
  assert.ok(Math.abs(after.height - old.height) < 1);
  assert.ok(Math.abs(after.x - old.x) < 1);
  await page.locator(".rea-canvas").focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page
    .getByRole("combobox", { name: "Arrange selection", exact: true })
    .selectOption("left");
  const aligned = await model();
  assert.equal(
    aligned.nodes[0].position.x - aligned.nodes[0].size.width / 2,
    aligned.nodes[1].position.x - aligned.nodes[1].size.width / 2,
  );
  await page
    .getByRole("button", { name: "Frame selection", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(150);
  const frame = (await model()).nodes.find((n) => n.shape === "frame");
  assert.equal(frame.members.length, 2);
  const before = await model();
  const fb = await page
    .getByRole("button", { name: "Edit Frame", exact: true })
    .boundingBox();
  await page.mouse.move(fb.x + 50, fb.y + 20);
  await page.mouse.down();
  await page.mouse.move(fb.x + 110, fb.y + 60, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const moved = await model();
  for (const n of before.nodes) {
    const next = moved.nodes.find((p) => p.id === n.id);
    assert.ok(next.position.x > n.position.x);
    assert.equal(
      next.position.x - n.position.x,
      moved.nodes[0].position.x - before.nodes[0].position.x,
    );
  }
  await page.reload();
  await page.getByRole("button", { name: "Edit Frame", exact: true }).waitFor();
  assert.equal(
    (await model()).nodes.find((n) => n.shape === "frame").members.length,
    2,
  );
  await page
    .getByRole("button", { name: "Edit Frame", exact: true })
    .click({ position: { x: 50, y: 20 } });
  await page.getByRole("button", { name: "Delete shape", exact: true }).click();
  assert.equal((await model()).nodes.length, 2);
  // Basic Mermaid subgraphs retain editable membership, rather than becoming header bands.
  await apply(
    'flowchart LR\n subgraph grp["Mechanism"]\n a["Step one"]\n b["Step two"]\n a --> b\n end',
  );
  assert.equal(await page.locator(".rea-frame-node").count(), 1);
  assert.equal(
    (await model()).nodes.find((n) => n.shape === "frame").members.length,
    2,
  );
  await page
    .getByRole("button", { name: "Edit Step one", exact: true })
    .click();
  const previous = await center(
    page.getByRole("button", { name: "Edit Step one", exact: true }),
  );
  await page
    .getByRole("button", { name: "Add idea left", exact: true })
    .click({ force: true });
  await page
    .getByRole("textbox", { name: "Shape text", exact: true })
    .fill("Left idea");
  await page.keyboard.press("Enter");
  const added = await center(
      page.getByRole("button", { name: "Edit Left idea", exact: true }),
    ),
    kept = await center(
      page.getByRole("button", { name: "Edit Step one", exact: true }),
    );
  assert.ok(added.x < kept.x);
  assert.ok(Math.abs(previous.x - kept.x) < 1);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "research/public-release.png" });
  console.log(
    "PASS: edge-only resize, exact arrangement, true frame move/reopen/remove, editable subgraphs, left quick-add stability.",
  );
} finally {
  await browser.close();
}
