import { mathSegments } from "./math-source.js";
export const ALIGNMENTS = ["left", "center", "right", "justify"];
export function characterCount(text) {
  if (typeof Intl.Segmenter === "function")
    return [
      ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        text,
      ),
    ].length;
  return Array.from(text).length;
}
export function inlineRuns(text, resolveTitle, style = {}, depth = 0) {
  if (depth > 8) return [{ text, ...style }];
  const runs = [];
  let plain = "";
  const flush = () => {
    if (plain) {
      runs.push({ text: plain, ...style });
      plain = "";
    }
  };
  for (let i = 0; i < text.length;) {
    const tail = text.slice(i);
    if (tail.startsWith("\\$")) {
      plain += tail.slice(0, 2);
      i += 2;
      continue;
    }
    if (tail.startsWith("$")) {
      const math = mathSegments(tail)[0];
      if (math?.math) {
        flush();
        const delimiter = math.display ? "$$" : "$";
        const raw = delimiter + math.text + delimiter;
        runs.push({
          ...style,
          text: raw,
          latex: math.text,
          display: math.display,
        });
        i += raw.length;
        continue;
      }
    }
    const wiki = /^\[\[([^\]\n]+)\]\]/.exec(tail);
    const link = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/.exec(
      tail,
    );
    if (wiki || link) {
      flush();
      if (wiki) {
        const [target, alias] = wiki[1].split("|");
        const title =
          alias ||
          resolveTitle?.(target) ||
          target.split("#")[0].split("/").pop().replace(/\.md$/i, "");
        runs.push({
          ...style,
          text: title || target,
          link: target,
          internal: true,
          wikiAlias: alias !== undefined,
        });
        i += wiki[0].length;
      } else {
        runs.push(
          ...inlineRuns(
            link[1],
            resolveTitle,
            { ...style, link: link[2], internal: false },
            depth + 1,
          ),
        );
        i += link[0].length;
      }
      continue;
    }
    let matched = false;
    for (const [delimiter, property] of [
      ["**", "bold"],
      ["__", "bold"],
      ["==", "highlight"],
      ["*", "italic"],
      ["_", "italic"],
      ["`", "code"],
    ]) {
      if (!tail.startsWith(delimiter)) continue;
      let end = text.indexOf(delimiter, i + delimiter.length);
      if (
        delimiter.length === 2 &&
        ["**", "__"].includes(delimiter) &&
        text[end + 2] === delimiter[0] &&
        text.slice(i + 2, end).split(delimiter[0]).length % 2 === 0
      )
        end++;
      if (end <= i + delimiter.length) continue;
      flush();
      const body = text.slice(i + delimiter.length, end);
      runs.push(
        ...(property === "code"
          ? [{ ...style, code: true, text: body }]
          : inlineRuns(
              body,
              resolveTitle,
              { ...style, [property]: true },
              depth + 1,
            )),
      );
      i = end + delimiter.length;
      matched = true;
      break;
    }
    if (!matched) {
      plain += text[i];
      i++;
    }
  }
  flush();
  return runs;
}
/** Preserve multiline TeX as literal source throughout a rich editing session. */
export function paragraphRuns(source, resolveTitle) {
  const paragraphs = [[]];
  for (const run of inlineRuns(source, resolveTitle)) {
    run.text.split("\n").forEach((text, i) => {
      if (i) paragraphs.push([]);
      paragraphs.at(-1).push({ ...run, text });
    });
  }
  return paragraphs;
}
export function richLines(text, width, measure, resolveTitle) {
  const result = [];
  text.split("\n").forEach((paragraph, paragraphIndex) => {
    const pieces = inlineRuns(paragraph, resolveTitle).flatMap((run) =>
      run.text
        .split(/(\s+)/)
        .filter(Boolean)
        .map((text) => ({ ...run, text })),
    );
    const item = listItem.exec(paragraph);
    const indent = item?.[1] || "";
    const indentWidth = Math.min(
      width / 2,
      measure(indent.replaceAll("\t", "  "), {}),
    );
    let runs = [],
      used = indentWidth;
    const push = () => {
      result.push({
        runs,
        width: used,
        indent: indentWidth,
        list: Boolean(item),
        paragraph: paragraphIndex,
        last: false,
      });
      runs = [];
      used = indentWidth;
    };
    for (const piece of pieces) {
      const whitespace = /^\s+$/.test(piece.text);
      if (!runs.length && whitespace) continue;
      const w = measure(piece.text, piece);
      if (runs.length && used + w > width && !whitespace) push();
      if (w > width && !whitespace) {
        for (const char of Array.from(piece.text)) {
          const cw = measure(char, piece);
          if (runs.length && used + cw > width) push();
          runs.push({ ...piece, text: char });
          used += cw;
        }
      } else if (used || !whitespace) {
        runs.push(piece);
        used += w;
      }
    }
    push();
    result.at(-1).last = true;
  });
  return result;
}
export function wrapSelection(value, start, end, left, right = left) {
  return {
    value:
      value.slice(0, start) +
      left +
      value.slice(start, end) +
      right +
      value.slice(end),
    start: start + left.length,
    end: end + left.length,
  };
}
export function paragraphRange(value, start, end) {
  const first = value.slice(0, start).split("\n").length - 1;
  const last = value.slice(0, Math.max(start, end - 1)).split("\n").length - 1;
  return { first, last };
}
const listItem =
  /^([ \t]*)(?:(\d+(?:\.\d+)*[.)]|(?:[IVXLCDM]+|[ivxlcdm]+|[a-zA-Z]{1,2})\.|\([a-zA-Z0-9]+\))|([-*]))[ \t]+(.*)$/;

