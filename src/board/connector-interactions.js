import { placeConnectedThought } from "../thought-placement.js";
import { connectorPath, insetEndpoints } from "../connector-projection.js";
import {
  magneticAttachment,
  connectorAlignment,
  attachmentGuides,
} from "../connector-guides.js";
import { routeConnection } from "../connector-geometry.js";
import { dragSegment, dragBend } from "../connector-routing.js";
import { nextId } from "../model.js";
export function createConnectorInteractions({
  board,
  $,
  doc,
  canvas,
  handles,
  context,
  on,
  preferences,
  snapped,
  finishText,
  hideMenus,
  selectNode,
  change,
  setTool,
  toLocal,
  toWorld,
  highlight,
  placeControls,
  selectionControls,
}) {
  function thoughtPosition(from, side, drop, event) {
    return placeConnectedThought(
      board.layout.nodes.get(from),
      board.layout.nodes.values(),
      side,
      preferences.snapping && !event?.altKey,
      drop,
    );
  }
  function child(side = "right", from = board.selected, box, edit = true) {
    if (
      !from ||
      !board.model ||
      !board.layout?.nodes.has(from) ||
      board.layout.nodes.get(from).shape === "text"
    )
      return;
    finishText();
    const parent = board.model.nodes.find((n) => n.id === from);
    const { x, y, width, height } = box || thoughtPosition(from, side);
    const id = nextId(board.model);
    change(
      (m) => {
        m.nodes.push({
          id,
          label: "A new thought",
          shape: "rect",
          fill: parent.fill,
          stroke: parent.stroke,
          size: { width, height },
          position: { x, y },
        });
        m.edges.push({
          from,
          to: id,
          label: "",
          routing: "auto",
          ...(side ? { fromSide: side } : {}),
          toRatio: 0,
        });
        board.selection = new Set([id]);
        board.selected = id;
        board.selectedEdge = null;
        board.hoveredNode = null;
      },
      { editAfter: edit ? id : null },
    );
  }
  function bindQuickAdd() {
    on(handles, "click", (e) => {
      const button = e.target.closest("[data-port],[data-quick-add]");
      const side = button?.dataset.port || button?.dataset.quickAdd;
      if (side && e.detail === 0 && !board.suppressClick) {
        $(".rea-preview").setAttribute("hidden", "");
        child(side, board.hoveredNode || board.selected);
      }
    });
    on(handles, "pointerover", (e) => {
      const button = e.target.closest("[data-port],[data-quick-add]");
      const from = board.hoveredNode || board.selected;
      if (!button || !from || board.drag || board.externalEditing) return;
      const side = button.dataset.port || button.dataset.quickAdd;
      showConnectionPreview(
        from,
        side,
        thoughtPosition(from, side),
        null,
        true,
      );
    });
    on(handles, "pointerout", (e) => {
      if (
        !board.drag &&
        !e.relatedTarget?.closest?.("[data-port],[data-quick-add]")
      )
        $(".rea-preview").setAttribute("hidden", "");
    });
  }
  function connect(from, to, fromSide, targetAttachment) {
    if (
      from === to ||
      [from, to].some((id) => board.layout.nodes.get(id)?.shape === "text")
    )
      return;
    change((m) => {
      if (!m.edges.some((e) => e.from === from && e.to === to))
        m.edges.push({
          from,
          to,
          label: "",
          routing: "auto",
          ...(fromSide ? { fromSide } : {}),
          ...(targetAttachment
            ? {
                ...(targetAttachment.center
                  ? {}
                  : { toSide: targetAttachment.side }),
                toRatio: targetAttachment.ratio,
              }
            : {}),
        });
    });
    setTool("select");
  }
  function hitNode(x, y, exclude) {
    const p = toWorld(x, y);
    for (const n of [...board.layout.nodes.values()].reverse()) {
      if (n.id === exclude || ["frame", "text"].includes(n.shape)) continue;
      const dx = Math.abs(p.x - n.x) / (n.width / 2 + 8 / board.zoom),
        dy = Math.abs(p.y - n.y) / (n.height / 2 + 8 / board.zoom);
      if (n.shape === "diamond" ? dx + dy <= 1.12 : dx <= 1 && dy <= 1)
        return n.id;
    }
    return null;
  }
  function startConnect(e, from, fromSide, quickAdd = false) {
    if (board.layout.nodes.get(from)?.shape === "text") return;
    finishText();
    hideMenus();
    selectNode(from);
    board.drag = {
      kind: "connect",
      from,
      fromSide,
      quickAdd,
      start: { x: e.clientX, y: e.clientY },
      moved: false,
      target: null,
    };
    canvas.setPointerCapture(e.pointerId);
    context.hidden = true;
    handles.hidden = true;
  }
  function bindConnectorHandles() {
    on(handles, "pointerdown", (e) => {
      if (e.button !== 0) return;
      const port = e.target.closest("[data-port],[data-quick-add]");
      const from = board.hoveredNode || board.selected;
      if (port && from && !board.externalEditing) {
        e.preventDefault();
        e.stopPropagation();
        startConnect(e, from, port.dataset.port || port.dataset.quickAdd, true);
      }
    });
    bindEdgeHandles();
  }
  function showConnectionPreview(from, side, target, hit, ghost) {
    const a = board.layout.nodes.get(from);
    const geo = routeConnection(
      a,
      target,
      {
        from,
        to: target.id,
        routing: "auto",
        fromSide: side,
        fromRatio: 0,
        toSide: hit?.center ? undefined : hit?.side,
        toRatio: hit?.ratio ?? 0,
      },
      board.layout.nodes.values(),
    );
    const preview = $(".rea-preview");
    preview.removeAttribute("hidden");
    $(".rea-preview-line").setAttribute(
      "d",
      connectorPath(
        insetEndpoints(geo.points).map(toLocal),
        [],
        9 * board.zoom,
      ),
    );
    const rect = $(".rea-thought-ghost");
    rect.toggleAttribute("hidden", !ghost);
    if (ghost) {
      const p = toLocal({
        x: target.x - target.width / 2,
        y: target.y - target.height / 2,
      });
      for (const [key, value] of Object.entries({
        x: p.x,
        y: p.y,
        width: target.width * board.zoom,
        height: target.height * board.zoom,
      }))
        rect.setAttribute(key, value);
    }
  }
  function previewConnection(e) {
    const pointed = hitNode(e.clientX, e.clientY);
    board.drag.target = pointed === board.drag.from ? null : pointed;
    if (pointed === board.drag.from) {
      board.drag.newThought = null;
      $(".rea-preview").setAttribute("hidden", "");
      drawGuides([]);
      highlight();
      return;
    }
    const a = board.layout.nodes.get(board.drag.from);
    const p = toWorld(e.clientX, e.clientY);
    const bounds = canvas.getBoundingClientRect();
    board.drag.newThought =
      !pointed &&
      e.clientX > bounds.left + 85 &&
      e.clientX < bounds.right - 10 &&
      e.clientY > bounds.top + 10 &&
      e.clientY < bounds.bottom - 60
        ? thoughtPosition(board.drag.from, board.drag.fromSide, p, e)
        : null;
    const target = board.drag.target
      ? board.layout.nodes.get(board.drag.target)
      : board.drag.newThought || { ...p, width: 0, height: 0, shape: "rect" };
    const hit = board.drag.target
      ? magneticAttachment(target, p, board.zoom, !e.altKey, a)
      : null;
    board.drag.targetAttachment = hit;
    drawGuides(hit ? attachmentGuides(target, hit) : []);
    showConnectionPreview(
      board.drag.from,
      board.drag.fromSide,
      target,
      hit,
      !!board.drag.newThought,
    );
    highlight();
  }
  function startEdgeDrag(e, kind, index = 0) {
    if (e.button !== 0 || board.selectedEdge === null || !board.layout) return;
    e.preventDefault();
    finishText();
    hideMenus();
    const link = board.layout.links[board.selectedEdge];
    board.drag = {
      kind: "edge",
      action: kind,
      index,
      edgeIndex: board.selectedEdge,
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
  function bindEdgeHandles() {
    on($(".rea-edge-controls"), "pointerdown", (e) => {
      const b = e.target.closest("[data-edge-control]");
      if (b)
        startEdgeDrag(e, b.dataset.edgeControl, Number(b.dataset.index) || 0);
    });
  }
  function connectorAnchors(exclude) {
    return [...board.layout.nodes.values()]
      .filter((n) => n.shape !== "frame")
      .flatMap((n) => [
        { x: n.x, y: n.y },
        { x: n.x - n.width / 2, y: n.y },
        { x: n.x + n.width / 2, y: n.y },
        { x: n.x, y: n.y - n.height / 2 },
        { x: n.x, y: n.y + n.height / 2 },
      ])
      .concat(
        board.layout.links.flatMap((l, i) =>
          i === exclude ? [] : l.geometry?.points || [],
        ),
      );
  }
  function moveEdge(e) {
    const d = board.drag,
      link = board.layout.links[d.edgeIndex],
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
          ? board.layout.nodes.get(d.target)
          : { ...p, width: 0, height: 0, shape: "rect" },
        attachment = magneticAttachment(
          n,
          toWorld(e.clientX, e.clientY),
          board.zoom,
          !e.altKey,
          board.layout.nodes.get(
            d.action === "from" ? d.original.to : d.original.from,
          ),
        ),
        prefix = d.action === "from" ? "from" : "to";
      drawGuides(d.target ? attachmentGuides(n, attachment) : []);
      if (attachment.center && !link.edge.waypoints?.length)
        delete link.edge[`${prefix}Side`];
      else link.edge[`${prefix}Side`] = attachment.side;
      link.edge[`${prefix}Ratio`] = attachment.ratio;
      if (prefix === "from") link.previewFrom = n;
      else link.previewTo = n;
    } else if (d.action === "label") {
      const aligned = connectorAlignment(
        toWorld(e.clientX, e.clientY),
        connectorAnchors(d.edgeIndex),
        board.zoom,
        !e.altKey,
      );
      for (const axis of ["x", "y"])
        if (aligned.guides.some((g) => g.axis === axis))
          p[axis] = aligned.point[axis];
      drawGuides(aligned.guides);
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
      const aligned = connectorAlignment(
        toWorld(e.clientX, e.clientY),
        connectorAnchors(d.edgeIndex),
        board.zoom,
        !e.altKey,
      );
      for (const axis of ["x", "y"])
        if (aligned.guides.some((g) => g.axis === axis))
          p[axis] = aligned.point[axis];
      drawGuides(aligned.guides);
      const points =
        d.action === "bend"
          ? dragBend(d.points, d.index, p)
          : dragSegment(d.points, d.index, p);
      link.edge.routing = "orthogonal";
      link.edge.waypoints = points.slice(1, -1);
    }
    board.layout.redraw();
    highlight();
    placeControls();
  }
  function endEdge(d, cancel) {
    const link = board.layout.links[d.edgeIndex];
    const next = structuredClone(link.edge);
    delete link.previewFrom;
    delete link.previewTo;
    link.edge = structuredClone(d.original);
    if (!cancel && d.moved) {
      if (d.action === "from" || d.action === "to") {
        if (d.target) next[d.action] = d.target;
        else {
          board.layout.redraw();
          selectionControls();
          return;
        }
      }
      change((m) => {
        m.edges[d.edgeIndex] = next;
      });
    } else board.layout.redraw();
    selectionControls();
  }

  function drawGuides(guides) {
    const svg = $(".rea-guides");
    svg.replaceChildren();
    for (const g of guides) {
      const a = toLocal(
          g.from ??
            (g.axis === "x"
              ? { x: g.value, y: g.start }
              : { x: g.start, y: g.value }),
        ),
        b = toLocal(
          g.to ??
            (g.axis === "x"
              ? { x: g.value, y: g.end }
              : { x: g.end, y: g.value }),
        ),
        line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
      for (const [k, v] of Object.entries({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      }))
        line.setAttribute(k, v);
      if (g.kind) line.classList.add("rea-connector-guide");
      svg.append(line);
      if (g.point) {
        const at = toLocal(g.point),
          dot = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", at.x);
        dot.setAttribute("cy", at.y);
        dot.setAttribute("r", 4);
        dot.classList.add("rea-connector-snap");
        svg.append(dot);
      }
    }
  }

  return {
    child,
    connect,
    hitNode,
    startConnect,
    previewConnection,
    startEdgeDrag,
    moveEdge,
    endEdge,
    drawGuides,
    bindQuickAdd,
    bindConnectorHandles,
  };
}
