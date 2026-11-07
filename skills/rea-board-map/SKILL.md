---
name: rea-board-map
description: Create and edit Mermaid idea maps in the user's Obsidian Board tool using the rea-board MCP bridge. Use for brainstorming, study/concept/mechanism maps, decision trees, project maps, comparisons, selected-branch expansion, and source-grounded maps linked to vault notes. Not for generic Obsidian note formatting.
---
# Obsidian Board mapping

Use `rea-board` MCP tools to create and revise local `.board` files. The assistant performs the thinking; Board is a local visual editor, with no embedded model client or provider API keys.

Read `board_get_capabilities` at the start of a mapping task. It defines current model fields, map patterns, and editable versus source-only diagram types. If tools are not available in this chat, use the project's tested `mcp/call.mjs` helper against the same MCP server. Do not treat filesystem writes as proof that a live board was updated.

## Choose a useful map

- Brainstorming: radial or tree, short topic labels, a few meaningful categories before detail.
- Learning/medical mechanisms: concept or mechanism, explicit relationship labels, causes/intermediates/effects, and source links. Do not imply a generated medical relationship is established evidence.
- Differential or decision work: decision tree with labeled criteria and outcomes. Preserve uncertainty and missing evidence.
- Project planning: goals, deliverables, dependencies and next actions; link details/tasks to existing notes instead of duplicating a task engine.
- Comparisons: alternatives against consistent criteria, with tradeoffs made visible.
- Timelines, sequence interactions, class/state/entity diagrams: use the corresponding native Mermaid source when the request needs it. These render in Board but can be source-only. Do not promise drag editing for unsupported syntax.

Prefer an editable flowchart arranged as a mind map when the user wants free layout, resizing, manually routed connectors, or direct editing. A Mermaid `mindmap` is a different source-only diagram type; use it when specifically requested or when its natural hierarchy is sufficient.

## Ground and build

Search relevant note titles with `board_search_notes`; read only needed source excerpts with `board_read_note`. Get actual headings/block IDs with `board_note_targets` before storing specific links. User-provided links can be used directly. Do not invent note names, citations or block identifiers.

Create with `board_create`, using a structured map for a simple hierarchy or Mermaid source for richer cross-links/diagram types. Keep labels concise; deeper explanation belongs in linked notes. Color should communicate branch/category/meaning, not decorate every node differently. Avoid crowding; split a large map into linked boards when necessary.

For an existing board, read it first and use the returned `revision` in every write. `board_apply` performs semantic edits; `board_expand_branch` appends a bounded branch. If the user says “expand this,” inspect `board_read.selection` for a single selected node; use the explicit node when supplied. Preserve unrelated branches, manual waypoints, label positions, colors and links. Re-read on a revision conflict and reassess; do not retry stale writes blindly. Use `board_replace_source` only for a requested whole-map transformation.

After writing, read the board back, check node/edge counts and the intended relationships, and open it with `board_open` when useful. Report the board path and any meaningful source-only limitation. The MCP bridge must not be represented as live-tested unless a real call succeeds.

## Implementation reference

Read [bridge-and-storage.md](references/bridge-and-storage.md) only for setup, command-line fallback, exact storage details, or diagnosing bridge availability. Runtime capabilities and tool schemas are the authoritative field reference.

## Avoid the failures seen in large maps

- Every semantic operation needs `type`. Use the schema's supported operation variants and preserve `expectedRevision`. On conflict, re-read the actual board and reassess before saving.
- Use `create_frame` for genuine containers. Arrange members or whole frames deliberately; never select a frame and its members together for an arrangement operation. Spatial header bands are not containers.
- Separate independent relationships. Use distinct attachment ratios, staggered waypoints, generous gutters and short labels. Automatic spacing and crossing hops help readability, but do not imply merged lines are a shared causal chain. Preserve user-authored manual routes; inspect crowded areas rather than trusting node/edge counts.
- Run a visual inspection after writing when a browser/native inspection surface is available. Check at a readable zoom: labels, arrow direction, crossing ambiguity, lanes, whitespace, frame membership and whether all intended areas can be reached. If no screenshot inspection occurred, say so explicitly; do not claim visual usability was verified.
- Learning maps should follow prerequisites and mechanisms when that is the requested organizing principle. Preserve major requested content areas and distinguish causal, associative and hierarchical links. Do not add quiz labels unless requested. Never claim exhaustive exam coverage from a concept map; practical image/specimen work requires its own sources and activities.
- Correct the meaning before polishing the layout. Verify technical terms and relationship direction from the supplied sources; flag uncertain relationships. The earlier EDPVR terminology correction is a reason to verify context, not a universal rule to reuse a particular medical explanation.

## Color deliberately

Use a restrained palette when it improves comprehension: for example, violet for the central question, blue for prerequisites/evidence, green for mechanisms or outcomes, amber for decisions/uncertainty, and rose for cautions. Adapt these meanings to the task rather than treating them as a fixed ontology. Keep related nodes consistent, use connector colors to distinguish independent paths when crowded, and keep enough contrast against Ivory/Ice/Sage paper and dark mode. Use labels, grouping and route separation too; color alone must not carry meaning. Preserve user-chosen colors and never recolor unrelated branches merely to match a new palette.

## Readable layout clearance

Reserve dedicated connector gutters between groups; measure wrapped label bounds, not just node centers. Leave enough space for the entire connector phrase plus padding between boxes. Route cross-group relationships outside frames with separate lanes; place labels beside their own routes, clear of nodes, frame titles and other labels. A frame must own its explicit members and leave header padding. Inspect a representative dense section at a readable zoom, then the overall map. Fix collisions by spacing/routing before reducing font size. Preserve all concepts and relationship text during a layout-only cleanup; save a recoverable pre-edit copy and use revision-guarded edits.

## Concise, formatted labels

When requested, use short labels and a personal character target as a writing aid, never an automatic truncation rule. The optional counter is a soft UI preference. Preserve Markdown `**bold**`, `*italic*`, `==highlight==`, `[[Note|alias]]` and `[label](https://...)` in label source. Use consistent numbering for lists. `textAlign` is a node default; `textAlignments` is an array of left/center/right/justify values per source paragraph. Keep important text visible by fitting or resizing the shape before reducing text size. An overflow ellipsis indicates retained source, not removed content.
