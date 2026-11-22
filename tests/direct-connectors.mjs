import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { browserOptions } from "./runtime.mjs";
import { parse } from "../src/model.js";

const source = `flowchart LR
  a["Parent"]
  b["Occupied slot"]
  c["Target"]
  f["Level 3: Lymphocyte Activation"]
  b -->|"Related"| c
  linkStyle 0 stroke:#f59e0b,stroke-width:2px
  %% board-layout: {"version":4,"nodes":{"a":{"x":200,"y":280,"width":160,"height":80},"b":{"x":440,"y":280,"width":160,"height":80},"c":{"x":740,"y":490,"width":160,"height":80},"f":{"x":480,"y":350,"width":1000,"height":600,"frame":true,"members":["a","b","c"]}}}`;
const browser = await chromium.launch(browserOptions);
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.setDefaultTimeout(8000);
const read = async () =>
  parse(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source,
    ),
  );
const node = (name) =>
  page.getByRole("button", { name: `Edit ${name}`, exact: true });
const port = (side) =>
  page.getByRole("button", {
    name: `Drag ${side} connection handle`,
    exact: true,
  });
const center = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const hoverNode = (name) => node(name).locator(".rea-shape-body").hover();
const ghost = page.locator(".rea-thought-ghost");

try {
  await page.addInitScript(
    (source) =>
      localStorage.setItem(
        "rea-whimsical-board-v1",
        JSON.stringify({ source }),
      ),
    source,
  );
  await page.goto(process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5199");
  await node("Parent").waitFor();
  assert.equal(await port("right").isVisible(), false);
  await hoverNode("Parent");
  await port("right").hover();
  await ghost.waitFor();
  const proposed = await ghost.boundingBox();
  await port("right").click();
  const editor = page.getByRole("textbox", { name: "Shape text", exact: true });
  await editor.fill("New branch");
  await editor.press("Enter");
  const created = await node("New branch")
    .locator(".rea-shape-body")
    .boundingBox();
  for (const key of ["x", "y", "width", "height"])
    assert.ok(Math.abs(proposed[key] - created[key]) < 2, key);
  const occupied = await node("Occupied slot")
    .locator(".rea-shape-body")
    .boundingBox();
  assert.ok(
    created.y + created.height < occupied.y ||
      created.y > occupied.y + occupied.height,
  );

  await hoverNode("Parent");
  const start = await center(port("bottom"));
  const target = await center(node("Target").locator(".rea-shape-body"));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.locator(".rea-preview").waitFor();
  assert.equal(await ghost.isVisible(), false);
  await page.mouse.up();
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source.includes(
      "a --> c",
    ),
  );
  const saved = await read();
  const connection = saved.edges.find(
    (edge) => edge.from === "a" && edge.to === "c",
  );
  assert.equal(connection.toRatio, 0);
  assert.equal(connection.toSide, undefined);
  assert.equal(saved.nodes.length, 5);
  const arrow = page.locator('[data-edge="2"] .rea-edge-line');
  const before = await arrow.getAttribute("d");
  assert.ok(await arrow.getAttribute("marker-end"));
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x - 300, target.y - 290, { steps: 12 });
  await page.mouse.up();
  assert.notEqual(await arrow.getAttribute("d"), before);
  assert.ok(await arrow.getAttribute("marker-end"));

  await hoverNode("Parent");
  const lowerPort = await center(port("bottom"));
  await page.mouse.move(lowerPort.x, lowerPort.y);
  await page.mouse.down();
  await page.mouse.move(1220, 740, { steps: 12 });
  await ghost.waitFor();
  const dropPreview = await ghost.boundingBox();
  await page.mouse.up();
  const dropped = await node("A new thought")
    .locator(".rea-shape-body")
    .boundingBox();
  for (const key of ["x", "y", "width", "height"])
    assert.ok(Math.abs(dropPreview[key] - dropped[key]) < 2, key);

  await page
    .getByRole("button", { name: "More board options", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  const frameTitle = node("Level 3: Lymphocyte Activation").locator(
    ".rea-node-text",
  );
  assert.equal(
    await frameTitle.textContent(),
    "Level 3: Lymphocyte Activation",
  );
  assert.equal(
    await frameTitle.evaluate((el) => getComputedStyle(el).whiteSpace),
    "pre",
  );
  const titleColor = await frameTitle.evaluate(
    (el) => getComputedStyle(el).fill,
  );
  assert.equal(titleColor, "rgb(238, 234, 245)");
  await frameTitle.dblclick({ force: true });
  assert.equal(
    await editor.evaluate((el) => getComputedStyle(el).color),
    titleColor,
  );
  assert.equal(
    await editor.evaluate((el) => el.value),
    "Level 3: Lymphocyte Activation",
  );
  await editor.press("Escape");

  const lineColors = await page
    .locator(".rea-edge-line")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).stroke));
  const arrowColors = await page
    .locator(".rea-connector-arrow")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
  assert.deepEqual(lineColors, arrowColors);
  assert.notEqual(lineColors[0], lineColors[1]);
  await page.locator(".rea-wire-label").first().click();
  const direction = page.getByRole("combobox", { name: "Connector direction" });
  await direction.selectOption("both");
  const firstLine = page.locator('[data-edge="0"] .rea-edge-line');
  assert.ok(await firstLine.getAttribute("marker-start"));
  await direction.selectOption("one");
  assert.equal(await firstLine.getAttribute("marker-start"), null);
  await page
    .getByRole("button", { name: "Reverse connector", exact: true })
    .click();
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("rea-whimsical-board-v1")).source.includes(
      "c -->|",
    ),
  );
  assert.deepEqual(
    (await read()).edges
      .slice(0, 1)
      .map(({ from, to, color }) => ({ from, to, color })),
    [{ from: "c", to: "b", color: "#f59e0b" }],
  );
  console.log(
    "PASS: hover ports, collision-free preview, matching placement, center attachments, arrow retention, and dark frame titles.",
  );
} finally {
  await browser.close();
}
