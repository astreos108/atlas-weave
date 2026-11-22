import {
  backgroundHex,
  DEFAULT_BOARD_PAPER,
  paperColors,
} from "../appearance.js";
import { snapPoint } from "../connector-routing.js";
export function createBoardPreferences({
  root,
  $,
  signal,
  options,
  refreshView,
  refreshEditor,
  status,
}) {
  let snapping = options.snap !== false;
  function setTheme(theme, save = true) {
    root.dataset.theme = theme;
    for (const mode of ["light", "dark"])
      root
        .querySelector(`[data-action=${mode}]`)
        .setAttribute("aria-pressed", String(mode === theme));
    if (root.dataset.background) {
      const colors = paperColors(root.dataset.background, theme);
      root.style.setProperty("--paper", colors.paper);
      root.style.setProperty("--grid", colors.grid);
    }
    refreshView();
    if (save)
      Promise.resolve(options.setTheme?.(theme)).catch(() =>
        status("Could not save theme preference.", true),
      );
  }
  setTheme(options.theme || "light", false);
  function setAppearance(patch, save = true) {
    const background =
        backgroundHex(patch.background) ||
        root.dataset.background ||
        DEFAULT_BOARD_PAPER,
      showGrid = patch.showGrid ?? root.dataset.grid !== "false";
    root.dataset.background = background;
    root.dataset.grid = String(showGrid);
    const colors = paperColors(background, root.dataset.theme);
    root.style.setProperty("--paper", colors.paper);
    root.style.setProperty("--grid", colors.grid);
    $(".rea-background-hex").value = background;
    for (const button of root.querySelectorAll("button[data-background]")) {
      const swatch = backgroundHex(button.dataset.background);
      button.style.setProperty("--swatch", swatch);
      button.setAttribute("aria-pressed", String(swatch === background));
    }
    $("[data-action=grid]").setAttribute("aria-pressed", String(showGrid));
    refreshView();
    if (save)
      Promise.resolve(options.setAppearance?.({ background, showGrid })).catch(
        () => status("Could not save background preference.", true),
      );
  }
  setAppearance(
    {
      background: options.background || "ivory",
      showGrid: options.showGrid !== false,
    },
    false,
  );
  onBackgroundInput();
  function onBackgroundInput() {
    const input = $(".rea-background-hex");
    input.addEventListener(
      "change",
      () => {
        const color = backgroundHex(input.value);
        input.setAttribute("aria-invalid", String(!color));
        if (color) setAppearance({ background: color });
      },
      { signal },
    );
    input.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          input.blur();
        }
      },
      { signal },
    );
  }
  let textPreferences = {
    counterEnabled: options.counterEnabled === true,
    characterTarget: options.characterTarget || 280,
  };
  function setTextPreferences(patch, save = true) {
    textPreferences = { ...textPreferences, ...patch };
    textPreferences.characterTarget = Math.max(
      1,
      Math.min(
        10000,
        Math.round(Number(textPreferences.characterTarget) || 280),
      ),
    );
    $("[data-action=counter]").setAttribute(
      "aria-pressed",
      String(textPreferences.counterEnabled),
    );
    $(".rea-character-target").value = textPreferences.characterTarget;
    $(".rea-character-target").hidden = !textPreferences.counterEnabled;
    refreshEditor();
    if (save)
      Promise.resolve(options.setTextPreferences?.(textPreferences)).catch(() =>
        status("Could not save text preferences.", true),
      );
  }
  setTextPreferences({}, false);
  $(".rea-character-target").addEventListener(
    "change",
    (e) => setTextPreferences({ characterTarget: e.target.value }),
    { signal },
  );
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

  return {
    setTheme,
    setAppearance,
    setTextPreferences,
    setSnap,
    snapped,
    get snapping() {
      return snapping;
    },
    get textPreferences() {
      return textPreferences;
    },
  };
}
