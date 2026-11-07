import { FuzzySuggestModal } from "obsidian";
export const isLinkableNote = (file) =>
  file.extension === "md" &&
  !file.path
    .split("/")
    .some(
      (part) =>
        part.startsWith(".") ||
        ["node_modules", "_backups", "dist", "build", "vendor"].includes(part),
    );
function choose(app, items, title, itemText) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    class Picker extends FuzzySuggestModal {
      getItems() {
        return items;
      }
      getItemText(item) {
        return itemText(item);
      }
      onChooseItem(item) {
        done(item);
      }
      onClose() {
        window.setTimeout(() => done(null), 0);
      }
    }
    const modal = new Picker(app);
    modal.setPlaceholder(title);
    modal.open();
  });
}
export function noteTargets(app, file) {
  const cache = app.metadataCache.getFileCache(file),
    base = file.path.replace(/\.md$/, "");
  return [
    { label: "Whole note", target: base },
    ...(cache?.headings || []).map((h) => ({
      label: `Heading: ${h.heading}`,
      target: `${base}#${h.heading}`,
    })),
    ...Object.keys(cache?.blocks || {}).map((id) => ({
      label: `Block: ^${id}`,
      target: `${base}#^${id}`,
    })),
  ];
}
export async function pickNoteLink(app) {
  const file = await choose(
    app,
    app.vault
      .getMarkdownFiles()
      .filter(isLinkableNote)
      .sort((a, b) => a.path.localeCompare(b.path)),
    "Link to a note…",
    (f) => f.path,
  );
  if (!file) return null;
  const target = await choose(
    app,
    noteTargets(app, file),
    "Choose the whole note, a heading, or a block…",
    (t) => t.label,
  );
  return target?.target || null;
}