export const outlineStyles = [
  { id: "traditional", label: "Roman and alphabetic outline", icon: "Ⅰ A" },
  { id: "mixed", label: "Numeric and Roman outline", icon: "1 ⅰ" },
  { id: "decimal", label: "Decimal outline", icon: "1.1" },
];

const listDepth = (indent) =>
  Math.floor(indent.replaceAll("\t", "  ").length / 2);

function roman(value) {
  if (value > 3999) return String(value);
  let result = "";
  for (const [number, glyph] of [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ]) {
    result += glyph.repeat(Math.floor(value / number));
    value %= number;
  }
  return result;
}

function alphabetic(value) {
  let result = "";
  for (; value > 0; value = Math.floor((value - 1) / 26))
    result = String.fromCharCode(97 + ((value - 1) % 26)) + result;
  return result;
}

function outlineMarker(style, counts, depth) {
  const value = counts[depth];
  if (style === "decimal") return counts.join(".") + ".";
  if (style === "traditional")
    return [
      roman(value) + ".",
      alphabetic(value).toUpperCase() + ".",
      value + ".",
      alphabetic(value) + ".",
      "(" + value + ")",
      "(" + alphabetic(value) + ")",
    ][depth % 6];
  return [
    value + ".",
    roman(value).toLowerCase() + ".",
    alphabetic(value) + ".",
    "(" + value + ")",
  ][depth % 4];
}

function outlineBounds(lines, first, last) {
  while (first > 0 && listItem.exec(lines[first - 1])?.[2]) first--;
  while (last + 1 < lines.length && listItem.exec(lines[last + 1])?.[2]) last++;
  return { first, last };
}

function findOutline(lines, first, last, preferred) {
  for (let i = first; i <= last; i++) {
    const item = listItem.exec(lines[i]);
    if (!item?.[2]) continue;
    if (listDepth(item[1]) === 0 && /^[IVXLCDM]+\.$/.test(item[2]))
      return "traditional";
    if (/^\d+\.\d/.test(item[2])) return "decimal";
    if (listDepth(item[1]) === 1 && /^[ivxlcdm]+\.$/.test(item[2]))
      return "mixed";
  }
  return preferred;
}

