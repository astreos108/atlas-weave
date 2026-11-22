import { gridLayers } from "../grid.js";
export function createViewport({
  board,
  $,
  root,
  canvas,
  diagram,
  transform,
  on,
  finishText,
  placeControls,
  positionCardEditor,
  highlight,
  hideMenus,
  selectionControls,
}) {
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

  function view() {
    transform.style.transform = `translate(${board.pan.x}px,${board.pan.y}px) scale(${board.zoom})`;
    $(".rea-percent").textContent = `${Math.round(board.zoom * 100)}%`;
    const layers = gridLayers(board.zoom, board.pan),
      color = getComputedStyle(root).getPropertyValue("--grid").trim();
    canvas.style.backgroundImage = layers
      .map(
        (l) =>
          `radial-gradient(${l.visible ? color : "transparent"} ${l.radius}px, transparent ${l.radius}px)`,
      )
      .join(",");
    canvas.style.backgroundSize = layers
      .map((l) => `${l.size}px ${l.size}px`)
      .join(",");
    canvas.style.backgroundPosition = layers
      .map((l) => `${l.x}px ${l.y}px`)
      .join(",");
    placeControls();
    positionCardEditor();
    const b = board.layout?.bounds();
    $(".rea-recover").hidden =
      !b ||
      (b.x * board.zoom + board.pan.x < canvas.clientWidth - 70 &&
        (b.x + b.width) * board.zoom + board.pan.x > 80 &&
        b.y * board.zoom + board.pan.y < canvas.clientHeight - 60 &&
        (b.y + b.height) * board.zoom + board.pan.y > 50);
  }
  function animateView() {
    const before = transform.style.transform;
    view();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const after = transform.style.transform;
    transform.animate([{ transform: before }, { transform: after }], {
      duration: 220,
      easing: "cubic-bezier(.2,.8,.2,1)",
    });
  }
  function fit() {
    const svg = diagram.querySelector("svg");
    if (!svg) return;
    const b = board.layout ? board.layout.bounds() : svg.viewBox.baseVal,
      w = Math.max(100, canvas.clientWidth - 220),
      h = Math.max(100, canvas.clientHeight - 140);
    board.zoom = Math.min(
      1.2,
      Math.max(0.05, Math.min(w / b.width, h / b.height)),
    );
    board.pan = {
      x:
        110 +
        (w - b.width * board.zoom) / 2 -
        (board.layout ? b.x * board.zoom : 0),
      y:
        70 +
        (h - b.height * board.zoom) / 2 -
        (board.layout ? b.y * board.zoom : 0),
    };
    animateView();
  }

  function focusIdea(id) {
    const n = board.layout?.nodes.get(id);
    if (!n) return;
    board.selection = new Set([id]);
    board.selected = id;
    board.selectedEdge = null;
    board.zoom = Math.min(
      1.6,
      Math.max(
        0.2,
        Math.min(
          (canvas.clientWidth - 180) / n.width,
          (canvas.clientHeight - 160) / n.height,
        ),
      ),
    );
    board.pan = {
      x: canvas.clientWidth / 2 - n.x * board.zoom,
      y: canvas.clientHeight / 2 - n.y * board.zoom,
    };
    animateView();
    highlight();
    $(".rea-present-title").textContent = n.label;
  }
  function present(delta = 0) {
    if (!board.model?.nodes.length) return;
    finishText();
    hideMenus();
    board.presenting = true;
    root.classList.add("rea-presenting");
    $(".rea-presenter").hidden = false;
    board.presentIndex = Math.max(
      0,
      Math.min(board.model.nodes.length - 1, board.presentIndex + delta),
    );
    focusIdea(board.model.nodes[board.presentIndex].id);
    canvas.focus();
  }
  function exitPresent() {
    board.presenting = false;
    root.classList.remove("rea-presenting");
    $(".rea-presenter").hidden = true;
    fit();
    selectionControls();
  }

  function scale(
    factor,
    x = canvas.clientWidth / 2,
    y = canvas.clientHeight / 2,
    animate = false,
  ) {
    finishText();
    const next = Math.max(0.05, Math.min(3, board.zoom * factor));
    board.pan = {
      x: x - ((x - board.pan.x) * next) / board.zoom,
      y: y - ((y - board.pan.y) * next) / board.zoom,
    };
    board.zoom = next;
    if (animate) animateView();
    else view();
  }
  function bindWheel() {
    on(
      canvas,
      "wheel",
      (e) => {
        e.preventDefault();
        if (board.drag) return;
        if (e.ctrlKey || e.metaKey) {
          const r = canvas.getBoundingClientRect();
          scale(
            Math.exp(-e.deltaY * 0.008),
            e.clientX - r.left,
            e.clientY - r.top,
          );
        } else {
          finishText();
          board.pan.x -= e.deltaX;
          board.pan.y -= e.deltaY;
          view();
        }
      },
      { passive: false },
    );
  }
  return {
    toWorld,
    toLocal,
    view,
    animateView,
    fit,
    focusIdea,
    present,
    exitPresent,
    scale,
    bindWheel,
  };
}
