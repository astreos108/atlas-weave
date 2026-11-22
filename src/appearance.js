const PRESETS = { ivory: "#fffdf5", ice: "#f5fbff", sage: "#f5faf3" };
export const DEFAULT_BOARD_PAPER = PRESETS.ivory;
export function backgroundHex(value) {
  const text = PRESETS[value] || String(value || "").trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (!match) return null;
  const hex = match[1];
  return (
    "#" +
    (hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex).toLowerCase()
  );
}
export function paperColors(value, theme = "light") {
  let paper = backgroundHex(value) || PRESETS.ivory;
  const channels = paper
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16));
  const dark =
    channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114 < 130;
  if (theme === "dark" && !dark)
    paper =
      "#" +
      channels
        .map((c) =>
          Math.round(c * 0.1 + 3)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  return { paper, grid: dark || theme === "dark" ? "#6e7b87" : "#c7c5bd" };
}

export const CONNECTOR_COLORS = {
  "#9b96aa": "#c4c9d5",
  "#8b5cf6": "#c39bff",
  "#3b82f6": "#79baff",
  "#10b981": "#55e3b1",
  "#f59e0b": "#ffce55",
  "#ef4444": "#ff888f",
};

export function applyConnectorColor(element, color = "#9b96aa") {
  element.classList.add("rea-connector-color");
  element.style.setProperty("--connector-light", color);
  element.style.setProperty(
    "--connector-dark",
    CONNECTOR_COLORS[color.toLowerCase()] ||
      `oklch(from ${color} max(l, 0.81) c h)`,
  );
}

export const DEFAULT_THOUGHT_COLOR = { fill: "#ede9fe", stroke: "#a78bfa" };
export const SHAPE_COLORS = [
  ["#ffffff", "#cbd5e1"],
  [DEFAULT_THOUGHT_COLOR.fill, DEFAULT_THOUGHT_COLOR.stroke],
  ["#d1fae5", "#6ee7b7"],
  ["#fef3c7", "#fbbf24"],
  ["#ffe4e6", "#fda4af"],
  ["#dbeafe", "#93c5fd"],
];

export function shapeInk(fill) {
  const [r, g, b] = fill
    .slice(1)
    .match(/../g)
    .map((channel) => parseInt(channel, 16));
  return r * 0.299 + g * 0.587 + b * 0.114 < 130
    ? "var(--on-dark-shape)"
    : "var(--on-light-shape)";
}
