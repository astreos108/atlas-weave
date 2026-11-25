import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { browserOptions } from "./runtime.mjs";
import { parse } from "../src/model.js";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto(process.env.REA_BOARD_TEST_URL);
  page.setDefaultTimeout(7000);
  await page.locator(".rea-diagram .node").first().waitFor();
  const canvas = page.locator(".rea-canvas");
  const paste = (text) =>
    canvas.evaluate((element, value) => {
      const data = new DataTransfer();
      data.setData("text/plain", value);
      element.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
      );
    }, text);
  const saved = async () =>
    parse(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("atlasweave-board-v1")).source,
      ),
    );
  await paste("| Phase | Meaning |\n| --- | --- |\n| One | First |");
  await page
    .getByRole("button", { name: "Edit Table (2 × 2)", exact: true })
    .dblclick();
  await page.getByRole("textbox", { name: "Row 2, column 2" }).fill("Updated");
  await canvas.dblclick({ position: { x: 1150, y: 130 } });
  await page.locator(".rea-content-card").getByText("Updated").waitFor();
  await paste("A\tB\n3\t4");
  await page
    .locator(".rea-content-card")
    .getByText("4", { exact: true })
    .waitFor();
  await paste('```js\n  const x = "<svg>";\n\n```');
  await page.getByRole("button", { name: "Fit diagram", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Code (js)", exact: true })
    .dblclick();
  await page
    .getByRole("textbox", { name: "Code (js) source" })
    .fill("  const x = 4;\n");
  await canvas.dblclick({ position: { x: 1150, y: 130 } });
  await page.locator(".rea-content-card").getByText("const x = 4;").waitFor();
  await paste("|tex\n\\frac{1}{2}\n|");
  await page.getByRole("button", { name: "Edit LaTeX", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Edit LaTeX", exact: true })
    .press("Enter");
  await page.getByRole("textbox", { name: "LaTeX source" }).fill("x^2");
  await canvas.dblclick({ position: { x: 1150, y: 130 } });
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page
    .locator(".rea-card-latex")
    .getByText("x^2", { exact: true })
    .waitFor();
  assert.deepEqual(
    (await saved()).nodes.filter((n) => n.card).map((n) => n.card.type),
    ["table", "table", "code", "latex"],
  );
  const surfaces = await page
    .locator(".rea-content-card")
    .evaluateAll((cards) =>
      cards.map((card) => ({
        hasShapeBody: !!card.parentElement.querySelector(".rea-shape-body"),
        height: Number(card.getAttribute("height")),
        contentHeight: card.firstElementChild.offsetHeight,
      })),
    );
  assert.equal(surfaces.length, 4);
  for (const surface of surfaces) {
    assert.equal(surface.hasShapeBody, false);
    assert.ok(surface.height - surface.contentHeight <= 2);
  }
  await page.reload();
  await page.locator(".rea-content-card").getByText("Updated").waitFor();
  assert.equal(
    (await saved()).nodes.find((n) => n.card?.type === "code").card.source,
    "  const x = 4;\n",
  );
  await page
    .getByRole("button", { name: "Pan (H or Space)", exact: true })
    .click();
  const transform = page.locator(".rea-transform");
  const original = await transform.evaluate((el) => el.style.transform);
  const card = await page
    .getByRole("button", { name: "Edit Table (2 × 2)", exact: true })
    .first()
    .boundingBox();
  await page.mouse.move(card.x + 30, card.y + 12);
  await page.mouse.down();
  await page.mouse.move(card.x + 210, card.y + 100, { steps: 12 });
  await page.mouse.up();
  assert.notEqual(
    await transform.evaluate((el) => el.style.transform),
    original,
  );
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Select (V)", exact: true }).click();
  const shapes = page.getByRole("button", { name: "Shapes", exact: true });
  await shapes.click();
  await page
    .getByRole("button", { name: "Add code block", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Add LaTeX block", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Add table", exact: true }).click();
  await canvas.click({ position: { x: 1100, y: 650 } });
  await page.getByRole("dialog", { name: "Edit Table (2 × 2)" }).waitFor();
  await page.getByRole("button", { name: "Add column", exact: true }).click();
  await page.getByRole("textbox", { name: "Row 1, column 3" }).fill("Notes");
  await page.getByRole("button", { name: "Add row", exact: true }).click();
  const newCell = page.getByRole("textbox", { name: "Row 3, column 1" });
  await newCell.fill("New row");
  const dragHandle = async (name, target) => {
    const from = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    const to = await page
      .getByRole("textbox", { name: target, exact: true })
      .boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
  };
  await dragHandle("Drag row 3", "Row 2, column 1");
  assert.equal(
    await page.getByRole("textbox", { name: "Row 2, column 1" }).inputValue(),
    "New row",
  );
  await dragHandle("Drag row 2", "Row 3, column 1");
  await dragHandle("Drag column 3", "Row 1, column 2");
  assert.equal(
    await page.getByRole("textbox", { name: "Row 1, column 2" }).inputValue(),
    "Notes",
  );
  await dragHandle("Drag column 2", "Row 1, column 3");
  await page
    .getByRole("button", { name: "Drag column 3", exact: true })
    .click({ button: "right" });
  await page
    .getByRole("button", { name: "Delete column", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Drag row 2", exact: true })
    .click({ button: "right" });
  await page.getByRole("button", { name: "Delete row", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Row 2, column 1" })
    .press("ControlOrMeta+Enter");
  await page
    .locator(".rea-content-card")
    .getByText("New row", { exact: true })
    .waitFor();

  await page
    .getByRole("button", { name: "Place text (T)", exact: true })
    .click();
  await canvas.click({ position: { x: 1100, y: 380 } });
  const editor = page.getByRole("textbox", { name: "Shape text" });
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData(
      "text/plain",
      "\n| Feature | Status | Priority | Notes |\n| :--- | :---: | ---: | --- |\n| **User Auth** | Active | 1 | Uses `OAuth 2.0` [link](https://example.com) |\n",
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
    );
  });
  const table = page
    .locator(".rea-content-card table")
    .filter({ hasText: "User Auth" });
  await table.locator("strong").filter({ hasText: "User Auth" }).waitFor();
  assert.equal(await table.locator("th").count(), 4);
  assert.equal(
    await table
      .locator("td")
      .nth(2)
      .evaluate((cell) => getComputedStyle(cell).textAlign),
    "right",
  );
  await table.getByRole("link", { name: "link" }).waitFor();
  const before = await saved();
  await paste(
    'subgraph import_frame["Imported frame"]\n direction TB\n qa["Frame member"]\nend',
  );
  await page
    .getByRole("button", { name: "Edit Imported frame", exact: true })
    .waitFor();
  const withFrame = await saved();
  const frame = withFrame.nodes.find((node) => node.label === "Imported frame");
  assert.equal(frame.shape, "frame");
  assert.equal(
    withFrame.nodes.find((node) => node.id === frame.members[0]).label,
    "Frame member",
  );
  assert.ok(
    before.nodes.every((node) =>
      withFrame.nodes.some(
        (next) => next.id === node.id && next.label === node.label,
      ),
    ),
  );
  await paste("sequenceDiagram\n Alice->>Bob: Hello");
  await page
    .getByRole("button", { name: "Edit Code (mermaid)", exact: true })
    .waitFor();
  assert.equal(
    (await saved()).nodes.find((node) => node.card?.language === "mermaid").card
      .source,
    "sequenceDiagram\n Alice->>Bob: Hello",
  );
  await paste(
    [
      "flowchart LR",
      'subgraph value["Import Value"]',
      'v1["Projects"]',
      'v2["Skills"]',
      "v1 -->|build through practice| v2",
      "end",
      'subgraph plan["Import Plan"]',
      'p1["Actions"]',
      'p2["Milestones"]',
      "p1 -->|build toward| p2",
      "end",
      'subgraph health["Import Health"]',
      'h1["Body"]',
      'h2["Capacity to act"]',
      "h1 --> h2",
      "end",
      "v2 -->|can support| p1",
      "p2 -->|guides| h1",
      "h2 -->|feedback| v1",
      "v1 -->|supports action| p1",
      "p1 -->|prioritizes health| h2",
      "h2 -->|sets pace| p2",
      "p2 -->|guides practice| v2",
      "v2 -->|sustains capacity| h2",
      "h1 -->|supports milestones| p1",
    ].join("\n"),
  );
  await page
    .getByRole("button", { name: "Edit Import Health", exact: true })
    .waitFor();
  const grouped = await saved();
  const frames = grouped.nodes
    .filter(
      (node) => node.label.startsWith("Import ") && node.shape === "frame",
    )
    .sort((a, b) => a.position.x - b.position.x);
  assert.equal(frames.length, 3);
  for (let i = 1; i < frames.length; i++) {
    const [left, right] = frames.slice(i - 1, i + 1);
    assert.ok(
      right.position.x - left.position.x >=
        (left.size.width + right.size.width) / 2 + 79,
    );
  }
  const importedRoutes = grouped.edges.filter((edge) =>
    [
      "can support",
      "guides",
      "feedback",
      "supports action",
      "prioritizes health",
      "sets pace",
      "guides practice",
      "sustains capacity",
      "supports milestones",
    ].includes(edge.label),
  );
  assert.equal(importedRoutes.length, 9);
  const top = Math.min(
    ...frames.map((frame) => frame.position.y - frame.size.height / 2),
  );
  const bottom = Math.max(
    ...frames.map((frame) => frame.position.y + frame.size.height / 2),
  );
  const lanes = importedRoutes.map((edge) => {
    assert.equal(edge.routing, "orthogonal");
    const index = edge.waypoints.findIndex(
      (point, index) =>
        edge.waypoints[index + 1]?.y === point.y &&
        (point.y < top || point.y > bottom),
    );
    assert.ok(index >= 0, edge.label);
    const a = edge.waypoints[index];
    const b = edge.waypoints[index + 1];
    return { y: a.y, left: Math.min(a.x, b.x), right: Math.max(a.x, b.x) };
  });
  lanes.forEach((a, index) => {
    for (const b of lanes.slice(index + 1))
      assert.ok(a.y !== b.y || a.right < b.left || b.right < a.left);
  });
  console.log(
    "PASS: table, spreadsheet, code and LaTeX cards round trip, and pan starts over card content.",
  );
} finally {
  await browser.close();
}
