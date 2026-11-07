import { parse, readBoard } from "./model.js";
const color = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v : fallback);
export function decodeClipboard(text) {
  if (!text || text.length > 2_000_000)
    throw new Error("Clipboard is empty or too large.");
  const candidate =
    readBoard(text) ||
    text.trim().replace(/^```(?:mermaid)?\s*\n?|\n?```$/g, "");
  if (
    /^(?:flowchart|graph|mindmap|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|timeline|journey|quadrantChart|gitGraph|xychart|sankey|architecture|block|packet|kanban|requirementDiagram|C4)/.test(
      candidate,
    )
  )
    return { source: candidate, model: parse(candidate) };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    /* Non-JSON text is handled below. */
  }
  if (data?.type === "rea-board-clipboard" && data.version === 1)
    return { model: parse(data.source) };
  const elements = data?.elements;
  if (Array.isArray(elements)) {
    const shapes = elements.filter(
      (e) =>
        !e.isDeleted &&
        ["rectangle", "ellipse", "diamond", "text"].includes(e.type) &&
        !(e.type === "text" && e.containerId),
    );
    const nodes = shapes.map((e, i) => ({
      id: `p${i + 1}`,
      label:
        e.text ||
        elements.find((t) => t.containerId === e.id)?.text ||
        "Untitled",
      shape:
        e.type === "diamond"
          ? "diamond"
          : e.type === "ellipse"
            ? "round"
            : "rect",
      fill: color(e.backgroundColor, "#ede9fe"),
      stroke: color(e.strokeColor, "#a78bfa"),
      position: { x: e.x + e.width / 2, y: e.y + e.height / 2 },
      size: { width: Math.max(80, e.width), height: Math.max(48, e.height) },
    }));
    const ids = new Map(shapes.map((e, i) => [e.id, nodes[i].id]));
    const edges = elements
      .filter(
        (e) =>
          !e.isDeleted &&
          ["arrow", "line"].includes(e.type) &&
          ids.has(e.startBinding?.elementId) &&
          ids.has(e.endBinding?.elementId),
      )
      .map((e) => ({
        from: ids.get(e.startBinding.elementId),
        to: ids.get(e.endBinding.elementId),
        label: elements.find((t) => t.containerId === e.id)?.text || "",
        color: color(e.strokeColor, "#9b96aa"),
        routing: "auto",
      }));
    if (nodes.length)
      return {
        model: { direction: "LR", nodes, edges },
        notice:
          "Pasted editable Excalidraw shapes. Unsupported drawings and unbound lines are omitted.",
      };
  }
  // tldraw's exported JSON shapes (not its compressed, private browser clipboard).
  const records = data?.records || data?.shapes || data?.content?.shapes;
  if (Array.isArray(records)) {
    const nodes = records
      .filter((e) => e.typeName === "shape" && ["geo", "text"].includes(e.type))
      .map((e, i) => ({
        id: `p${i + 1}`,
        label:
          e.props?.text ||
          e.props?.richText?.content
            ?.map((p) => p.content?.map((t) => t.text || "").join(""))
            .join("\n") ||
          "Untitled",
        shape: e.props?.geo === "diamond" ? "diamond" : "rect",
        fill: "#ede9fe",
        stroke: "#a78bfa",
        position: {
          x: e.x + (e.props?.w || 160) / 2,
          y: e.y + (e.props?.h || 80) / 2,
        },
        size: { width: e.props?.w || 160, height: e.props?.h || 80 },
      }));
    if (nodes.length)
      return {
        model: { direction: "LR", nodes, edges: [] },
        notice:
          "Pasted editable tldraw shapes; unsupported bindings are omitted.",
      };
  }
  if (data)
    throw new Error(
      "This app’s private clipboard format is not supported yet. Copy as SVG or Mermaid instead.",
    );
  return {
    model: {
      direction: "LR",
      nodes: [
        {
          id: "p1",
          label: text.trim(),
          shape: "rect",
          fill: "#ede9fe",
          stroke: "#a78bfa",
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    },
  };
}

export function svgClipboardModel(markup, ownerDocument) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml"),
    svg = doc.documentElement;
  if (svg.localName !== "svg" || doc.querySelector("parsererror"))
    throw new Error("Invalid SVG.");
  // Import geometry only; scripts, foreignObject, remote references and event handlers never enter the board.
  const nodes = [],
    edges = [],
    matrix = (el) => {
      let m = new DOMMatrix();
      for (let n = el; n && n !== svg; n = n.parentElement) {
        const tr = n.getAttribute("transform");
        if (tr) {
          const g = ownerDocument.createElementNS(
            "http://www.w3.org/2000/svg",
            "g",
          );
          g.setAttribute("transform", tr);
          const v = g.transform.baseVal.consolidate();
          if (v) m = v.matrix.multiply(m);
        }
      }
      return m;
    };
  for (const el of svg.querySelectorAll("rect,ellipse,circle,text")) {
    if (el.closest("defs,clipPath,mask")) continue;
    const num = (k) => Number(el.getAttribute(k) || 0);
    let x,
      y,
      w,
      h,
      label = "";
    if (el.localName === "rect") {
      w = num("width");
      h = num("height");
      x = num("x") + w / 2;
      y = num("y") + h / 2;
    } else if (el.localName === "text") {
      label = el.textContent;
      w = Math.max(100, label.length * 8);
      h = 60;
      x = num("x");
      y = num("y");
    } else {
      w = 2 * (num("rx") || num("r"));
      h = 2 * (num("ry") || num("r"));
      x = num("cx");
      y = num("cy");
    }
    if (w < 4 || h < 4) continue;
    const m = matrix(el),
      p = new DOMPoint(x, y).matrixTransform(m);
    nodes.push({
      id: `p${nodes.length + 1}`,
      label: label || " ",
      shape: ["ellipse", "circle"].includes(el.localName) ? "round" : "rect",
      fill: color(el.getAttribute("fill"), "#ede9fe"),
      stroke: color(el.getAttribute("stroke"), "#a78bfa"),
      position: { x: p.x, y: p.y },
      size: {
        width: Math.max(80, w * Math.hypot(m.a, m.b)),
        height: Math.max(48, h * Math.hypot(m.c, m.d)),
      },
    });
  }
  // Put text back into the surrounding rectangle when it is clearly contained.
  for (const n of [...nodes])
    if (n.label.trim()) {
      const parent = nodes.find(
        (p) =>
          p !== n &&
          !p.label.trim() &&
          Math.abs(n.position.x - p.position.x) < p.size.width / 2 &&
          Math.abs(n.position.y - p.position.y) < p.size.height / 2,
      );
      if (parent) {
        parent.label = n.label;
        nodes.splice(nodes.indexOf(n), 1);
      }
    }
  if (!nodes.length)
    throw new Error(
      "SVG has no supported editable shapes/text. Complex paths are not yet imported.",
    );
  return {
    model: { direction: "LR", nodes, edges },
    notice:
      "Pasted editable SVG rectangles, circles and text. Complex paths, images and connectors need a native adapter.",
  };
}

