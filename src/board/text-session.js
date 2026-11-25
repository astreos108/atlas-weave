import { createTextEditor } from "../text-editor.js";
export function createTextSession({
  board,
  doc,
  win,
  root,
  canvas,
  diagram,
  signal,
  preferences,
  cardEditor,
  hideMenus,
  toLocal,
  resolveBoardLinkTitle,
  suggestBoardLinks,
  openBoardLink,
  selectionControls,
  view,
  change,
  placeControls,
}) {
  function startText(id = null, edgeIndex = null) {
    finishText();
    hideMenus();
    const n = id && board.layout?.nodes.get(id),
      edge = edgeIndex !== null && board.model?.edges[edgeIndex];
    if (!n && !edge) return;
    if (n?.card) return cardEditor.editCard(n);
    let p, width;
    if (n) {
      board.selection = new Set([id]);
      board.selected = id;
      board.selectedEdge = null;
      p = toLocal(n);
      width = Math.max(100, n.width * board.zoom - 26);
    } else {
      board.selection.clear();
      board.selected = null;
      board.selectedEdge = edgeIndex;
      const a = board.layout.nodes.get(edge.from),
        b = board.layout.nodes.get(edge.to);
      p = toLocal(
        board.layout.links[edgeIndex]?.geometry?.label || {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        },
      );
      width = (edge.labelWidth || 180) * board.zoom;
    }
    const foreign = doc.createElementNS(
      "http://www.w3.org/2000/svg",
      "foreignObject",
    );
    foreign.classList.add("rea-live-foreign");
    const host = doc.createElement("div");
    host.className = "rea-live-host";
    if (n?.shape === "frame") host.classList.add("rea-live-frame-title");
    if (n?.shape === "text") host.classList.add("rea-live-annotation");
    foreign.append(host);
    const worldWidth = n
      ? n.shape === "frame"
        ? Math.min(n.width - 36, Math.max(180, n.label.length * 9))
        : n.width -
          (n.shape === "text" ? 0 : n.shape === "diamond" ? n.width * 0.55 : 32)
      : edge.labelWidth || 180;
    const worldHeight = n
      ? n.shape === "frame"
        ? Math.min(80, n.height - 20)
        : n.height - (n.shape === "text" ? 0 : 28)
      : Math.max(60, (edge.labelFontSize || 13) * 4);
    foreign.setAttribute(
      "x",
      n
        ? -n.width / 2 +
            (n.shape === "frame"
              ? 18
              : n.shape === "diamond"
                ? n.width * 0.275
                : n.shape === "text"
                  ? 0
                  : 16)
        : board.layout.links[edgeIndex].geometry.label.x - worldWidth / 2,
    );
    foreign.setAttribute(
      "y",
      n
        ? n.shape === "frame"
          ? -n.height / 2 + 10
          : -n.height / 2 + (n.shape === "text" ? 0 : 14)
        : board.layout.links[edgeIndex].geometry.label.y - worldHeight / 2,
    );
    foreign.setAttribute("width", worldWidth);
    foreign.setAttribute("height", worldHeight);
    (n ? n.el : diagram.querySelector("svg")).append(foreign);
    if (!n) {
      board.layout.links[edgeIndex].label?.setAttribute("visibility", "hidden");
      board.layout.links[edgeIndex].mathEl?.setAttribute(
        "visibility",
        "hidden",
      );
    }
    const originalFontSize = n ? n.textSize || 16 : edge.labelFontSize || 13;
    let fontSize = originalFontSize;
    const originalSize = n
      ? { width: n.width, height: n.height, x: n.x, y: n.y }
      : null;
    let explicitResize = false;
    const resizeEditor = (size) => {
      board.layout.resize(n.id, size);
      board.layout.move(n.id, {
        x:
          n.shape === "text"
            ? originalSize.x + (n.width - originalSize.width) / 2
            : n.x,
        y: originalSize.y + (n.height - originalSize.height) / 2,
      });
      board.layout.redraw();
      const inset =
        n.shape === "text" ? 0 : n.shape === "diamond" ? n.width * 0.55 : 32;
      foreign.setAttribute("x", -n.width / 2 + inset / 2);
      foreign.setAttribute("y", -n.height / 2 + (n.shape === "text" ? 0 : 14));
      foreign.setAttribute("width", n.width - inset);
      foreign.setAttribute("height", n.height - (n.shape === "text" ? 0 : 28));
      wrapper.style.width = `${n.width * board.zoom}px`;
      wrapper.style.height = `${n.height * board.zoom}px`;
      wrapper.style.top = `${toLocal(n).y}px`;
      if (n.shape === "text") wrapper.style.left = `${toLocal(n).x}px`;
    };
    const editor = createTextEditor({
      doc,
      root,
      signal: signal,
      value: n ? n.label : edge.label,
      label: n ? "Shape text" : "Connection text",
      fontSize,
      surfaceHost: host,
      resolveTitle: resolveBoardLinkTitle,
      suggestLinks: suggestBoardLinks,
      onOpenLink: (link, internal) =>
        internal
          ? openBoardLink(link)
          : win.open(link, "_blank", "noopener,noreferrer"),
      onExpand: () => {
        if (!n || n.card || n.shape === "frame") return;
        explicitResize = true;
        resizeEditor(board.layout.fitText(n.id));
      },
      onDraft: (value, surface, size) => {
        fontSize = size;
        if (!n) {
          const height = Math.max(worldHeight, Math.ceil(size * 1.4) * 2);
          foreign.setAttribute("height", height);
          foreign.setAttribute(
            "y",
            board.layout.links[edgeIndex].geometry.label.y - height / 2,
          );
          return;
        }
        n.textSize = size;
        n.label = value;
        if (n.shape === "text") {
          resizeEditor({ width: n.width, height: n.height });
          return;
        }
        const limit = Math.max(
          originalSize.height,
          (canvas.clientHeight - 130) / board.zoom,
        );
        const height = Math.min(limit, surface.scrollHeight + 28);
        if (n.shape !== "frame" && height > n.height + 2) {
          resizeEditor({ width: n.width, height });
        } else {
          board.layout.resize(n.id, { width: n.width, height: n.height });
        }
      },
      alignment: n?.textAlign || (n?.shape === "text" ? "left" : "center"),
      alignments: n?.textAlignments || [],
      outlineStyle: n?.outlineStyle,
      getPreferences: () => preferences.textPreferences,
      onCommit: () => {
        finishText();
        canvas.focus();
      },
      onCancel: () => {
        finishText(true);
        canvas.focus();
      },
    });
    const { input, wrapper } = editor;
    const editorWidth = Math.min(width, canvas.clientWidth - 32),
      height = n
        ? n.shape === "frame"
          ? 52
          : n.height * board.zoom - 4
        : Math.max(70, (edge.labelFontSize || 13) * board.zoom * 4);
    wrapper.style.width = `${editorWidth}px`;
    wrapper.style.height = `${Math.min(canvas.clientHeight - 130, Math.max(40, height))}px`;
    wrapper.style.left = `${Math.max(16 + editorWidth / 2, Math.min(canvas.clientWidth - 16 - editorWidth / 2, p.x))}px`;
    wrapper.style.top = `${Math.max(80 + height / 2, Math.min(canvas.clientHeight - 40 - height / 2, n?.shape === "frame" ? toLocal({ x: n.x, y: n.y - n.height / 2 }).y + 30 : p.y))}px`;
    if (n?.shape === "text") {
      wrapper.style.width = `${n.width * board.zoom}px`;
      wrapper.style.height = `${n.height * board.zoom}px`;
      wrapper.style.left = `${p.x}px`;
      wrapper.style.top = `${p.y}px`;
    }
    if (n) input.classList.add("rea-node-editor");
    else input.classList.add("rea-connector-editor");
    if (n?.shape === "frame") {
      const at = toLocal({
        x: n.x - n.width / 2 + 18 + worldWidth / 2,
        y: n.y - n.height / 2 + 10 + worldHeight / 2,
      });
      wrapper.style.width = `${worldWidth * board.zoom}px`;
      wrapper.style.height = `${worldHeight * board.zoom}px`;
      wrapper.style.left = `${at.x}px`;
      wrapper.style.top = `${at.y}px`;
    }
    board.editing = {
      input,
      editor,
      id,
      edgeIndex,
      foreign,
      originalSize,
      didExplicitResize: () => explicitResize,
      getFontSize: () => fontSize,
      originalFontSize,
      original: input.value,
      originalOutlineStyle: n?.outlineStyle,
      originalAlignments: JSON.stringify(n?.textAlignments || []),
    };
    if (n) n.el.classList.add("rea-editing");
    selectionControls();
    input.focus();
    input.select();
    editor.update();
  }
  function getEditorSession() {
    return board.editing
      ? {
          id: board.editing.id,
          edgeIndex: board.editing.edgeIndex,
          value: board.editing.input.value,
          start: board.editing.input.selectionStart,
          end: board.editing.input.selectionEnd,
          alignments: board.editing.editor.getAlignments(),
          outlineStyle: board.editing.editor.getOutlineStyle(),
          fontSize: board.editing.getFontSize(),
          viewport: { zoom: board.zoom, pan: { ...board.pan } },
        }
      : null;
  }
  function restoreEditorSession(session) {
    if (!session) return;
    if (
      Number.isFinite(session.viewport?.zoom) &&
      Number.isFinite(session.viewport?.pan?.x) &&
      Number.isFinite(session.viewport?.pan?.y)
    ) {
      board.zoom = Math.max(0.05, Math.min(3, session.viewport.zoom));
      board.pan = { ...session.viewport.pan };
      view();
    }
    startText(session.id, session.edgeIndex);
    if (board.editing) {
      board.editing.input.value = session.value;
      board.editing.editor.setOutlineStyle(session.outlineStyle);
      if (session.fontSize) board.editing.editor.setFontSize(session.fontSize);
      board.editing.input.setSelectionRange(session.start, session.end);
      board.editing.editor.update();
    }
  }
  function finishText(cancel = false) {
    if (!board.editing) return;
    const current = board.editing,
      alignments = current.editor.getAlignments();
    const commit =
      !cancel &&
      (current.input.value !== current.original ||
        JSON.stringify(alignments) !== current.originalAlignments ||
        current.editor.getOutlineStyle() !== current.originalOutlineStyle ||
        current.getFontSize() !== current.originalFontSize ||
        current.didExplicitResize());
    board.editing = null;
    current.editor.remove();
    current.foreign.remove();
    if (current.id) {
      const n = board.layout.nodes.get(current.id),
        saved = board.model.nodes.find((n) => n.id === current.id);
      if (n && saved) {
        n.label =
          commit && n.shape === "text" ? current.input.value : saved.label;
        n.textSize =
          commit && n.shape === "text" ? current.getFontSize() : saved.textSize;
        board.layout.resize(
          n.id,
          commit ? { width: n.width, height: n.height } : current.originalSize,
        );
        if (
          !commit &&
          (n.y !== current.originalSize.y || n.x !== current.originalSize.x)
        ) {
          board.layout.move(n.id, {
            x: current.originalSize.x,
            y: current.originalSize.y,
          });
          board.layout.redraw();
        }
      }
    } else {
      board.layout.links[current.edgeIndex]?.label?.removeAttribute(
        "visibility",
      );
      board.layout.links[current.edgeIndex]?.mathEl?.removeAttribute(
        "visibility",
      );
    }
    diagram
      .querySelectorAll(".rea-editing")
      .forEach((el) => el.classList.remove("rea-editing"));
    if (commit) {
      const value = current.input.value;
      change((m) => {
        if (current.id) {
          const n = m.nodes.find((n) => n.id === current.id);
          if (n) {
            n.label = value || "Untitled";
            n.textAlignments = alignments;
            const outlineStyle = current.editor.getOutlineStyle();
            if (outlineStyle) n.outlineStyle = outlineStyle;
            else delete n.outlineStyle;
            if (current.getFontSize() !== current.originalFontSize)
              n.textSize = current.getFontSize();
          }
        } else if (m.edges[current.edgeIndex]) {
          m.edges[current.edgeIndex].label = value;
          if (current.getFontSize() !== current.originalFontSize)
            m.edges[current.edgeIndex].labelFontSize = current.getFontSize();
        }
      });
    }
    placeControls();
  }
  function fitText(id) {
    finishText();
    const n = board.layout?.nodes.get(id);
    if (!n || n.card || n.shape === "frame") return;
    const size = board.layout.fitText(id);
    change((m) => {
      const node = m.nodes.find((n) => n.id === id);
      node.size = size;
      if (node.shape === "text") node.textWrap = false;
    });
  }

  return {
    startText,
    finishText,
    getEditorSession,
    restoreEditorSession,
    fitText,
  };
}
