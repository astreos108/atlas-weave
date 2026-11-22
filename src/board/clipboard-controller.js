import mermaid from "../mermaid-renderer.js";
import { parse, serialize, nextId } from "../model.js";
import { setMarkup } from "../markup.js";
import { snapValue } from "../connector-routing.js";
import { cardNode, clipboardCard, validCard } from "../content-card.js";
import { membersFor } from "../domain/board-actions.js";
import { createLayout } from "../layout.js";
import { routeImportedFrames } from "../import-routing.js";
import {
  decodeClipboard,
  clipboardMermaid,
  svgClipboardModel,
  exportSelection,
  svgToPng,
} from "../clipboard.js";
export function createClipboardController({
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
  board,
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
}) {
  function download() {
    const url = URL.createObjectURL(
        new Blob(
          [
            `# ${board.title}\n\n\x60\x60\x60mermaid\n${board.source}\n\x60\x60\x60\n`,
          ],
          { type: "text/markdown" },
        ),
      ),
      a = doc.createElement("a");
    a.href = url;
    a.download = `${board.title.replace(/[\\/:*?"<>|]/g, "-") || "Board"}.md`;
    a.click();
    win.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let pastePoint = null;
  async function pasteText(
    text,
    html = "",
    card = clipboardCard(text, html, doc),
  ) {
    finishText();
    const before = board.source;
    try {
      if (card && !validCard(card))
        throw new Error("Card exceeds the supported size.");
      let decoded = card
        ? {
            model: {
              direction: "LR",
              edges: [],
              nodes: [
                { id: "card", ...cardNode(card), position: { x: 0, y: 0 } },
              ],
            },
          }
        : /<svg[\s>]/i.test(text)
          ? svgClipboardModel(text, doc)
          : /<svg[\s>]/i.test(html) &&
              !/^\s*(?:flowchart|graph|[[{])/.test(text)
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
      if (board.source !== before)
        throw new Error(
          "Board changed while reading the clipboard. Paste again.",
        );
      if (!decoded.model && board.model && !board.model.nodes.length) {
        if (decoded.source) {
          board.selection.clear();
          commit(decoded.source, { autoFit: true });
          return;
        }
        throw new Error("Clipboard contains no editable board content.");
      }
      if (!decoded.model && decoded.source && board.model) {
        const diagramCard = {
          type: "code",
          language: "mermaid",
          source: decoded.source,
        };
        if (!validCard(diagramCard))
          throw new Error("Mermaid source exceeds the supported card size.");
        decoded = {
          model: {
            direction: board.model.direction,
            nodes: [
              {
                id: "card",
                ...cardNode(diagramCard),
                position: { x: 0, y: 0 },
              },
            ],
            edges: [],
          },
          notice: "Pasted Mermaid source as an editable code block.",
        };
      }
      if (!board.model)
        throw new Error(
          "This diagram uses source-only Mermaid. Create an editable flowchart board to paste shapes.",
        );
      const incoming = parse(serialize(decoded.model));
      if (!incoming)
        throw new Error("Unsupported or invalid shape geometry in clipboard.");
      if (!incoming.nodes.length) return;
      if (
        incoming.nodes.length > 300 ||
        incoming.nodes.length + board.model.nodes.length > 300
      )
        throw new Error("Paste is limited to 300 shapes.");
      // Resolve Mermaid auto layout offscreen once, then insert every shape at the paste location.
      let positions = incoming.nodes.every((n) => n.position)
        ? Object.fromEntries(incoming.nodes.map((n) => [n.id, n.position]))
        : null;
      if (!positions) {
        const originalFlowchart =
          decoded.source && /^(?:flowchart|graph)\s/.test(decoded.source);
        if (originalFlowchart)
          for (const edge of incoming.edges) edge.routing ??= "auto";
        const result = await mermaid.render(
            `rea-paste-${uid}-${++board.epoch}`,
            originalFlowchart ? decoded.source : serialize(incoming),
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
              { preserveMermaidLayout: !!originalFlowchart },
            );
          if (originalFlowchart) routeImportedFrames(incoming, l.nodes);
          positions = l.positions();
          for (const n of incoming.nodes) {
            const at = l.nodes.get(n.id);
            n.size = { width: at.width, height: at.height };
          }
        } finally {
          holder.remove();
        }
      }
      if (board.source !== before)
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
          x: snapValue(at.x - cx, board.snapping),
          y: snapValue(at.y - cy, board.snapping),
        };
      if (!explicit) {
        for (let tries = 0; tries < 50; tries++) {
          const overlaps = incoming.nodes.some((n) =>
            [...board.layout.nodes.values()].some(
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
        board.selection = new Set(ids.values());
        board.selectedEdge = null;
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
  function bind() {
    on(
      root,
      "paste",
      (e) => {
        if (!modal.hidden || cardEditor.active || !e.clipboardData) return;
        const data = e.clipboardData;
        const text =
          data.getData("application/x-excalidraw") ||
          data.getData("text/plain");
        const html = data.getData("text/html");
        const card = clipboardCard(text, html, doc);
        const inShapeEditor =
          board.editing?.id &&
          board.layout.nodes.get(board.editing.id)?.shape !== "frame" &&
          board.editing.input.contains(e.target);
        if (
          !inShapeEditor &&
          (e.target.isContentEditable ||
            e.target.closest?.('[contenteditable="true"]') ||
            /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))
        )
          return;
        const mermaidSource = !card && clipboardMermaid(text);
        if (inShapeEditor && !card && !mermaidSource) return;
        e.preventDefault();
        e.stopPropagation();
        if (!text && !html) {
          status(
            "This clipboard contains only an image or a private app format. Copy as SVG or Mermaid for editable shapes.",
            true,
          );
          return;
        }
        if (inShapeEditor) canvas.focus();
        pasteText(text, html, card);
      },
      { capture: true },
    );
    on(root, "copy", (e) => {
      if (
        e.target.isContentEditable ||
        e.target.closest?.('[contenteditable="true"]') ||
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        !board.model
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      const ids = board.selection.size
          ? membersFor(board.model, board.selection)
          : board.selectedEdge !== null
            ? new Set([
                board.model.edges[board.selectedEdge].from,
                board.model.edges[board.selectedEdge].to,
              ])
            : new Set(board.model.nodes.map((n) => n.id)),
        copy = structuredClone(board.model);
      freezePositions(copy);
      copy.nodes = copy.nodes.filter((n) => ids.has(n.id));
      copy.edges = copy.edges.filter(
        (e, i) =>
          board.selectedEdge === i || (ids.has(e.from) && ids.has(e.to)),
      );
      e.clipboardData.setData("text/plain", serialize(copy));
      status("Copied Mermaid shapes.");
    });
  }
  async function copyVisual(kind) {
    finishText();
    hideMenus();
    try {
      if (!board.layout)
        throw new Error(
          "Image copying currently supports editable flowcharts.",
        );
      const image = exportSelection(
        diagram.querySelector("svg"),
        board.layout,
        membersFor(board.model, board.selection),
        board.selectedEdge,
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
        `Copied ${board.selection.size ? "selection" : "content"} as ${kind.toUpperCase()}.`,
      );
    } catch (e) {
      status(`Copy failed: ${e.message}`, true);
    }
  }
  function bindContextMenu() {
    on(canvas, "contextmenu", (e) => {
      if (board.editing) return;
      e.preventDefault();
      finishText();
      hideMenus();
      pastePoint = toWorld(e.clientX, e.clientY);
      const id = nodeId(e.target.closest(".node")),
        edge = e.target.closest("[data-edge]");
      if (id && !board.selection.has(id)) selectNode(id);
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
  }

  return {
    pasteText,
    pasteFromClipboard,
    copyVisual,
    download,
    bind,
    bindContextMenu,
  };
}
