import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { browserOptions } from "./runtime.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });
  page.setDefaultTimeout(8000);
  await page.goto(
    new URL(
      "/session.html",
      process.env.REA_BOARD_TEST_URL || "http://127.0.0.1:5199",
    ).href,
  );
  await page.evaluate(async () => {
    const host = document.createElement("div");
    host.id = "app";
    document.body.append(host);
    const { mount } = await import("/src/canvas.js");
    const { suggestNoteLinks } = await import("/src/inline-note-links.js");
    const file = {
      path: "Drafts/Scratchpad.md",
      basename: "Scratchpad",
      extension: "md",
    };
    let note = "# Goal\n\nThe goal of this synthesis.\n";
    const app = {
      vault: {
        getMarkdownFiles: () => [file],
        cachedRead: async () => note,
        process: async (_file, fn) => {
          note = fn(note);
          window.testNote = note;
        },
      },
      metadataCache: {
        getFirstLinkpathDest: () => file,
        getFileCache: () => ({
          headings: [{ heading: "Goal" }],
          sections: [
            {
              type: "paragraph",
              position: {
                start: { offset: 8 },
                end: { offset: note.trimEnd().length },
              },
            },
          ],
        }),
      },
    };
    window.mountLinkBoard = mount;
    window.linkBoard = mount(document.querySelector("#app"), {
      source: 'flowchart LR\na["Read"] --> b["Other thought"]',
      suggestLinks: (query) => suggestNoteLinks(app, "Test.board", query),
      openLink: (target) => {
        window.openedTarget = target;
      },
      save: async (source) => {
        window.savedSource = source;
      },
    });
  });
  await page
    .getByRole("button", { name: "Edit Read", exact: true })
    .locator(".rea-shape-body")
    .dblclick();
  const editor = page.getByRole("textbox", { name: "Shape text", exact: true });
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially(" [[Scratch");
  await page.getByRole("option", { name: /Scratchpad/ }).waitFor();
  await page.getByRole("button", { name: "# Heading", exact: true }).click();
  await page.getByRole("option", { name: /Goal/ }).waitFor();
  await editor.press("Enter");
  assert.equal(await editor.locator("a").count(), 1);
  await editor.press("ArrowLeft");
  const raw = editor.locator("[data-raw-link]");
  await raw.waitFor();
  assert.equal(await raw.textContent(), "[[Drafts/Scratchpad#Goal]]");
  await editor.evaluate((el) => {
    const at = el.value.indexOf("]]");
    el.setSelectionRange(at, at);
  });
  await editor.pressSequentially("|Section");
  await editor.press("Enter");
  await editor.getByRole("link", { name: "Section", exact: true }).waitFor();
  assert.equal(
    await editor.evaluate((el) => el.value),
    "Read [[Drafts/Scratchpad#Goal|Section]]",
  );

  await editor.getByRole("link", { name: "Section", exact: true }).click();
  await raw.waitFor();
  await editor.press("ControlOrMeta+Home");
  await raw.waitFor({ state: "detached" });
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially("[[Scratchpad^synthesis");
  await page.getByRole("option", { name: /goal of this synthesis/ }).waitFor();
  await page
    .getByRole("button", { name: "| Display text", exact: true })
    .click();
  await editor.pressSequentially("goal here");
  await page.getByRole("option", { name: /goal here/ }).waitFor();
  await editor.press("Enter");
  assert.match(
    await page.evaluate(() => window.testNote),
    /synthesis\. \^atlas-[0-9a-f]{8}/,
  );
  await editor.pressSequentially("[[@Other");
  await page.getByRole("option", { name: /Other thought/ }).waitFor();
  await editor.press("Enter");
  await editor.pressSequentially("[Web](https://example.com)");
  assert.equal(await editor.locator("a").count(), 4);
  await editor.press("Enter");
  await page
    .getByRole("img", { name: "Contains links", exact: true })
    .waitFor();
  await page.locator('.rea-inline-link[data-text-link*="#^"]').click();
  assert.match(
    await page.evaluate(() => window.openedTarget),
    /^Drafts\/Scratchpad#\^atlas-/,
  );
  await page.evaluate(() => window.linkBoard.flush());
  const target = await page.evaluate(() => {
    const source = window.savedSource;
    window.linkBoard.destroy();
    const mount = window.mountLinkBoard;
    const target = window.openedTarget;
    window.openedTarget = null;
    window.linkBoard = mount(document.querySelector("#app"), {
      source,
      openLink: (link) => {
        window.openedTarget = link;
      },
    });
    return target;
  });
  const reopenedLink = page.locator('.rea-inline-link[data-text-link*="#^"]');
  await reopenedLink.click();
  assert.equal(await page.evaluate(() => window.openedTarget), target);
  await page.evaluate(() => (window.openedTarget = null));
  await reopenedLink.press("Enter");
  assert.equal(await page.evaluate(() => window.openedTarget), target);
  await page.locator('.rea-inline-link[data-text-link="@shape:b"]').click();
  await page
    .getByRole("button", { name: "Edit Other thought", exact: true })
    .locator(".rea-shape-body")
    .waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Edit Other thought", exact: true })
      .evaluate((el) => el.classList.contains("rea-selected")),
  );
  console.log(
    "PASS: inline heading, paragraph anchor with alias, shape navigation, and Markdown web links coexist.",
  );
} finally {
  await browser.close();
}
