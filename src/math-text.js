import { inlineRuns } from "./text-format.js";

export { mathSegments } from "./math-source.js";

export function mathLabel(doc, source, renderMath, resolveTitle) {
  const runs = inlineRuns(source, resolveTitle);
  if (!renderMath || !runs.some((run) => run.latex !== undefined)) return null;
  const foreign = doc.createElementNS(
    "http://www.w3.org/2000/svg",
    "foreignObject",
  );
  foreign.classList.add("rea-math-label");
  const content = doc.createElement("div");
  content.className = "rea-math-content";
  const body = doc.createElement("div");
  body.className = "rea-math-body";
  for (const run of runs) {
    let el;
    if (run.latex !== undefined) {
      try {
        el = renderMath(run.latex, run.display);
        el.setAttribute("aria-label", run.latex);
      } catch {
        el = doc.createTextNode(run.text);
      }
    } else el = doc.createTextNode(run.text);
    for (const [flag, tag] of [
      ["code", "code"],
      ["highlight", "mark"],
      ["italic", "em"],
      ["bold", "strong"],
    ]) {
      if (run[flag]) {
        const parent = doc.createElement(tag);
        parent.append(el);
        el = parent;
      }
    }
    if (run.link) {
      const link = doc.createElement("a");
      link.dataset.textLink = run.link;
      link.dataset.internal = String(run.internal);
      link.setAttribute("role", "link");
      link.tabIndex = 0;
      link.append(el);
      el = link;
    }
    body.append(el);
  }
  content.append(body);
  foreign.append(content);
  return foreign;
}
