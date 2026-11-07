# Whimsical release review and Board backlog

Reviewed **108 entries across all 11 archive pages**, 2023.1–2026.13, on 2026-11-07. Sources: [archive](https://whimsical.com/releases), [2026/2025](https://whimsical.com/releases/2), [2025/2024](https://whimsical.com/releases/3), [2024](https://whimsical.com/releases/4), [2024 continued](https://whimsical.com/releases/5), [2024 foundation](https://whimsical.com/releases/6), [2023 paste](https://whimsical.com/releases/7), [2023 text](https://whimsical.com/releases/8), [2023 objects](https://whimsical.com/releases/9), [2023 rename](https://whimsical.com/releases/10), [2023 image copy](https://whimsical.com/releases/11). This is an original implementation and product review, not access to Whimsical internals.

## Implemented foundation in 0.6

- Grid dots and snapping share the same world origin, including pan/zoom. New dimensions use 40-unit multiples around 20-unit center points. Existing saved geometry stays intact; Alt temporarily disables snapping and guides.
- Red temporary edge/center guides, screen-pixel tolerance, preserved group spacing.
- Frame-coalesced pointer work; positioned edits bypass Mermaid layout. Eased fit/zoom/presentation, subtle popovers and reduced-motion support. Direct manipulation follows the pointer rather than animating behind it.
- Compact selection frame, corner resizers and centered connection ports. Selection toolbar sits above the bounds and quick-add handles, or below when necessary.
- Four-direction quick add, floating rename using Obsidian's file manager, offscreen recovery button and Cmd/Ctrl+0.
- Additive Mermaid paste, selected-subgraph Mermaid copy, context-menu paste at cursor, plain text and safe HTML text fallback. File import opens a file chooser.
- Selection-aware PNG clipboard (Cmd/Ctrl+Shift+C) and SVG copy (context menu/More, or Cmd/Ctrl+Alt+Shift+C). Theme colors, fonts and arrow markers are embedded; editing controls are excluded. PNG uses up to 2× resolution, bounded to 8192 pixels.
- Rounded elbows and a basic obstacle detour heuristic. Manual routes remain authoritative. This is not a general optimal-routing solver.
- Unicode/emoji labels and composition-safe Enter handling. Use the OS emoji picker; a colon-search emoji UI is not included.

## Clipboard compatibility: actual contract

| Input | Current behavior | Remaining work |
|---|---|---|
| Board / Mermaid flowchart | Editable nodes/edges; positions, styles and routes survive Board copies | More Mermaid constructs such as subgraphs |
| Other Mermaid types | Render/source-edit in an empty board; refuses to overwrite existing flowchart content | Native editable sequence/mindmap models |
| Plain/rich text | Editable text shape; editor paste remains normal | Outline/list-to-map and richer formatting |
| Excalidraw JSON clipboard | Rectangles, diamonds, ellipses, text, bound connectors; explanatory omission notice | Freehand, rotations, images and unbound connectors |
| tldraw JSON records | Basic geo/text shapes | Compressed clipboard, full binding/rotation/style adapters |
| SVG from other apps | Editable basic rectangles, circles, ellipses and text | Complex paths, images, connectors and exact transforms |
| Canva, FigJam, Lucidchart, Lucidspark, Miro, Mural, Visio | SVG/text paths above when available | Dedicated native clipboard fixtures and adapters; **not universal editable paste yet** |
| Raster-only clipboard | Explicit unsupported-format notice, no destructive replacement | Local vault image assets + image-node model |

No images, paths or private formats are silently advertised as fully editable imported diagrams. Importing SVG extracts supported geometry only; it never inserts SVG scripts, event handlers, external resources or HTML into the live board.

## Prioritized future iterations

1. **Cross-app import fidelity:** capture real clipboard fixtures for every named app; native format adapters with per-format round-trip/omission tests; preserve groups, bindings, sizes, labels and rotations. Start Excalidraw/tldraw, then FigJam/Miro/Lucid, then Canva/Mural/Visio. Add complex SVG connectors and local image assets as fallback.
2. **Routing:** visibility-graph obstacle avoidance, lane/segment snapping, connector-to-connector joins, parallel-edge spacing, label collision avoidance, arrowhead/dash/weight options, independent label colors. Preserve manual routes when neighboring shapes move.
3. **Arrangement:** resize-time alignment guides, equal-gap hints, align/distribute commands, match-size, layer order, true groups, lock objects and selection filtering. Keep explicit commands distinct from reset-to-layout.
4. **Keyboard/navigation:** command palette, board text search, minimap, saved viewport per file, keyboard nudge, selection focus, accessible shortcuts/help and touch/trackpad tuning.
5. **Text:** inline emphasis/lists, adjustable shape font size, custom hex colors/remembered colors, searchable emoji/icons, code blocks and CJK/IME/grapheme/RTL coverage.
6. **Obsidian integration:** indexed backlinks, safe note-rename rewrites, block previews and transclusion, Markdown Board embeds and source anchors, file history/conflict review. Reuse native notes rather than building another document system.
7. **Project mapping:** collapsible branches and optional lightweight sections/frames; preserve internal relationships on move/resize. Retain the existing external MCP patterns for decisions, mechanisms, concepts and project maps.
8. **MCP:** focused auto-layout/arrange operations, explicit selection resources, safe rename/move, source evidence links, richer import capabilities and response receipts. Keep AI external; no provider keys or in-board AI chat.
9. **Export:** transparent/background controls, pixel scale, direct SVG MIME compatibility, PDF/print, multi-region export and portable linked attachments. Add real target-app paste tests beyond clipboard MIME checks.
10. **Scale/reliability:** spatial indexes, visible-region rendering, text-measure caches, performance budgets on 100/300-node boards, recovery snapshots, external-edit merges and automated mobile verification.

Out of scope: templates, sticky notes, wireframes/lo-fi drawing, Kanban/task-management duplication, cloud accounts/teams/billing, live multiplayer, notification systems, and embedded AI. Native Obsidian tabs, vault files, links and external MCP already cover much of the relevant platform work.

## Complete release disposition

Each published entry is accounted for below. “Deferred/out of scope” covers the product boundaries above; feature detail on the source page remains authoritative.

| Release | Published topic | Board disposition |
|---|---|---|
| 2026.13 | Paste from anywhere | Clipboard foundation; app-specific adapters remain partial |
| 2026.12 | Multi-page files | Escape cancel already present; theme-aware SVG export added |
| 2026.11 | Code blocks in Boards | Preserve MCP geometry already present; rich paste remains partial |
| 2026.10 | Better search and icons in flowcharts | Unicode emoji works; icon picker later |
| 2026.9 | Dark mode | Light/dark already present |
| 2026.8 | Ask Whimsical | Deferred/out of scope for the current Board foundation |
| 2026.7 | Elbow connector improvements | Rounded smart elbows and compact selection controls |
| 2026.6 | Copy as SVG and Linux app | Selected SVG copy and hover feedback |
| 2026.5 | Whiteboard in ChatGPT | External MCP already present |
| 2026.4 | Flowchart auto-layout | Auto layout already present; improve collision engine later |
| 2026.3 | MCP for coding agents | MCP/Mermaid copy already present |
| 2026.2 | Command menu, better connectors, and custom colors | Endpoint handles already present; custom colors/command menu later |
| 2026.1 | Tabbed folders and scrollbars in Boards | Four-direction quick add; recovery navigation |
| 2025.11 | Full emoji support for comment reactions | Deferred/out of scope for the current Board foundation |
| 2025.10 | Collapsible headings and toggle lists | Deferred/out of scope for the current Board foundation |
| 2025.9 | Export multiple frames as a single zip file | Deferred/out of scope for the current Board foundation |
| 2025.8 | Recent improvements | Deferred/out of scope for the current Board foundation |
| 2025.7 | File upload improvements | Deferred/out of scope for the current Board foundation |
| 2025.6 | Recent improvements | Deferred/out of scope for the current Board foundation |
| 2025.5 | Change existing teams to open or private | Deferred/out of scope for the current Board foundation |
| 2025.4 | Desktop app for Windows | Deferred/out of scope for the current Board foundation |
| 2025.3 | File uploads | Deferred/out of scope for the current Board foundation |
| 2025.2 | New mention menu | Deferred/out of scope for the current Board foundation |
| 2025.1 | Desktop app icon notification badge | Deferred/out of scope for the current Board foundation |
| 2024.36 | Paste tables into Whimsical from your favorite spreadsheet app | Deferred/out of scope for the current Board foundation |
| 2024.34 | Some things have moved! | Floating filename, compact actions; search/history later |
| 2024.35 | New warnings and controls when editing color themes | Deferred/out of scope for the current Board foundation |
| 2024.32 | Board tables—rebuilt from the ground up | Deferred/out of scope for the current Board foundation |
| 2024.33 | New Slack notifications | Deferred/out of scope for the current Board foundation |
| 2024.31 | Granular notification preferences | Deferred/out of scope for the current Board foundation |
| 2024.30 | Notification inbox | Deferred/out of scope for the current Board foundation |
| 2024.29 | SAML session expiration notices | Deferred/out of scope for the current Board foundation |
| 2024.27 | AVIF Image Support in Boards and Docs | Deferred/out of scope for the current Board foundation |
| 2024.28 | Dark sidebar | Deferred/out of scope for the current Board foundation |
| 2024.26 | ERD endpoints for connectors | Deferred/out of scope for the current Board foundation |
| 2024.25 | Desktop app for macOS | Deferred/out of scope for the current Board foundation |
| 2024.24 | Code blocks in text objects | Deferred/out of scope for the current Board foundation |
| 2024.23 | Request File Access | Deferred/out of scope for the current Board foundation |
| 2024.22 | User offboarding | Deferred/out of scope for the current Board foundation |
| 2024.21 | More detailed workspace information | Deferred/out of scope for the current Board foundation |
| 2024.20 | Custom editor upgrade instructions | Deferred/out of scope for the current Board foundation |
| 2024.19 | See comment recipients | Deferred/out of scope for the current Board foundation |
| 2024.18 | Configure SAML session timeouts | Deferred/out of scope for the current Board foundation |
| 2024.17 | Place comments anywhere on boards | Deferred/out of scope for the current Board foundation |
| 2024.16 | Create files from Google | Deferred/out of scope for the current Board foundation |
| 2024.15 | Tooltips now support color options | Deferred/out of scope for the current Board foundation |
| 2024.14 | Linear integration | Deferred/out of scope for the current Board foundation |
| 2024.13 | Annotations supercharged | Deferred/out of scope for the current Board foundation |
| 2024.12 | HashiCorp icons | Deferred/out of scope for the current Board foundation |
| 2024.11 | Table improvements in Whimsical Docs | Deferred/out of scope for the current Board foundation |
| 2024.10 | Keep the same color when adding new shapes | Remember last shape color later |
| 2024.9 | RSS feed for Product updates | Deferred/out of scope for the current Board foundation |
| 2024.8 | Image captions | Deferred/out of scope for the current Board foundation |
| 2024.7 | GitHub link improvements | Deferred/out of scope for the current Board foundation |
| 2024.6 | Present your wireframes | Deferred/out of scope for the current Board foundation |
| 2024.5 | View embedded boards as presentations | Deferred/out of scope for the current Board foundation |
| 2024.4 | A new home for product updates | Deferred/out of scope for the current Board foundation |
| 2024.3 | View your AI prompt history | Deferred/out of scope for the current Board foundation |
| 2024.2 | Our Grammarly integration is here! | Deferred/out of scope for the current Board foundation |
| 2024.1 | Our built-in emoji keyboard is here | Native Unicode supported; searchable emoji picker later |
| 2023.48 | Rotate images in boards | Deferred/out of scope for the current Board foundation |
| 2023.47 | Whimsical Diagrams GPT | Deferred/out of scope for the current Board foundation |
| 2023.46 | Sequence diagram actors | Deferred/out of scope for the current Board foundation |
| 2023.45 | Whimsical AI for sequence diagrams | Deferred/out of scope for the current Board foundation |
| 2023.44 | Paste as options that format content for you | Contextual paste added; outline-to-map later |
| 2023.43 | Improved file search when adding links | Native note target picker already present |
| 2023.42 | Filter selection | Selection filtering later |
| 2023.41 | Paste mermaid text as a flowchart | Direct automatic Mermaid paste |
| 2023.40 | File mentions and previews | Deferred/out of scope for the current Board foundation |
| 2023.39 | SCIM is now generally available for JumpCloud | Deferred/out of scope for the current Board foundation |
| 2023.38 | More text formatting options for board objects | Rich text later |
| 2023.37 | Mention teammates anywhere | Deferred/out of scope for the current Board foundation |
| 2023.36 | Text editor performance improvements | Avoid full layout for positioned edits |
| 2023.35 | Language and special character bug fixes and improvements | Composition Enter guard added; broader IME tests later |
| 2023.34 | Whimsical AI for sticky notes | Deferred/out of scope for the current Board foundation |
| 2023.33 | Remove your account photo | Deferred/out of scope for the current Board foundation |
| 2023.32 | Support for HCL syntax | Deferred/out of scope for the current Board foundation |
| 2023.31 | Summarize URLs with Whimsical AI | Deferred/out of scope for the current Board foundation |
| 2023.30 | Latest bug fixes and improvements | Group duplicate/resize already present |
| 2023.29 | Enhanced data security for org plans | Deferred/out of scope for the current Board foundation |
| 2023.28 | More consistent flowchart shape expansion | Stable text sizing already present; directional growth later |
| 2023.27 | Easy comment navigation | Deferred/out of scope for the current Board foundation |
| 2023.26 | Export a list of your members | Deferred/out of scope for the current Board foundation |
| 2023.25 | New icon added | Deferred/out of scope for the current Board foundation |
| 2023.24 | Embed to object | Object focus already present; embeds later |
| 2023.23 | Cloud architecture icons | Deferred/out of scope for the current Board foundation |
| 2023.22 | Toolbar changes | Deferred/out of scope for the current Board foundation |
| 2023.21 | Improved status indicator details | Deferred/out of scope for the current Board foundation |
| 2023.20 | New comment reactions | Deferred/out of scope for the current Board foundation |
| 2023.19 | Resizing images snaps to width of the doc | Deferred/out of scope for the current Board foundation |
| 2023.18 | Rename files with right click | Floating rename |
| 2023.17 | Whimsical AI | Deferred/out of scope for the current Board foundation |
| 2023.16 | Google Docs smart chip integration | Deferred/out of scope for the current Board foundation |
| 2023.15 | Customize text connector colors | Separate label colors later |
| 2023.14 | Add and remove multiple columns in tables | Deferred/out of scope for the current Board foundation |
| 2023.13 | Improvements to commenting and searching in tables | Deferred/out of scope for the current Board foundation |
| 2023.12 | Mobile support for Whimsical Docs | Deferred/out of scope for the current Board foundation |
| 2023.11 | Jira integration | Deferred/out of scope for the current Board foundation |
| 2023.10 | Template browsing | Deferred/out of scope for the current Board foundation |
| 2023.9 | Teams | Deferred/out of scope for the current Board foundation |
| 2023.8 | Copy objects as images | Selection PNG clipboard |
| 2023.7 | Set board thumbnail | Deferred/out of scope for the current Board foundation |
| 2023.6 | Slack integration | Deferred/out of scope for the current Board foundation |
| 2023.5 | New connector modes | Auto/straight/elbow already present |
| 2023.4 | AI mind mapping | Deferred/out of scope for the current Board foundation |
| 2023.3 | Deleting sections retains contents | Deferred/out of scope for the current Board foundation |
| 2023.2 | Request editor access | Deferred/out of scope for the current Board foundation |
| 2023.1 | Report suspicious content | Deferred/out of scope for the current Board foundation |
