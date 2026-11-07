import { setMarkup, appendMarkup } from "./markup.js";
import {
  membersFor,
  createFrame,
  arrangeNodes,
  removeNodes,
} from "./domain/board-actions.js";
import { resizeBox } from "./domain/resize-box.js";
import { createSaveQueue } from "./workflows/save-queue.js";
import mermaid from "./mermaid-renderer.js";
import { createLayout, wireGeometry } from "./layout.js";
import { INITIAL, parse, serialize, nextId, readBoard } from "./model.js";
import {
  snapValue,
  snapPoint,
  nearestAttachment,
  dragSegment,
  dragBend,
  edgeLink,
  GRID,
} from "./connector-routing.js";
import { alignMove } from "./alignment.js";
import {
  decodeClipboard,
  svgClipboardModel,
  exportSelection,
  svgToPng,
} from "./clipboard.js";
import { button } from "./icons.js";
let instance = 0;
const COLORS = [
  ["#ffffff", "#cbd5e1"],
  ["#ede9fe", "#a78bfa"],
  ["#d1fae5", "#6ee7b7"],
  ["#fef3c7", "#fbbf24"],
  ["#ffe4e6", "#fda4af"],
  ["#dbeafe", "#93c5fd"],
];
export function mount(root, options) {
  const doc = root.ownerDocument,
    win = doc.defaultView;
  root.classList.add("rea");
  const uid = ++instance,
    abort = new AbortController();
  let presenting = false,
    presentIndex = 0,
    snapping = options.snap !== false,
    selection = new Set(),
    spacePan = false,
    source = options.source || INITIAL,
    model = parse(source),
    selected = null,
    selectedEdge = null,
    tool = "select",
    zoom = 1,
    pan = { x: 0, y: 0 },
    layout = null,
    epoch = 0,
    disposed = false,
    history = [source],
    cursor = 0,
    saveQueue = null,
    externalEditing = false,
    drag = null,
    editing = null,
    draft = null,
    title = options.title || "Untitled board",
    suppressClick = false,
    keyboardConnect = null;
  setMarkup(
    root,
    `<main class="rea-workspace"><div class="rea-canvas" tabindex="0" aria-label="Board. Drag shapes to move. Double-click to edit text."><div class="rea-transform"><div class="rea-diagram"></div></div><div class="rea-empty" hidden>A little room to think.<small>Add a shape to get started.</small></div></div>
    <button class="rea-title" aria-label="Rename board" title="Rename board"></button><button class="rea-recover" data-action="fit" hidden>Zoom to content</button><svg class="rea-guides"></svg><div class="rea-paste-menu rea-popover" hidden role="menu"></div><nav class="rea-toolbar" aria-label="Board tools">${button("select", "Select (V)", 'data-tool="select"')}${button("hand", "Pan (H or Space)", 'data-tool="hand"')}<i></i>${button("rect", "Add rectangle (R)", 'data-tool="rect"')}${button("round", "Add pill (O)", 'data-tool="round"')}${button("diamond", "Add decision (D)", 'data-tool="diamond"')}${button("connect", "Connect shapes (C)", 'data-tool="connect"')}<i></i>${button("more", "More board options", 'data-action="more" aria-expanded="false"')}</nav>
    <div class="rea-more rea-popover" hidden role="menu" aria-label="Board options"><div class="rea-board-name"></div><div class="rea-menu-actions">${button("board", "New board", 'data-action="new"')}${button("import", "Import file", 'data-action="import"')}${button("source", "Mermaid source", 'data-action="source"')}${button("arrange", "Auto layout", 'data-action="arrange"')}${button("frame", "Frame selection", 'data-action="frame"')}${button("export", "Export Markdown", 'data-action="export"')}${button("image", "Copy as PNG (⌘⇧C)", 'data-action="copy-png"')}${button("vector", "Copy as SVG", 'data-action="copy-svg"')}${button("grid", "Snap to grid", 'data-action="snap"')}${button("present", "Present board", 'data-action="present"')}${button("support", "Support development on Ko-fi", 'data-action="support"')}</div><div class="rea-theme-controls">${button("sun", "Light mode", 'data-action="light"')}${button("moon", "Dark mode", 'data-action="dark"')}</div><p>Drag to move · Double-click to write<br>Drag a shape’s handle to connect</p></div>
    <div class="rea-context rea-popover" hidden role="toolbar" aria-label="Selection options"></div><div class="rea-palette rea-popover" hidden aria-label="Shape colors"></div><div class="rea-handles" hidden></div><div class="rea-resizers" hidden></div><div class="rea-edge-controls" hidden></div><div class="rea-selection-bounds" hidden></div><div class="rea-marquee" hidden></div>
    <svg class="rea-preview" hidden><defs><marker id="rea-preview-${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10" fill="#7956d9"/></marker></defs><path class="rea-preview-line" marker-end="url(#rea-preview-${uid})"/></svg>
    <div class="rea-zoom">${button("undo", "Undo", 'data-action="undo"')}${button("redo", "Redo", 'data-action="redo"')}<i></i>${button("minus", "Zoom out", 'data-action="out"')}<button class="rea-percent" data-action="fit" title="Fit diagram" aria-label="Fit diagram">100%</button>${button("plus", "Zoom in", 'data-action="in"')}</div>
    <div class="rea-presenter rea-popover" hidden>${button("minus", "Previous idea", 'data-action="previous"')}<span class="rea-present-title"></span>${button("plus", "Next idea", 'data-action="next"')}${button("close", "Exit presentation", 'data-action="exit-present"')}</div><span class="rea-status" role="status">All changes saved locally</span><div class="rea-modal-backdrop" hidden><section class="rea-source-dialog rea-popover" role="dialog" aria-modal="true" aria-label="Mermaid source"><div class="rea-dialog-heading"><strong>Mermaid</strong>${button("close", "Close source", 'data-action="close-source"')}</div><textarea class="rea-source" spellcheck="false" aria-label="Mermaid source"></textarea><div class="rea-source-error" role="alert"></div><div class="rea-dialog-footer"><label>Direction <select class="rea-direction"><option value="LR">Left → right</option><option value="TD">Top → bottom</option><option value="RL">Right → left</option><option value="BT">Bottom → top</option></select></label><button data-action="import-file" class="rea-import-file" hidden>Choose file…</button><button class="rea-primary" data-action="apply-source">Apply changes</button></div></section></div>
    <input class="rea-file" type="file" accept=".board,.md,.mmd,.mermaid,.svg,.json,.excalidraw,.tldr,text/plain" hidden></main>`,
  );
  const $ = (s) => root.querySelector(s),
    canvas = $(".rea-canvas"),
    diagram = $(".rea-diagram"),
    transform = $(".rea-transform"),
    context = $(".rea-context"),
    handles = $(".rea-handles"),
    palette = $(".rea-palette"),
    more = $(".rea-more"),
    modal = $(".rea-modal-backdrop");
  $(".rea-board-name").textContent = title;
  $(".rea-title").textContent = title;
  function setTheme(theme, save = true) {
    root.dataset.theme = theme;
    for (const mode of ["light", "dark"])
      root
        .querySelector(`[data-action=${mode}]`)
        .setAttribute("aria-pressed", String(mode === theme));
    if (save)
      Promise.resolve(options.setTheme?.(theme)).catch(() =>
        status("Could not save theme preference.", true),
      );
  }
  setTheme(options.theme || "light", false);
  function setSnap(value, save = true) {
    snapping = value;
    root.dataset.snap = String(value);
    $("[data-action=snap]").setAttribute("aria-pressed", String(value));
    if (save)
      Promise.resolve(options.setSnap?.(value)).catch(() =>
        status("Could not save grid preference.", true),
      );
  }
  setSnap(snapping, false);
  const snapped = (p, e = {}) => snapPoint(p, snapping && !e.altKey);

  if (!options.newBoard) $("[data-action=new]").hidden = true;
  function on(el, event, fn, opts = {}) {
    el.addEventListener(event, fn, { ...opts, signal: abort.signal });
  }
  function status(text, error = false) {
    $(".rea-status").textContent = text;
    $(".rea-status").classList.toggle("rea-error", error);
  }
  saveQueue = createSaveQueue(
    async (snapshot) => {
      status("Saving…");
      await options.save?.(snapshot, title);
      if (!disposed) status("All changes saved locally");
    },
    (e) => {
      if (!disposed)
        status(
          `Save failed: ${e.message}. Unsaved work retained; export a copy.`,
          true,
        );
    },
  );
  function persist() {
    saveQueue.enqueue(source);
  }
  function nodeId(el) {
    return (
      el && model?.nodes.find((n) => el.id.includes(`flowchart-${n.id}-`))?.id
    );
  }
  function toWorld(x, y) {
    return new DOMPoint(x, y).matrixTransform(
      diagram.querySelector("svg").getScreenCTM().inverse(),
    );
  }
  function toLocal(p) {
    const screen = new DOMPoint(p.x, p.y).matrixTransform(
        diagram.querySelector("svg").getScreenCTM(),
      ),
      r = canvas.getBoundingClientRect();
    return { x: screen.x - r.left, y: screen.y - r.top };
  }
  function hideMenus() {
    $(".rea-paste-menu").hidden = true;
    more.hidden = true;
    palette.hidden = true;
    $("[data-action=more]").setAttribute("aria-expanded", "false");
  }
  function syncSelection() {
    selection = new Set(
      [...selection].filter((id) => model?.nodes.some((n) => n.id === id)),
    );
    selected = selection.size === 1 ? [...selection][0] : null;
  }
  function selectionBox() {
    if (!layout || !selection.size) return null;
    const ns = [...selection].map((id) => layout.nodes.get(id)).filter(Boolean);
    if (!ns.length) return null;
    const x = Math.min(...ns.map((n) => n.x - n.width / 2)),
      y = Math.min(...ns.map((n) => n.y - n.height / 2)),
      right = Math.max(...ns.map((n) => n.x + n.width / 2)),
      bottom = Math.max(...ns.map((n) => n.y + n.height / 2));
    return { x, y, width: right - x, height: bottom - y };
  }
  function highlight() {
    diagram.querySelectorAll(".node").forEach((el) => {
      const id = nodeId(el);
      el.classList.toggle("rea-selected", selection.has(id));
      el.classList.toggle(
        "rea-target",
        drag?.target === id || keyboardConnect === id,
      );
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute(
        "aria-label",
        `Edit ${model?.nodes.find((n) => n.id === id)?.label || "shape"}`,
      );
    });
    diagram
      .querySelectorAll("[data-edge]")
      .forEach((el) =>
        el.classList.toggle(
          "rea-selected-edge",
          Number(el.dataset.edge) === selectedEdge,
        ),
      );
  }
  function view() {
    transform.style.transform = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
    $(".rea-percent").textContent = `${Math.round(zoom * 100)}%`;
    canvas.style.backgroundSize = `${GRID * zoom}px ${GRID * zoom}px`;
    canvas.style.backgroundPosition = `${pan.x - (GRID * zoom) / 2}px ${pan.y - (GRID * zoom) / 2}px`;
    placeControls();
    const b = layout?.bounds();
    $(".rea-recover").hidden =
      !b ||
      (b.x * zoom + pan.x < canvas.clientWidth - 70 &&
        (b.x + b.width) * zoom + pan.x > 80 &&
        b.y * zoom + pan.y < canvas.clientHeight - 60 &&
        (b.y + b.height) * zoom + pan.y > 50);
  }
  function animateView() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const before = transform.style.transform;
    view();
    const after = transform.style.transform;
    transform.animate([{ transform: before }, { transform: after }], {
      duration: 220,
      easing: "cubic-bezier(.2,.8,.2,1)",
    });
  }
  function fit() {
    const svg = diagram.querySelector("svg");
    if (!svg) return;
    const b = layout ? layout.bounds() : svg.viewBox.baseVal,
      w = Math.max(100, canvas.clientWidth - 220),
      h = Math.max(100, canvas.clientHeight - 140);
    zoom = Math.min(1.2, Math.max(0.05, Math.min(w / b.width, h / b.height)));
    pan = {
      x: 110 + (w - b.width * zoom) / 2 - (layout ? b.x * zoom : 0),
      y: 70 + (h - b.height * zoom) / 2 - (layout ? b.y * zoom : 0),
    };
    animateView();
  }
  function placeControls() {
    drawEdgeControls();
    const resizers = $(".rea-resizers"),
      frame = $(".rea-selection-bounds");
    if (editing || drag?.moved || !layout) {
      context.hidden = true;
      handles.hidden = true;
      resizers.hidden = true;
      frame.hidden = true;
      return;
    }
    const n = layout.nodes.get(selected),
      box = selectionBox();
    let anchor;
    handles.hidden = !n || n.shape === "frame";
    resizers.hidden = !n;
    frame.hidden = !box;
    if (box) {
      const topLeft = toLocal({ x: box.x, y: box.y }),
        bottomRight = toLocal({ x: box.x + box.width, y: box.y + box.height });
      anchor = { x: (topLeft.x + bottomRight.x) / 2, y: topLeft.y - 82 };
      for (const [key, value] of Object.entries({
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      }))
        frame.style[key] = `${value}px`;
    }
    if (n) {
      const top = toLocal({ x: n.x, y: n.y - n.height / 2 }),
        bottom = toLocal({ x: n.x, y: n.y + n.height / 2 }),
        left = toLocal({ x: n.x - n.width / 2, y: n.y }),
        right = toLocal({ x: n.x + n.width / 2, y: n.y });
      for (const [side, p] of Object.entries({ top, right, bottom, left })) {
        const b = handles.querySelector(`[data-port=${side}]`);
        b.style.left = `${p.x}px`;
        b.style.top = `${p.y}px`;
        const q = handles.querySelector(`[data-quick-add=${side}]`);
        q.style.left = `${p.x + ({ left: -28, right: 28 }[side] || 0)}px`;
        q.style.top = `${p.y + ({ top: -28, bottom: 28 }[side] || 0)}px`;
      }
      for (const [corner, p] of Object.entries({
        n: { x: top.x, y: top.y - 7 },
        e: { x: right.x + 7, y: right.y },
        s: { x: bottom.x, y: bottom.y + 7 },
        w: { x: left.x - 7, y: left.y },
        nw: toLocal({ x: n.x - n.width / 2, y: n.y - n.height / 2 }),
        ne: toLocal({ x: n.x + n.width / 2, y: n.y - n.height / 2 }),
        se: toLocal({ x: n.x + n.width / 2, y: n.y + n.height / 2 }),
        sw: toLocal({ x: n.x - n.width / 2, y: n.y + n.height / 2 }),
      })) {
        const b = resizers.querySelector(`[data-resize=${corner}]`);
        b.style.left = `${p.x}px`;
        b.style.top = `${p.y}px`;
      }
    } else if (selectedEdge !== null) {
      const link = layout.links[selectedEdge];
      if (link?.geometry) {
        const points = link.geometry.points || [link.geometry.label],
          locals = points.map(toLocal);
        anchor = {
          x:
            (Math.min(...locals.map((p) => p.x)) +
              Math.max(...locals.map((p) => p.x))) /
            2,
          y:
            Math.min(
              ...locals.map((p) => p.y),
              ...(link.labelBox
                ? [link.labelBox.getBBox().y * zoom + pan.y]
                : []),
            ) - 78,
        };
      }
    }
    if (!anchor) {
      context.hidden = true;
      return;
    }
    context.hidden = false;
    const half = context.offsetWidth / 2;
    context.style.left = `${Math.max(half + 82, Math.min(canvas.clientWidth - half - 10, anchor.x))}px`;
    const top =
      anchor.y < 58
        ? Math.min(
            canvas.clientHeight - 55,
            (box
              ? toLocal({ x: box.x, y: box.y + box.height }).y
              : anchor.y + 100) + 40,
          )
        : anchor.y;
    context.style.top = `${Math.max(58, Math.min(canvas.clientHeight - 50, top))}px`;
    if (!palette.hidden) {
      palette.style.left = context.style.left;
      palette.style.top = `${parseFloat(context.style.top) + 48}px`;
    }
  }
  function selectionControls() {
    palette.hidden = true;
    syncSelection();
    const n = model?.nodes.find((n) => n.id === selected);
    setMarkup(
      context,
      n
        ? `${button("text", "Edit text", 'data-selection="text"')}<button aria-label="Shape color" title="Shape color" data-selection="color"><span class="rea-color-dot"></span></button><select aria-label="Shape type" class="rea-shape-type"><option value="rect">▢</option><option value="round">▱</option><option value="diamond">◇</option></select><i></i>${button("plus", "Add child idea (Tab)", 'data-selection="child"')}${button("duplicate", "Duplicate shape (⌘D)", 'data-selection="duplicate"')}${button("trash", "Delete shape", 'data-selection="delete"')}`
        : selectedEdge !== null
          ? `${button("text", "Edit connection label", 'data-selection="edge-text"')}<button aria-label="Connection color" title="Connection color" data-selection="color"><span class="rea-color-dot"></span></button><select aria-label="Connector routing" class="rea-edge-routing"><option value="auto">Auto</option><option value="straight">Straight</option><option value="orthogonal">Right angle</option></select><select aria-label="Connection label width" class="rea-edge-width" title="Label width"><option value="0">Auto width</option><option value="100">Narrow</option><option value="160">Medium</option><option value="240">Wide</option><option value="320">Extra wide</option></select><select aria-label="Connection text size" class="rea-edge-font"><option value="13">13 px</option><option value="16">16 px</option><option value="20">20 px</option><option value="24">24 px</option><option value="32">32 px</option></select>${button("arrange", "Reset connector route", 'data-selection="reset-route"')}${button("trash", "Delete connection", 'data-selection="delete"')}`
          : selection.size > 1
            ? `<span class="rea-selection-count">${selection.size} shapes</span><button aria-label="Shape color" title="Shape color" data-selection="color"><span class="rea-color-dot"></span></button>${button("duplicate", "Duplicate shapes (⌘D)", 'data-selection="duplicate"')}${button("trash", "Delete shapes", 'data-selection="delete"')}${button("frame", "Frame selection", 'data-selection="frame"')}<select class="rea-arrangement" aria-label="Arrange selection"><option value="">Arrange…</option><option value="left">Align left</option><option value="center">Align centers</option><option value="right">Align right</option><option value="top">Align top</option><option value="middle">Align middles</option><option value="bottom">Align bottom</option><option value="distribute-x">Distribute horizontally</option><option value="distribute-y">Distribute vertically</option></select>`
            : "",
    );
    if (n?.shape === "frame") {
      const type = context.querySelector(".rea-shape-type");
      setMarkup(type, '<option value="frame">Frame</option>');
      type.disabled = true;
      context.querySelector("[data-selection=child]").hidden = true;
    }
    if (n) {
      context.querySelector(".rea-color-dot").style.background = n.fill;
      context.querySelector(".rea-shape-type").value = n.shape;
    }
    if (selectedEdge !== null && model?.edges[selectedEdge]) {
      const e = model.edges[selectedEdge];
      context.querySelector(".rea-color-dot").style.background =
        e.color || "#9b96aa";
      context.querySelector(".rea-edge-routing").value =
        e.routing || "straight";
      context.querySelector(".rea-edge-width").value = String(
        e.labelWidth || 0,
      );
      context.querySelector(".rea-edge-font").value = String(
        e.labelFontSize || 13,
      );
    }
    const item =
      n || (selectedEdge !== null ? model?.edges[selectedEdge] : null);
    if (item) {
      if (options.pickLink)
        appendMarkup(
          context,
          button(
            "link",
            item.link ? "Change note link" : "Add note link",
            'data-selection="note-link"',
          ),
        );
      if (edgeLink(item) && options.openLink)
        appendMarkup(
          context,
          button("link", "Open linked note", 'data-selection="open-link"'),
        );
      if (item.link)
        appendMarkup(
          context,
          button("close", "Remove note link", 'data-selection="remove-link"'),
        );
    }
    placeControls();
    highlight();
  }
  for (const side of ["top", "right", "bottom", "left"]) {
    const b = doc.createElement("button");
    b.className = "rea-port";
    b.dataset.port = side;
    b.setAttribute("aria-label", `Drag ${side} connection handle`);
    b.title = "Drag to connect · Drop in empty space to add a connected shape";
    handles.append(b);
    const q = doc.createElement("button");
    q.className = "rea-quick-add";
    q.dataset.quickAdd = side;
    q.setAttribute("aria-label", `Add idea ${side}`);
    q.textContent = "+";
    handles.append(q);
  }
  for (const corner of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
    const b = doc.createElement("button");
    b.className = "rea-resize";
    b.dataset.resize = corner;
    b.setAttribute("aria-label", `Resize ${corner} corner`);
    b.title = "Drag to resize · Shift to keep proportions";
    $(".rea-resizers").append(b);
  }
  on($(".rea-resizers"), "pointerdown", (e) => {
    const corner = e.target.closest("[data-resize]")?.dataset.resize;
    if (e.button !== 0 || !corner || !selected) return;
    e.preventDefault();
    finishText();
    hideMenus();
    const n = layout.nodes.get(selected);
    drag = {
      kind: "resize",
      id: selected,
      corner,
      start: toWorld(e.clientX, e.clientY),
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      positions: layout.positions(),
      moved: false,
    };
    canvas.setPointerCapture(e.pointerId);
  });
  async function render(autoFit = false, editAfter = null) {
    const ticket = ++epoch;
    model = parse(source);
    try {
      const existing = diagram.querySelector("svg");
      if (layout && model?.nodes.every((n) => n.position) && existing) {
        for (const el of [...existing.querySelectorAll(".node")])
          if (!nodeId(el)) el.remove();
        for (const n of model.nodes)
          if (
            ![...existing.querySelectorAll(".node")].some(
              (el) => nodeId(el) === n.id,
            )
          ) {
            const el = doc.createElementNS("http://www.w3.org/2000/svg", "g");
            el.id = `flowchart-${n.id}-board`;
            el.classList.add("node");
            existing.append(el);
          }
        layout = createLayout(existing, model, nodeId);
        $(".rea-empty").hidden = !!model.nodes.length;
        if (autoFit) fit();
        selectionControls();
        if (editAfter) startText(editAfter);
        return;
      }
      const result = await mermaid.render(`rea-${uid}-${ticket}`, source);
      if (disposed || ticket !== epoch) return;
      setMarkup(diagram, result.svg);
      const svg = diagram.querySelector("svg");
      const box = svg.viewBox.baseVal;
      svg.setAttribute("width", box.width);
      svg.setAttribute("height", box.height);
      layout = model ? createLayout(svg, model, nodeId) : null;
      if (layout) {
        svg.setAttribute("viewBox", "0 0 1 1");
        svg.setAttribute("width", "1");
        svg.setAttribute("height", "1");
      }
      $(".rea-empty").hidden = !!model?.nodes.length || !model;
      if (autoFit) fit();
      selectionControls();
      if (editAfter) startText(editAfter);
    } catch {
      if (ticket === epoch)
        status("Could not render diagram. Check Mermaid source.", true);
    }
  }
  function commit(next, { autoFit = false, editAfter = null } = {}) {
    if (externalEditing) {
      status("An external edit is being saved. Try again.", true);
      render();
      return;
    }
    if (next === source) return;
    source = next;
    draft = null;
    history = history.slice(0, cursor + 1);
    history.push(next);
    cursor++;
    if (history.length > 100) {
      history.shift();
      cursor--;
    }
    model = parse(source);
    render(autoFit, editAfter);
    persist();
  }
  function freezePositions(next) {
    if (layout) {
      const positions = layout.positions();
      for (const n of next.nodes)
        if (positions[n.id]) {
          n.position = positions[n.id];
          const at = layout.nodes.get(n.id);
          n.size = { width: at.width, height: at.height };
        }
    }
  }
  function change(fn, opts) {
    if (!model) {
      showSource();
      status("This Mermaid syntax is edited as source.", true);
      return;
    }
    const next = structuredClone(model);
    freezePositions(next);
    try {
      fn(next);
      const text = serialize(next);
      if (
        !parse(text) ||
        next.nodes.length > 300 ||
        next.edges.length > 1000 ||
        text.length > 200000
      )
        throw new Error(
          "Board exceeds supported limits or has invalid geometry",
        );
      commit(text, opts);
    } catch (e) {
      status(e.message, true);
    }
  }
  function setTool(next) {
    tool = next;
    keyboardConnect = null;
    root.querySelectorAll("[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === tool);
      b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
    });
    canvas.classList.toggle("rea-connect-tool", next === "connect");
    canvas.classList.toggle("rea-hand-tool", next === "hand");
    highlight();
  }
  function add(shape, position) {
    finishText();
    hideMenus();
    let id;
    change(
      (m) => {
        id = nextId(m);
        const r = canvas.getBoundingClientRect(),
          p =
            position ||
            toWorld(
              r.left + canvas.clientWidth / 2,
              r.top + canvas.clientHeight / 2,
            );
        if (!position)
          while (
            m.nodes.some(
              (n) =>
                n.position &&
                Math.abs(n.position.x - p.x) < 150 &&
                Math.abs(n.position.y - p.y) < 90,
            )
          ) {
            p.x += 35;
            p.y += 100;
          }
        m.nodes.push({
          id,
          label: shape === "diamond" ? "A decision" : "A new thought",
          shape,
          fill: "#ede9fe",
          stroke: "#a78bfa",
          position: snapped(p),
        });
        selected = id;
        selection = new Set([id]);
        selectedEdge = null;
      },
      { editAfter: null },
    );
    setTool("select");
  }
  function child(side = "right") {
    if (!selected || !model) return;
    finishText();
    const parent = model.nodes.find((n) => n.id === selected),
      at = layout.nodes.get(selected),
      id = nextId(model);
    change(
      (m) => {
        m.nodes.push({
          id,
          label: "A new thought",
          shape: "rect",
          fill: parent.fill,
          stroke: parent.stroke,
          size: { width: at.width, height: at.height },
          position: snapped({
            x: at.x + ({ right: 340, left: -340 }[side] || 0),
            y: at.y + ({ top: -180, bottom: 180 }[side] || 0),
          }),
        });
        m.edges.push({
          from: parent.id,
          to: id,
          label: "",
          routing: "auto",
          fromSide: side,
        });
        selection = new Set([id]);
        selected = id;
        selectedEdge = null;
      },
      { editAfter: id },
    );
  }
  on(handles, "click", (e) => {
    const side = e.target.closest("[data-quick-add]")?.dataset.quickAdd;
    if (side) child(side);
  });
  function focusIdea(id) {
    const n = layout?.nodes.get(id);
    if (!n) return;
    selection = new Set([id]);
    selected = id;
    selectedEdge = null;
    zoom = Math.min(
      1.6,
      Math.max(
        0.2,
        Math.min(
          (canvas.clientWidth - 180) / n.width,
          (canvas.clientHeight - 160) / n.height,
        ),
      ),
    );
    pan = {
      x: canvas.clientWidth / 2 - n.x * zoom,
      y: canvas.clientHeight / 2 - n.y * zoom,
    };
    animateView();
    highlight();
    $(".rea-present-title").textContent = n.label;
  }
  function present(delta = 0) {
    if (!model?.nodes.length) return;
    finishText();
    hideMenus();
    presenting = true;
    root.classList.add("rea-presenting");
    $(".rea-presenter").hidden = false;
    presentIndex = Math.max(
      0,
      Math.min(model.nodes.length - 1, presentIndex + delta),
    );
    focusIdea(model.nodes[presentIndex].id);
    canvas.focus();
  }
  function exitPresent() {
    presenting = false;
    root.classList.remove("rea-presenting");
    $(".rea-presenter").hidden = true;
    fit();
    selectionControls();
  }
  function duplicate() {
    if (!selection.size) return;
    const originals = membersFor(model, selection);
    change((m) => {
      const map = new Map();
      for (const n of [...m.nodes])
        if (originals.has(n.id)) {
          const id = nextId(m);
          map.set(n.id, id);
          m.nodes.push({
            ...n,
            id,
            position: { x: n.position.x + 40, y: n.position.y + 80 },
          });
        }
      for (const n of m.nodes)
        if ([...map.values()].includes(n.id) && n.members)
          n.members = n.members.map((id) => map.get(id)).filter(Boolean);
      m.edges.push(
        ...m.edges
          .filter((e) => map.has(e.from) && map.has(e.to))
          .map((e) => ({
            ...e,
            from: map.get(e.from),
            to: map.get(e.to),
            ...(e.waypoints
              ? {
                  waypoints: e.waypoints.map((p) => ({
                    x: p.x + 40,
                    y: p.y + 80,
                  })),
                }
              : {}),
          })),
      );
      selection = new Set(map.values());
      selected = selection.size === 1 ? [...selection][0] : null;
    });
  }
  function removeSelection() {
    if (selection.size) {
      const ids = new Set(selection);
      change((m) => {
        removeNodes(m, ids);
      });
    } else if (selectedEdge !== null)
      change((m) => m.edges.splice(selectedEdge, 1));
    selection.clear();
    selected = null;
    selectedEdge = null;
    selectionControls();
  }
  function selectNode(id, additive = false, preserve = false) {
    if (!id) return;
    if (additive) {
      if (selection.has(id)) selection.delete(id);
      else selection.add(id);
    } else if (!preserve || !selection.has(id)) selection = new Set([id]);
    syncSelection();
    selectedEdge = null;
    hideMenus();
    selectionControls();
  }
  function selectEdge(index) {
    selection.clear();
    selected = null;
    selectedEdge = index;
    hideMenus();
    selectionControls();
  }
  function startText(id = null, edgeIndex = null) {
    finishText();
    hideMenus();
    const n = id && layout?.nodes.get(id),
      edge = edgeIndex !== null && model?.edges[edgeIndex];
    if (!n && !edge) return;
    let p,
      width = 200;
    if (n) {
      selection = new Set([id]);
      selected = id;
      selectedEdge = null;
      p = toLocal(n);
      width = Math.max(100, n.width * zoom - 26);
    } else {
      selection.clear();
      selected = null;
      selectedEdge = edgeIndex;
      const a = layout.nodes.get(edge.from),
        b = layout.nodes.get(edge.to);
      p = toLocal(
        layout.links[edgeIndex]?.geometry?.label || {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        },
      );
      width = (edge.labelWidth || 180) * zoom;
    }
    const input = doc.createElement("textarea");
    input.rows = 1;
    input.className = "rea-inline-text";
    input.setAttribute("aria-label", n ? "Shape text" : "Connection text");
    input.value = n ? n.label : edge.label;
    input.style.width = `${Math.min(width, canvas.clientWidth - 32)}px`;
    input.style.left = `${Math.max(16 + Math.min(width, canvas.clientWidth - 32) / 2, Math.min(canvas.clientWidth - 16 - Math.min(width, canvas.clientWidth - 32) / 2, p.x))}px`;
    input.style.top = `${Math.max(24, Math.min(canvas.clientHeight - 24, p.y))}px`;
    input.style.fontSize = `${Math.max(10, (edge ? edge.labelFontSize || 13 : 16) * zoom)}px`;
    editing = { input, id, edgeIndex, original: input.value };
    root.append(input);
    if (n) n.el.classList.add("rea-editing");
    selectionControls();
    input.focus();
    input.select();
    on(input, "keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        finishText();
        canvas.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishText(true);
        canvas.focus();
      }
    });
    on(input, "input", () => {
      input.style.removeProperty("height");
      input.style.height = `${Math.min(220, Math.max(34, input.scrollHeight))}px`;
    });
    input.style.height = `${Math.min(220, Math.max(34, input.scrollHeight))}px`;
    on(input, "blur", () => finishText());
  }
  function finishText(cancel = false) {
    if (!editing) return;
    const current = editing;
    editing = null;
    current.input.remove();
    diagram
      .querySelectorAll(".rea-editing")
      .forEach((el) => el.classList.remove("rea-editing"));
    if (!cancel && current.input.value !== current.original) {
      const value = current.input.value;
      change((m) => {
        if (current.id) {
          const n = m.nodes.find((n) => n.id === current.id);
          if (n) n.label = value || "Untitled";
        } else if (m.edges[current.edgeIndex])
          m.edges[current.edgeIndex].label = value;
      });
    }
    placeControls();
  }
  function connect(from, to, fromSide) {
    if (from === to) return;
    change((m) => {
      if (!m.edges.some((e) => e.from === from && e.to === to))
        m.edges.push({
          from,
          to,
          label: "",
          routing: "auto",
          ...(fromSide ? { fromSide } : {}),
        });
    });
    setTool("select");
  }
  function hitNode(x, y, exclude) {
    const p = toWorld(x, y);
    for (const n of [...layout.nodes.values()].reverse()) {
      if (n.id === exclude) continue;
      const dx = Math.abs(p.x - n.x) / (n.width / 2 + 8 / zoom),
        dy = Math.abs(p.y - n.y) / (n.height / 2 + 8 / zoom);
      if (n.shape === "diamond" ? dx + dy <= 1.12 : dx <= 1 && dy <= 1)
        return n.id;
    }
    return null;
  }
  function startConnect(e, from, fromSide) {
    finishText();
    hideMenus();
    selectNode(from);
    drag = {
      kind: "connect",
      from,
      fromSide,
      start: { x: e.clientX, y: e.clientY },
      moved: false,
      target: null,
    };
    canvas.setPointerCapture(e.pointerId);
    context.hidden = true;
    handles.hidden = true;
  }
  on(handles, "pointerdown", (e) => {
    if (e.button !== 0) return;
    const port = e.target.closest("[data-port]");
    if (port && selected) {
      e.preventDefault();
      e.stopPropagation();
      startConnect(e, selected, port.dataset.port);
    }
  });
  function previewConnection(e) {
    drag.target = hitNode(e.clientX, e.clientY, drag.from);
    const a = layout.nodes.get(drag.from),
      target = drag.target
        ? layout.nodes.get(drag.target)
        : {
            ...toWorld(e.clientX, e.clientY),
            width: 0,
            height: 0,
            shape: "rect",
          },
      geo = wireGeometry(a, target, false, {
        routing: "auto",
        fromSide: drag.fromSide,
      }),
      points = geo.points.map(toLocal);
    $(".rea-preview").hidden = false;
    $(".rea-preview-line").setAttribute(
      "d",
      points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" "),
    );
    highlight();
  }
  function drawEdgeControls() {
    const holder = $(".rea-edge-controls");
    holder.hidden =
      selectedEdge === null || !layout || !!editing || !!drag?.moved;
    if (holder.hidden) return;
    const link = layout.links[selectedEdge],
      points = link?.geometry?.points;
    if (!points?.length) {
      holder.hidden = true;
      return;
    }
    holder.replaceChildren();
    function handle(kind, index, p, label) {
      const at = toLocal(p),
        b = doc.createElement("button");
      b.className = `rea-edge-control rea-edge-${kind}`;
      b.dataset.edgeControl = kind;
      b.dataset.index = String(index);
      b.setAttribute("aria-label", label);
      b.title = label;
      b.style.left = `${at.x}px`;
      b.style.top = `${at.y}px`;
      holder.append(b);
    }
    handle("from", 0, points[0], "Reconnect source endpoint");
    handle("to", points.length - 1, points.at(-1), "Reconnect target endpoint");
    for (let i = 1; i < points.length - 1; i++)
      handle("bend", i, points[i], `Drag connector bend ${i}`);
    for (let i = 0; i < points.length - 1; i++) {
      if (points.length > 2 && (i === 0 || i === points.length - 2)) continue;
      const a = points[i],
        b = points[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 14)
        handle(
          "segment",
          i,
          { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          `Drag connector segment ${i + 1}`,
        );
    }
    if (link.labelBox) {
      const b = link.labelBox.getBoundingClientRect(),
        r = canvas.getBoundingClientRect(),
        h = doc.createElement("button");
      h.className = "rea-edge-control rea-edge-width-handle";
      h.dataset.edgeControl = "label-width";
      h.setAttribute("aria-label", "Resize connection label");
      h.title = "Drag to resize label width";
      h.style.left = `${b.right - r.left + 5}px`;
      h.style.top = `${b.top + b.height / 2 - r.top}px`;
      holder.append(h);
    }
  }
  function startEdgeDrag(e, kind, index = 0) {
    if (e.button !== 0 || selectedEdge === null || !layout) return;
    e.preventDefault();
    finishText();
    hideMenus();
    const link = layout.links[selectedEdge];
    drag = {
      kind: "edge",
      action: kind,
      index,
      edgeIndex: selectedEdge,
      original: structuredClone(link.edge),
      points: structuredClone(link.geometry.points),
      start: toWorld(e.clientX, e.clientY),
      clientX: e.clientX,
      clientY: e.clientY,
      moved: false,
      target: null,
    };
    canvas.setPointerCapture(e.pointerId);
  }
  on($(".rea-edge-controls"), "pointerdown", (e) => {
    const b = e.target.closest("[data-edge-control]");
    if (b)
      startEdgeDrag(e, b.dataset.edgeControl, Number(b.dataset.index) || 0);
  });
  function moveEdge(e) {
    const d = drag,
      link = layout.links[d.edgeIndex],
      p = snapped(toWorld(e.clientX, e.clientY), e);
    if (
      !d.moved &&
      Math.hypot(e.clientX - d.clientX, e.clientY - d.clientY) < 3
    )
      return;
    d.moved = true;
    link.edge = structuredClone(d.original);
    if (d.action === "from" || d.action === "to") {
      d.target = hitNode(e.clientX, e.clientY);
      const n = d.target
          ? layout.nodes.get(d.target)
          : { ...p, width: 0, height: 0, shape: "rect" },
        attachment = nearestAttachment(
          n,
          d.target &&
            Math.abs(p.x - n.x) < n.width * 0.18 &&
            Math.abs(p.y - n.y) < n.height * 0.18
            ? d.action === "from"
              ? d.points[1] || d.points.at(-1)
              : d.points.at(-2) || d.points[0]
            : p,
        ),
        prefix = d.action === "from" ? "from" : "to";
      link.edge[`${prefix}Side`] = attachment.side;
      link.edge[`${prefix}Ratio`] = attachment.ratio;
      if (prefix === "from") link.previewFrom = n;
      else link.previewTo = n;
    } else if (d.action === "label") {
      const before = d.original.labelOffset || { x: 0, y: 0 };
      link.edge.labelOffset = {
        x: before.x + p.x - d.start.x,
        y: before.y + p.y - d.start.y,
      };
    } else if (d.action === "label-width") {
      link.edge.labelWidth = Math.max(
        60,
        Math.min(800, (d.original.labelWidth || 180) + 2 * (p.x - d.start.x)),
      );
    } else {
      const points =
        d.action === "bend"
          ? dragBend(d.points, d.index, p)
          : dragSegment(d.points, d.index, p);
      link.edge.routing = "orthogonal";
      link.edge.waypoints = points.slice(1, -1);
    }
    layout.redraw();
    highlight();
    placeControls();
  }
  function endEdge(d, cancel) {
    const link = layout.links[d.edgeIndex];
    const next = structuredClone(link.edge);
    delete link.previewFrom;
    delete link.previewTo;
    link.edge = structuredClone(d.original);
    if (!cancel && d.moved) {
      if (d.action === "from" || d.action === "to") {
        if (d.target) next[d.action] = d.target;
        else {
          layout.redraw();
          selectionControls();
          return;
        }
      }
      change((m) => {
        m.edges[d.edgeIndex] = next;
      });
    } else layout.redraw();
    selectionControls();
  }
  on(canvas, "pointerdown", (e) => {
    if (externalEditing) return;
    if (e.button !== 0 && e.button !== 1) return;
    finishText();
    hideMenus();
    const node = e.target.closest(".node"),
      id = nodeId(node),
      edge = e.target.closest("[data-edge]");
    if ((e.ctrlKey || e.metaKey) && options.openLink) {
      const item = id
        ? model.nodes.find((n) => n.id === id)
        : edge
          ? model.edges[Number(edge.dataset.edge)]
          : null;
      if (edgeLink(item)) {
        options.openLink(edgeLink(item));
        return;
      }
    }
    if (edge && e.target.closest(".rea-wire-label,.rea-edge-label-bg")) {
      selectEdge(Number(edge.dataset.edge));
      startEdgeDrag(e, "label");
      return;
    }
    if (e.button === 1 || spacePan || tool === "hand") {
      e.preventDefault();
      drag = {
        kind: "pan",
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
        moved: false,
      };
      return;
    }
    if (id && layout) {
      if (tool === "connect") {
        startConnect(e, id);
        return;
      }
      if (e.shiftKey) {
        selectNode(id, true);
        return;
      }
      selectNode(id, false, true);
      drag = {
        kind: "node",
        id,
        ids: [...membersFor(model, selection)],
        start: toWorld(e.clientX, e.clientY),
        clientX: e.clientX,
        clientY: e.clientY,
        moved: false,
        positions: layout.positions(),
        edges: layout.links.map((l) => structuredClone(l.edge)),
      };
    } else if (!e.target.closest("[data-edge]")) {
      const base = e.shiftKey ? new Set(selection) : new Set();
      selection = base;
      selected = null;
      selectedEdge = null;
      selectionControls();
      drag = {
        kind: "marquee",
        x: e.clientX,
        y: e.clientY,
        base: new Set(base),
        moved: false,
      };
      canvas.setPointerCapture(e.pointerId);
    }
  });
  function updatePointer(e) {
    if (!drag) return;
    if (drag.kind === "edge") {
      moveEdge(e);
      return;
    }
    if (drag.kind === "connect") {
      if (Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y) > 4)
        drag.moved = true;
      previewConnection(e);
      return;
    }
    if (drag.kind === "pan") {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return;
      drag.moved = true;
      canvas.setPointerCapture(e.pointerId);
      pan = {
        x: drag.px + e.clientX - drag.x,
        y: drag.py + e.clientY - drag.y,
      };
      view();
      canvas.classList.add("panning");
      return;
    }
    if (drag.kind === "marquee") {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 3) return;
      drag.moved = true;
      const r = canvas.getBoundingClientRect(),
        left = Math.min(drag.x, e.clientX),
        top = Math.min(drag.y, e.clientY),
        right = Math.max(drag.x, e.clientX),
        bottom = Math.max(drag.y, e.clientY);
      const box = $(".rea-marquee");
      box.hidden = false;
      for (const [key, v] of Object.entries({
        left: left - r.left,
        top: top - r.top,
        width: right - left,
        height: bottom - top,
      }))
        box.style[key] = `${v}px`;
      const a = toWorld(left, top),
        b = toWorld(right, bottom);
      selection = new Set(drag.base);
      for (const n of layout?.nodes.values() || [])
        if (
          n.x + n.width / 2 >= a.x &&
          n.x - n.width / 2 <= b.x &&
          n.y + n.height / 2 >= a.y &&
          n.y - n.height / 2 <= b.y
        )
          selection.add(n.id);
      syncSelection();
      highlight();
      placeControls();
      return;
    }
    if (drag.kind === "resize") {
      const p = toWorld(e.clientX, e.clientY),
        next = resizeBox(
          drag,
          drag.corner,
          { x: p.x - drag.start.x, y: p.y - drag.start.y },
          {
            snap: snapping && !e.altKey,
            others: e.altKey
              ? []
              : [...layout.nodes.values()].filter(
                  (n) => n.id !== drag.id && n.shape !== "frame",
                ),
            threshold: 6 / zoom,
          },
        );
      if (e.shiftKey && drag.corner.length === 2) {
        const factor = Math.max(
          next.width / drag.width,
          next.height / drag.height,
        );
        next.width = drag.width * factor;
        next.height = drag.height * factor;
        next.x =
          drag.x +
          ((next.width - drag.width) * (drag.corner.includes("e") ? 1 : -1)) /
            2;
        next.y =
          drag.y +
          ((next.height - drag.height) * (drag.corner.includes("s") ? 1 : -1)) /
            2;
      }
      drag.moved = true;
      const actual = layout.resize(drag.id, next);
      layout.move(drag.id, {
        x:
          next.x +
          ((actual.width - next.width) * (drag.corner.includes("w") ? -1 : 1)) /
            2,
        y:
          next.y +
          ((actual.height - next.height) *
            (drag.corner.includes("n") ? -1 : 1)) /
            2,
      });
      drawGuides(next.guides);
      layout.redraw();
      placeControls();
      return;
    }
    if (
      !drag.moved &&
      Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) < 3
    )
      return;
    drag.moved = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("rea-dragging");
    const p = toWorld(e.clientX, e.clientY),
      primary = drag.positions[drag.id],
      target = snapped(
        {
          x: primary.x + p.x - drag.start.x,
          y: primary.y + p.y - drag.start.y,
        },
        e,
      ),
      moving = layout.nodes.get(drag.id),
      aligned = e.altKey
        ? { x: 0, y: 0, guides: [] }
        : alignMove(
            { ...target, width: moving.width, height: moving.height },
            [...layout.nodes.values()].filter((n) => !drag.ids.includes(n.id)),
            6 / zoom,
          ),
      dx = target.x + aligned.x - primary.x,
      dy = target.y + aligned.y - primary.y;
    drawGuides(aligned.guides);
    for (const id of drag.ids) {
      const before = drag.positions[id];
      layout.move(id, { x: before.x + dx, y: before.y + dy });
    }
    for (let i = 0; i < layout.links.length; i++) {
      const original = drag.edges[i];
      if (
        drag.ids.includes(original.from) &&
        drag.ids.includes(original.to) &&
        original.waypoints
      )
        layout.links[i].edge.waypoints = original.waypoints.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
    }
    layout.redraw();
    placeControls();
  }
  let pointerFrame = 0,
    pendingPointer = null;
  on(canvas, "pointermove", (e) => {
    pendingPointer = e;
    if (!pointerFrame)
      pointerFrame = win.requestAnimationFrame(() => {
        pointerFrame = 0;
        const latest = pendingPointer;
        pendingPointer = null;
        if (latest) updatePointer(latest);
      });
  });
  function endDrag(e, cancel = false) {
    if (pendingPointer) {
      win.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      const latest = pendingPointer;
      pendingPointer = null;
      if (!cancel) updatePointer(latest);
    }
    drawGuides([]);
    const done = drag;
    drag = null;
    canvas.classList.remove("panning", "rea-dragging");
    $(".rea-preview").hidden = true;
    $(".rea-marquee").hidden = true;
    highlight();
    if (!done) return;
    if (done.kind === "edge") {
      if (done.moved) {
        suppressClick = true;
        win.setTimeout(() => (suppressClick = false), 0);
      }
      endEdge(done, cancel);
      return;
    }
    if (done.kind === "marquee") {
      if (cancel) selection = done.base;
      syncSelection();
      selectionControls();
      return;
    }
    if (done.kind === "resize") {
      if (cancel) {
        layout.resize(done.id, { width: done.width, height: done.height });
        layout.move(done.id, { x: done.x, y: done.y });
        layout.redraw();
      } else if (done.moved) {
        const n = layout.nodes.get(done.id),
          positions = layout.positions();
        change((m) => {
          const node = m.nodes.find((x) => x.id === done.id);
          node.size = { width: n.width, height: n.height };
          node.position = positions[done.id];
        });
      }
      placeControls();
      return;
    }
    if (done.moved) {
      suppressClick = true;
      win.setTimeout(() => (suppressClick = false), 0);
    }
    if (done.kind === "connect") {
      if (!cancel && done.moved) {
        const r = canvas.getBoundingClientRect();
        if (done.target) {
          connect(done.from, done.target, done.fromSide);
          selection = new Set([done.target]);
          selected = done.target;
        } else if (
          hitNode(e.clientX, e.clientY) !== done.from &&
          e.clientX > r.left + 85 &&
          e.clientX < r.right - 10 &&
          e.clientY > r.top + 10 &&
          e.clientY < r.bottom - 60
        ) {
          const p = toWorld(e.clientX, e.clientY);
          change(
            (m) => {
              const base = m.nodes.find((n) => n.id === done.from),
                id = nextId(m);
              m.nodes.push({
                ...base,
                id,
                label: "A new thought",
                position: snapped(p),
              });
              m.edges.push({
                from: done.from,
                to: id,
                label: "",
                routing: "auto",
                ...(done.fromSide ? { fromSide: done.fromSide } : {}),
              });
              selected = id;
              selection = new Set([id]);
              selectedEdge = null;
            },
            { editAfter: null },
          );
          setTool("select");
        }
      } else if (!cancel && tool === "connect") {
        if (keyboardConnect && keyboardConnect !== done.from) {
          connect(keyboardConnect, done.from);
          keyboardConnect = null;
        } else keyboardConnect = done.from;
      }
    } else if (done.kind === "node" && done.moved) {
      if (cancel) {
        for (const [id, p] of Object.entries(done.positions))
          layout.move(id, p);
        done.edges?.forEach(
          (edge, i) => (layout.links[i].edge = structuredClone(edge)),
        );
        layout.redraw();
      } else {
        const positions = layout.positions(),
          edges = layout.links.map((l) => structuredClone(l.edge));
        change((m) => {
          for (const n of m.nodes)
            if (positions[n.id]) n.position = positions[n.id];
          m.edges = edges;
        });
      }
    }
    placeControls();
    highlight();
  }
  on(canvas, "pointerup", (e) => endDrag(e));
  on(canvas, "pointercancel", (e) => endDrag(e, true));
  on(canvas, "lostpointercapture", (e) => {
    if (drag) endDrag(e, true);
  });
  on(diagram, "click", (e) => {
    if (suppressClick) return;
    const edge = e.target.closest("[data-edge]");
    if (edge) selectEdge(Number(edge.dataset.edge));
  });
  on(diagram, "dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = nodeId(e.target.closest(".node")),
      edge = e.target.closest("[data-edge]");
    if (id) startText(id);
    else if (edge) startText(null, Number(edge.dataset.edge));
  });
  on(diagram, "keydown", (e) => {
    if (e.key !== "Enter") return;
    const edge = e.target.closest("[data-edge]");
    if (edge) {
      e.preventDefault();
      startText(null, Number(edge.dataset.edge));
      return;
    }
    const id = nodeId(e.target.closest(".node"));
    if (id) {
      e.preventDefault();
      if (tool === "connect") {
        if (keyboardConnect) connect(keyboardConnect, id);
        else {
          keyboardConnect = id;
          highlight();
        }
      } else startText(id);
    }
  });
  on(canvas, "dblclick", (e) => {
    if (!e.target.closest(".node,[data-edge]") && model)
      add("rect", toWorld(e.clientX, e.clientY));
  });
  on(context, "click", (e) => {
    const action = e.target.closest("[data-selection]")?.dataset.selection;
    if (action === "frame") frameSelection();
    if (action === "child") child();
    if (action === "text") startText(selected);
    if (action === "edge-text") startText(null, selectedEdge);
    if (action === "duplicate") duplicate();
    if (action === "delete") removeSelection();
    if (action === "note-link") chooseLink();
    if (action === "open-link") {
      const item = selected
        ? model.nodes.find((n) => n.id === selected)
        : model.edges[selectedEdge];
      if (edgeLink(item)) options.openLink?.(edgeLink(item));
    }
    if (action === "remove-link")
      change((m) => {
        const item = selected
          ? m.nodes.find((n) => n.id === selected)
          : m.edges[selectedEdge];
        delete item.link;
      });
    if (action === "reset-route")
      change((m) => {
        const edge = m.edges[selectedEdge];
        delete edge.waypoints;
        delete edge.labelOffset;
        delete edge.fromSide;
        delete edge.toSide;
        delete edge.fromRatio;
        delete edge.toRatio;
        edge.routing = "auto";
      });
    if (action === "color") {
      if (palette.hidden) showPalette();
      else palette.hidden = true;
      placeControls();
    }
  });
  on(context, "change", (e) => {
    if (e.target.matches(".rea-arrangement")) {
      const mode = e.target.value;
      if (mode) change((m) => arrangeNodes(m, [...selection], mode));
      return;
    }
    if (e.target.matches(".rea-shape-type"))
      change(
        (m) => (m.nodes.find((n) => n.id === selected).shape = e.target.value),
      );
    if (e.target.matches(".rea-edge-routing"))
      change((m) => {
        m.edges[selectedEdge].routing = e.target.value;
        delete m.edges[selectedEdge].waypoints;
      });
    if (e.target.matches(".rea-edge-font"))
      change(
        (m) => (m.edges[selectedEdge].labelFontSize = Number(e.target.value)),
      );
    if (e.target.matches(".rea-edge-width"))
      change((m) => {
        if (Number(e.target.value))
          m.edges[selectedEdge].labelWidth = Number(e.target.value);
        else delete m.edges[selectedEdge].labelWidth;
      });
  });
  async function chooseLink() {
    const before = source,
      id = selected,
      index = selectedEdge;
    if (!options.pickLink || (!id && index === null)) return;
    finishText();
    try {
      const link = await options.pickLink();
      if (!link || disposed) return;
      if (source !== before) {
        status("Board changed while choosing a link. Choose it again.", true);
        return;
      }
      change((m) => {
        const item = id ? m.nodes.find((n) => n.id === id) : m.edges[index];
        if (item) item.link = link;
      });
    } catch (e) {
      status(`Could not choose link: ${e.message}`, true);
    }
  }
  function showPalette() {
    palette.replaceChildren();
    const isEdge = selectedEdge !== null,
      choices = isEdge
        ? [
            ["#9b96aa", "#9b96aa"],
            ["#8b5cf6", "#8b5cf6"],
            ["#3b82f6", "#3b82f6"],
            ["#10b981", "#10b981"],
            ["#f59e0b", "#f59e0b"],
            ["#ef4444", "#ef4444"],
          ]
        : COLORS;
    for (const [fill, stroke] of choices) {
      const b = doc.createElement("button");
      b.style.background = fill;
      b.style.borderColor = stroke;
      b.setAttribute(
        "aria-label",
        `${isEdge ? "Connection color" : "Color"} ${fill}`,
      );
      b.title = fill;
      palette.append(b);
      on(b, "click", () => {
        change((m) => {
          if (isEdge) m.edges[selectedEdge].color = fill;
          else
            for (const n of m.nodes)
              if (selection.has(n.id)) Object.assign(n, { fill, stroke });
        });
        palette.hidden = true;
      });
    }
    palette.hidden = false;
  }
  function scale(
    factor,
    x = canvas.clientWidth / 2,
    y = canvas.clientHeight / 2,
    animate = false,
  ) {
    finishText();
    const next = Math.max(0.05, Math.min(3, zoom * factor));
    pan = {
      x: x - ((x - pan.x) * next) / zoom,
      y: y - ((y - pan.y) * next) / zoom,
    };
    zoom = next;
    if (animate) animateView();
    else view();
  }
  on(
    canvas,
    "wheel",
    (e) => {
      e.preventDefault();
      if (drag) return;
      if (e.ctrlKey || e.metaKey) {
        const r = canvas.getBoundingClientRect();
        scale(
          Math.exp(-e.deltaY * 0.008),
          e.clientX - r.left,
          e.clientY - r.top,
        );
      } else {
        finishText();
        pan.x -= e.deltaX;
        pan.y -= e.deltaY;
        view();
      }
    },
    { passive: false },
  );
  function travel(delta) {
    finishText(true);
    if (cursor + delta < 0 || cursor + delta >= history.length) return;
    cursor += delta;
    source = history[cursor];
    draft = null;
    selection.clear();
    selected = null;
    selectedEdge = null;
    hideMenus();
    render();
    persist();
  }
  let importing = false;
  function showSource(asImport = false) {
    finishText();
    hideMenus();
    importing = asImport;
    modal.hidden = false;
    modal
      .querySelector("section")
      .setAttribute(
        "aria-label",
        asImport ? "Import Mermaid" : "Mermaid source",
      );
    $(".rea-dialog-heading strong").textContent = asImport
      ? "Import Mermaid"
      : "Mermaid";
    $(".rea-source").setAttribute(
      "placeholder",
      asImport ? "Paste Mermaid code or a fenced Mermaid block here…" : "",
    );
    $(".rea-source").value = asImport ? "" : (draft ?? source);
    $(".rea-source-error").textContent = "";
    $(".rea-direction").value = model?.direction || "LR";
    $(".rea-direction").disabled = asImport || !model;
    $(".rea-import-file").hidden = !asImport;
    $("[data-action=apply-source]").textContent = asImport
      ? "Import diagram"
      : "Apply changes";
    $(".rea-source").focus();
  }
  function closeSource() {
    if (!importing) draft = $(".rea-source").value;
    modal.hidden = true;
    canvas.focus();
  }
  async function applySource() {
    const entered = $(".rea-source").value,
      value = readBoard(entered) || entered;
    try {
      await mermaid.parse(value);
      if (importing) {
        selection.clear();
        selected = null;
        selectedEdge = null;
      }
      commit(value, { autoFit: importing });
      modal.hidden = true;
      canvas.focus();
    } catch {
      $(".rea-source-error").textContent =
        "Check your syntax. The saved board has not changed.";
    }
  }
  function download() {
    const url = URL.createObjectURL(
        new Blob(
          [`# ${title}\n\n\x60\x60\x60mermaid\n${source}\n\x60\x60\x60\n`],
          { type: "text/markdown" },
        ),
      ),
      a = doc.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[\\/:*?"<>|]/g, "-") || "Board"}.md`;
    a.click();
    win.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function drawGuides(guides) {
    const svg = $(".rea-guides");
    svg.replaceChildren();
    for (const g of guides) {
      const a = toLocal(
          g.axis === "x"
            ? { x: g.value, y: g.start }
            : { x: g.start, y: g.value },
        ),
        b = toLocal(
          g.axis === "x" ? { x: g.value, y: g.end } : { x: g.end, y: g.value },
        ),
        line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
      for (const [k, v] of Object.entries({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      }))
        line.setAttribute(k, v);
      svg.append(line);
    }
  }
  on($(".rea-title"), "click", () => {
    const b = $(".rea-title"),
      input = doc.createElement("input");
    input.className = "rea-title-input";
    input.value = title;
    input.setAttribute("aria-label", "Board name");
    b.hidden = true;
    b.after(input);
    let ended = false;
    const finish = async (cancel) => {
      if (ended) return;
      ended = true;
      const next = input.value.trim();
      input.remove();
      b.hidden = false;
      if (cancel || !next || next === title) return;
      try {
        if (/[\\/:*?"<>|]/.test(next))
          throw new Error("Choose a name without file path characters.");
        await options.rename?.(next);
        title = next;
        b.textContent = title;
        $(".rea-board-name").textContent = title;
        if (!options.rename) persist();
      } catch (e) {
        status(e.message, true);
      }
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") finish(false);
      if (e.key === "Escape") finish(true);
    });
    input.addEventListener("blur", () => finish(false));
    input.focus();
    input.select();
  });
  let pastePoint = null;
  async function pasteText(text, html = "") {
    finishText();
    const before = source;
    try {
      const decoded = /<svg[\s>]/i.test(text)
        ? svgClipboardModel(text, doc)
        : /<svg[\s>]/i.test(html) && !/^\s*(?:flowchart|graph|[[{])/.test(text)
          ? svgClipboardModel(
              html.slice(html.indexOf("<svg"), html.indexOf("</svg>") + 6),
              doc,
            )
          : decodeClipboard(
              text ||
                new win.DOMParser().parseFromString(html, "text/html").body
                  .textContent,
            );
      if (decoded.source) await mermaid.parse(decoded.source);
      if (source !== before)
        throw new Error(
          "Board changed while reading the clipboard. Paste again.",
        );
      if (!decoded.model) {
        if (model?.nodes.length)
          throw new Error(
            "Paste this Mermaid diagram type into an empty board, or edit it in Mermaid source.",
          );
        selection.clear();
        commit(decoded.source, { autoFit: true });
        return;
      }
      if (!model)
        throw new Error(
          "This diagram uses source-only Mermaid. Create an editable flowchart board to paste shapes.",
        );
      const incoming = parse(serialize(decoded.model));
      if (!incoming)
        throw new Error("Unsupported or invalid shape geometry in clipboard.");
      if (!incoming.nodes.length) return;
      if (
        incoming.nodes.length > 300 ||
        incoming.nodes.length + model.nodes.length > 300
      )
        throw new Error("Paste is limited to 300 shapes.");
      // Resolve Mermaid auto layout offscreen once, then insert every shape at the paste location.
      let positions = incoming.nodes.every((n) => n.position)
        ? Object.fromEntries(incoming.nodes.map((n) => [n.id, n.position]))
        : null;
      if (!positions) {
        const result = await mermaid.render(
            `rea-paste-${uid}-${++epoch}`,
            serialize(incoming),
          ),
          holder = doc.createElement("div");
        holder.className = "rea-offscreen-measure";
        setMarkup(holder, result.svg);
        root.append(holder);
        try {
          const svg = holder.querySelector("svg"),
            l = createLayout(
              svg,
              incoming,
              (el) =>
                incoming.nodes.find((n) => el.id.includes(`flowchart-${n.id}-`))
                  ?.id,
            );
          positions = l.positions();
          for (const n of incoming.nodes) {
            const at = l.nodes.get(n.id);
            n.size = { width: at.width, height: at.height };
          }
        } finally {
          holder.remove();
        }
      }
      if (source !== before)
        throw new Error("Board changed during paste. Paste again.");
      const r = canvas.getBoundingClientRect(),
        explicit = !!pastePoint,
        at =
          pastePoint ||
          toWorld(
            r.left + canvas.clientWidth / 2,
            r.top + canvas.clientHeight / 2,
          );
      pastePoint = null;
      const xs = Object.values(positions).map((p) => p.x),
        ys = Object.values(positions).map((p) => p.y),
        cx = (Math.min(...xs) + Math.max(...xs)) / 2,
        cy = (Math.min(...ys) + Math.max(...ys)) / 2,
        offset = {
          x: snapValue(at.x - cx, snapping),
          y: snapValue(at.y - cy, snapping),
        };
      if (!explicit) {
        for (let tries = 0; tries < 50; tries++) {
          const overlaps = incoming.nodes.some((n) =>
            [...layout.nodes.values()].some(
              (b) =>
                Math.abs(positions[n.id].x + offset.x - b.x) <
                  ((n.size?.width || 160) + b.width) / 2 + 16 &&
                Math.abs(positions[n.id].y + offset.y - b.y) <
                  ((n.size?.height || 80) + b.height) / 2 + 16,
            ),
          );
          if (!overlaps) break;
          offset.x += 40;
          offset.y += 80;
        }
      }
      change((m) => {
        const ids = new Map();
        for (const n of incoming.nodes) {
          const id = nextId(m);
          ids.set(n.id, id);
          m.nodes.push({
            ...n,
            id,
            position: {
              x: positions[n.id].x + offset.x,
              y: positions[n.id].y + offset.y,
            },
          });
        }
        for (const n of m.nodes)
          if ([...ids.values()].includes(n.id) && n.members)
            n.members = n.members.map((id) => ids.get(id)).filter(Boolean);
        for (const e of incoming.edges)
          m.edges.push({
            ...e,
            from: ids.get(e.from),
            to: ids.get(e.to),
            ...(e.waypoints
              ? {
                  waypoints: e.waypoints.map((p) => ({
                    x: p.x + offset.x,
                    y: p.y + offset.y,
                  })),
                }
              : {}),
          });
        selection = new Set(ids.values());
        selectedEdge = null;
      });
      if (decoded.notice) status(decoded.notice);
    } catch (e) {
      status(`Paste: ${e.message}`, true);
    }
  }
  async function pasteFromClipboard() {
    hideMenus();
    try {
      const data = options.readClipboard
        ? await options.readClipboard()
        : { text: await navigator.clipboard.readText() };
      await pasteText(data.text, data.html);
    } catch {
      status(
        "Clipboard access unavailable. Press ⌘V / Ctrl+V on the board.",
        true,
      );
    }
  }
  on(root, "paste", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !modal.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    const data = e.clipboardData,
      text =
        data.getData("application/x-excalidraw") || data.getData("text/plain"),
      html = data.getData("text/html");
    if (!text && !html) {
      status(
        "This clipboard contains only an image or a private app format. Copy as SVG or Mermaid for editable shapes.",
        true,
      );
      return;
    }
    pasteText(text, html);
  });
  on(root, "copy", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !model) return;
    e.preventDefault();
    e.stopPropagation();
    const ids = selection.size
        ? membersFor(model, selection)
        : selectedEdge !== null
          ? new Set([
              model.edges[selectedEdge].from,
              model.edges[selectedEdge].to,
            ])
          : new Set(model.nodes.map((n) => n.id)),
      copy = structuredClone(model);
    freezePositions(copy);
    copy.nodes = copy.nodes.filter((n) => ids.has(n.id));
    copy.edges = copy.edges.filter(
      (e, i) => selectedEdge === i || (ids.has(e.from) && ids.has(e.to)),
    );
    e.clipboardData.setData("text/plain", serialize(copy));
    status("Copied Mermaid shapes.");
  });
  async function copyVisual(kind) {
    finishText();
    hideMenus();
    try {
      if (!layout)
        throw new Error(
          "Image copying currently supports editable flowcharts.",
        );
      const image = exportSelection(
        diagram.querySelector("svg"),
        layout,
        membersFor(model, selection),
        selectedEdge,
        getComputedStyle(root).getPropertyValue("--paper").trim(),
      );
      if (kind === "png") {
        const blob = await svgToPng(image, doc);
        if (options.copyImage)
          await options.copyImage(await blob.arrayBuffer());
        else
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
      } else if (options.copySvg) await options.copySvg(image.text);
      else {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": new Blob([image.text], { type: "text/plain" }),
              "text/html": new Blob([image.text], { type: "text/html" }),
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(image.text);
        }
      }
      status(
        `Copied ${selection.size ? "selection" : "content"} as ${kind.toUpperCase()}.`,
      );
    } catch (e) {
      status(`Copy failed: ${e.message}`, true);
    }
  }
  on(canvas, "contextmenu", (e) => {
    if (editing) return;
    e.preventDefault();
    finishText();
    hideMenus();
    pastePoint = toWorld(e.clientX, e.clientY);
    const id = nodeId(e.target.closest(".node")),
      edge = e.target.closest("[data-edge]");
    if (id && !selection.has(id)) selectNode(id);
    if (edge) selectEdge(Number(edge.dataset.edge));
    const menu = $(".rea-paste-menu");
    setMarkup(
      menu,
      '<button data-action="paste">Paste</button><button data-action="copy-png">Copy as PNG · ⌘⇧C</button><button data-action="copy-svg">Copy as SVG</button><button data-action="fit">Zoom to content</button>',
    );
    menu.hidden = false;
    const r = canvas.getBoundingClientRect();
    menu.style.left = `${Math.max(80, Math.min(canvas.clientWidth - 210, e.clientX - r.left))}px`;
    menu.style.top = `${Math.max(55, Math.min(canvas.clientHeight - 180, e.clientY - r.top))}px`;
  });
  function frameSelection() {
    if (!selection.size) {
      status("Select shapes to place in a frame.");
      return;
    }
    change((m) => {
      const id = nextId(m);
      createFrame(m, { id, ids: [...selection] });
      selection = new Set([id]);
      selected = id;
      selectedEdge = null;
    });
  }
  const actions = {
    support: () =>
      win.open(
        "https://ko-fi.com/theprasanjitsahoo",
        "_blank",
        "noopener,noreferrer",
      ),
    frame: frameSelection,
    "copy-png": () => copyVisual("png"),
    "copy-svg": () => copyVisual("svg"),
    paste: () => pasteFromClipboard(),
    present: () => {
      presentIndex = Math.max(
        0,
        model?.nodes.findIndex((n) => n.id === selected) || 0,
      );
      present();
    },
    next: () => present(1),
    previous: () => present(-1),
    "exit-present": exitPresent,
    snap: () => setSnap(!snapping),
    light: () => setTheme("light"),
    dark: () => setTheme("dark"),
    more: () => {
      finishText();
      more.hidden = !more.hidden;
      palette.hidden = true;
      $("[data-action=more]").setAttribute(
        "aria-expanded",
        String(!more.hidden),
      );
    },
    new: () => options.newBoard?.(),
    source: () => showSource(false),
    "close-source": closeSource,
    "apply-source": applySource,
    arrange: () => {
      hideMenus();
      change(
        (m) => {
          if (m.nodes.some((n) => n.shape === "frame"))
            throw new Error(
              "Arrange frames or their members with the selection controls.",
            );
          for (const n of m.nodes) delete n.position;
          for (const e of m.edges) {
            delete e.waypoints;
            delete e.labelOffset;
          }
        },
        { autoFit: true },
      );
    },
    export: () => {
      finishText();
      download();
      hideMenus();
    },
    import: () => $(".rea-file").click(),
    "import-file": () => $(".rea-file").click(),
    fit,
    in: () => scale(1.2, undefined, undefined, true),
    out: () => scale(1 / 1.2, undefined, undefined, true),
    undo: () => travel(-1),
    redo: () => travel(1),
  };
  on(root, "click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action) actions[action]?.();
    const t = e.target.closest("[data-tool]")?.dataset.tool;
    if (t) {
      finishText();
      hideMenus();
      if (["rect", "round", "diamond"].includes(t)) add(t);
      else setTool(t);
    }
  });
  on($(".rea-source"), "input", () => (draft = $(".rea-source").value));
  on($(".rea-direction"), "change", (e) => {
    const next = parse($(".rea-source").value);
    if (next) {
      next.direction = e.target.value;
      for (const n of next.nodes) delete n.position;
      $(".rea-source").value = serialize(next);
      draft = $(".rea-source").value;
    }
  });
  on($(".rea-file"), "change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (/\.(svg|json|excalidraw|tldr)$/i.test(file.name)) {
        await pasteText(text);
        e.target.value = "";
        return;
      }
      const next = readBoard(text) || text;
      await mermaid.parse(next);
      if (!options.fixedTitle) {
        title = file.name.replace(/\.(board|md|mmd|mermaid)$/, "");
        $(".rea-board-name").textContent = title;
        $(".rea-title").textContent = title;
      }
      selection.clear();
      selected = null;
      selectedEdge = null;
      modal.hidden = true;
      commit(next, { autoFit: true });
    } catch {
      status("Could not import that Mermaid file.", true);
    }
    e.target.value = "";
  });
  on(root, "keydown", (e) => {
    if (presenting && ["ArrowRight", "ArrowLeft", "Escape"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Escape") exitPresent();
      else present(e.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (e.key === "Escape" && !editing) {
      e.preventDefault();
      if (!modal.hidden) {
        closeSource();
        return;
      }
      if (drag) {
        endDrag(e, true);
        return;
      }
      hideMenus();
      selection.clear();
      selected = null;
      selectedEdge = null;
      setTool("select");
      selectionControls();
      return;
    }
    if (!modal.hidden) {
      if (e.key === "Tab") {
        e.preventDefault();
        const controls = [
          ...modal.querySelectorAll("button,textarea,select"),
        ].filter((el) => !el.disabled && !el.hidden);
        const i = controls.indexOf(doc.activeElement);
        controls[
          (i + (e.shiftKey ? -1 : 1) + controls.length) % controls.length
        ].focus();
      }
      return;
    }
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "Tab" && !e.shiftKey && selected) {
      e.preventDefault();
      child();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      e.stopPropagation();
      copyVisual(e.altKey ? "svg" : "png");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "0") {
      e.preventDefault();
      fit();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.stopPropagation();
      travel(e.shiftKey ? 1 : -1);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicate();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeSelection();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selection = new Set(model?.nodes.map((n) => n.id) || []);
      selectedEdge = null;
      selectionControls();
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      spacePan = true;
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = {
      r: "rect",
      d: "diamond",
      o: "round",
      c: "connect",
      v: "select",
      h: "hand",
    }[e.key.toLowerCase()];
    if (t) {
      e.preventDefault();
      if (["rect", "round", "diamond"].includes(t)) add(t);
      else setTool(t);
    }
  });
  on(win, "keyup", (e) => {
    if (e.key === " ") spacePan = false;
  });
  on(win, "blur", () => (spacePan = false));
  const resize = new ResizeObserver(() => placeControls());
  resize.observe(canvas);
  setTool("select");
  render(true);
  return {
    destroy() {
      finishText();
      disposed = true;
      win.cancelAnimationFrame(pointerFrame);
      resize.disconnect();
      abort.abort();
      setMarkup(root, "");
    },
    setSnap: (value) => setSnap(value, false),
    setTheme: (theme) => setTheme(theme, false),
    focusNode: focusIdea,
    snapshot: () => ({
      selectedNodes: [...selection],
      selectedEdge,
      viewport: { zoom, pan },
    }),
    getSource: () => source,
    async flush() {
      finishText();
      await saveQueue.flush();
    },
    async withExternalWrite(expected, action) {
      await this.flush();
      if (source !== expected)
        throw new Error("Revision conflict: unsaved Board edits changed");
      externalEditing = true;
      try {
        return await action();
      } finally {
        externalEditing = false;
      }
    },
    setTitle(next) {
      title = next;
      $(".rea-board-name").textContent = title;
      $(".rea-title").textContent = title;
    },
  };
}