export function exportSelection(svg, layout, ids, edgeIndex, background) {
  const all = new Set(ids),
    partial = all.size || edgeIndex !== null;
  // Inline computed styles so SVG and PNG don't depend on Obsidian's stylesheet.
  const originals = new Map(
    [...svg.querySelectorAll("*")].map((el, i) => [i, el]),
  );

  // Match surviving elements via temporary clone-index attributes, preserving marker defs.
  const styled = svg.cloneNode(true);
  [...styled.querySelectorAll("*")].forEach((el, i) => {
    const s = getComputedStyle(originals.get(i));
    for (const prop of [
      "fill",
      "stroke",
      "stroke-width",
      "font-family",
      "font-size",
      "font-weight",
      "text-anchor",
      "opacity",
      "paint-order",
    ])
      el.style.setProperty(prop, s.getPropertyValue(prop));
  });
  if (partial) {
    for (const el of styled.querySelectorAll(".node")) {
      const id = [...layout.nodes].find(([, n]) => n.el.id === el.id)?.[0];
      if (!all.has(id)) el.remove();
    }
    for (const el of styled.querySelectorAll("[data-edge]")) {
      const i = Number(el.dataset.edge),
        e = layout.links[i].edge;
      if (i !== edgeIndex && !(all.has(e.from) && all.has(e.to))) el.remove();
    }
  }
  const boxes = [];
  for (const [id, n] of layout.nodes)
    if (!partial || all.has(id))
      boxes.push({
        x: n.x - n.width / 2,
        y: n.y - n.height / 2,
        width: n.width,
        height: n.height,
      });
  for (const [i, l] of layout.links.entries())
    if (
      !partial ||
      i === edgeIndex ||
      (all.has(l.edge.from) && all.has(l.edge.to))
    ) {
      boxes.push(l.path.getBBox());
      if (l.labelBox) boxes.push(l.labelBox.getBBox());
    }
  if (!boxes.length) throw new Error("Nothing to copy.");
  const x = Math.min(...boxes.map((b) => b.x)) - 20,
    y = Math.min(...boxes.map((b) => b.y)) - 20,
    w = Math.max(...boxes.map((b) => b.x + b.width)) - x + 20,
    h = Math.max(...boxes.map((b) => b.y + b.height)) - y + 20;
  styled.querySelectorAll("style,.rea-edge-hit").forEach((el) => el.remove());
  styled.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  styled.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  styled.setAttribute("width", w);
  styled.setAttribute("height", h);
  styled.style.background = background;
  styled
    .querySelectorAll(".rea-editing")
    .forEach((el) => el.classList.remove("rea-editing"));
  return {
    text: new XMLSerializer().serializeToString(styled),
    width: w,
    height: h,
  };
}
export async function svgToPng({ text, width, height }, ownerDocument) {
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(2, 8192 / Math.max(width, height)),
      canvas = ownerDocument.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed."))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