function numberOutline(lines, first, last, style) {
  const counts = [];
  for (let i = first; i <= last; i++) {
    const item = listItem.exec(lines[i]);
    if (!item?.[2]) {
      counts.length = 0;
      continue;
    }
    const depth = Math.min(listDepth(item[1]), counts.length);
    const next = (counts[depth] || 0) + 1;
    counts.length = depth + 1;
    counts[depth] = next;
    lines[i] = item[1] + outlineMarker(style, counts, depth) + " " + item[4];
  }
}

function remapListSelection(original, lines, start, end) {
  const remap = (offset) => {
    const row = original.join("\n").slice(0, offset).split("\n").length - 1;
    const before = original
      .slice(0, row)
      .reduce((sum, line) => sum + line.length + 1, 0);
    const after = lines
      .slice(0, row)
      .reduce((sum, line) => sum + line.length + 1, 0);
    return (
      after +
      Math.max(0, offset - before + lines[row].length - original[row].length)
    );
  };
  return { value: lines.join("\n"), start: remap(start), end: remap(end) };
}

export function indentList(value, start, end, outdent, preferred) {
  const { first, last } = paragraphRange(value, start, end);
  const original = value.split("\n");
  const lines = [...original];
  if (!lines.slice(first, last + 1).every((line) => listItem.test(line)))
    return null;
  const bounds = outlineBounds(lines, first, last);
  const style = findOutline(lines, bounds.first, bounds.last, preferred);
  for (let i = first; i <= last; i++) {
    const [, indent, marker, bullet, body] = listItem.exec(lines[i]);
    const prefix = outdent
      ? indent.replace(/^(?: {1,2}|\t)/, "")
      : indent + "  ";
    const previous = lines
      .slice(0, i)
      .reverse()
      .map((line) => listItem.exec(line))
      .find((item) => !item || item[1].length <= prefix.length);
    const next =
      previous?.[1] === prefix && /^\d+[.)]$/.test(previous[2])
        ? Number.parseInt(previous[2], 10) + 1
        : 1;
    lines[i] =
      prefix +
      (bullet || (style || prefix === indent ? marker : next + ".")) +
      " " +
      body;
  }
  if (style) numberOutline(lines, bounds.first, bounds.last, style);
  return remapListSelection(original, lines, start, end);
}

export function listLines(value, start, end, ordered = true, style) {
  const { first, last } = paragraphRange(value, start, end);
  const lines = value.split("\n");
  for (let i = first; i <= last; i++) {
    const item = listItem.exec(lines[i]);
    const indent = item?.[1] || /^[ \t]*/.exec(lines[i])[0];
    lines[i] =
      indent +
      (ordered ? i - first + 1 + ". " : "- ") +
      (item?.[4] ?? lines[i].slice(indent.length));
  }
  if (style) {
    const bounds = outlineBounds(lines, first, last);
    numberOutline(lines, bounds.first, bounds.last, style);
  }
  return lines.join("\n");
}

export function continueList(value, start, end, preferred) {
  const lines = value.split("\n");
  const { first } = paragraphRange(value, start, end);
  const line = value.slice(0, start).split("\n").at(-1);
  const match = listItem.exec(line);
  if (!match) return null;
  const [, indent, marker, bullet, body] = match;
  const bounds = outlineBounds(lines, first, first);
  const style = findOutline(lines, bounds.first, bounds.last, preferred);
  if (!body.trim()) {
    if (indent) return indentList(value, start, end, true, style);
    return {
      value: value.slice(0, start - line.length) + value.slice(end),
      start: start - line.length,
      end: start - line.length,
    };
  }
  const next =
    bullet ||
    (style || !/^\d/.test(marker)
      ? marker
      : Number.parseInt(marker, 10) + 1 + ".");
  const prefix = "\n" + indent + next + " ";
  const inserted = value.slice(0, start) + prefix + value.slice(end);
  const caret = start + prefix.length;
  if (!style || bullet) return { value: inserted, start: caret, end: caret };
  const original = inserted.split("\n");
  const updated = [...original];
  const after = outlineBounds(updated, first, first + 1);
  numberOutline(updated, after.first, after.last, style);
  return remapListSelection(original, updated, caret, caret);
}
