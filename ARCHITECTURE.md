# Architecture

The Board source is the durable truth. UI selections, viewport, computed connector lanes and SVG are projections; they never become an independent document model.

| Owner | Modules | Responsibility |
|---|---|---|
| Domain | `src/domain/`, `model.js`, `text-format.js` | Frame membership, move/arrange/resize invariants, Mermaid codec and validated persisted fields |
| Workflows | `src/workflows/`, `bridge-operations.js` | Serialized persistence, failed-save state, semantic operations and bounded mutations |
| Projections | `layout.js`, `connector-projection.js`, `grid.js`, routing/alignment | SVG geometry, port/lane separation, gaps/hops, obstacle detours and guides |
| UI | `canvas.js`, `src/board/`, `text-editor.js`, `rich-text-surface.js`, `icons.js`, `markup.js` | Intent collection, selection, source dialog and sanitized rendering |
| Adapters | `plugin.js`, `plugin-settings.js`, `note-links.js`, `desktop-clipboard.js`, `bridge-server.js`, `mcp/` | Obsidian lifecycle, file/link/clipboard, optional loopback and stdio transport |

## Invariants

- Frames are first-class objects (`shape: frame`, `members` IDs), not header bands. Membership has one authoritative list; each ordinary node belongs to at most one frame. No nesting/cycles. Frame movement includes member positions and internal manual routes. Removing a frame retains its contents.
- A layout comment is portable supplemental data. Unsupported syntax remains source-only rather than being flattened destructively. Basic subgraphs are converted to explicit frame membership. Generic Mermaid cannot restore interactive geometry.
- Snap targets and guides use world coordinates; screen-space tolerance scales with zoom. Resizing moves the dragged edge, holding its opposite fixed. Alignment is deliberate and may supersede grid positions.
- UI and MCP use the same frame, movement and arrangement domain operations. All persistence uses guarded Vault APIs. A failed save remains a failed flush. Recovery creates a new file rather than overwriting the conflicting original.
- External writes serialize per path, validate against disk revisions, and acquire in-memory Board session guards before writing. Async validation cannot authorize replacing newer UI edits. Dirty/conflicting views block external edits.
- Positions/manual routes belong to source. Automatic ports, lanes, gaps/hops and collision adjustments are derived. Explicit manual ratios and routes are not rewritten for visual convenience.
- Domain modules import no DOM, Obsidian, AI, filesystem or network adapters. A CI check enforces that rule. There is no model-provider integration or telemetry.

The board mount in `canvas.js` composes the UI modules under `src/board/` and owns the live document, history, save queue, and public lifecycle. UI modules use the mount's existing mutation path and receive only the state and operations their feature needs. They do not write to the vault or keep a second board document.

| Board module | Responsibility |
|---|---|
| `card-editor.js` | Table, code, and equation drafts, controls, and overlay cleanup |
| `source-dialog.js` | Source dialog, validation, and file import dispatch |
| `clipboard-controller.js` | Clipboard formats, paste placement, and exports |
| `preferences.js` | Applying theme, paper, grid, snapping, and text preferences |
| `text-session.js` | Inline editing, draft snapshots, and restoring the editor on reopen |
| `viewport.js` | Coordinate conversion, pan and zoom, fit, and presentation |
| `selection-controls.js` | Selection highlighting, controls, and toolbar actions |
| `connector-interactions.js` | Connector creation, previews, and route edits |
| `pointer-interactions.js` | Pointer capture, queued movement, completion, and cancellation |

## Lifecycle and privacy

Each mount owns its AbortController, ResizeObserver, animation-frame work and save queue. FileView flushes before replacement/unload. Plugin lifecycle owns settings/recovery and the optional bridge; guarded startup cleans up a listener if credential creation fails or the plugin unloads during startup. Clipboard access is deliberate, not polled.

MCP defaults off. Note content access requires separate opt-in. Credentials rotate and are never logged. Private settings, recovery, boards and research evidence are excluded from the repository. Public tests use synthetic fixtures.

## Deliberate limits

This is a small JavaScript codebase, not a new generic framework. The UI module is still sizeable; the durable frame/arrangement rules, save workflow, connector projection and desktop capabilities have been separated where correctness changes independently. Source changes plus undo history are the local action record; no separate analytics/event ledger duplicates document truth. More UI extraction should follow concrete ownership pressure.

Initial public support is desktop-only. Mobile, optimal dense-graph routing, nested frames and complete cross-app clipboard adapters need their own verification before being advertised. See `docs/adr/0001-board-ownership.md` and `docs/RELEASE_READINESS.md`.

## Text ownership

Markdown label source and paragraph alignments are durable. Rich SVG runs, wrapping and overflow are projections. The editor owns a transient draft, cursor and local undo stack; blur does not imply commit. Obsidian's adapter caches active editor sessions by Board path while navigation saves the draft. Character targets are preferences, never content validation constraints. Version 5 metadata distinguishes alignment from earlier codecs so older releases cannot silently strip it. Inline links use explicit user navigation; rendered labels never load external images or execute HTML.

The rich surface is an allowlisted DOM/Markdown seam: marks, text and link destinations are serialized back to the label; pasted HTML is never mounted. Source-offset mappings restore DOM selection across live normalization and navigation. The editable surface shares the shape's SVG world coordinates; transient tools remain screen-space overlays. Connector magnets use raw pointer coordinates and a bounded screen-pixel tolerance before any grid fallback; only committed attachment ratios/routes enter document truth.

Math labels keep TeX delimiters and source in Mermaid. `math-source.js` owns delimiter recognition, `math-text.js` projects mixed text/equations into a bounded SVG foreignObject, and only the Obsidian adapter loads MathJax and calls its public rendering API. Geometry changes reuse the formula projection; label changes invalidate it. Missing/failed rendering retains literal source. Equation editing exposes TeX in place; the web demo has a literal-source fallback. Clipboard exports inline math layout styles and use self-contained data images so Chromium can rasterize foreignObject content without tainting the PNG canvas.

Ordinary typing and replacement events retain native text nodes, allowing macOS substitutions to complete. Markdown normalization only replaces DOM when the projection changes, and composition owns its keyboard events until completion. We do not read or duplicate the user's system replacement dictionary.

Connector handles translate pointer gestures into one board change. `thought-placement.js` resolves a collision-free box for both the hover or drop preview and the committed thought. Route previews and committed edges share geometry and obstacle routing in `connector-geometry.js`. A center attachment uses the existing zero ratio with no fixed side, so the facing edge is derived as shapes move. Explicit sides and manual waypoints remain part of the saved route. Preview shapes and routes live only in the canvas overlay.

Board presentation uses the light and dark token blocks at the top of `styles.css`. `appearance.js` owns saved swatch mappings, shape ink selection, and board paper presets. Frame preview and editor inherit the same frame ink token. Connector lines, markers, and controls resolve the same palette mapping without storing theme colors in Mermaid.

The inline link picker reads an unfinished wikilink at the editor's caret and replaces that source range on selection. The Obsidian adapter searches note metadata and reads paragraph text only for block suggestions in the chosen note. Creating a paragraph anchor uses the Vault API with a full snapshot check before writing. Same-board links store a shape ID in a reserved `@shape:` target and resolve through the board view. A shape's toolbar link remains separate from the links in its text.
