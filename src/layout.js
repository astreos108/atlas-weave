import { richLines, inlineRuns } from "./text-format.js";
import {
  projectedEdges,
  insetEndpoints,
  separateLane,
  connectorPath,
} from "./connector-projection.js";
import { avoidObstacles, roundedPath, crossesBox } from "./smart-routing.js";
import { pathMidpoint } from "./connector-routing.js";
import { attachment, manualRoute, pathGeometry } from "./connector-routing.js";
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
export function boundary(node, toward) {
  const dx = toward.x - node.x,
    dy = toward.y - node.y;
  if (!dx && !dy) return { x: node.x, y: node.y };
  const hw = Math.max(1, node.width / 2),
    hh = Math.max(1, node.height / 2);
  const t =
    node.shape === "diamond"
      ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
      : Math.min(
          dx ? hw / Math.abs(dx) : Infinity,
          dy ? hh / Math.abs(dy) : Infinity,
        );
  return { x: node.x + dx * t, y: node.y + dy * t };
}
const SIDES = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};
function midpoint(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  let half = length / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (half <= segment)
      return {
        x: a.x + (b.x - a.x) * (segment ? half / segment : 0),
        y: a.y + (b.y - a.y) * (segment ? half / segment : 0),
      };
    half -= segment;
  }
  return points[0];
}
function autoWireGeometry(a, b, self = false, edge = {}) {
  if (self) {
    const x = a.x + a.width / 2,
      y = a.y;
    return {
      d: `M ${x} ${y - 10} C ${x + 90} ${y - 100}, ${x + 90} ${y + 100}, ${x} ${y + 10}`,
      label: { x: x + 65, y },
    };
  }
  if (edge.routing === "orthogonal") {
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y),
      from =
        edge.fromSide ||
        (horizontal
          ? b.x >= a.x
            ? "right"
            : "left"
          : b.y >= a.y
            ? "bottom"
            : "top"),
      to =
        edge.toSide ||
        (horizontal
          ? b.x >= a.x
            ? "left"
            : "right"
          : b.y >= a.y
            ? "top"
            : "bottom");
    const start = attachment(a, from, edge.fromRatio),
      end = attachment(b, to, edge.toRatio),
      u = SIDES[from],
      v = SIDES[to],
      p = { x: start.x + u.x * 28, y: start.y + u.y * 28 },
      q = { x: end.x + v.x * 28, y: end.y + v.y * 28 };
    let middle;
    if (u.x && v.x) {
      if (u.x === -v.x && (q.x - p.x) * u.x >= 0) {
        const x = (p.x + q.x) / 2 + (edge._lane || 0);
        middle = [
          { x, y: p.y },
          { x, y: q.y },
        ];
      } else {
        const y = Math.min(a.y - a.height / 2, b.y - b.height / 2) - 45;
        middle = [
          { x: p.x, y },
          { x: q.x, y },
        ];
      }
    } else if (u.y && v.y) {
      if (u.y === -v.y && (q.y - p.y) * u.y >= 0) {
        const y = (p.y + q.y) / 2 + (edge._lane || 0);
        middle = [
          { x: p.x, y },
          { x: q.x, y },
        ];
      } else {
        const x = Math.max(a.x + a.width / 2, b.x + b.width / 2) + 45;
        middle = [
          { x, y: p.y },
          { x, y: q.y },
        ];
      }
    } else middle = [u.x ? { x: q.x, y: p.y } : { x: p.x, y: q.y }];
    let points = [start, p, ...middle, q, end],
      label = midpoint(points);
    const size = edge._labelSize;
    if (
      size &&
      [a, b].some(
        (n) =>
          Math.abs(label.x - n.x) < (n.width + size.width) / 2 + 10 &&
          Math.abs(label.y - 10 - n.y) < (n.height + size.height) / 2 + 10,
      )
    ) {
      if (horizontal) {
        const y =
          Math.min(a.y - a.height / 2, b.y - b.height / 2) -
          size.height / 2 -
          35;
        points = [start, p, { x: p.x, y }, { x: q.x, y }, q, end];
        label = { x: (p.x + q.x) / 2, y };
      } else {
        const x =
          Math.max(a.x + a.width / 2, b.x + b.width / 2) + size.width / 2 + 35;
        points = [start, p, { x, y: p.y }, { x, y: q.y }, q, end];
        label = { x, y: (p.y + q.y) / 2 };
      }
    }
    return {
      d: points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" "),
      label,
      points,
    };
  }
  const start = edge.fromSide
      ? attachment(a, edge.fromSide, edge.fromRatio)
      : boundary(a, b),
    end = edge.toSide
      ? attachment(b, edge.toSide, edge.toRatio)
      : boundary(b, a);
  return {
    d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    points: [start, end],
  };
}
export function wireGeometry(a, b, self = false, edge = {}) {
  let geo;
  if (edge.waypoints?.length) geo = pathGeometry(manualRoute(a, b, edge));
  else if (self) {
    const x = a.x + a.width / 2,
      y = a.y;
    geo = pathGeometry([
      { x, y: y - 12 },
      { x: x + 65, y: y - 12 },
      { x: x + 65, y: y + a.height / 2 + 45 },
      { x: x + 30, y: y + a.height / 2 + 45 },
      { x: x + 30, y: y + 12 },
      { x, y: y + 12 },
    ]);
  } else {
    const horizontal = Math.abs(a.y - b.y) < 1,
      vertical = Math.abs(a.x - b.x) < 1,
      sideFits = (side) =>
        !side ||
        (horizontal && ["left", "right"].includes(side)) ||
        (vertical && ["top", "bottom"].includes(side)),
      routing =
        edge.routing === "auto"
          ? (horizontal || vertical) &&
            sideFits(edge.fromSide) &&
            sideFits(edge.toSide)
            ? "straight"
            : "orthogonal"
          : edge.routing;
    geo = autoWireGeometry(a, b, false, {
      ...edge,
      routing,
      _labelSize: edge.labelOffset ? null : edge._labelSize,
    });
  }
  geo.baseLabel = { ...geo.label };
  if (edge.labelOffset)
    geo.label = {
      x: geo.label.x + edge.labelOffset.x,
      y: geo.label.y + edge.labelOffset.y,
    };
  return geo;
}
export function createLayout(svg, model, identify, options = {}) {
  const doc = svg.ownerDocument,
    element = (tag, attrs) => svgElement(tag, attrs, doc);
  const nodes = new Map(),
    measureContext = doc.createElement("canvas").getContext("2d");
  measureContext.font = "16px system-ui";
  const measure = (s) => measureContext.measureText(s).width;
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
        Math.max(160, Math.min(320, Math.ceil(b.width / 40) * 40)),
      height: data.size?.height || Math.max(80, Math.ceil(b.height / 40) * 40),
    };
    nodes.set(id, n);
    svg.append(el);
    el.classList.toggle("rea-frame-node", n.shape === "frame");
    if (n.shape === "frame") svg.prepend(el);
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
    n.textEl = element("text", {
      "text-anchor": "middle",
      class: "rea-node-text",
    });
    const rgb = n.fill
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16));
    n.textEl.style.fill =
      rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 < 130
        ? "#f8f6ff"
        : "#353344";
    n.textMarks = element("g", { class: "rea-text-marks" });
    el.append(n.shapeEl, n.textMarks, n.textEl);
  }
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
    const color = edge.color || "#9b96aa",
      markerId = `${svg.id}-board-arrow-${index}`,
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
        fill: color,
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
        stroke: color,
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "marker-end": `url(#${markerId})`,
      });
    path.style.stroke = color;
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
  function measureRun(text, run = {}) {
    measureContext.font = `${run.italic ? "italic " : ""}${run.bold ? "600 " : ""}16px ${run.code ? "monospace" : "system-ui"}`;
    return measureContext.measureText(text).width;
  }
  function fitText(id) {
    const n = nodes.get(id);
    if (!n) return null;
    const natural = Math.max(
      ...n.label
        .split("\n")
        .map((p) =>
          inlineRuns(p, options.resolveLinkTitle).reduce(
            (sum, r) => sum + measureRun(r.text, r),
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
      measureRun,
      options.resolveLinkTitle,
    );
    return {
      width,
      height:
        Math.ceil(
          Math.max(80, lines.length * 23 + (n.shape === "diamond" ? 60 : 32)) /
            40,
        ) * 40,
    };
  }
  function resize(id, size) {
    const n = nodes.get(id);
    if (!n) return;
    n.width = Math.min(4000, Math.max(80, size.width));
    n.height = Math.min(4000, Math.max(48, size.height));
    const inset = n.shape === "diamond" ? n.width * 0.55 : 32,
      lineHeight = 23;
    const allLines = richLines(
      n.label,
      Math.max(32, n.width - inset),
      measureRun,
      options.resolveLinkTitle,
    );
    const capacity = Math.max(1, Math.floor((n.height - 28) / lineHeight));
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
    if (n.shape === "frame") n.shapeEl.setAttribute("fill-opacity", ".09");
    n.textEl.setAttribute("text-anchor", "start");
    n.textEl.replaceChildren();
    n.textMarks.replaceChildren();
    lines.forEach((line, i) => {
      const alignment =
        n.shape === "frame"
          ? "left"
          : n.textAlignments?.[line.paragraph] || n.textAlign || "center";
      const usable = n.width - inset,
        total = line.runs.reduce((sum, r) => sum + measureRun(r.text, r), 0);
      let x =
        alignment === "center"
          ? -total / 2
          : alignment === "right"
            ? n.width / 2 - inset / 2 - total
            : -n.width / 2 + inset / 2;
      if (n.shape === "frame") x = -n.width / 2 + 18;
      const y =
        n.shape === "frame"
          ? -n.height / 2 + 28 + i * lineHeight
          : (i - (lines.length - 1) / 2) * lineHeight + 5;
      const spaces = line.runs.filter((r) => /^\s+$/.test(r.text)).length;
      const extra =
        alignment === "justify" && !line.last && spaces
          ? Math.max(0, (usable - total) / spaces)
          : 0;
      for (const run of line.runs) {
        const w = measureRun(run.text, run);
        if (run.highlight)
          n.textMarks.append(
            element("rect", {
              x: x - 1,
              y: y - 16,
              width: w + 2,
              height: 21,
              rx: 2,
              fill: "#ffe68a",
              opacity: ".85",
            }),
          );
        const span = element("tspan", { x, y });
        span.textContent = run.text;
        if (run.bold) span.setAttribute("font-weight", "600");
        if (run.italic) span.setAttribute("font-style", "italic");
        if (run.code) span.setAttribute("font-family", "monospace");
        if (run.link) {
          const a = element("a", {
            "data-text-link": run.link,
            "data-internal": String(run.internal),
            role: "link",
            tabindex: 0,
            "aria-label": run.text,
            class: "rea-inline-link",
          });
          span.setAttribute("text-decoration", "underline");
          a.append(span);
          n.textEl.append(a);
        } else n.textEl.append(span);
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
          fromSide: projected[index].fromSide,
          toSide: projected[index].toSide,
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
      let geo = wireGeometry(a, b, edge.from === edge.to, {
        ...edge,
        _labelSize: label
          ? {
              width: textWidth + 12,
              height: lines.length * (fontSize * 1.4) + 6,
            }
          : null,
      });
      if (
        edge.routing === "auto" &&
        !edge.waypoints?.length &&
        geo.points?.length === 2 &&
        [...nodes.values()].some(
          (n) =>
            n.id !== edge.from &&
            n.id !== edge.to &&
            n.shape !== "frame" &&
            crossesBox(geo.points[0], geo.points[1], n),
        )
      )
        geo = wireGeometry(a, b, false, { ...edge, routing: "orthogonal" });
      if (geo.points?.length > 2) {
        if (
          !edge.waypoints?.length &&
          ["auto", "orthogonal"].includes(edge.routing)
        ) {
          geo.points = avoidObstacles(
            geo.points,
            [...nodes.values()].filter(
              (n) =>
                n.id !== edge.from && n.id !== edge.to && n.shape !== "frame",
            ),
          );
          geo.baseLabel = pathMidpoint(geo.points);
          geo.label = {
            x: geo.baseLabel.x + (edge.labelOffset?.x || 0),
            y: geo.baseLabel.y + (edge.labelOffset?.y || 0),
          };
        }
        geo.d = roundedPath(geo.points);
      }
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
          geo.label = candidates.find(fits) || geo.label;
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
      if (label) {
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
        const box = label.getBBox();
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
    } else {
      n.x = Math.round(n.x / 20) * 20;
      n.y = Math.round(n.y / 20) * 20;
    }
    resize(n.id, { width: n.width, height: n.height });
  }
  for (const f of nodes.values())
    if (f.shape === "frame" && !f.position) {
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
