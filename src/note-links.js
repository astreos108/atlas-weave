export { isLinkableNote } from "./inline-note-links.js";
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
