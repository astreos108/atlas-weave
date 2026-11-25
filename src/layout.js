import { annotationSize } from "./domain/text-annotation.js";
import { cardContent } from "./content-card.js";
import { frameOwners } from "./domain/board-actions.js";
/*! @license Heroicons Link, MIT, Copyright (c) Tailwind Labs, Inc.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import { applyConnectorColor, shapeInk } from "./appearance.js";
import { mathLabel } from "./math-text.js";
import { richLines, inlineRuns } from "./text-format.js";
import {
  projectedEdges,
  insetEndpoints,
  separateLane,
  connectorPath,
} from "./connector-projection.js";
import { pathMidpoint } from "./connector-routing.js";
import { routeConnection } from "./connector-geometry.js";
const NS = "http://www.w3.org/2000/svg";
const point = (matrix, x, y) => new DOMPoint(x, y).matrixTransform(matrix);
const svgElement = (tag, attrs = {}, doc) => {
  const el = doc.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
};
export function wrapText(text, width, measure = (s) => s.length * 8) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && measure(`${line} ${word}`) > width) {
        lines.push(line);
        line = "";
      }
      if (measure(word) > width) {
        for (const char of Array.from(word)) {
          if (line && measure(line + char) > width) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      } else line += (line ? " " : "") + word;
    }
    lines.push(line);
  }
  return lines;
}
export function createLayout(svg, model, identify, options = {}) {
  const doc = svg.ownerDocument,
    element = (tag, attrs) => svgElement(tag, attrs, doc);
  const nodes = new Map(),
    measureContext = doc.createElement("canvas").getContext("2d");
  measureContext.font = "16px system-ui";
  for (const n of model.nodes.filter((n) => n.shape === "frame"))
    if (
      ![...svg.querySelectorAll(".node")].some((el) => identify(el) === n.id)
    ) {
      const el = element("g", { class: "node", id: `flowchart-${n.id}-frame` });
      svg.prepend(el);
    }
  for (const el of svg.querySelectorAll(".node")) {
    const id = identify(el),
      data = model.nodes.find((n) => n.id === id);
    if (!data) continue;
    const b = el.getBBox(),
      m = svg.getScreenCTM().inverse().multiply(el.getScreenCTM()),
      center = point(m, b.x + b.width / 2, b.y + b.height / 2);
    const n = {
      ...data,
      el,
      x: center.x,
      y: center.y,
      width:
        data.size?.width ||
        (options.preserveMermaidLayout
          ? Math.max(80, Math.ceil(b.width))
          : Math.max(160, Math.min(320, Math.ceil(b.width / 40) * 40))),
      height:
        data.size?.height ||
        (options.preserveMermaidLayout
          ? Math.max(48, Math.ceil(b.height))
          : Math.max(80, Math.ceil(b.height / 40) * 40)),
    };
    nodes.set(id, n);
    svg.append(el);
    el.classList.toggle("rea-frame-node", n.shape === "frame");
    el.classList.toggle("rea-text-node", n.shape === "text");
    el.classList.toggle("rea-line-node", n.shape === "line");
    // Keep the node identity produced by Mermaid; use fixed-font, wrapping text inside resizable geometry.
    el.replaceChildren();
    n.shapeEl = element(n.shape === "diamond" ? "polygon" : "rect", {
      fill: n.fill,
      stroke: n.stroke,
      "stroke-width": 1.2,
      class: "rea-shape-body",
    });
    n.shapeEl.style.fill = n.fill;
    n.shapeEl.style.stroke = n.stroke;
    if (n.shape === "line") {
      n.lineEl = element("line", { class: "rea-standalone-line" });
      n.lineEl.style.stroke = n.stroke;
    }
    n.textEl = element("text", {
      "text-anchor": "middle",
      class: "rea-node-text",
    });
    if (n.shape !== "frame")
      n.el.style.setProperty("--shape-ink", shapeInk(n.fill));
    n.textMarks = element("g", { class: "rea-text-marks" });
    n.linkIndicator = element("g", {
      class: "rea-link-indicator",
      role: "img",
      "aria-label": "Contains links",
    });
    n.linkIndicator.append(
      element("path", {
        d: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244",
      }),
    );
    if (!n.card) el.append(n.shapeEl, n.textMarks, n.textEl, n.linkIndicator);
    if (n.lineEl) el.append(n.lineEl);
    if (n.card) {
      n.cardEl = element("foreignObject", { class: "rea-content-card" });
      const content = doc.createElement("div");
      content.className = `rea-card-content rea-card-${n.card.type}`;
      content.append(cardContent(doc, n.card, options.renderMath));
      n.cardEl.append(content);
      el.append(n.cardEl);
    }
  }
  const owners = frameOwners(model, nodes);
  const depth = (node) => {
    let level = 0;
    for (let owner = owners.get(node.id); owner; owner = owners.get(owner.id))
      level++;
    return level;
  };
  const frames = [...nodes.values()].filter((node) => node.shape === "frame");
  frames.sort((a, b) => depth(b) - depth(a));
  for (const frame of frames) svg.prepend(frame.el);
  svg
    .querySelectorAll(
      ".edgePaths,.edgeLabels,.rea-wires,.rea-wire-labels,.rea-wire-defs,.cluster",
    )
    .forEach((el) => el.remove());
  const labelLayer = element("g", { class: "rea-wire-labels" });
  const wires = element("g", { class: "rea-wires" }),
    defs = element("defs", { class: "rea-wire-defs" });
  const firstShape = [...svg.children].find(
    (el) =>
      el.classList.contains("node") && !el.classList.contains("rea-frame-node"),
  );
  svg.insertBefore(wires, firstShape || null);
  svg.insertBefore(labelLayer, firstShape || null);
  svg.append(defs);
  const links = model.edges.map((original, index) => {
    const edge = structuredClone(original);
    const markerId = `${svg.id}-board-arrow-${index}`,
      marker = element("marker", {
        id: markerId,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: "auto-start-reverse",
      });
    marker.append(
      element("path", {
        d: "M 0 0 L 10 5 L 0 10 z",
        class: "rea-connector-arrow",
        "stroke-linejoin": "round",
      }),
    );
    defs.append(marker);
    const g = element("g", {
        "data-edge": index,
        role: "button",
        tabindex: 0,
        "aria-label": `Connection ${index + 1}${edge.label ? `: ${edge.label}` : ""}`,
      }),
      hit = element("path", { class: "rea-edge-hit" }),
      path = element("path", {
        class: "rea-edge-line",
        fill: "none",
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "marker-end": `url(#${markerId})`,
        ...(edge.bidirectional ? { "marker-start": `url(#${markerId})` } : {}),
      });
    applyConnectorColor(path, edge.color);
    applyConnectorColor(marker.firstElementChild, edge.color);
    g.append(hit, path);
    let label, labelBox;
    if (edge.label) {
      labelBox = element("rect", { class: "rea-edge-label-bg", rx: 5 });
      label = element("text", {
        "text-anchor": "middle",
        class: "rea-wire-label",
      });
      const labelGroup = element("g", { "data-edge": index });
      labelGroup.append(labelBox, label);
      labelLayer.append(labelGroup);
    }
    wires.append(g);
    return { edge, path, hit, label, labelBox, geometry: null };
  });
  function position(n) {
    n.el.setAttribute("transform", `translate(${n.x},${n.y})`);
  }
  function measureRun(text, run = {}, forceBold = false, size = 16) {
    measureContext.font = `${run.italic ? "italic " : ""}${run.bold || forceBold ? "600 " : ""}${size}px ${run.code ? "monospace" : "system-ui"}`;
    return measureContext.measureText(text).width;
  }
  function fitText(id) {
    const n = nodes.get(id);
    if (!n) return null;
    if (n.shape === "text")
      return annotationSize(
        { ...n, textWrap: false },
        (text, run) => measureRun(text, run, false, n.textSize || 16),
        options.resolveLinkTitle,
      );
    const size = n.textSize || 16;
    const measure = (text, run) =>
      measureRun(text, run, n.shape === "frame", size);
    const natural = Math.max(
      ...n.label
        .split("\n")
        .map((p) =>
          inlineRuns(p, options.resolveLinkTitle).reduce(
            (sum, r) => sum + measure(r.text, r),
            0,
          ),
        ),
      120,
    );
    const width =
      Math.ceil(Math.max(160, Math.min(640, natural + 40)) / 40) * 40;
    const lines = richLines(
      n.label,
      width - (n.shape === "diamond" ? width * 0.55 : 32),
      measure,
      options.resolveLinkTitle,
    );
    return {
      width,
      height:
        Math.ceil(
          Math.max(
            80,
            lines.length * Math.ceil(size * 1.4) +
              (n.shape === "diamond" ? 60 : 32),
          ) / 40,
        ) * 40,
    };
  }
  function resize(id, size) {
    const n = nodes.get(id);
    if (!n) return;
    if (n.shape === "text")
      size = annotationSize(
        n,
        (text, run) => measureRun(text, run, false, n.textSize || 16),
        options.resolveLinkTitle,
        n.textWrap ? size.width : undefined,
      );
    n.width = Math.min(
      4000,
      Math.max(n.shape === "text" ? 16 : 80, size.width),
    );
    n.height = Math.min(
      4000,
      Math.max(n.shape === "text" ? 24 : 48, size.height),
    );
    if (n.cardEl) {
      n.cardEl.setAttribute("x", -n.width / 2);
      n.cardEl.setAttribute("y", -n.height / 2);
      n.cardEl.setAttribute("width", n.width);
      n.cardEl.setAttribute("height", n.height);
      position(n);
      return { width: n.width, height: n.height };
    }
    const inset =
        n.shape === "text" ? 0 : n.shape === "diamond" ? n.width * 0.55 : 32,
      fontSize = n.textSize || 16,
      lineHeight = Math.ceil(fontSize * 1.4),
      measure = (text, run) =>
        measureRun(text, run, n.shape === "frame", fontSize);
    n.textEl.style.fontSize = `${fontSize}px`;
    const allLines = richLines(
      n.label,
      Math.max(32, n.width - inset),
      measure,
      options.resolveLinkTitle,
    );
    const capacity = Math.max(
      1,
      Math.floor((n.height - (n.shape === "text" ? 0 : 28)) / lineHeight),
    );
    const lines =
      n.shape === "frame" ? allLines.slice(0, 2) : allLines.slice(0, capacity);
    n.textOverflow = n.shape !== "frame" && allLines.length > capacity;
    if (n.shape === "diamond")
      n.shapeEl.setAttribute(
        "points",
        `0,${-n.height / 2} ${n.width / 2},0 0,${n.height / 2} ${-n.width / 2},0`,
      );
    else
      for (const [key, value] of Object.entries({
        x: -n.width / 2,
        y: -n.height / 2,
        width: n.width,
        height: n.height,
        rx: n.shape === "round" ? n.height / 2 : 10,
        ry: n.shape === "round" ? n.height / 2 : 10,
      }))
        n.shapeEl.setAttribute(key, value);
    if (n.lineEl) {
      const halfX = n.lineDirection === "vertical" ? 0 : n.width / 2;
      const halfY =
        n.lineDirection === "horizontal" || !n.lineDirection ? 0 : n.height / 2;
      const endY = n.lineDirection === "rising" ? -halfY : halfY;
      for (const [key, value] of Object.entries({
        x1: -halfX,
        x2: halfX,
        y1: -endY,
        y2: endY,
      }))
        n.lineEl.setAttribute(key, value);
    }
    n.linkIndicator.toggleAttribute(
      "hidden",
      !n.link && !inlineRuns(n.label).some((run) => run.link),
    );
    n.linkIndicator.setAttribute(
      "transform",
      `translate(${n.width / 2 - 24},${-n.height / 2 + 6}) scale(.75)`,
    );
    if (n.shape === "frame") n.shapeEl.setAttribute("fill-opacity", ".09");
    n.textEl.setAttribute("text-anchor", "start");
    n.textEl.replaceChildren();
    n.textMarks.replaceChildren();
    let anchor;
    lines.forEach((line, i) => {
      const alignment =
        n.shape === "frame" || line.list
          ? "left"
          : n.textAlignments?.[line.paragraph] ||
            n.textAlign ||
            (n.shape === "text" ? "left" : "center");
      const usable = n.width - inset,
        total = line.runs.reduce((sum, r) => sum + measure(r.text, r), 0);
      let x =
        alignment === "center"
          ? -total / 2
          : alignment === "right"
            ? n.width / 2 - inset / 2 - total
            : -n.width / 2 + inset / 2;
      if (n.shape === "frame") x = -n.width / 2 + 18;
      x += line.indent;
      const y =
        n.shape === "frame"
          ? -n.height / 2 + 12 + fontSize + i * lineHeight
          : (i - (lines.length - 1) / 2) * lineHeight + fontSize * 0.3125;
      const spaces = line.runs.filter((r) => /^\s+$/.test(r.text)).length;
      const extra =
        alignment === "justify" && !line.last && spaces
          ? Math.max(0, (usable - total) / spaces)
          : 0;
      for (const run of line.runs) {
        const w = measure(run.text, run);
        if (run.highlight)
          n.textMarks.append(
            element("rect", {
              x: x - 1,
              y: y - fontSize,
              width: w + 2,
              height: lineHeight - 2,
              rx: 2,
              opacity: ".85",
            }),
          );
        const span = element("tspan", { x, y });
        span.textContent = run.text;
        if (run.bold) span.setAttribute("font-weight", "600");
        if (run.italic) span.setAttribute("font-style", "italic");
        if (run.code) span.setAttribute("font-family", "monospace");
        if (run.link) {
          if (
            !anchor ||
            anchor.dataset.textLink !== run.link ||
            anchor.dataset.internal !== String(run.internal)
          ) {
            anchor = element("a", {
              "data-text-link": run.link,
              "data-internal": String(run.internal),
              role: "link",
              tabindex: 0,
              class: "rea-inline-link",
            });
            n.textEl.append(anchor);
          }
          span.setAttribute("text-decoration", "underline");
          anchor.append(span);
          anchor.setAttribute("aria-label", anchor.textContent);
        } else {
          anchor = null;
          n.textEl.append(span);
        }
        x += w + (/^\s+$/.test(run.text) ? extra : 0);
      }
    });
    if (n.textOverflow) {
      const hint = element("tspan", {
        x: n.width / 2 - 16,
        y: n.height / 2 - 9,
        class: "rea-text-truncated",
        "text-anchor": "end",
      });
      hint.textContent = "…";
      n.textEl.append(hint);
    }
    const title = element("title");
    title.textContent = n.label;
    if (n.textOverflow) n.textEl.append(title);
    if (n.mathSource !== n.label) {
      n.mathEl?.remove();
      n.mathEl = mathLabel(
        svg.ownerDocument,
        n.label,
        options.renderMath,
        options.resolveLinkTitle,
      );
      n.mathSource = n.label;
      if (n.mathEl) n.el.append(n.mathEl);
    }
    n.textEl.style.display = n.mathEl || n.card ? "none" : "";
    n.textMarks.style.display = n.mathEl || n.card ? "none" : "";
    if (n.mathEl) {
      for (const [key, value] of Object.entries({
        x: -n.width / 2 + inset / 2,
        y: -n.height / 2 + 14,
        width: Math.max(32, n.width - inset),
        height:
          n.shape === "frame" ? Math.min(60, n.height - 28) : n.height - 28,
      }))
        n.mathEl.setAttribute(key, value);
      n.mathEl.classList.add("rea-node-math");
      const content = n.mathEl.firstElementChild;
      content.style.fontSize = `${fontSize}px`;
      content.style.textAlign =
        n.textAlign || (n.shape === "text" ? "left" : "center");
      content.classList.toggle("rea-math-frame", n.shape === "frame");
    }
    position(n);
    return { width: n.width, height: n.height };
  }
  function move(id, p) {
    const n = nodes.get(id);
    if (n) {
      n.x = p.x;
      n.y = p.y;
      position(n);
    }
  }
  function redraw() {
    const projected = projectedEdges(
        links.map((l) => l.edge),
        nodes,
      ),
      routes = [],
      labelRects = [];
    for (const [index, link] of links.entries()) {
      const { path, hit, label, labelBox } = link,
        edge = {
          ...projected[index],
          ...link.edge,
          fromSide: link.previewFrom
            ? link.edge.fromSide
            : projected[index].fromSide,
          toSide: link.previewTo ? link.edge.toSide : projected[index].toSide,
          fromRatio: projected[index].fromRatio,
          toRatio: projected[index].toRatio,
        },
        a = link.previewFrom || nodes.get(edge.from),
        b = link.previewTo || nodes.get(edge.to);
      if (!a || !b) continue;
      const width =
        edge.labelWidth ||
        Math.max(100, Math.min(240, Math.hypot(b.x - a.x, b.y - a.y) * 0.55));
      const fontSize = edge.labelFontSize || 13;
      measureContext.font = `${fontSize}px system-ui`;
      const lines = label
          ? wrapText(
              edge.label,
              width,
              (s) => measureContext.measureText(s).width,
            )
          : [],
        textWidth = lines.length
          ? Math.max(...lines.map((s) => measureContext.measureText(s).width))
          : 0;
      measureContext.font = "16px system-ui";
      const geo = routeConnection(
        a,
        b,
        edge,
        nodes.values(),
        edge.from === edge.to,
      );
      if (geo.points) {
        if (!edge.waypoints?.length)
          geo.points = separateLane(geo.points, routes);
        geo.d = connectorPath(insetEndpoints(geo.points), routes);
        routes.push(geo.points);
        if (!edge.labelOffset && label) {
          const b = pathMidpoint(geo.points);
          geo.label = { ...b };
          const candidates = [geo.label];
          for (let i = 1; i < geo.points.length; i++) {
            const a = geo.points[i - 1],
              b = geo.points[i];
            for (const t of [0.5, 0.25, 0.75])
              candidates.push({
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t,
              });
          }
          const occupied = [
            ...labelRects,
            ...[...nodes.values()]
              .filter((n) => n.shape !== "frame")
              .map((n) => ({
                x: n.x - n.width / 2,
                y: n.y - n.height / 2,
                width: n.width,
                height: n.height,
              })),
          ];
          const fits = (p) => {
            const r = {
              x: p.x - textWidth / 2 - 8,
              y: p.y - lines.length * fontSize * 0.7 - 10,
              width: textWidth + 16,
              height: lines.length * fontSize * 1.4 + 10,
            };
            return !occupied.some(
              (b) =>
                r.x < b.x + b.width + 8 &&
                r.x + r.width > b.x - 8 &&
                r.y < b.y + b.height + 8 &&
                r.y + r.height > b.y - 8,
            );
          };
          const offsetCandidates = candidates.flatMap(({ x, y }) => {
            const dy = lines.length * fontSize * 1.4 + 20;
            const dx = textWidth + 24;
            return [
              { x, y: y - dy },
              { x, y: y + dy },
              { x: x - dx, y },
              { x: x + dx, y },
            ];
          });
          geo.label = candidates.find(fits) ||
            offsetCandidates.find(fits) || {
              x: geo.label.x,
              y:
                Math.min(...occupied.map((r) => r.y)) -
                lines.length * fontSize * 1.4 -
                20,
            };
          labelRects.push({
            x: geo.label.x - textWidth / 2 - 8,
            y: geo.label.y - lines.length * fontSize * 0.7 - 10,
            width: textWidth + 16,
            height: lines.length * fontSize * 1.4 + 10,
          });
        }
      }
      link.geometry = geo;
      path.setAttribute("d", geo.d);
      hit.setAttribute("d", geo.d);
      if (link.mathSource !== edge.label) {
        link.mathEl?.remove();
        link.mathEl = mathLabel(
          svg.ownerDocument,
          edge.label || "",
          options.renderMath,
          options.resolveLinkTitle,
        );
        link.mathSource = edge.label;
        if (link.mathEl) label?.parentElement.append(link.mathEl);
      }
      if (link.mathEl) {
        const height = Math.max(
          fontSize * 3,
          lines.length * fontSize * 1.4 + 12,
        );
        for (const [key, value] of Object.entries({
          x: geo.label.x - width / 2,
          y: geo.label.y - height / 2,
          width,
          height,
        }))
          link.mathEl.setAttribute(key, value);
        link.mathEl.style.fontSize = `${fontSize}px`;
      }
      if (label) {
        label.style.display = link.mathEl ? "none" : "";
        label.style.fontSize = `${fontSize}px`;
        label.replaceChildren();
        lines.forEach((line, i) => {
          const span = element("tspan", {
            x: geo.label.x,
            y:
              geo.label.y + (i - (lines.length - 1) / 2) * (fontSize * 1.4) - 7,
          });
          span.textContent = line;
          label.append(span);
        });
        const box = link.mathEl
          ? {
              x: Number(link.mathEl.getAttribute("x")),
              y: Number(link.mathEl.getAttribute("y")),
              width: Number(link.mathEl.getAttribute("width")),
              height: Number(link.mathEl.getAttribute("height")),
            }
          : label.getBBox();
        for (const [key, value] of Object.entries({
          x: box.x - 6,
          y: box.y - 3,
          width: box.width + 12,
          height: box.height + 6,
        }))
          labelBox.setAttribute(key, value);
      }
    }
    // Give Electron a real SVG viewport. A 1px viewport with visible overflow
    // can leave stale raster tiles when panning or changing the background.
    const b = bounds();
    svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.width} ${b.height}`);
    svg.setAttribute("width", b.width);
    svg.setAttribute("height", b.height);
    svg.classList.add("rea-world-svg");
    svg.style.left = `${b.x}px`;
    svg.style.top = `${b.y}px`;
  }
  function bounds() {
    if (!nodes.size) return { x: 0, y: 0, width: 100, height: 100 };
    const xs = [],
      ys = [];
    for (const n of nodes.values()) {
      xs.push(n.x - n.width / 2, n.x + n.width / 2);
      ys.push(n.y - n.height / 2, n.y + n.height / 2);
    }
    for (const layer of [wires, labelLayer])
      if (layer.childElementCount) {
        const b = layer.getBBox();
        xs.push(b.x, b.x + b.width);
        ys.push(b.y, b.y + b.height);
      }
    const x = Math.min(...xs) - 40,
      y = Math.min(...ys) - 40;
    return {
      x,
      y,
      width: Math.max(...xs) - x + 40,
      height: Math.max(...ys) - y + 40,
    };
  }
  for (const n of nodes.values()) {
    if (n.position) {
      n.x = n.position.x;
      n.y = n.position.y;
    } else if (!options.preserveMermaidLayout) {
      n.x = Math.round(n.x / 20) * 20;
      n.y = Math.round(n.y / 20) * 20;
    }
    if (n.cardEl) {
      n.cardEl.setAttribute("width", 840);
      n.cardEl.setAttribute("height", 440);
      const content = n.cardEl.firstElementChild;
      resize(n.id, {
        width: content.offsetWidth + 1,
        height: content.offsetHeight + 1,
      });
    } else resize(n.id, { width: n.width, height: n.height });
  }
  for (const f of frames)
    if (!f.position) {
      const members = f.members.map((id) => nodes.get(id)).filter(Boolean);
      if (members.length) {
        const l = Math.min(...members.map((n) => n.x - n.width / 2)) - 40,
          r = Math.max(...members.map((n) => n.x + n.width / 2)) + 40,
          t = Math.min(...members.map((n) => n.y - n.height / 2)) - 80,
          b = Math.max(...members.map((n) => n.y + n.height / 2)) + 40;
        resize(f.id, { width: r - l, height: b - t });
        move(f.id, { x: (l + r) / 2, y: (t + b) / 2 });
      }
    }
  if (options.preserveMermaidLayout) {
    const axis = ["TD", "TB", "BT"].includes(model.direction) ? "y" : "x";
    const length = axis === "x" ? "width" : "height";
    const parents = new Map();
    for (const frame of frames)
      for (const id of frame.members) parents.set(id, frame.id);
    const groups = new Map();
    for (const frame of frames) {
      const parent = parents.get(frame.id);
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(frame);
    }
    // Keep Mermaid's internal node arrangement. Separate frames on the main
    // axis when the editable frame padding makes neighboring groups overlap.
    const shift = (frame, delta) => {
      move(frame.id, { x: frame.x, y: frame.y, [axis]: frame[axis] + delta });
      for (const id of frame.members) {
        const member = nodes.get(id);
        if (member?.shape === "frame") shift(member, delta);
        else if (member)
          move(id, { x: member.x, y: member.y, [axis]: member[axis] + delta });
      }
    };
    const arrangeFrames = (parent) => {
      const siblings = groups.get(parent?.id) || [];
      for (const frame of siblings) arrangeFrames(frame);
      siblings.sort((a, b) => a[axis] - b[axis]);
      let boundary = -Infinity;
      for (const frame of siblings) {
        const start = frame[axis] - frame[length] / 2;
        if (start < boundary) shift(frame, boundary - start);
        boundary = frame[axis] + frame[length] / 2 + 80;
      }
      if (!parent || !siblings.length) return;
      const end =
        Math.max(...siblings.map((frame) => frame[axis] + frame[length] / 2)) +
        40;
      const extension = end - (parent[axis] + parent[length] / 2);
      if (extension > 0) {
        resize(parent.id, {
          width: parent.width,
          height: parent.height,
          [length]: parent[length] + extension,
        });
        move(parent.id, {
          x: parent.x,
          y: parent.y,
          [axis]: parent[axis] + extension / 2,
        });
      }
    };
    arrangeFrames();
  }
  redraw();
  return {
    nodes,
    links,
    move,
    resize,
    fitText,
    redraw,
    bounds,
    positions() {
      return Object.fromEntries(
        [...nodes].map(([id, n]) => [
          id,
          { x: Math.round(n.x * 100) / 100, y: Math.round(n.y * 100) / 100 },
        ]),
      );
    },
  };
}
