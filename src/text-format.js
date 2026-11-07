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
export function richLines(text, width, measure, resolveTitle) {
  const result = [];
  text.split("\n").forEach((paragraph, paragraphIndex) => {
    const pieces = inlineRuns(paragraph, resolveTitle).flatMap((run) =>
      run.text
        .split(/(\s+)/)
        .filter(Boolean)
        .map((text) => ({ ...run, text })),
    );
    let runs = [],
      used = 0;
    const push = () => {
      result.push({
        runs,
        width: used,
        paragraph: paragraphIndex,
        last: false,
      });
      runs = [];
      used = 0;
    };
    for (const piece of pieces) {
      const whitespace = /^\s+$/.test(piece.text);
      if (!used && whitespace) continue;
      const w = measure(piece.text, piece);
      if (used && used + w > width && !whitespace) push();
      if (w > width && !whitespace) {
        for (const char of Array.from(piece.text)) {
          const cw = measure(char, piece);
          if (used && used + cw > width) push();
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
export function listLines(value, start, end, ordered = true) {
  const range = paragraphRange(value, start, end),
    lines = value.split("\n");
  for (let i = range.first; i <= range.last; i++)
    lines[i] =
      (ordered ? `${i - range.first + 1}. ` : "- ") +
      lines[i].replace(/^\s*(?:\d+[.)]|[-*])\s+/, "");
  return lines.join("\n");
}
export function continueList(value, start, end) {
  const line = value.slice(0, start).split("\n").at(-1),
    match = /^(\s*)(?:(\d+)[.)]|([-*]))\s+(.*)$/.exec(line);
  if (!match) return null;
  if (!match[4].trim())
    return {
      value: value.slice(0, start - line.length) + value.slice(end),
      start: start - line.length,
      end: start - line.length,
    };
  const prefix =
    "\n" + match[1] + (match[2] ? `${Number(match[2]) + 1}. ` : `${match[3]} `);
  return {
    value: value.slice(0, start) + prefix + value.slice(end),
    start: start + prefix.length,
    end: start + prefix.length,
  };
}
