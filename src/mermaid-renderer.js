import { parse as parseBoard } from "./model.js";
import mermaid from "mermaid";
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  maxTextSize: 200000,
  maxEdges: 1000,
  secure: ["securityLevel", "startOnLoad", "maxTextSize", "maxEdges", "secure"],
  theme: "base",
  themeVariables: {
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: "16px",
    primaryTextColor: "#353344",
    lineColor: "#9b96aa",
    edgeLabelBackground: "#faf9fc",
  },
  flowchart: {
    htmlLabels: false,
    curve: "basis",
    nodeSpacing: 65,
    rankSpacing: 90,
    padding: 24,
  },
  suppressErrorRendering: true,
});
export function checkSource(source) {
  if (typeof source !== "string" || !source.trim() || source.length > 200000)
    throw new Error("Mermaid source must contain 1–200000 characters");
  if (
    /<(?:img|image)\b|@\{[^}]*\bimg\s*:|\burl\s*\(\s*['"]?https?:/i.test(source)
  )
    throw new Error("Remote/image assets are not supported in Board diagrams");
}
export default {
  async parse(source) {
    checkSource(source);
    return mermaid.parse(source);
  },
  async render(id, source) {
    checkSource(source);
    // Editable Board labels are projected again by createLayout with native
    // Obsidian MathJax. Prevent Mermaid's KaTeX pass from interpreting encoded
    // label newlines (#10;) as TeX. This seed-layout string is never persisted.
    const layoutSource =
      source.includes("$$") && parseBoard(source)
        ? source.replaceAll("$$", "＄＄")
        : source;
    return mermaid.render(id, layoutSource);
  },
};
