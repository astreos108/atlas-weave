const PRESETS = { ivory: "#fffdf5", ice: "#f5fbff", sage: "#f5faf3" };
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
