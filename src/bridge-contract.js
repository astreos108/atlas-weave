import { MAP_PATTERNS } from "./map-patterns.js";
const str = { type: "string" },
  path = {
    type: "string",
    description: "Vault-relative .board path. Never an absolute path.",
  },
  revision = {
    type: "string",
    description:
      "SHA-256 revision returned by board_read. Required to prevent overwriting newer edits.",
  };
const schema = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const BRIDGE_CAPABILITIES = {
  version: "0.8.0",
  storage:
    "Plain Mermaid .board files, geometry/link metadata in Mermaid comments. No embedded AI or provider API keys.",
  patterns: MAP_PATTERNS,
  editableDiagram: "flowchart",
  sourceOnlyDiagrams: [
    "mindmap",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "gantt",
    "timeline",
    "pie",
    "journey",
  ],
  nodeFields: [
    "id",
    "label",
    "shape",
    "fill",
    "stroke",
    "position",
    "size",
    "link",
    "members",
    "textAlign",
    "textAlignments",
  ],
  edgeFields: [
    "from",
    "to",
    "label",
    "color",
    "routing",
    "fromSide",
    "toSide",
    "fromRatio",
    "toRatio",
    "waypoints",
    "labelOffset",
    "labelWidth",
    "labelFontSize",
    "link",
  ],
  frames:
    "shape=frame with explicit members IDs. Move via move_nodes to include members/internal routes. Removing a frame preserves contents; no nested frames.",
  arrangement: [
    "left",
    "center",
    "right",
    "top",
    "middle",
    "bottom",
    "distribute-x",
    "distribute-y",
  ],
  routing: ["auto", "straight", "orthogonal"],
  linkTargets:
    "Native Obsidian note, note#Heading, or note#^block-id. .board links navigate through Obsidian; they do not automatically become indexed Markdown backlinks.",
  rules: [
    "Read and use expectedRevision before every existing-board mutation.",
    "Expand a selected branch with board_expand_branch or board_apply; preserve unrelated nodes and manual routes.",
    "Use source replacement for whole-diagram changes, not routine branch edits.",
    "Read notes only when relevant to the user request.",
    "Return sources and mark uncertain/generated relationships explicitly.",
  ],
};
const operation = (type, properties, required = []) => ({
  type: "object",
  properties: { type: { const: type }, ...properties },
  required: ["type", ...required],
  additionalProperties: false,
});
const operationSchema = {
  oneOf: [
    operation("add_node", { node: { type: "object" } }, ["node"]),
    operation("update_node", { id: str, changes: { type: "object" } }, [
      "id",
      "changes",
    ]),
    operation("remove_node", { id: str }, ["id"]),
    operation("add_edge", { edge: { type: "object" } }, ["edge"]),
    operation(
      "update_edge",
      { index: { type: "integer", minimum: 0 }, changes: { type: "object" } },
      ["index", "changes"],
    ),
    operation("remove_edge", { index: { type: "integer", minimum: 0 } }, [
      "index",
    ]),
    operation(
      "move_nodes",
      {
        ids: { type: "array", items: str },
        dx: { type: "number" },
        dy: { type: "number" },
      },
      ["ids", "dx", "dy"],
    ),
    operation(
      "create_frame",
      { id: str, label: str, ids: { type: "array", items: str, minItems: 1 } },
      ["id", "ids"],
    ),
    operation("remove_frame", { id: str }, ["id"]),
    operation(
      "arrange",
      {
        ids: { type: "array", items: str, minItems: 2 },
        mode: { type: "string", enum: BRIDGE_CAPABILITIES.arrangement },
      },
      ["ids", "mode"],
    ),
  ],
};
export const BRIDGE_TOOLS = [
  {
    name: "board_get_capabilities",
    description:
      "Read Board features, map patterns, data fields, diagram-type limits and editing rules.",
    inputSchema: schema({}),
  },
  {
    name: "board_list",
    description: "Find saved boards in this vault.",
    inputSchema: schema({
      query: str,
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
  },
  {
    name: "board_read",
    description:
      "Read Mermaid, editable model, revision, and any active selection for a board.",
    inputSchema: schema({ path }, ["path"]),
  },
  {
    name: "board_create",
    description:
      "Create a new board from Mermaid source or a structured map. Existing files are never overwritten.",
    inputSchema: schema(
      {
        path,
        source: str,
        map: {
          type: "object",
          description:
            "{kind: radial|tree|concept|decision|project|mechanism|comparison, root: string, branches: [{label, relationship?, link?, children?: [...]}]}",
        },
        open: { type: "boolean" },
      },
      ["path"],
    ),
  },
  {
    name: "board_apply",
    description:
      "Atomically apply semantic node/edge edits. Every operation requires a type discriminator, for example {type: update_node, id, changes}. Operations: create_frame {id,label?,ids}, remove_frame {id}, arrange {ids,mode}, add_node {node}, update_node {id,changes}, remove_node {id}, add_edge {edge}, update_edge {index,changes}, remove_edge {index}, move_nodes {ids,dx,dy}. Indices refer to the current model, processed in order.",
    inputSchema: schema(
      {
        path,
        expectedRevision: revision,
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 300,
          items: operationSchema,
        },
      },
      ["path", "expectedRevision", "operations"],
    ),
  },
  {
    name: "board_expand_branch",
    description:
      "Append an assistant-proposed branch under one existing node, preserving the rest of the map and its manual layout. The assistant generates the content; Board does not call an AI model.",
    inputSchema: schema(
      {
        path,
        expectedRevision: revision,
        parentId: str,
        branches: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            description: "{label, relationship?, link?, children?}",
          },
        },
        radial: { type: "boolean" },
      },
      ["path", "expectedRevision", "parentId", "branches"],
    ),
  },
  {
    name: "board_replace_source",
    description:
      "Replace a whole board with validated Mermaid using a revision guard. Prefer semantic operations for local edits.",
    inputSchema: schema({ path, expectedRevision: revision, source: str }, [
      "path",
      "expectedRevision",
      "source",
    ]),
  },
  {
    name: "board_open",
    description: "Open a saved board in its native Obsidian Board view.",
    inputSchema: schema({ path }, ["path"]),
  },
  {
    name: "board_search_notes",
    description:
      "Find Markdown notes by title/path and metadata aliases. Does not read unrelated note contents.",
    inputSchema: schema(
      { query: str, limit: { type: "integer", minimum: 1, maximum: 100 } },
      ["query"],
    ),
  },
  {
    name: "board_note_targets",
    description:
      "List the whole-note, heading and explicit block targets of one Markdown note.",
    inputSchema: schema(
      { path: { type: "string", description: "Vault-relative .md path." } },
      ["path"],
    ),
  },
  {
    name: "board_read_note",
    description:
      "Read a bounded slice of a relevant Markdown note for a source-grounded map.",
    inputSchema: schema(
      {
        path: { type: "string" },
        startLine: { type: "integer", minimum: 1 },
        lineCount: { type: "integer", minimum: 1, maximum: 500 },
      },
      ["path"],
    ),
  },
];
