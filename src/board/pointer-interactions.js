import { cardTypes } from "../content-card.js";
import {
  membersFor,
  frameOwners,
  updateFrameMembership,
} from "../domain/board-actions.js";
import { resizeBox } from "../domain/resize-box.js";
import { alignMove } from "../alignment.js";
export function createPointerInteractions({
  board,
  $,
  win,
  root,
  canvas,
  handles,
  transform,
  on,
  openLink,
  preferences,
  cardEditor,
  snapped,
  toWorld,
  finishText,
  hideMenus,
  nodeId,
  selectEdge,
  startEdgeDrag,
  showSource,
  add,
  startConnect,
  selectNode,
  hitNode,
  placePorts,
  moveEdge,
  previewConnection,
  drawGuides,
  view,
  syncSelection,
  highlight,
  placeControls,
  selectionControls,
  change,
  endEdge,
  connect,
  child,
  setTool,
}) {
  function startResize(e) {
    const corner = e.target.closest("[data-resize]")?.dataset.resize;
    if (e.button !== 0 || !corner || !board.selected) return;
    e.preventDefault();
    finishText();
    hideMenus();
    const n = board.layout.nodes.get(board.selected);
    board.drag = {
      kind: "resize",
      id: board.selected,
      corner,
      start: toWorld(e.clientX, e.clientY),
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      positions: board.layout.positions(),
      moved: false,
    };
    canvas.setPointerCapture(e.pointerId);
  }

  function bindPointerEvents() {
    bindPointerStart();
    bindPointerMovement();
    bindPointerEnd();
  }
  function bindPointerStart() {
    on(
      root,
      "pointerdown",
      (e) => {
        if (
          board.externalEditing ||
          cardEditor.active ||
          (e.button !== 0 && e.button !== 1)
        )
          return;
        if (e.button !== 1 && !board.spacePan && board.tool !== "hand") return;
        if (
          !e.target.closest(
            ".rea-canvas,.rea-context,.rea-handles,.rea-resizers,.rea-edge-controls",
          )
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        finishText();
        hideMenus();
        for (const animation of transform.getAnimations()) animation.cancel();
        board.drag = {
          kind: "pan",
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          px: board.pan.x,
          py: board.pan.y,
          moved: false,
        };
        canvas.setPointerCapture(e.pointerId);
      },
      { capture: true },
    );
    on(canvas, "pointerdown", (e) => {
      if (board.externalEditing || cardEditor.active || e.button !== 0) return;
      if (e.target.closest("[data-text-link]")) return;
      finishText();
      hideMenus();
      const node = e.target.closest(".node"),
        id = nodeId(node),
        edge = e.target.closest("[data-edge]");
      if ((e.ctrlKey || e.metaKey) && openLink) {
        const item = id
          ? board.model.nodes.find((n) => n.id === id)
          : edge
            ? board.model.edges[Number(edge.dataset.edge)]
            : null;
        if (item?.link) {
          openLink(item.link);
          return;
        }
      }
      if (
        edge &&
        e.target.closest(".rea-wire-label,.rea-edge-label-bg,.rea-math-label")
      ) {
        selectEdge(Number(edge.dataset.edge));
        startEdgeDrag(e, "label");
        return;
      }
      if (
        ["rect", "round", "diamond", "text", "line"].includes(board.tool) ||
        Object.hasOwn(cardTypes, board.tool)
      ) {
        if (!board.model) {
          showSource();
          return;
        }
        if (!board.layout) return;
        const point = toWorld(e.clientX, e.clientY);
        if (board.tool === "line") {
          board.drag = { kind: "line", start: snapped(point, e) };
          canvas.setPointerCapture(e.pointerId);
        } else {
          add(
            board.tool,
            point,
            board.model.nodes.find((n) => n.id === id && n.shape === "frame")
              ?.id,
          );
        }
        return;
      }
      if (id && board.layout) {
        if (board.tool === "connect") {
          startConnect(e, id);
          return;
        }
        if (e.shiftKey) {
          selectNode(id, true);
          return;
        }
        selectNode(id, false, true);
        board.drag = {
          kind: "node",
          id,
          ids: [
            ...membersFor(board.model, board.selection, board.layout.nodes),
          ],
          frameMembers: frameOwners(board.model, board.layout.nodes),
          start: toWorld(e.clientX, e.clientY),
          clientX: e.clientX,
          clientY: e.clientY,
          moved: false,
          positions: board.layout.positions(),
          edges: board.layout.links.map((l) => structuredClone(l.edge)),
        };
      } else if (!e.target.closest("[data-edge]")) {
        const base = e.shiftKey ? new Set(board.selection) : new Set();
        board.selection = base;
        board.selected = null;
        board.selectedEdge = null;
        selectionControls();
        board.drag = {
          kind: "marquee",
          x: e.clientX,
          y: e.clientY,
          base: new Set(base),
          moved: false,
        };
        canvas.setPointerCapture(e.pointerId);
      }
    });
  }
  function updatePointer(e) {
    if (!board.drag) {
      if (
        !board.layout ||
        board.externalEditing ||
        board.editing ||
        e.target.closest(".rea-handles")
      )
        return;
      const next =
        board.tool === "select" ? hitNode(e.clientX, e.clientY) : null;
      if (next !== board.hoveredNode) {
        board.hoveredNode = next;
        placePorts();
      }
      return;
    }
    if (board.drag.kind === "edge") {
      moveEdge(e);
      return;
    }
    if (board.drag.kind === "connect") {
      if (
        Math.hypot(
          e.clientX - board.drag.start.x,
          e.clientY - board.drag.start.y,
        ) > 4
      )
        board.drag.moved = true;
      if (board.drag.moved) previewConnection(e);
      return;
    }
    if (board.drag.kind === "line") {
      drawGuides([
        {
          from: board.drag.start,
          to: snapped(toWorld(e.clientX, e.clientY), e),
        },
      ]);
      return;
    }
    if (board.drag.kind === "pan") {
      if (
        !board.drag.moved &&
        Math.hypot(e.clientX - board.drag.x, e.clientY - board.drag.y) < 3
      )
        return;
      board.drag.moved = true;
      board.pan = {
        x: board.drag.px + e.clientX - board.drag.x,
        y: board.drag.py + e.clientY - board.drag.y,
      };
      view();
      canvas.classList.add("panning");
      return;
    }
    if (board.drag.kind === "marquee") {
      if (Math.hypot(e.clientX - board.drag.x, e.clientY - board.drag.y) < 3)
        return;
      board.drag.moved = true;
      const r = canvas.getBoundingClientRect(),
        left = Math.min(board.drag.x, e.clientX),
        top = Math.min(board.drag.y, e.clientY),
        right = Math.max(board.drag.x, e.clientX),
        bottom = Math.max(board.drag.y, e.clientY);
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
      board.selection = new Set(board.drag.base);
      for (const n of board.layout?.nodes.values() || [])
        if (
          n.x + n.width / 2 >= a.x &&
          n.x - n.width / 2 <= b.x &&
          n.y + n.height / 2 >= a.y &&
          n.y - n.height / 2 <= b.y
        )
          board.selection.add(n.id);
      syncSelection();
      highlight();
      placeControls();
      return;
    }
    if (board.drag.kind === "resize") {
      const p = toWorld(e.clientX, e.clientY),
        next = resizeBox(
          board.drag,
          board.drag.corner,
          { x: p.x - board.drag.start.x, y: p.y - board.drag.start.y },
          {
            snap: preferences.snapping && !e.altKey,
            others: e.altKey
              ? []
              : [...board.layout.nodes.values()].filter(
                  (n) => n.id !== board.drag.id && n.shape !== "frame",
                ),
            threshold: 6 / board.zoom,
          },
        );
      if (e.shiftKey && board.drag.corner.length === 2) {
        const factor = Math.max(
          next.width / board.drag.width,
          next.height / board.drag.height,
        );
        next.width = board.drag.width * factor;
        next.height = board.drag.height * factor;
        next.x =
          board.drag.x +
          ((next.width - board.drag.width) *
            (board.drag.corner.includes("e") ? 1 : -1)) /
            2;
        next.y =
          board.drag.y +
          ((next.height - board.drag.height) *
            (board.drag.corner.includes("s") ? 1 : -1)) /
            2;
      }
      board.drag.moved = true;
      const actual = board.layout.resize(board.drag.id, next);
      board.layout.move(board.drag.id, {
        x:
          next.x +
          ((actual.width - next.width) *
            (board.drag.corner.includes("w") ? -1 : 1)) /
            2,
        y:
          next.y +
          ((actual.height - next.height) *
            (board.drag.corner.includes("n") ? -1 : 1)) /
            2,
      });
      drawGuides(next.guides);
      board.layout.redraw();
      placeControls();
      return;
    }
    if (
      !board.drag.moved &&
      Math.hypot(
        e.clientX - board.drag.clientX,
        e.clientY - board.drag.clientY,
      ) < 3
    )
      return;
    board.drag.moved = true;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("rea-dragging");
    const p = toWorld(e.clientX, e.clientY),
      primary = board.drag.positions[board.drag.id],
      target = snapped(
        {
          x: primary.x + p.x - board.drag.start.x,
          y: primary.y + p.y - board.drag.start.y,
        },
        e,
      ),
      moving = board.layout.nodes.get(board.drag.id),
      aligned = e.altKey
        ? { x: 0, y: 0, guides: [] }
        : alignMove(
            { ...target, width: moving.width, height: moving.height },
            [...board.layout.nodes.values()].filter(
              (n) => !board.drag.ids.includes(n.id),
            ),
            6 / board.zoom,
          ),
      dx = target.x + aligned.x - primary.x,
      dy = target.y + aligned.y - primary.y;
    drawGuides(aligned.guides);
    for (const id of board.drag.ids) {
      const before = board.drag.positions[id];
      board.layout.move(id, { x: before.x + dx, y: before.y + dy });
    }
    for (let i = 0; i < board.layout.links.length; i++) {
      const original = board.drag.edges[i];
      if (
        board.drag.ids.includes(original.from) &&
        board.drag.ids.includes(original.to) &&
        original.waypoints
      )
        board.layout.links[i].edge.waypoints = original.waypoints.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
    }
    board.layout.redraw();
    placeControls();
  }
  let pointerFrame = 0,
    pendingPointer = null;
  function queuePointer(e) {
    pendingPointer = e;
    if (!pointerFrame)
      pointerFrame = win.requestAnimationFrame(() => {
        pointerFrame = 0;
        const latest = pendingPointer;
        pendingPointer = null;
        if (latest) updatePointer(latest);
      });
  }
  function bindPointerMovement() {
    on(canvas, "pointermove", queuePointer);
    on(
      win,
      "pointermove",
      (e) => {
        if (board.drag?.kind !== "pan" || e.pointerId !== board.drag.pointerId)
          return;
        e.stopPropagation();
        queuePointer(e);
      },
      { capture: true },
    );
    for (const type of ["pointerup", "pointercancel"]) {
      on(
        win,
        type,
        (e) => {
          if (
            board.drag?.kind === "pan" &&
            e.pointerId === board.drag.pointerId
          )
            endDrag(e, type === "pointercancel");
        },
        { capture: true },
      );
    }
  }
  function endDrag(e, cancel = false) {
    if (pendingPointer) {
      win.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      const latest = pendingPointer;
      pendingPointer = null;
      if (!cancel) updatePointer(latest);
    }
    if (!cancel && board.drag?.kind === "connect" && board.drag.moved)
      previewConnection(e);
    drawGuides([]);
    const done = board.drag;
    board.drag = null;
    canvas.classList.remove("panning", "rea-dragging");
    $(".rea-preview").setAttribute("hidden", "");
    $(".rea-marquee").hidden = true;
    highlight();
    if (!done) return;
    if (done.kind === "line") {
      if (cancel) return;
      const end = snapped(toWorld(e.clientX, e.clientY), e);
      const dx = end.x - done.start.x,
        dy = end.y - done.start.y;
      const direction =
        Math.abs(dy) < 20
          ? "horizontal"
          : Math.abs(dx) < 20
            ? "vertical"
            : dx * dy < 0
              ? "rising"
              : "falling";
      add(
        "line",
        { x: done.start.x + dx / 2, y: done.start.y + dy / 2 },
        null,
        {
          size: {
            width: Math.min(4000, Math.max(80, Math.abs(dx))),
            height: Math.min(4000, Math.max(48, Math.abs(dy))),
          },
          lineDirection: direction,
        },
      );
      return;
    }
    if (done.kind === "edge") {
      if (done.moved) {
        board.suppressClick = true;
        win.setTimeout(() => (board.suppressClick = false), 0);
      }
      endEdge(done, cancel);
      return;
    }
    if (done.kind === "marquee") {
      if (cancel) board.selection = done.base;
      syncSelection();
      selectionControls();
      return;
    }
    if (done.kind === "resize") {
      if (cancel) {
        board.layout.resize(done.id, {
          width: done.width,
          height: done.height,
        });
        board.layout.move(done.id, { x: done.x, y: done.y });
        board.layout.redraw();
      } else if (done.moved) {
        const n = board.layout.nodes.get(done.id),
          positions = board.layout.positions();
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
      board.suppressClick = true;
      win.setTimeout(() => (board.suppressClick = false), 0);
    }
    if (done.kind === "connect") {
      if (!cancel && done.moved) {
        if (done.target) {
          connect(done.from, done.target, done.fromSide, done.targetAttachment);
          board.selection = new Set([done.target]);
          board.selected = done.target;
        } else if (done.newThought) {
          child(done.fromSide || null, done.from, done.newThought, false);
          setTool("select");
        }
      } else if (!cancel && done.quickAdd) {
        child(done.fromSide, done.from);
      } else if (!cancel && board.tool === "connect") {
        if (board.keyboardConnect && board.keyboardConnect !== done.from) {
          connect(board.keyboardConnect, done.from);
          board.keyboardConnect = null;
        } else board.keyboardConnect = done.from;
      }
    } else if (done.kind === "node" && done.moved) {
      if (cancel) {
        for (const [id, p] of Object.entries(done.positions))
          board.layout.move(id, p);
        done.edges?.forEach(
          (edge, i) => (board.layout.links[i].edge = structuredClone(edge)),
        );
        board.layout.redraw();
      } else {
        const positions = board.layout.positions(),
          edges = board.layout.links.map((l) => structuredClone(l.edge));
        change((m) => {
          for (const n of m.nodes)
            if (positions[n.id]) n.position = positions[n.id];
          const moving = new Set(done.ids);
          const roots = done.ids.filter(
            (id) => !moving.has(done.frameMembers.get(id)?.id),
          );
          for (const id of done.ids) {
            const owner = done.frameMembers.get(id);
            if (!owner || !moving.has(owner.id)) continue;
            const frame = m.nodes.find((n) => n.id === owner.id);
            if (!frame.members.includes(id)) frame.members.push(id);
          }
          updateFrameMembership(m, roots);
          m.edges = edges;
        });
      }
    }
    placeControls();
    highlight();
  }
  function bindPointerEnd() {
    on(canvas, "pointerleave", (e) => {
      if (e.relatedTarget && handles.contains(e.relatedTarget)) return;
      board.hoveredNode = null;
      if (!board.drag) {
        $(".rea-preview").setAttribute("hidden", "");
        placePorts();
      }
    });
    on(canvas, "pointerup", (e) => {
      if (board.drag) endDrag(e);
    });
    on(canvas, "pointercancel", (e) => {
      if (board.drag) endDrag(e, true);
    });
    on(canvas, "lostpointercapture", (e) => {
      if (board.drag && board.drag.kind !== "pan") endDrag(e, true);
    });
  }
  function bindPointerBlur() {
    on(win, "blur", (e) => {
      board.spacePan = false;
      if (board.drag?.kind === "pan") endDrag(e, true);
    });
  }
  function cancelPointerFrame() {
    win.cancelAnimationFrame(pointerFrame);
  }
  return {
    startResize,
    bindPointerEvents,
    bindPointerBlur,
    endDrag,
    cancelPointerFrame,
  };
}
