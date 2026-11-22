/** Math source remains in the label; native rendering is a disposable projection. */
export function mathSegments(source) {
  const parts = [];
  let plain = "";
  const flush = () => {
    if (plain) parts.push({ text: plain });
    plain = "";
  };
  for (let i = 0; i < source.length;) {
    if (source[i] === "\\" && i + 1 < source.length) {
      plain += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (source[i] === "`") {
      const ticks = /^`+/.exec(source.slice(i))[0];
      const end = source.indexOf(ticks, i + ticks.length);
      if (end >= 0) {
        plain += source.slice(i, end + ticks.length);
        i = end + ticks.length;
        continue;
      }
    }
    if (source[i] !== "$") {
      plain += source[i++];
      continue;
    }
    const delimiter = source.startsWith("$$", i) ? "$$" : "$";
    let end = i + delimiter.length;
    for (; end < source.length; end++) {
      if (source[end] === "\\") {
        end++;
        continue;
      }
      if (delimiter === "$" && source[end] === "\n") break;
      if (source.startsWith(delimiter, end)) break;
    }
    if (source.startsWith(delimiter, end) && end > i + delimiter.length) {
      flush();
      parts.push({
        text: source.slice(i + delimiter.length, end),
        math: true,
        display: delimiter === "$$",
      });
      i = end + delimiter.length;
    } else plain += source[i++];
  }
  flush();
  return parts;
}
