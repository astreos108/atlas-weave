/** Edge or corner resize: opposite edge stays fixed. Snap the dragged edge itself. */
export function resizeBox(
  box,
  handle,
  delta,
  { snap = true, others = [], threshold = 6 } = {},
) {
  let l = box.x - box.width / 2,
    r = box.x + box.width / 2,
    t = box.y - box.height / 2,
    b = box.y + box.height / 2;
  const round = (v) => (snap ? Math.round(v / 20) * 20 : v);
  if (handle.includes("w")) l = Math.min(r - 80, round(l + delta.x));
  if (handle.includes("e")) r = Math.max(l + 80, round(r + delta.x));
  if (handle.includes("n")) t = Math.min(b - 48, round(t + delta.y));
  if (handle.includes("s")) b = Math.max(t + 48, round(b + delta.y));
  const next = { x: (l + r) / 2, y: (t + b) / 2, width: r - l, height: b - t },
    guides = [];
  for (const axis of ["x", "y"]) {
    const side =
      axis === "x"
        ? handle.includes("w")
          ? "w"
          : handle.includes("e")
            ? "e"
            : null
        : handle.includes("n")
          ? "n"
          : handle.includes("s")
            ? "s"
            : null;
    if (!side) continue;
    const size = axis === "x" ? "width" : "height",
      sign = ["w", "n"].includes(side) ? -1 : 1,
      edge = next[axis] + (sign * next[size]) / 2;
    let best = null;
    for (const n of others)
      for (const offset of [-0.5, 0, 0.5]) {
        const v = n[axis] + offset * n[size],
          d = v - edge;
        if (
          Math.abs(d) <= threshold &&
          (!best || Math.abs(d) < Math.abs(best.d))
        )
          best = { d, v, n };
      }
    if (best && next[size] + sign * best.d >= (axis === "x" ? 80 : 48)) {
      next[axis] += best.d / 2;
      next[size] += sign * best.d;
      const cross = axis === "x" ? "y" : "x",
        crossSize = axis === "x" ? "height" : "width";
      guides.push({
        axis,
        value: best.v,
        start:
          Math.min(
            next[cross] - next[crossSize] / 2,
            best.n[cross] - best.n[crossSize] / 2,
          ) - 16,
        end:
          Math.max(
            next[cross] + next[crossSize] / 2,
            best.n[cross] + best.n[crossSize] / 2,
          ) + 16,
      });
    }
  }
  return { ...next, guides };
}
