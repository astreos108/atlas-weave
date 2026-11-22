import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestNoteLinks } from "../src/inline-note-links.js";

test("a block suggestion never writes into a note changed since the search", async () => {
  const file = {
    path: "Drafts/Scratchpad.md",
    basename: "Scratchpad",
    extension: "md",
  };
  let content = "Original paragraph.\n";
  const app = {
    vault: {
      cachedRead: async () => content,
      process: async (_file, update) => {
        content = update(content);
      },
    },
    metadataCache: {
      getFirstLinkpathDest: () => file,
      getFileCache: () => ({
        sections: [
          {
            type: "paragraph",
            position: { start: { offset: 0 }, end: { offset: 19 } },
          },
        ],
      }),
    },
  };
  const [result] = await suggestNoteLinks(
    app,
    "Test.board",
    "Scratchpad#^Original",
  );
  assert.equal(result.label, "Original paragraph.");
  content = "A different paragraph.\n";
  await assert.rejects(result.resolve(), /The note changed/);
  assert.equal(content, "A different paragraph.\n");
});

test("block search includes late passages and is scoped to the selected note", async () => {
  const notes = ["Drafts", "Archive"].map((folder) => ({
    path: folder + "/Scratchpad.md",
    basename: "Scratchpad",
    extension: "md",
  }));
  const fixture = (folder) => {
    const position = (start, end) => ({
      start: { offset: start },
      end: { offset: end },
    });
    const blocks = {};
    let content = "## Scope of " + folder + "\n\n";
    for (let i = 0; i < 16; i++) {
      const id = "earlier-" + i;
      const line = "Earlier paragraph ^" + id;
      blocks[id] = {
        position: position(content.length, content.length + line.length),
      };
      content += line + "\n\n";
    }
    const passage = "A résumé about the central question.";
    const sections = [
      {
        type: "paragraph",
        position: position(content.length, content.length + passage.length),
      },
    ];
    content += passage + "\n";
    return {
      content,
      cache: {
        blocks,
        sections,
        headings: [{ heading: "Scope of " + folder, position: position(0, 1) }],
      },
    };
  };
  const fixtures = new Map(
    notes.map((note) => [note.path, fixture(note.path.split("/")[0])]),
  );
  const app = {
    vault: {
      cachedRead: async (file) => fixtures.get(file.path).content,
      getAbstractFileByPath: (path) => notes.find((note) => note.path === path),
      process: async (file, update) => {
        const data = fixtures.get(file.path);
        data.content = update(data.content);
      },
    },
    metadataCache: {
      getFirstLinkpathDest: () => null,
      getFileCache: (file) => fixtures.get(file.path).cache,
    },
  };
  assert.equal(
    (await suggestNoteLinks(app, "Test.board", "Drafts/Scratchpad#^")).length,
    17,
  );
  const [result] = await suggestNoteLinks(
    app,
    "Test.board",
    "Archive/Scratchpad#^archive resume central",
  );
  assert.equal(result.label, "A résumé about the central question.");
  assert.match(await result.resolve(), /^Archive\/Scratchpad#\^atlas-/);
  assert.match(fixtures.get(notes[1].path).content, /question\. \^atlas-/);
  assert.doesNotMatch(fixtures.get(notes[0].path).content, /\^atlas-/);
});
