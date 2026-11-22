/** Durable frame membership and arrangement rules. No UI or storage dependencies. */
function containingFrame(frames, point, geometry) {
  if (!point) return null;
  return frames
    .map((frame) => ({ frame, box: geometry(frame) }))
    .filter(
      ({ box }) =>
        box &&
        Math.abs(point.x - box.x) <= box.width / 2 &&
        Math.abs(point.y - box.y) <= box.height / 2,
    )
    .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)
    .at(0)?.frame;
}

function storedGeometry(node) {
  return node.position && node.size ? { ...node.position, ...node.size } : null;
}

export function frameOwners(model, layout) {
  const frames = model.nodes.filter((n) => n.shape === "frame");
  const geometry = layout ? (n) => layout.get(n.id) : storedGeometry;
  const owners = new Map(frames.flatMap((f) => f.members.map((id) => [id, f])));
  for (const node of model.nodes) {
    if (owners.has(node.id)) continue;
    const box = geometry(node);
    const candidates =
      node.shape === "frame" && box
        ? frames.filter((f) => {
            const outer = geometry(f);
            return (
              outer &&
              outer.width > box.width &&
              outer.height > box.height &&
              Math.abs(outer.x - box.x) <= (outer.width - box.width) / 2 &&
              Math.abs(outer.y - box.y) <= (outer.height - box.height) / 2
            );
          })
        : frames;
    const owner = containingFrame(candidates, box, geometry);
    let ancestor = owner;
    while (ancestor && ancestor.id !== node.id)
      ancestor = owners.get(ancestor.id);
    if (owner && !ancestor) owners.set(node.id, owner);
  }
  return owners;
}

export function membersFor(model, ids, layout) {
  const result = new Set(ids);
  const owners = frameOwners(model, layout);
  for (const node of model.nodes) {
    let owner = owners.get(node.id);
    const visited = new Set([node.id]);
    while (owner && !visited.has(owner.id)) {
      if (result.has(owner.id)) {
        result.add(node.id);
        break;
      }
      visited.add(owner.id);
      owner = owners.get(owner.id);
    }
  }
  return result;
}

export function updateFrameMembership(model, ids) {
  const changed = new Set(ids);
  for (const frame of model.nodes)
    if (frame.members)
      frame.members = frame.members.filter((id) => !changed.has(id));
  for (const [id, owner] of frameOwners(model))
    if (changed.has(id)) owner.members.push(id);
  validateFrames(model);
}

export function validateFrames(model) {
  const ids = new Set(model.nodes.map((n) => n.id));
  const ownership = new Map();
  for (const frame of model.nodes.filter((n) => n.shape === "frame")) {
    if (!Array.isArray(frame.members))
      throw new Error("Frame members must be an array");
    for (const id of frame.members) {
      if (id === frame.id || !ids.has(id) || ownership.has(id))
        throw new Error("Frame members must exist and have one owner");
      ownership.set(id, frame.id);
    }
  }
  for (const id of ownership.keys()) {
    const visited = new Set();
    for (let at = id; at; at = ownership.get(at)) {
      if (visited.has(at)) throw new Error("Frames cannot contain each other");
      visited.add(at);
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
  const selected = new Set(ids);
  const owners = frameOwners(model);
  const members = [...selected].filter((id) => {
    let owner = owners.get(id);
    const visited = new Set([id]);
    while (owner && !visited.has(owner.id)) {
      if (selected.has(owner.id)) return false;
      visited.add(owner.id);
      owner = owners.get(owner.id);
    }
    return true;
  });
  const parent = owners.get(members[0]);
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
  if (parent && members.every((id) => owners.get(id) === parent))
    parent.members.push(id);
  validateFrames(model);
}
export function removeNodes(model, ids, { deleteFrameContents = false } = {}) {
  const removing = new Set(ids);
  if (deleteFrameContents) {
    const remainingFrames = model.nodes.filter(
      (node) => node.shape === "frame" && !removing.has(node.id),
    );
    for (const [id, owner] of frameOwners(model)) {
      if (!removing.has(owner.id) || removing.has(id)) continue;
      const node = model.nodes.find((item) => item.id === id);
      if (node.shape === "frame") continue;
      const other = containingFrame(
        remainingFrames,
        node.position,
        storedGeometry,
      );
      if (other) other.members.push(id);
      else removing.add(id);
    }
  }
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
      (n) =>
        n.shape === "frame" &&
        [...membersFor(model, [n.id])].some(
          (id) => id !== n.id && chosen.has(id),
        ),
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

export function reverseConnector(edge) {
  [edge.from, edge.to] = [edge.to, edge.from];
  for (const suffix of ["Side", "Ratio"]) {
    const from = edge["from" + suffix];
    const to = edge["to" + suffix];
    delete edge["from" + suffix];
    delete edge["to" + suffix];
    if (to !== undefined) edge["from" + suffix] = to;
    if (from !== undefined) edge["to" + suffix] = from;
  }
  edge.waypoints?.reverse();
}
