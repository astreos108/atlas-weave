import { createPointerInteractions } from "./board/pointer-interactions.js";
import { createConnectorInteractions } from "./board/connector-interactions.js";
import { createSelectionControls } from "./board/selection-controls.js";
import { createViewport } from "./board/viewport.js";
import { createTextSession } from "./board/text-session.js";
import { createBoardPreferences } from "./board/preferences.js";
import { createClipboardController } from "./board/clipboard-controller.js";
import { createSourceDialog } from "./board/source-dialog.js";
import { createCardEditor } from "./board/card-editor.js";
import { cardNode, cardTypes } from "./content-card.js";
import { duplicateOffset } from "./thought-placement.js";
import { DEFAULT_BOARD_PAPER, DEFAULT_THOUGHT_COLOR } from "./appearance.js";
import { setMarkup } from "./markup.js";
import {
  membersFor,
  frameOwners,
  updateFrameMembership,
  createFrame,
  removeNodes,
} from "./domain/board-actions.js";
import { createSaveQueue } from "./workflows/save-queue.js";
import mermaid from "./mermaid-renderer.js";
import { createLayout } from "./layout.js";
import { INITIAL, parse, serialize, nextId } from "./model.js";

import { button } from "./icons.js";
let instance = 0;
export function mount(root, options) {
  const doc = root.ownerDocument,
    win = doc.defaultView;
  root.classList.add("rea");
  const uid = ++instance,
    abort = new AbortController();
  let presenting = false,
    presentIndex = 0,
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
    hoveredNode = null,
    editing = null,
    draft = null,
    title = options.title || "Untitled board",
    suppressClick = false,
    keyboardConnect = null;
  setMarkup(
    root,
    `<main class="rea-workspace"><div class="rea-canvas" tabindex="0" aria-label="Board. Drag shapes to move. Double-click to edit text."><div class="rea-transform"><div class="rea-diagram"></div></div><div class="rea-empty" hidden>A little room to think.<small>Add a shape to get started.</small></div></div>
    <button class="rea-title" aria-label="Rename board" title="Rename board"></button><button class="rea-recover" data-action="fit" hidden>Zoom to content</button><svg class="rea-guides"></svg><div class="rea-paste-menu rea-popover" hidden role="menu"></div><nav class="rea-toolbar" aria-label="Board tools">${button("select", "Select (V)", 'data-tool="select"')}${button("hand", "Pan (H or Space)", 'data-tool="hand"')}<i></i> ${button("rect", "Shapes", 'data-action="shapes" aria-expanded="false"')}${button("text", "Place text (T)", 'data-tool="text"')}${button("line", "Draw line (L)", 'data-tool="line"')}<div class="rea-shape-menu rea-popover" aria-label="Shape choices" hidden>${button("rect", "Add rectangle (R)", 'data-tool="rect"')}${button("round", "Add pill (O)", 'data-tool="round"')}${button("diamond", "Add decision (D)", 'data-tool="diamond"')}${button("table", "Add table", 'data-tool="table"')}${button("source", "Add code block", 'data-tool="code"')}${button("latex", "Add LaTeX block", 'data-tool="latex"')}</div>${button("connect", "Connect shapes (C)", 'data-tool="connect"')}<i></i>${button("more", "More board options", 'data-action="more" aria-expanded="false"')}</nav>
    <div class="rea-more rea-popover" hidden role="menu" aria-label="Board options"><div class="rea-board-name"></div><div class="rea-menu-actions">${button("board", "New board", 'data-action="new"')}${button("import", "Import file", 'data-action="import"')}${button("source", "Mermaid source", 'data-action="source"')}${button("arrange", "Auto layout", 'data-action="arrange"')}${button("frame", "Frame selection", 'data-action="frame"')}${button("export", "Export Markdown", 'data-action="export"')}${button("image", "Copy as PNG (⌘⇧C)", 'data-action="copy-png"')}${button("vector", "Copy as SVG", 'data-action="copy-svg"')}${button("grid", "Snap to grid", 'data-action="snap"')}${button("dots", "Show grid dots", 'data-action="grid"')}${button("present", "Present board", 'data-action="present"')}${button("support", "Support development on Ko-fi", 'data-action="support"')}</div><div class="rea-background-controls" role="group" aria-label="Board background"><button data-background="ivory" aria-label="Ivory background" title="Ivory background"><span class="rea-background-swatch rea-bg-ivory"></span></button><button data-background="ice" aria-label="Ice background" title="Ice background"><span class="rea-background-swatch rea-bg-ice"></span></button><button data-background="sage" aria-label="Sage background" title="Sage background"><span class="rea-background-swatch rea-bg-sage"></span></button><input class="rea-background-hex" aria-label="Background hex color" title="Background hex color" placeholder="${DEFAULT_BOARD_PAPER}" maxlength="7" spellcheck="false"></div><div class="rea-text-preferences"><button data-action="counter" aria-label="Character counter" title="Character counter" aria-pressed="false">Aa</button><input type="number" class="rea-character-target" aria-label="Character target" title="Soft character target" min="1" max="10000" value="280"></div><div class="rea-theme-controls">${button("sun", "Light mode", 'data-action="light"')}${button("moon", "Dark mode", 'data-action="dark"')}</div></div>
    <div class="rea-context rea-popover" hidden role="toolbar" aria-label="Selection options"></div><div class="rea-palette rea-popover" hidden aria-label="Shape colors"></div><div class="rea-handles" hidden></div><div class="rea-resizers" hidden></div><div class="rea-edge-controls" hidden></div><div class="rea-selection-bounds" hidden></div><div class="rea-marquee" hidden></div>
    <svg class="rea-preview" hidden><defs><marker id="rea-preview-${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10" class="rea-preview-arrow"/></marker></defs><rect class="rea-thought-ghost" rx="9" hidden/><path class="rea-preview-line" marker-end="url(#rea-preview-${uid})"/></svg>
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
  const preferences = createBoardPreferences({
    root,
    $,
    signal: abort.signal,
    options,
    refreshView() {
      if (layout) view();
    },
    refreshEditor() {
      editing?.editor.update();
    },
    status,
  });
  const { setTheme, setAppearance, setTextPreferences, setSnap, snapped } =
    preferences;
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
  const {
    toWorld,
    toLocal,
    view,
    fit,
    focusIdea,
    present,
    exitPresent,
    scale,
    bindWheel,
  } = createViewport({
    board: {
      get selection() {
        return selection;
      },
      set selection(value) {
        selection = value;
      },
      get selected() {
        return selected;
      },
      set selected(value) {
        selected = value;
      },
      get selectedEdge() {
        return selectedEdge;
      },
      set selectedEdge(value) {
        selectedEdge = value;
      },
      get zoom() {
        return zoom;
      },
      set zoom(value) {
        zoom = value;
      },
      get pan() {
        return pan;
      },
      set pan(value) {
        pan = value;
      },
      get presenting() {
        return presenting;
      },
      set presenting(value) {
        presenting = value;
      },
      get presentIndex() {
        return presentIndex;
      },
      set presentIndex(value) {
        presentIndex = value;
      },
      get layout() {
        return layout;
      },
      get model() {
        return model;
      },
      get drag() {
        return drag;
      },
    },
    $,
    root,
    canvas,
    diagram,
    transform,
    on,
    finishText: () => finishText(),
    placeControls: () => placeControls(),
    positionCardEditor: () => cardEditor.position(),
    highlight: () => highlight(),
    hideMenus,
    selectionControls: () => selectionControls(),
  });
  function hideMenus() {
    $(".rea-paste-menu").hidden = true;
    more.hidden = true;
    $(".rea-shape-menu").hidden = true;
    $("[data-action=shapes]").setAttribute("aria-expanded", "false");
    palette.hidden = true;
    $("[data-action=more]").setAttribute("aria-expanded", "false");
  }
  const {
    syncSelection,
    highlight,
    placePorts,
    placeControls,
    selectionControls,
    selectNode,
    selectEdge,
    bindSelectionActions,
  } = createSelectionControls({
    board: {
      get selection() {
        return selection;
      },
      set selection(value) {
        selection = value;
      },
      get selected() {
        return selected;
      },
      set selected(value) {
        selected = value;
      },
      get selectedEdge() {
        return selectedEdge;
      },
      set selectedEdge(value) {
        selectedEdge = value;
      },
      get layout() {
        return layout;
      },
      get model() {
        return model;
      },
      get drag() {
        return drag;
      },
      get keyboardConnect() {
        return keyboardConnect;
      },
      get hoveredNode() {
        return hoveredNode;
      },
      get editing() {
        return editing;
      },
      get presenting() {
        return presenting;
      },
      get tool() {
        return tool;
      },
      get zoom() {
        return zoom;
      },
      get pan() {
        return pan;
      },
    },
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
    isCardEditing: () => cardEditor.active,
    startText: (...args) => startText(...args),
    change,
    frameSelection,
    duplicate,
    removeSelection,
  });
  on(handles, "dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selected) fitText(selected);
  });
  on($(".rea-resizers"), "dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selected) fitText(selected);
  });
  on($(".rea-resizers"), "pointerdown", (e) => startResize(e));
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
        layout = createLayout(existing, model, nodeId, {
          resolveLinkTitle: resolveBoardLinkTitle,
          renderMath: options.renderMath,
        });
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
      layout = model
        ? createLayout(svg, model, nodeId, {
            resolveLinkTitle: resolveBoardLinkTitle,
            renderMath: options.renderMath,
          })
        : null;
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
    hoveredNode = null;
    $(".rea-preview").setAttribute("hidden", "");
    tool = next;
    keyboardConnect = null;
    root.querySelectorAll("[data-tool]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === tool);
      b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
    });
    canvas.classList.toggle("rea-connect-tool", next === "connect");
    canvas.classList.toggle("rea-hand-tool", next === "hand");
    placePorts();
    highlight();
  }
  function add(shape, position, frameId, line) {
    finishText();
    hideMenus();
    const id = model ? nextId(model) : null;
    change(
      (m) => {
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
        const card = Object.hasOwn(cardTypes, shape)
          ? structuredClone(cardTypes[shape])
          : null;
        m.nodes.push(
          card
            ? { id, ...cardNode(card), position: snapped(p) }
            : {
                id,
                label:
                  shape === "line"
                    ? ""
                    : shape === "text"
                      ? "Text"
                      : shape === "diamond"
                        ? "A decision"
                        : "A new thought",
                ...line,
                shape,
                ...DEFAULT_THOUGHT_COLOR,
                position: line ? p : snapped(p),
              },
        );
        if (frameId) m.nodes.find((n) => n.id === frameId)?.members.push(id);
        else updateFrameMembership(m, [id]);
        selected = id;
        selection = new Set([id]);
        selectedEdge = null;
      },
      {
        editAfter:
          shape === "text" || Object.hasOwn(cardTypes, shape) ? id : null,
      },
    );
    setTool("select");
  }
  const {
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
  } = createConnectorInteractions({
    board: {
      get selection() {
        return selection;
      },
      set selection(value) {
        selection = value;
      },
      get selected() {
        return selected;
      },
      set selected(value) {
        selected = value;
      },
      get selectedEdge() {
        return selectedEdge;
      },
      set selectedEdge(value) {
        selectedEdge = value;
      },
      get hoveredNode() {
        return hoveredNode;
      },
      set hoveredNode(value) {
        hoveredNode = value;
      },
      get layout() {
        return layout;
      },
      get model() {
        return model;
      },
      get drag() {
        return drag;
      },
      set drag(value) {
        drag = value;
      },
      get zoom() {
        return zoom;
      },
      get suppressClick() {
        return suppressClick;
      },
      get externalEditing() {
        return externalEditing;
      },
    },
    $,
    doc,
    canvas,
    handles,
    context,
    on,
    preferences,
    snapped,
    finishText: () => finishText(),
    hideMenus,
    selectNode,
    change,
    setTool,
    toLocal,
    toWorld,
    highlight,
    placeControls,
    selectionControls,
  });
  bindQuickAdd();
  function resolveBoardLinkTitle(target) {
    if (target.startsWith("@shape:"))
      return model?.nodes
        .find((n) => n.id === target.slice("@shape:".length))
        ?.label.split("\n")[0];
    return options.resolveLinkTitle?.(target);
  }
  function openBoardLink(target) {
    if (target.startsWith("@shape:")) {
      const id = target.slice("@shape:".length);
      if (!layout?.nodes.has(id))
        return status("The linked shape is unavailable.", true);
      finishText();
      focusIdea(id);
      return;
    }
    options.openLink?.(target);
  }
  function suggestBoardLinks(query) {
    if (!query.startsWith("@")) return options.suggestLinks?.(query) || [];
    const needle = query.slice(1).toLowerCase().trim();
    return model.nodes
      .filter(
        (n) =>
          n.id !== selected &&
          (n.label + " " + n.id).toLowerCase().includes(needle),
      )
      .slice(0, 12)
      .map((n) => ({
        label: n.label.split("\n")[0] || n.id,
        detail: "Shape on this board",
        target: "@shape:" + n.id,
      }));
  }
  function duplicate() {
    if (!selection.size) return;
    change((m) => {
      const originals = membersFor(m, selection);
      const nodes = m.nodes.filter((n) => originals.has(n.id));
      const owners = frameOwners(m);
      const frameMembers = new Map(
        nodes
          .filter((n) => n.members)
          .map((n) => [
            n.id,
            nodes
              .filter((child) => owners.get(child.id) === n)
              .map((child) => child.id),
          ]),
      );
      const { x: dx, y: dy } = duplicateOffset(
        nodes,
        m.nodes,
        preferences.snapping,
      );
      const map = new Map();
      for (const n of [...m.nodes])
        if (originals.has(n.id)) {
          const id = nextId(m);
          map.set(n.id, id);
          m.nodes.push({
            ...n,
            id,
            position: { x: n.position.x + dx, y: n.position.y + dy },
            ...(n.shape === "frame" ? { members: frameMembers.get(n.id) } : {}),
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
                    x: p.x + dx,
                    y: p.y + dy,
                  })),
                }
              : {}),
          })),
      );
      updateFrameMembership(
        m,
        [...selection]
          .filter((id) => !originals.has(owners.get(id)?.id))
          .map((id) => map.get(id)),
      );
      selection = new Set([...selection].map((id) => map.get(id)));
      selected = selection.size === 1 ? [...selection][0] : null;
    });
  }
  function removeSelection() {
    if (selection.size) {
      const ids = new Set(selection);
      change((m) => {
        removeNodes(m, ids, { deleteFrameContents: true });
      });
    } else if (selectedEdge !== null)
      change((m) => m.edges.splice(selectedEdge, 1));
    selection.clear();
    selected = null;
    selectedEdge = null;
    selectionControls();
  }
  const cardEditor = createCardEditor({
    doc,
    win,
    root,
    canvas,
    signal: abort.signal,
    renderMath: options.renderMath,
    getZoom: () => zoom,
    toLocal,
    selectCard(id) {
      selection = new Set([id]);
      selectedEdge = null;
      syncSelection();
    },
    selectionControls,
    status,
    change,
  });
  const {
    startText,
    finishText,
    getEditorSession,
    restoreEditorSession,
    fitText,
  } = createTextSession({
    board: {
      get editing() {
        return editing;
      },
      set editing(value) {
        editing = value;
      },
      get selection() {
        return selection;
      },
      set selection(value) {
        selection = value;
      },
      get selected() {
        return selected;
      },
      set selected(value) {
        selected = value;
      },
      get selectedEdge() {
        return selectedEdge;
      },
      set selectedEdge(value) {
        selectedEdge = value;
      },
      get zoom() {
        return zoom;
      },
      set zoom(value) {
        zoom = value;
      },
      get pan() {
        return pan;
      },
      set pan(value) {
        pan = value;
      },
      get layout() {
        return layout;
      },
      get model() {
        return model;
      },
    },
    doc,
    win,
    root,
    canvas,
    diagram,
    signal: abort.signal,
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
  });
  bindConnectorHandles();
  const {
    startResize,
    bindPointerEvents,
    bindPointerBlur,
    endDrag,
    cancelPointerFrame,
  } = createPointerInteractions({
    board: {
      get drag() {
        return drag;
      },
      set drag(value) {
        drag = value;
      },
      get hoveredNode() {
        return hoveredNode;
      },
      set hoveredNode(value) {
        hoveredNode = value;
      },
      get pan() {
        return pan;
      },
      set pan(value) {
        pan = value;
      },
      get selection() {
        return selection;
      },
      set selection(value) {
        selection = value;
      },
      get selected() {
        return selected;
      },
      set selected(value) {
        selected = value;
      },
      get selectedEdge() {
        return selectedEdge;
      },
      set selectedEdge(value) {
        selectedEdge = value;
      },
      get suppressClick() {
        return suppressClick;
      },
      set suppressClick(value) {
        suppressClick = value;
      },
      get keyboardConnect() {
        return keyboardConnect;
      },
      set keyboardConnect(value) {
        keyboardConnect = value;
      },
      get spacePan() {
        return spacePan;
      },
      set spacePan(value) {
        spacePan = value;
      },
      get externalEditing() {
        return externalEditing;
      },
      get tool() {
        return tool;
      },
      get editing() {
        return editing;
      },
      get layout() {
        return layout;
      },
      get model() {
        return model;
      },
      get zoom() {
        return zoom;
      },
    },
    $,
    win,
    root,
    canvas,
    handles,
    transform,
    on,
    openLink: options.openLink?.bind(options),
    preferences,
    cardEditor,
    snapped,
    toWorld,
    finishText,
    hideMenus,
    nodeId,
    selectEdge,
    startEdgeDrag,
    showSource: () => showSource(),
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
  });
  bindPointerEvents();
  on(diagram, "click", (e) => {
    if (suppressClick || tool === "hand" || spacePan) return;
    const link = e.target.closest("[data-text-link]");
    if (link) {
      e.preventDefault();
      if (link.dataset.internal === "true")
        openBoardLink(link.dataset.textLink);
      else win.open(link.dataset.textLink, "_blank", "noopener,noreferrer");
      return;
    }
    const edge = e.target.closest("[data-edge]");
    if (edge) selectEdge(Number(edge.dataset.edge));
  });
  function selectedBorderAt(e) {
    const n = layout?.nodes.get(selected);
    if (!n || n.card || n.shape === "frame") return null;
    const p = toWorld(e.clientX, e.clientY),
      dx = Math.abs(p.x - n.x),
      dy = Math.abs(p.y - n.y),
      tolerance = 9 / zoom;
    return dx <= n.width / 2 + tolerance &&
      dy <= n.height / 2 + tolerance &&
      Math.min(Math.abs(dx - n.width / 2), Math.abs(dy - n.height / 2)) <=
        tolerance
      ? n.id
      : null;
  }
  on(diagram, "dblclick", (e) => {
    if (cardEditor.active || tool === "hand" || spacePan || suppressClick)
      return;
    e.preventDefault();
    e.stopPropagation();
    const border = selectedBorderAt(e);
    if (border) {
      fitText(border);
      return;
    }
    const id = nodeId(e.target.closest(".node")),
      edge = e.target.closest("[data-edge]");
    if (id) {
      const n = layout.nodes.get(id),
        p = toWorld(e.clientX, e.clientY);
      const atEdge =
        Math.min(
          Math.abs(p.x - (n.x - n.width / 2)),
          Math.abs(p.x - (n.x + n.width / 2)),
          Math.abs(p.y - (n.y - n.height / 2)),
          Math.abs(p.y - (n.y + n.height / 2)),
        ) <
        8 / zoom;
      if (n.shape === "frame" && p.y > n.y - n.height / 2 + 55)
        add("rect", p, id);
      else if (atEdge && !n.card && n.shape !== "frame") fitText(id);
      else if (n.card?.type === "table") {
        const cell = e.target.closest("td,th");
        cardEditor.editCard(n, cell?.parentElement.rowIndex, cell?.cellIndex);
      } else startText(id);
    } else if (edge) startText(null, Number(edge.dataset.edge));
  });
  on(diagram, "keydown", (e) => {
    if (e.key !== "Enter") return;
    const link = e.target.closest("[data-text-link]");
    if (link) {
      link.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
      e.preventDefault();
      return;
    }
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
    const border = selectedBorderAt(e);
    if (border) {
      e.preventDefault();
      fitText(border);
      return;
    }
    if (!e.target.closest(".node,[data-edge]") && model)
      add("rect", toWorld(e.clientX, e.clientY));
  });
  bindSelectionActions();
  bindWheel();
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
  function setTitle(next) {
    title = next;
    $(".rea-board-name").textContent = title;
    $(".rea-title").textContent = title;
  }
  const clipboard = createClipboardController({
    doc,
    win,
    root,
    canvas,
    diagram,
    modal,
    $,
    on,
    uid,
    options,
    board: {
      get source() {
        return source;
      },
      get model() {
        return model;
      },
      get layout() {
        return layout;
      },
      get editing() {
        return editing;
      },
      get selectedEdge() {
        return selectedEdge;
      },
      get selection() {
        return selection;
      },
      get snapping() {
        return preferences.snapping;
      },
      get title() {
        return title;
      },
      get epoch() {
        return epoch;
      },
      set selection(value) {
        selection = value;
      },
      set selectedEdge(value) {
        selectedEdge = value;
      },
      set epoch(value) {
        epoch = value;
      },
    },
    cardEditor,
    finishText,
    hideMenus,
    commit,
    change,
    toWorld,
    status,
    nodeId,
    selectNode,
    selectEdge,
    freezePositions,
  });
  const { pasteText, pasteFromClipboard, copyVisual, download } = clipboard;
  const sourceDialog = createSourceDialog({
    $,
    modal,
    canvas,
    on,
    finishText,
    hideMenus,
    getDraft: () => draft,
    setDraft: (value) => {
      draft = value;
    },
    getSource: () => source,
    getModel: () => model,
    clearSelection() {
      selection.clear();
      selected = null;
      selectedEdge = null;
    },
    commit,
    pasteText,
    fixedTitle: options.fixedTitle,
    setTitle,
    status,
  });
  const { showSource, closeSource, applySource } = sourceDialog;
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
  clipboard.bind();
  clipboard.bindContextMenu();
  function frameSelection() {
    if (!selection.size) {
      status("Select shapes to place in a frame.");
      return;
    }
    canvas.focus();
    change((m) => {
      const id = nextId(m);
      createFrame(m, { id, ids: [...selection] });
      selection = new Set([id]);
      selected = id;
      selectedEdge = null;
    });
  }
  const actions = {
    counter: () =>
      setTextPreferences({
        counterEnabled: !preferences.textPreferences.counterEnabled,
      }),
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
    snap: () => setSnap(!preferences.snapping),
    grid: () => setAppearance({ showGrid: root.dataset.grid !== "true" }),
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
    const background =
      e.target.closest("[data-background]")?.dataset.background;
    if (background) setAppearance({ background });
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "shapes") {
      const menu = $(".rea-shape-menu");
      const open = menu.hidden;
      hideMenus();
      menu.hidden = !open;
      $("[data-action=shapes]").setAttribute("aria-expanded", String(open));
    }
    if (action) actions[action]?.();
    const t = e.target.closest("[data-tool]")?.dataset.tool;
    if (t) {
      finishText();
      hideMenus();
      setTool(t);
    }
  });
  sourceDialog.bind();
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
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "g") {
      e.preventDefault();
      e.stopPropagation();
      frameSelection();
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
      t: "text",
      l: "line",
      v: "select",
      h: "hand",
    }[e.key.toLowerCase()];
    if (t) {
      e.preventDefault();
      setTool(t);
    }
  });
  on(win, "keyup", (e) => {
    if (e.key === " ") spacePan = false;
  });
  bindPointerBlur();
  const resize = new ResizeObserver(() => {
    placeControls();
    cardEditor.position();
  });
  resize.observe(canvas);
  setTool("select");
  Promise.resolve(render(true)).then(() =>
    restoreEditorSession(options.editorSession),
  );
  return {
    destroy() {
      cardEditor.close();
      finishText();
      disposed = true;
      cancelPointerFrame();
      resize.disconnect();
      abort.abort();
      setMarkup(root, "");
    },
    getEditorSession,
    setTextPreferences: (patch) => setTextPreferences(patch, false),
    setAppearance: (patch) => setAppearance(patch, false),
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
      const session = getEditorSession();
      finishText();
      await saveQueue.flush();
      if (session && !disposed) {
        await render(false);
        restoreEditorSession(session);
      }
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
    setTitle,
  };
}
