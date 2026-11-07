# Architecture

The Board source is the durable truth. UI selections, viewport, computed connector lanes and SVG are projections; they never become an independent document model.

| Owner | Modules | Responsibility |
|---|---|---|
| Domain | `src/domain/`, `model.js` | Frame membership, move/arrange/resize invariants, Mermaid codec and validated persisted fields |
| Workflows | `src/workflows/`, `bridge-operations.js` | Serialized persistence, failed-save state, semantic operations and bounded mutations |
| Projections | `layout.js`, `connector-projection.js`, routing/alignment | SVG geometry, port/lane separation, gaps/hops, obstacle detours and guides |
| UI | `canvas.js`, `icons.js`, `markup.js` | Intent collection, selection, source dialog and sanitized rendering |
| Adapters | `plugin.js`, `plugin-settings.js`, `note-links.js`, `desktop-clipboard.js`, `bridge-server.js`, `mcp/` | Obsidian lifecycle, file/link/clipboard, optional loopback and stdio transport |

## Invariants

- Frames are first-class objects (`shape: frame`, `members` IDs), not header bands. Membership has one authoritative list; each ordinary node belongs to at most one frame. No nesting/cycles. Frame movement includes member positions and internal manual routes. Removing a frame retains its contents.
- A layout comment is portable supplemental data. Unsupported syntax remains source-only rather than being flattened destructively. Basic subgraphs are converted to explicit frame membership. Generic Mermaid cannot restore interactive geometry.
- Snap targets and guides use world coordinates; screen-space tolerance scales with zoom. Resizing moves the dragged edge, holding its opposite fixed. Alignment is deliberate and may supersede grid positions.
- UI and MCP use the same frame, movement and arrangement domain operations. All persistence uses guarded Vault APIs. A failed save remains a failed flush. Recovery creates a new file rather than overwriting the conflicting original.
- External writes serialize per path, validate against disk revisions, and acquire in-memory Board session guards before writing. Async validation cannot authorize replacing newer UI edits. Dirty/conflicting views block external edits.
- Positions/manual routes belong to source. Automatic ports, lanes, gaps/hops and collision adjustments are derived. Explicit manual ratios and routes are not rewritten for visual convenience.
- Domain modules import no DOM, Obsidian, AI, filesystem or network adapters. A CI check enforces that rule. There is no model-provider integration or telemetry.

## Lifecycle and privacy

Each mount owns its AbortController, ResizeObserver, animation-frame work and save queue. FileView flushes before replacement/unload. Plugin lifecycle owns settings/recovery and the optional bridge; guarded startup cleans up a listener if credential creation fails or the plugin unloads during startup. Clipboard access is deliberate, not polled.

MCP defaults off. Note content access requires separate opt-in. Credentials rotate and are never logged. Private settings, recovery, boards and research evidence are excluded from the repository. Public tests use synthetic fixtures.

## Deliberate limits

This is a small JavaScript codebase, not a new generic framework. The UI module is still sizeable; the durable frame/arrangement rules, save workflow, connector projection and desktop capabilities have been separated where correctness changes independently. Source changes plus undo history are the local action record; no separate analytics/event ledger duplicates document truth. More UI extraction should follow concrete ownership pressure.

Initial public support is desktop-only. Mobile, optimal dense-graph routing, nested frames and complete cross-app clipboard adapters need their own verification before being advertised. See `docs/adr/0001-board-ownership.md` and `docs/RELEASE_READINESS.md`.
