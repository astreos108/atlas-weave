# Changelog

## 0.9.1 — Atlas Weave

- Renamed the product to Atlas Weave and introduced its visual learning and thinking positioning.
- Acknowledged inspiration from visual tools including Whimsical, Miro, and others, with an explicit independent-project statement.
- Preserved existing plugin, view, storage, and MCP configuration identifiers for upgrade compatibility.
- Renamed the public repository and protected main with required pull requests, CI, and resolved conversations; force pushes/deletion are blocked with no bypass actors.

## 0.9.0 — live writing and connector guides

- Replaced the white Markdown field with a transparent, live rich editor inside the shape. Formatting and links render while editing; Mermaid retains Markdown source.
- Made frame-title editing local to the title area and kept per-paragraph alignment live.
- Added a small link-target editor, sanitized plain-text paste, selection restoration, IME handling and editor-local undo.
- Verified auto-fit changes both width and height without moving neighboring shapes.
- Added teal connector route/label guides and small midpoint/quarter-point attachment magnets, independent from grid rounding. Alt bypasses guides and magnets.
- Count visible characters in the optional writing counter.

## 0.8.0 — writing and stable grid levels

- Added an optional grapheme character counter with an adjustable soft target; it never blocks typing.
- Made the inline editor fill its shape, with expandable overflow and bounded labels that retain their complete Mermaid text.
- Added inline bold, italic, highlight, code, wiki links and web links, consistent numbered/bullet lists, selection wrapping, and text undo/redo.
- Added left/center/right/justify alignment per source paragraph, saved in version 5 metadata.
- Double-click selected borders or handles to fit a shape to its text. Empty frame interiors create a new member; only the header edits the frame title.
- Kept editing sessions open on blur and restored drafts/cursor selections when navigating away and back within the same Obsidian session.
- Replaced changing grid strides with fixed 20/100/500-unit levels sharing one world origin.

## 0.7.0 — first public release

- Added hex paper colors with Ivory/Ice/Sage shortcuts, zoom-scaled dots and task-appropriate skill color guidance. Simplified border resizing, stabilized detours against unrelated shapes and kept connector labels above crossing lines.
- Gave More actions distinct icons and added a quiet optional Ko-fi support action.
- Introduced durable frames, membership-aware movement, side resizing and align/distribute controls.
- Added editable import of basic non-nested subgraphs, automatic connector port/lane separation, endpoint gaps and crossing hops.
- Flattened SVG projection coordinates to keep left quick-add and existing geometry stable.
- Made external MCP and note reads opt-in; added native searchable settings and optional Ko-fi support.
- Fixed failed-flush/conflict handling, guarded in-memory external writes and added separate-file draft recovery.
- Scoped plugin CSS, sanitized generated markup and upgraded vulnerable dependencies.
- Added public architecture/security/contributing documentation, portable tests, official lint, reproducibility checks and attested CI releases.

## Local prototypes before public release

These were local development iterations, not historical public GitHub releases:

- 0.6: smoother movement, grid phase fix, guides, direct paste, PNG/SVG clipboard, floating rename and offscreen recovery.
- 0.5: adjustable/reconnectable connectors, native note targets, external MCP and mapping skill.
- 0.4: resize, multi-selection, connector styling, orthogonal routing and paste import.
- 0.3: direct editing/connecting, compact contextual controls and themes.
- 0.2: free positioning and native `.board` files.
- 0.1: local Mermaid board prototype and public-page interface research.
