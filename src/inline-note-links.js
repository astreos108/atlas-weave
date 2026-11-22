export const isLinkableNote = (file) =>
  file.extension === "md" &&
  !file.path
    .split("/")
    .some(
      (part) =>
        part.startsWith(".") ||
        ["node_modules", "_backups", "dist", "build", "vendor"].includes(part),
    );
const safeTarget = (text) => !/[[\]|\r\n]/.test(text);

export async function suggestNoteLinks(app, sourcePath, query) {
  const separator = query.search(/[#^]/);
  if (separator !== -1 && query[separator] === "^")
    query = query.slice(0, separator) + "#" + query.slice(separator);
  const hash = query.indexOf("#");
  if (hash === -1) {
    const needle = query.toLowerCase().trim();
    return app.vault
      .getMarkdownFiles()
      .filter(isLinkableNote)
      .flatMap((file) => {
        const target = file.path.slice(0, -3);
        if (!safeTarget(target)) return [];
        const aliases =
          app.metadataCache.getFileCache(file)?.frontmatter?.aliases;
        const names = [
          file.basename,
          ...(Array.isArray(aliases)
            ? aliases.filter((a) => typeof a === "string")
            : typeof aliases === "string"
              ? [aliases]
              : []),
        ];
        const match = names.find((name) => name.toLowerCase().includes(needle));
        if (!match && !target.toLowerCase().includes(needle)) return [];
        return [
          {
            label: match || file.basename,
            detail: target,
            target,
            alias:
              match !== file.basename && safeTarget(match || "")
                ? match
                : undefined,
            rank:
              file.basename.toLowerCase() === needle
                ? 0
                : match?.toLowerCase().startsWith(needle)
                  ? 1
                  : 2,
          },
        ];
      })
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .slice(0, 12);
  }
  const note = query.slice(0, hash);
  const file =
    app.metadataCache.getFirstLinkpathDest(note, sourcePath) ||
    app.vault.getAbstractFileByPath?.(
      note.endsWith(".md") ? note : note + ".md",
    );
  if (!file || !isLinkableNote(file)) return [];
  const base = file.path.slice(0, -3);
  const fragment = query.slice(hash + 1);
  const cache = app.metadataCache.getFileCache(file);
  if (!fragment.startsWith("^"))
    return (cache?.headings || [])
      .filter(
        ({ heading }) =>
          safeTarget(heading) &&
          heading.toLowerCase().includes(fragment.toLowerCase()),
      )
      .map(({ heading }) => ({
        label: heading,
        target: base + "#" + heading,
        detail: file.basename,
      }));
  const snapshot = await app.vault.cachedRead(file);
  return blockSuggestions(app, file, cache, snapshot, fragment.slice(1));
}

const searchable = (text) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function blockSuggestions(app, file, cache, snapshot, query) {
  const base = file.path.slice(0, -3);
  const needle = searchable(query);
  const words = needle.split(" ").filter(Boolean);
  const headings = cache?.headings || [];
  const existing = cache?.blocks || {};
  const rows = [];
  function add(block, id, kind) {
    const { start, end } = block.position;
    if (
      start.offset < 0 ||
      end.offset > snapshot.length ||
      start.offset >= end.offset
    )
      return;
    const source = snapshot.slice(start.offset, end.offset).trim();
    if (!source) return;
    const heading =
      headings.findLast((h) => h.position?.start.offset < start.offset)
        ?.heading || "";
    const text = searchable(source);
    const haystack = searchable(
      [id, heading, source].filter(Boolean).join(" "),
    );
    if (words.some((word) => !haystack.includes(word))) return;
    const matchAt = words.length ? source.toLowerCase().indexOf(words[0]) : -1;
    const from = Math.max(0, matchAt - 40);
    const label =
      (from ? "…" : "") + source.slice(from, from + 180).replace(/\s+/g, " ");
    rows.push({
      label,
      detail: [heading, id ? "^" + id : "Add " + kind + " anchor"]
        .filter(Boolean)
        .join(" · "),
      ...(id
        ? { target: base + "#^" + id }
        : {
            resolve: () =>
              addAnchor(app, file, snapshot, start.offset, end.offset, kind),
          }),
      rank:
        needle && searchable(id || "") === needle
          ? 0
          : needle && text.startsWith(needle)
            ? 1
            : needle && text.includes(needle)
              ? 2
              : 3,
      offset: start.offset,
    });
  }
  for (const [id, block] of Object.entries(existing)) add(block, id, "block");
  const anchored = new Set(
    Object.values(existing).map((block) => block.position.start.offset),
  );
  const sections = cache?.sections || [];
  const listItems = new Set(cache?.listItems || []);
  const inline = new Set(["paragraph", "text"]);
  const separate = new Set(["blockquote", "callout", "table", "list", "code"]);
  for (const block of [...sections, ...listItems]) {
    if (block.id) {
      if (!Object.hasOwn(existing, block.id)) add(block, block.id, "block");
      continue;
    }
    if (anchored.has(block.position.start.offset)) continue;
    const kind = inline.has(block.type)
      ? "paragraph"
      : separate.has(block.type)
        ? block.type
        : listItems.has(block) &&
            block.position.start.line === block.position.end.line
          ? "list item"
          : null;
    if (!kind) continue;
    const text = snapshot.slice(
      block.position.start.offset,
      block.position.end.offset,
    );
    if (/\s\^[a-zA-Z0-9-]+\s*$/.test(text)) continue;
    add(block, null, kind);
  }
  return rows.sort((a, b) => a.rank - b.rank || a.offset - b.offset);
}

async function addAnchor(app, file, snapshot, start, end, kind) {
  let id;
  do {
    id = "atlas-" + crypto.randomUUID().slice(0, 8);
  } while (snapshot.includes("^" + id));
  const offset = snapshot.slice(0, end).trimEnd().length;
  if (
    offset <= start ||
    !/^(?:[ \t]*\r?\n|[ \t]*$)/.test(snapshot.slice(offset))
  )
    throw new Error("This block’s position changed. Search for it again.");
  const lineEnd = snapshot.includes("\r\n") ? "\r\n" : "\n";
  const suffix = snapshot.slice(offset);
  const anchor =
    kind === "paragraph" || kind === "list item"
      ? " ^" + id
      : lineEnd.repeat(2) + "^" + id + lineEnd + (suffix ? "" : lineEnd);
  await app.vault.process(file, (current) => {
    if (current !== snapshot)
      throw new Error("The note changed. Search for the block again.");
    return current.slice(0, offset) + anchor + current.slice(offset);
  });
  return file.path.slice(0, -3) + "#^" + id;
}
