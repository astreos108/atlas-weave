import { validateFrames } from "./domain/board-actions.js";
export const INITIAL = `flowchart LR
  idea["A little idea"]
  explore["Make some space"]
  decide{"What matters?"}
  build(["Bring it to life"])
  idea --> explore
  explore --> decide
  decide -->|Keep it simple| build
  style idea fill:#ede9fe,stroke:#a78bfa
  style explore fill:#ffffff,stroke:#cbd5e1
  style decide fill:#fef3c7,stroke:#fbbf24
  style build fill:#d1fae5,stroke:#6ee7b7`;
const entities = {
  "#quot;": '"',
  "#91;": "[",
  "#93;": "]",
  "#124;": "|",
  "#59;": ";",
  "#38;": "&",
  "#35;": "#",
  "#10;": "\n",
};
export const decode = (s) =>
  s.replace(/#(?:quot|91|93|124|59|38|35|10);/g, (x) => entities[x]);
export const encode = (s) =>
  s.replace(/\r\n?/g, "\n").replace(
    /[&"[\]|;#\n]/g,
    (x) =>
      ({
        "&": "#38;",
        '"': "#quot;",
        "[": "#91;",
        "]": "#93;",
        "|": "#124;",
        ";": "#59;",
        "#": "#35;",
        "\n": "#10;",
      })[x],
  );
// Normalize common inline/unquoted flowcharts without flattening unsupported constructs.
export function expandSimpleFlowchart(source) {
  const statements = [];
  for (const raw of source.trim().split("\n")) {
    if (raw.trim().startsWith("%%")) {
      statements.push(raw.trim());
      continue;
    }
    let part = "",
      depth = 0,
      quoted = false;
    for (const c of raw) {
      if (c === '"') quoted = !quoted;
      if (!quoted) {
        if ("[{(".includes(c)) depth++;
        if ("]})".includes(c)) depth--;
      }
      if (c === ";" && !quoted && depth === 0) {
        if (part.trim()) statements.push(part.trim());
        part = "";
      } else part += c;
    }
    if (part.trim()) statements.push(part.trim());
  }
  if (!/^(?:flowchart|graph)\s+(LR|RL|TD|TB|BT)$/.test(statements[0] || ""))
    return source;
  const definitions = new Map(),
    edges = [],
    extras = [];
  function read(text) {
    const m =
      /^(\w+)(\(\[(?:"([^"]*)"|([^\]]*))\]\)|\[(?:"([^"]*)"|([^\]]*))\]|\{(?:"([^"]*)"|([^}]*))\})?/.exec(
        text.trim(),
      );
    if (!m) return null;
    const id = m[1],
      has = !!m[2];
    if (has) {
      if (definitions.get(id)?.explicit) return null;
      const shape = m[2].startsWith("([")
          ? "round"
          : m[2].startsWith("{")
            ? "diamond"
            : "rect",
        label = decode(m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7] ?? m[8]);
      definitions.set(id, { id, shape, label, explicit: true });
    } else if (!definitions.has(id))
      definitions.set(id, { id, shape: "rect", label: id });
    return { id, rest: text.trim().slice(m[0].length).trim() };
  }
  for (const line of statements.slice(1)) {
    if (/^(?:style |linkStyle |%%)/.test(line)) {
      extras.push(line);
      continue;
    }
    let node = read(line);
    if (!node) return source;
    while (node.rest) {
      const arrow = /^-->\s*(?:\|([^|]*)\|\s*)?/.exec(node.rest);
      if (!arrow) return source;
      const next = read(node.rest.slice(arrow[0].length));
      if (!next) return source;
      edges.push(
        `  ${node.id} -->${arrow[1] ? `|${arrow[1]}|` : ""} ${next.id}`,
      );
      node = next;
    }
  }
  const shapes = {
    rect: ['["', '"]'],
    round: ['(["', '"])'],
    diamond: ['{"', '"}'],
  };
  return [
    statements[0],
    ...[...definitions.values()].map(
      (n) =>
        `  ${n.id}${shapes[n.shape][0]}${encode(n.label)}${shapes[n.shape][1]}`,
    ),
    ...edges,
    ...extras,
  ].join("\n");
}
// Basic non-nested Mermaid subgraphs become real editable frames. Unsupported syntax stays source-only.
function flattenSubgraphs(source) {
  if (!/^\s*subgraph\s/m.test(source)) return source;
  const lines = source.split("\n"),
    flat = [],
    frames = [];
  let current = null;
  for (const line of lines) {
    const text = line.trim();
    if (text.startsWith("subgraph ")) {
      if (current) return source;
      const match = /^subgraph\s+(\w+)(?:\s*\["?([^"\]]+)"?\]|\s+(.+))?$/.exec(
        text,
      );
      if (!match) return source;
      current = {
        id: match[1],
        label: match[2] || match[3] || match[1],
        members: [],
      };
      frames.push(current);
      continue;
    }
    if (text === "end") {
      if (!current) return source;
      current = null;
      continue;
    }
    if (current) {
      if (/^direction\s/.test(text)) return source;
      const id = /^(\w+)(?:\s*[[({]|$)/.exec(text)?.[1];
      if (id && !current.members.includes(id)) current.members.push(id);
    }
    flat.push(line);
  }
  if (
    current ||
    flat.some((line) => line.trim().startsWith("%% board-layout:"))
  )
    return source;
  const ids = new Set(frames.map((f) => f.id));
  if (
    frames.some((f) => !f.members.length || f.members.some((id) => ids.has(id)))
  )
    return source;
  const metadata = {
    version: 4,
    nodes: Object.fromEntries(
      frames.map((f) => [f.id, { frame: true, members: f.members }]),
    ),
  };
  return [
    ...flat,
    ...frames.map((f) => `${f.id}["${encode(f.label)}"]`),
    `%% board-layout: ${JSON.stringify(metadata)}`,
  ].join("\n");
}
// A deliberately small, lossless editing contract. Other Mermaid stays editable as source.
export function parse(source) {
  const lines = expandSimpleFlowchart(flattenSubgraphs(source))
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const header = lines
    .shift()
    ?.match(/^(?:flowchart|graph)\s+(LR|RL|TD|TB|BT)$/);
  if (!header) return null;
  const model = { direction: header[1], nodes: [], edges: [] };
  const styles = [],
    linkStyles = [];
  let metadata = null;
  for (const line of lines) {
    let m;
    if (line.startsWith("%% board-layout: ")) {
      if (metadata) return null;
      try {
        const saved = JSON.parse(line.slice("%% board-layout: ".length));
        if (
          ![1, 2, 3, 4, 5].includes(saved.version) ||
          !saved.nodes ||
          typeof saved.nodes !== "object" ||
          Array.isArray(saved.nodes)
        )
          return null;
        for (const p of Object.values(saved.nodes)) {
          if (!p || typeof p !== "object") return null;
          if (saved.version === 1 || p.x !== undefined || p.y !== undefined)
            if (
              !Number.isFinite(p.x) ||
              !Number.isFinite(p.y) ||
              Math.abs(p.x) > 1e7 ||
              Math.abs(p.y) > 1e7
            )
              return null;
          if (p.frame !== undefined && p.frame !== true) return null;
          if (
            p.members !== undefined &&
            (!Array.isArray(p.members) ||
              p.members.length > 300 ||
              p.members.some((id) => typeof id !== "string"))
          )
            return null;
          if (
            p.link !== undefined &&
            (typeof p.link !== "string" ||
              p.link.length > 2048 ||
              /[\r\n]/.test(p.link) ||
              p.link.includes(String.fromCharCode(0)))
          )
            return null;
          if (p.width !== undefined || p.height !== undefined)
            if (
              !Number.isFinite(p.width) ||
              !Number.isFinite(p.height) ||
              p.width < 80 ||
              p.height < 48 ||
              p.width > 4000 ||
              p.height > 4000
            )
              return null;
        }
        for (const p of Object.values(saved.nodes)) {
          if (
            p.textAlign !== undefined &&
            !["left", "center", "right", "justify"].includes(p.textAlign)
          )
            return null;
          if (
            p.textAlignments !== undefined &&
            (!Array.isArray(p.textAlignments) ||
              p.textAlignments.length > 10000 ||
              p.textAlignments.some(
                (a) =>
                  a !== null &&
                  !["left", "center", "right", "justify"].includes(a),
              ))
          )
            return null;
        }
        if (saved.edges !== undefined) {
          if (
            !saved.edges ||
            typeof saved.edges !== "object" ||
            Array.isArray(saved.edges)
          )
            return null;
          for (const [key, e] of Object.entries(saved.edges)) {
            if (!/^\d+$/.test(key) || !e || typeof e !== "object") return null;
            if (
              e.routing !== undefined &&
              !["auto", "straight", "orthogonal"].includes(e.routing)
            )
              return null;
            if (
              e.labelWidth !== undefined &&
              (!Number.isFinite(e.labelWidth) ||
                e.labelWidth < 60 ||
                e.labelWidth > 800)
            )
              return null;
            if (
              e.waypoints !== undefined &&
              (!Array.isArray(e.waypoints) ||
                e.waypoints.length > 128 ||
                e.waypoints.some(
                  (p) =>
                    !p ||
                    !Number.isFinite(p.x) ||
                    !Number.isFinite(p.y) ||
                    Math.abs(p.x) > 1e7 ||
                    Math.abs(p.y) > 1e7,
                ))
            )
              return null;
            if (
              e.labelOffset !== undefined &&
              (!e.labelOffset ||
                !Number.isFinite(e.labelOffset.x) ||
                !Number.isFinite(e.labelOffset.y) ||
                Math.abs(e.labelOffset.x) > 1e7 ||
                Math.abs(e.labelOffset.y) > 1e7)
            )
              return null;
            for (const r of [e.fromRatio, e.toRatio])
              if (r !== undefined && (!Number.isFinite(r) || r < -1 || r > 1))
                return null;
            if (
              e.labelFontSize !== undefined &&
              (!Number.isFinite(e.labelFontSize) ||
                e.labelFontSize < 10 ||
                e.labelFontSize > 48)
            )
              return null;
            if (
              e.link !== undefined &&
              (typeof e.link !== "string" ||
                e.link.length > 2048 ||
                /[\r\n]/.test(e.link) ||
                e.link.includes(String.fromCharCode(0)))
            )
              return null;
            for (const side of [e.fromSide, e.toSide])
              if (
                side !== undefined &&
                !["top", "right", "bottom", "left"].includes(side)
              )
                return null;
          }
        }
        metadata = saved;
      } catch {
        return null;
      }
      continue;
    }
    if (
      (m = line.match(/^(\w+)\s*(\["(.*)"\]|\{\s*"(.*)"\s*\}|\(\["(.*)"\]\))$/))
    ) {
      if (model.nodes.some((n) => n.id === m[1])) return null;
      model.nodes.push({
        id: m[1],
        label: decode(m[3] ?? m[4] ?? m[5]),
        shape:
          m[4] !== undefined
            ? "diamond"
            : m[5] !== undefined
              ? "round"
              : "rect",
        fill: "#ffffff",
        stroke: "#cbd5e1",
      });
    } else if ((m = line.match(/^(\w+)\s+-->\s*(?:\|([^|]*)\|\s*)?(\w+)$/)))
      model.edges.push({ from: m[1], to: m[3], label: decode(m[2] || "") });
    else if (
      (m = line.match(
        /^style\s+(\w+)\s+fill:(#[a-fA-F0-9]{6}),stroke:(#[a-fA-F0-9]{6})$/,
      ))
    )
      styles.push(m);
    else if (
      (m = line.match(
        /^linkStyle\s+(\d+)\s+stroke:(#[a-fA-F0-9]{6})(?:,stroke-width:2px)?$/,
      ))
    )
      linkStyles.push(m);
    else return null;
  }
  for (const [, id, fill, stroke] of styles) {
    const n = model.nodes.find((n) => n.id === id);
    if (!n) return null;
    Object.assign(n, { fill, stroke });
  }
  if (
    model.edges.some(
      (e) =>
        !model.nodes.some((n) => n.id === e.from) ||
        !model.nodes.some((n) => n.id === e.to),
    )
  )
    return null;
  for (const [, index, color] of linkStyles) {
    if (!model.edges[Number(index)]) return null;
    model.edges[Number(index)].color = color;
  }
  if (metadata) {
    for (const node of model.nodes)
      if (Object.hasOwn(metadata.nodes, node.id)) {
        const p = metadata.nodes[node.id];
        if (p.x !== undefined) node.position = { x: p.x, y: p.y };
        if (p.width !== undefined)
          node.size = { width: p.width, height: p.height };
        if (p.link !== undefined) node.link = p.link;
        if (p.textAlign !== undefined) node.textAlign = p.textAlign;
        if (p.textAlignments !== undefined)
          node.textAlignments = p.textAlignments;
        if (p.frame) {
          node.shape = "frame";
          node.members = p.members || [];
        }
      }
    for (const [index, e] of Object.entries(metadata.edges || {})) {
      if (!model.edges[Number(index)]) return null;
      for (const key of [
        "routing",
        "labelWidth",
        "fromSide",
        "toSide",
        "fromRatio",
        "toRatio",
        "waypoints",
        "labelOffset",
        "labelFontSize",
        "link",
      ])
        if (e[key] !== undefined) model.edges[Number(index)][key] = e[key];
    }
  }

  try {
    validateFrames(model);
  } catch {
    return null;
  }
  return model;
}
export function serialize(model) {
  const shapes = {
    rect: ['["', '"]'],
    diamond: ['{"', '"}'],
    round: ['(["', '"])'],
    frame: ['["', '"]'],
  };
  const nodes = Object.fromEntries(
    model.nodes
      .filter(
        (n) =>
          n.position ||
          n.size ||
          n.link ||
          n.textAlign ||
          n.textAlignments ||
          n.shape === "frame",
      )
      .map((n) => [
        n.id,
        {
          ...n.position,
          ...n.size,
          ...(n.link ? { link: n.link } : {}),
          ...(n.textAlign ? { textAlign: n.textAlign } : {}),
          ...(n.textAlignments?.length
            ? { textAlignments: n.textAlignments }
            : {}),
          ...(n.shape === "frame"
            ? { frame: true, members: n.members || [] }
            : {}),
        },
      ]),
  );
  const edges = Object.fromEntries(
    model.edges
      .map((e, i) => [
        i,
        Object.fromEntries(
          [
            "routing",
            "labelWidth",
            "fromSide",
            "toSide",
            "fromRatio",
            "toRatio",
            "waypoints",
            "labelOffset",
            "labelFontSize",
            "link",
          ]
            .filter((k) => e[k] !== undefined)
            .map((k) => [k, e[k]]),
        ),
      ])
      .filter(([, e]) => Object.keys(e).length),
  );
  const newFields =
    model.nodes.some((n) => n.link) ||
    model.edges.some(
      (e) =>
        e.routing === "auto" ||
        [
          "waypoints",
          "labelOffset",
          "fromRatio",
          "toRatio",
          "labelFontSize",
          "link",
        ].some((k) => e[k] !== undefined),
    );
  const version = model.nodes.some(
    (n) => n.textAlign || n.textAlignments?.length,
  )
    ? 5
    : model.nodes.some((n) => n.shape === "frame")
      ? 4
      : newFields
        ? 3
        : model.nodes.some((n) => n.size) || Object.keys(edges).length
          ? 2
          : 1;
  const metadata =
    Object.keys(nodes).length || Object.keys(edges).length
      ? [
          `  %% board-layout: ${JSON.stringify({ version, nodes, ...(Object.keys(edges).length ? { edges } : {}) })}`,
        ]
      : [];
  return [
    `flowchart ${model.direction}`,
    ...model.nodes.map(
      (n) =>
        `  ${n.id}${shapes[n.shape][0]}${encode(n.label)}${shapes[n.shape][1]}`,
    ),
    ...model.edges.map(
      (e) => `  ${e.from} -->${e.label ? `|${encode(e.label)}|` : ""} ${e.to}`,
    ),
    ...model.nodes.map(
      (n) => `  style ${n.id} fill:${n.fill},stroke:${n.stroke}`,
    ),
    ...model.edges.flatMap((e, i) =>
      e.color ? [`  linkStyle ${i} stroke:${e.color},stroke-width:2px`] : [],
    ),
    ...metadata,
  ].join("\n");
}
export function nextId(model) {
  let i = 1;
  while (model.nodes.some((n) => n.id === `n${i}`)) i++;
  return `n${i}`;
}
export function readBoard(markdown) {
  const m = /```mermaid[^\n]*\n([\s\S]*?)```/.exec(markdown);
  return m ? m[1].trim() : null;
}
export function replaceBoard(markdown, source) {
  return markdown.replace(
    /(```mermaid[^\n]*\n)[\s\S]*?```/,
    (_, start) => `${start}${source}\n\x60\x60\x60`,
  );
}
