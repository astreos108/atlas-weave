# Bridge and storage contract

Use the user's actual checkout and vault paths. Do not infer a particular vault layout.

1. Install REA Board in Obsidian. Enable **External MCP bridge** in its settings. Enable **Allow MCP note reading** only if the mapping task needs note excerpts.
2. Install the checkout's Node dependencies with `npm ci`.
3. Configure the assistant to run `node /path/to/rea-board/mcp/server.mjs --bridge-file /path/to/vault/CONFIG_DIR/plugins/rea-whimsical/bridge.json`. `CONFIG_DIR` is the vault's configured directory; `.obsidian` is only its default. The legacy plugin ID stays stable for existing boards/installations.
4. The credential is generated only when enabled, rotates on startup, and is deleted on shutdown. Never print, commit or put it into a prompt.

Fallback if this chat has not discovered the MCP tools:

```sh
REA_BOARD_BRIDGE_FILE='/path/to/vault/CONFIG_DIR/plugins/rea-whimsical/bridge.json' node /path/to/rea-board/mcp/call.mjs board_get_capabilities '{}'
```

Read `board_get_capabilities` and tool schemas rather than assuming feature availability. Every `board_apply.operations` entry needs a **`type` discriminator**. Example:

```json
{"path":"Maps/example.board","expectedRevision":"REVISION_FROM_READ","operations":[{"type":"update_node","id":"a","changes":{"label":"Revised idea"}},{"type":"create_frame","id":"group1","label":"Mechanism","ids":["a","b"]},{"type":"arrange","ids":["a","b"],"mode":"left"}]}
```

Native frames are `shape: frame` with explicit `members`. `move_nodes` on a frame moves its members and their internal routes. Removing a frame preserves contents. Frames cannot nest. Simple non-nested Mermaid subgraphs can import as editable frames; unsupported subgraph constructs remain source-only. Do not replace frames with decorative header bands and claim equivalent behavior.

Storage is plain Mermaid in `.board` files. Version 4 `%% board-layout:` comments add frame membership; version 5 adds `textAlign` and `textAlignments` for source paragraphs. Earlier versions remain supported. Basic inline Markdown remains in the label string. Coordinates, dimensions, connector routing intent, manual waypoints, label offsets and links are durable. Generated port spacing, line jumps, gaps and obstacle detours are projections, not extra causal relationships. Generic Mermaid renders the underlying graph using its own layout and does not reproduce Board geometry or native frame behavior.

Read before writes; use `expectedRevision`; re-read after conflicts. Failed UI saves prevent bridge writes and are retained for recovery from plugin settings. External writes are serialized per board and guard both memory and disk revisions. Never delete or overwrite a conflicting draft to make a write succeed.

Notes, headings and block links navigate through Obsidian. `.board` links do not yet participate in automatic Markdown backlink indexing or note-rename rewriting. MCP is desktop-only and opt-in. The assistant's external model provider may receive the content the user asks it to use; Board itself has no model client or provider API keys.
