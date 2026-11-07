// World coordinates; thresholds are converted from screen pixels by the caller.
export function alignMove(box, others, threshold = 6) {
  const result = { x: 0, y: 0, guides: [] };
  for (const axis of ["x", "y"]) {
    const size = axis === "x" ? "width" : "height",
      cross = axis === "x" ? "y" : "x",
      crossSize = axis === "x" ? "height" : "width";
    let best = null;
    for (const n of others)
      for (const a of [-0.5, 0, 0.5])
        for (const b of [-0.5, 0, 0.5]) {
          const value = n[axis] + b * n[size],
            delta = value - (box[axis] + a * box[size]);
          if (
            Math.abs(delta) <= threshold &&
            (!best || Math.abs(delta) < Math.abs(best.delta))
          )
            best = {
              delta,
              value,
              start:
                Math.min(
                  box[cross] - box[crossSize] / 2,
                  n[cross] - n[crossSize] / 2,
                ) - 16,
              end:
                Math.max(
                  box[cross] + box[crossSize] / 2,
                  n[cross] + n[crossSize] / 2,
                ) + 16,
            };
        }
    if (best) {
      result[axis] = best.delta;
      result.guides.push({ axis, ...best });
    }
  }
  return result;
}
