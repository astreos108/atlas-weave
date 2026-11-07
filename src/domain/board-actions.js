/** Durable frame membership and arrangement rules. No UI or storage dependencies. */
export function membersFor(model, ids) {
  const result = new Set(ids);
  for (const id of ids) {
    const n = model.nodes.find((n) => n.id === id);
    for (const member of n?.members || []) result.add(member);
  }
  return result;
}
export function validateFrames(model) {
  const ownership = new Set();
  for (const frame of model.nodes.filter((n) => n.shape === "frame")) {
    if (
      !Array.isArray(frame.members) ||
      frame.members.some(
        (id) =>
          id === frame.id ||
          !model.nodes.some((n) => n.id === id && n.shape !== "frame"),
      ) ||
      new Set(frame.members).size !== frame.members.length
    )
      throw new Error("Frames need unique existing non-frame members");
    for (const id of frame.members) {
      if (ownership.has(id))
        throw new Error("A shape can belong to only one frame");
      ownership.add(id);
    }
  }
}
export function moveNodes(model, ids, dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy))
    throw new Error("Invalid move");
  const moving = membersFor(model, ids);
  for (const id of moving) {
    const n = model.nodes.find((n) => n.id === id);
    if (!n?.position) throw new Error("Every moved shape needs a position");
    n.position = { x: n.position.x + dx, y: n.position.y + dy };
  }
  for (const e of model.edges)
    if (moving.has(e.from) && moving.has(e.to) && e.waypoints)
      e.waypoints = e.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
export function createFrame(model, { id, label = "Frame", ids }) {
  const members = [...membersFor(model, ids)].filter(
    (id) => model.nodes.find((n) => n.id === id)?.shape !== "frame",
  );
  if (!members.length) throw new Error("Select shapes to frame");
  if (model.nodes.some((n) => n.id === id)) throw new Error("Frame ID exists");
  const ns = members.map((id) => model.nodes.find((n) => n.id === id));
  if (ns.some((n) => !n.position || !n.size))
    throw new Error("Frame members need positions and sizes");
  for (const f of model.nodes)
    if (f.members) f.members = f.members.filter((id) => !members.includes(id));
  const left =
      Math.floor(
        Math.min(...ns.map((n) => n.position.x - n.size.width / 2)) / 20,
      ) *
        20 -
      40,
    right =
      Math.ceil(
        Math.max(...ns.map((n) => n.position.x + n.size.width / 2)) / 20,
      ) *
        20 +
      40,
    top =
      Math.floor(
        Math.min(...ns.map((n) => n.position.y - n.size.height / 2)) / 20,
      ) *
        20 -
      80,
    bottom =
      Math.ceil(
        Math.max(...ns.map((n) => n.position.y + n.size.height / 2)) / 20,
      ) *
        20 +
      40;
  model.nodes.unshift({
    id,
    label,
    shape: "frame",
    fill: "#ede9fe",
    stroke: "#a78bfa",
    position: { x: (left + right) / 2, y: (top + bottom) / 2 },
    size: { width: right - left, height: bottom - top },
    members,
  });
  validateFrames(model);
}
export function removeNodes(model, ids) {
  const removing = new Set(ids);
  model.nodes = model.nodes.filter((n) => !removing.has(n.id));
  model.edges = model.edges.filter(
    (e) => !removing.has(e.from) && !removing.has(e.to),
  );
  for (const n of model.nodes)
    if (n.members) n.members = n.members.filter((id) => !removing.has(id));
}
export function arrangeNodes(model, ids, mode) {
  const chosen = new Set(ids),
    ns = model.nodes.filter((n) => chosen.has(n.id));
  if (ns.length < 2) throw new Error("Select at least two objects");
  if (ns.some((n) => !n.position || !n.size))
    throw new Error("Arrangement needs saved geometry");
  if (
    ns.some(
      (n) => n.shape === "frame" && n.members.some((id) => chosen.has(id)),
    )
  )
    throw new Error("Arrange a frame or its members, not both");
  const left = Math.min(...ns.map((n) => n.position.x - n.size.width / 2)),
    right = Math.max(...ns.map((n) => n.position.x + n.size.width / 2)),
    top = Math.min(...ns.map((n) => n.position.y - n.size.height / 2)),
    bottom = Math.max(...ns.map((n) => n.position.y + n.size.height / 2));
  if (mode.startsWith("distribute-")) {
    const axis = mode.endsWith("x") ? "x" : "y",
      size = axis === "x" ? "width" : "height";
    const sorted = [...ns].sort((a, b) => a.position[axis] - b.position[axis]);
    const start = sorted[0].position[axis] - sorted[0].size[size] / 2,
      end = sorted.at(-1).position[axis] + sorted.at(-1).size[size] / 2,
      gap =
        (end - start - sorted.reduce((s, n) => s + n.size[size], 0)) /
        (ns.length - 1);
    let at = start;
    for (const n of sorted) {
      const delta = at + n.size[size] / 2 - n.position[axis];
      moveNodes(
        model,
        [n.id],
        axis === "x" ? delta : 0,
        axis === "y" ? delta : 0,
      );
      at += n.size[size] + gap;
    }
    return;
  }
  if (!["left", "center", "right", "top", "middle", "bottom"].includes(mode))
    throw new Error("Unknown arrangement");
  for (const n of ns) {
    const x = {
        left: left + n.size.width / 2,
        center: (left + right) / 2,
        right: right - n.size.width / 2,
      }[mode],
      y = {
        top: top + n.size.height / 2,
        middle: (top + bottom) / 2,
        bottom: bottom - n.size.height / 2,
      }[mode];
    moveNodes(
      model,
      [n.id],
      x === undefined ? 0 : x - n.position.x,
      y === undefined ? 0 : y - n.position.y,
    );
  }
}
