import { richLines } from "../text-format.js";

/** Typography bounds, independent of shape padding and grid-sized cards. */
export function annotationSize(node, measure, resolveTitle, width) {
  const natural = richLines(node.label, 1000000, measure, resolveTitle);
  const lineWidth = (line) =>
    line.indent +
    line.runs.reduce((sum, run) => sum + measure(run.text, run), 0);
  const fixed =
    width ?? (node.textWrap ? node.width || node.size?.width : null);
  const contentWidth = Math.max(
    16,
    Math.min(
      4000,
      fixed ?? Math.ceil(Math.max(0, ...natural.map(lineWidth))) + 2,
    ),
  );
  const lines = richLines(node.label, contentWidth, measure, resolveTitle);
  return {
    width: contentWidth,
    height: Math.min(
      4000,
      Math.max(24, lines.length * Math.ceil((node.textSize || 16) * 1.4)),
    ),
  };
}
