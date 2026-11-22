import { setMarkup, appendMarkup } from "../markup.js";
import { button } from "../icons.js";
import {
  applyConnectorColor,
  CONNECTOR_COLORS,
  SHAPE_COLORS,
} from "../appearance.js";
import { arrangeNodes, reverseConnector } from "../domain/board-actions.js";
import { cardNode, clipboardCard, validCard } from "../content-card.js";
export function createSelectionControls({
  board,
  $,
  doc,
  canvas,
  diagram,
  context,
  handles,
  palette,
  on,
  nodeId,
  toLocal,
  hideMenus,
  isCardEditing,
  startText,
  change,
  frameSelection,
  duplicate,
  removeSelection,
}) {
  function syncSelection() {
    board.selection = new Set(
      [...board.selection].filter((id) =>
        board.model?.nodes.some((n) => n.id === id),
      ),
    );
    board.selected =
      board.selection.size === 1 ? [...board.selection][0] : null;
  }
  function selectionBox() {
    if (!board.layout || !board.selection.size) return null;
    const ns = [...board.selection]
      .map((id) => board.layout.nodes.get(id))
      .filter(Boolean);
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
      el.classList.toggle("rea-selected", board.selection.has(id));
      el.classList.toggle(
        "rea-target",
        board.drag?.target === id || board.keyboardConnect === id,
      );
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute(
        "aria-label",
        `Edit ${board.model?.nodes.find((n) => n.id === id)?.label || "shape"}`,
      );
    });
    diagram
      .querySelectorAll("[data-edge]")
      .forEach((el) =>
        el.classList.toggle(
          "rea-selected-edge",
          Number(el.dataset.edge) === board.selectedEdge,
        ),
      );
  }
  function placePorts() {
    const n = board.layout?.nodes.get(board.hoveredNode || board.selected);
    handles.hidden =
      !n ||
      n.shape === "frame" ||
      !!board.editing ||
      !!board.drag ||
      board.presenting ||
      board.tool === "hand";
    if (handles.hidden) return;
    for (const [side, point] of Object.entries({
      top: { x: n.x, y: n.y - n.height / 2 },
      right: { x: n.x + n.width / 2, y: n.y },
      bottom: { x: n.x, y: n.y + n.height / 2 },
      left: { x: n.x - n.width / 2, y: n.y },
    })) {
      const p = toLocal(point);
      const b = handles.querySelector(`[data-port=${side}]`);
      b.style.left = `${p.x}px`;
      b.style.top = `${p.y}px`;
      const q = handles.querySelector(`[data-quick-add=${side}]`);
      q.style.left = `${p.x + ({ left: -28, right: 28 }[side] || 0)}px`;
      q.style.top = `${p.y + ({ top: -28, bottom: 28 }[side] || 0)}px`;
    }
  }
  function placeControls() {
    drawEdgeControls();
    const resizers = $(".rea-resizers"),
      frame = $(".rea-selection-bounds");
    if (
      board.editing ||
      isCardEditing() ||
      board.drag?.moved ||
      !board.layout
    ) {
      context.hidden = true;
      handles.hidden = true;
      resizers.hidden = true;
      frame.hidden = true;
      return;
    }
    const n = board.layout.nodes.get(board.selected),
      box = selectionBox();
    let anchor, belowEdge;
    placePorts();
    resizers.hidden = !n || !!n.card;
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
      for (const [corner, p] of Object.entries({
        n: { x: top.x, y: top.y },
        e: { x: right.x, y: right.y },
        s: { x: bottom.x, y: bottom.y },
        w: { x: left.x, y: left.y },
        nw: toLocal({ x: n.x - n.width / 2, y: n.y - n.height / 2 }),
        ne: toLocal({ x: n.x + n.width / 2, y: n.y - n.height / 2 }),
        se: toLocal({ x: n.x + n.width / 2, y: n.y + n.height / 2 }),
        sw: toLocal({ x: n.x - n.width / 2, y: n.y + n.height / 2 }),
      })) {
        const b = resizers.querySelector(`[data-resize=${corner}]`);
        b.style.left = `${p.x}px`;
        b.style.top = `${p.y}px`;
        if (corner.length === 1) {
          if (["n", "s"].includes(corner))
            b.style.width = `${Math.max(38, n.width * board.zoom - 20)}px`;
          else b.style.height = `${Math.max(38, n.height * board.zoom - 20)}px`;
        }
      }
    } else if (board.selectedEdge !== null) {
      const link = board.layout.links[board.selectedEdge];
      if (link?.geometry) {
        const points = link.geometry.points || [link.geometry.label],
          locals = points.map(toLocal);
        const endpoints = [link.edge.from, link.edge.to]
          .map((id) => board.layout.nodes.get(id))
          .filter(Boolean);
        const tops = endpoints.map(
          (node) => toLocal({ x: node.x, y: node.y - node.height / 2 }).y,
        );
        const bottoms = endpoints.map(
          (node) => toLocal({ x: node.x, y: node.y + node.height / 2 }).y,
        );
        belowEdge = Math.max(...bottoms, ...locals.map((p) => p.y)) + 18;
        anchor = {
          x:
            (Math.min(...locals.map((p) => p.x)) +
              Math.max(...locals.map((p) => p.x))) /
            2,
          y:
            Math.min(
              ...tops,
              ...locals.map((p) => p.y),
              ...(link.labelBox
                ? [link.labelBox.getBBox().y * board.zoom + board.pan.y]
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
              : belowEdge !== undefined
                ? belowEdge - 40
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
    const n = board.model?.nodes.find((n) => n.id === board.selected);
    setMarkup(
      context,
      n?.card
        ? `${button("text", "Edit card content", 'data-selection="text"')}${button("duplicate", "Duplicate card (⌘D)", 'data-selection="duplicate"')}${button("trash", "Delete card", 'data-selection="delete"')}`
        : n
          ? `${button("text", "Edit text", 'data-selection="text"')}<button aria-label="Shape color" title="Shape color" data-selection="color"><span class="rea-color-dot"></span></button><select aria-label="Shape type" class="rea-shape-type"><option value="rect">▢</option><option value="round">▱</option><option value="diamond">◇</option></select><i></i>${button("duplicate", "Duplicate shape (⌘D)", 'data-selection="duplicate"')}${button("trash", "Delete shape", 'data-selection="delete"')}`
          : board.selectedEdge !== null
            ? `${button("text", "Edit connection label", 'data-selection="edge-text"')}<button aria-label="Connection color" title="Connection color" data-selection="color"><span class="rea-color-dot"></span></button><select aria-label="Connector direction" class="rea-edge-direction"><option value="one">One-way</option><option value="both">Two-way</option></select>${button("reverse", "Reverse connector", 'data-selection="reverse-edge"')}<select aria-label="Connector routing" class="rea-edge-routing"><option value="auto">Auto</option><option value="straight">Straight</option><option value="orthogonal">Right angle</option></select><select aria-label="Connection label width" class="rea-edge-width" title="Label width"><option value="0">Auto width</option><option value="100">Narrow</option><option value="160">Medium</option><option value="240">Wide</option><option value="320">Extra wide</option></select><select aria-label="Connection text size" class="rea-edge-font"><option value="13">13 px</option><option value="16">16 px</option><option value="20">20 px</option><option value="24">24 px</option><option value="32">32 px</option></select>${button("arrange", "Reset connector route", 'data-selection="reset-route"')}${button("trash", "Delete connection", 'data-selection="delete"')}`
            : board.selection.size > 1
              ? `<span class="rea-selection-count">${board.selection.size} shapes</span><button aria-label="Shape color" title="Shape color" data-selection="color"><span class="rea-color-dot"></span></button>${button("duplicate", "Duplicate shapes (⌘D)", 'data-selection="duplicate"')}${button("trash", "Delete shapes", 'data-selection="delete"')}${button("frame", "Frame selection", 'data-selection="frame"')}<select class="rea-arrangement" aria-label="Arrange selection"><option value="">Arrange…</option><option value="left">Align left</option><option value="center">Align centers</option><option value="right">Align right</option><option value="top">Align top</option><option value="middle">Align middles</option><option value="bottom">Align bottom</option><option value="distribute-x">Distribute horizontally</option><option value="distribute-y">Distribute vertically</option></select>`
              : "",
    );
    if (n && !n.card && ["frame", "text", "line"].includes(n.shape)) {
      const type = context.querySelector(".rea-shape-type");
      setMarkup(type, `<option value="${n.shape}">${n.shape}</option>`);
      if (n.shape === "line")
        context.querySelector("[data-selection=text]").hidden = true;
      type.disabled = true;
    }
    if (n && !n.card && n.shape !== "frame" && clipboardCard(n.label, "", doc))
      appendMarkup(
        context,
        button(
          "table",
          "Convert to content card",
          'data-selection="convert-card"',
        ),
      );
    if (n && !n.card) {
      const dot = context.querySelector(".rea-color-dot");
      dot.classList.remove("rea-connector-color");
      dot.style.background = n.fill;
      context.querySelector(".rea-shape-type").value = n.shape;
    }
    if (board.selectedEdge !== null && board.model?.edges[board.selectedEdge]) {
      const e = board.model.edges[board.selectedEdge];
      const dot = context.querySelector(".rea-color-dot");
      dot.style.removeProperty("background");
      applyConnectorColor(dot, e.color);
      context.querySelector(".rea-edge-direction").value = e.bidirectional
        ? "both"
        : "one";
      context.querySelector(".rea-edge-routing").value =
        e.routing || "straight";
      context.querySelector(".rea-edge-width").value = String(
        e.labelWidth || 0,
      );
      context.querySelector(".rea-edge-font").value = String(
        e.labelFontSize || 13,
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
    b.dataset.edgeGrip = String(corner.length === 1);

    $(".rea-resizers").append(b);
  }

  function selectNode(id, additive = false, preserve = false) {
    if (!id) return;
    if (additive) {
      if (board.selection.has(id)) board.selection.delete(id);
      else board.selection.add(id);
    } else if (!preserve || !board.selection.has(id))
      board.selection = new Set([id]);
    syncSelection();
    board.selectedEdge = null;
    hideMenus();
    selectionControls();
  }
  function selectEdge(index) {
    board.selection.clear();
    board.selected = null;
    board.selectedEdge = index;
    hideMenus();
    selectionControls();
  }

  function drawEdgeControls() {
    const holder = $(".rea-edge-controls");
    holder.hidden =
      board.selectedEdge === null ||
      !board.layout ||
      !!board.editing ||
      !!board.drag?.moved;
    if (holder.hidden) return;
    const link = board.layout.links[board.selectedEdge],
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

  function bindSelectionActions() {
    on(context, "click", (e) => {
      const action = e.target.closest("[data-selection]")?.dataset.selection;
      if (action === "frame") frameSelection();
      if (action === "text") startText(board.selected);
      if (action === "convert-card")
        change((next) => {
          const node = next.nodes.find((item) => item.id === board.selected);
          const card = clipboardCard(node.label, "", doc);
          if (!validCard(card))
            throw new Error("Card exceeds the supported size.");
          Object.assign(node, cardNode(card));
        });
      if (action === "reverse-edge" && board.selectedEdge !== null)
        change((m) => reverseConnector(m.edges[board.selectedEdge]));
      if (action === "edge-text") startText(null, board.selectedEdge);
      if (action === "duplicate") duplicate();
      if (action === "delete") removeSelection();
      if (action === "reset-route")
        change((m) => {
          const edge = m.edges[board.selectedEdge];
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
        if (mode) change((m) => arrangeNodes(m, [...board.selection], mode));
        return;
      }
      if (e.target.matches(".rea-shape-type"))
        change(
          (m) =>
            (m.nodes.find((n) => n.id === board.selected).shape =
              e.target.value),
        );
      if (
        e.target.matches(".rea-edge-direction") &&
        board.selectedEdge !== null
      )
        change((m) => {
          const edge = m.edges[board.selectedEdge];
          if (e.target.value === "both") edge.bidirectional = true;
          else delete edge.bidirectional;
        });
      if (e.target.matches(".rea-edge-routing"))
        change((m) => {
          m.edges[board.selectedEdge].routing = e.target.value;
          delete m.edges[board.selectedEdge].waypoints;
        });
      if (e.target.matches(".rea-edge-font"))
        change(
          (m) =>
            (m.edges[board.selectedEdge].labelFontSize = Number(
              e.target.value,
            )),
        );
      if (e.target.matches(".rea-edge-width"))
        change((m) => {
          if (Number(e.target.value))
            m.edges[board.selectedEdge].labelWidth = Number(e.target.value);
          else delete m.edges[board.selectedEdge].labelWidth;
        });
    });
    function showPalette() {
      palette.replaceChildren();
      const isEdge = board.selectedEdge !== null,
        choices = isEdge
          ? Object.keys(CONNECTOR_COLORS).map((color) => [color, color])
          : SHAPE_COLORS;
      for (const [fill, stroke] of choices) {
        const b = doc.createElement("button");
        if (isEdge) applyConnectorColor(b, fill);
        else {
          b.style.background = fill;
          b.style.borderColor = stroke;
        }
        b.setAttribute(
          "aria-label",
          `${isEdge ? "Connection color" : "Color"} ${fill}`,
        );
        b.title = fill;
        palette.append(b);
        on(b, "click", () => {
          change((m) => {
            if (isEdge) m.edges[board.selectedEdge].color = fill;
            else
              for (const n of m.nodes)
                if (board.selection.has(n.id))
                  Object.assign(n, { fill, stroke });
          });
          palette.hidden = true;
        });
      }
      palette.hidden = false;
    }
  }
  return {
    syncSelection,
    highlight,
    placePorts,
    placeControls,
    selectionControls,
    selectNode,
    selectEdge,
    bindSelectionActions,
  };
}
