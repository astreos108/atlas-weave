# ADR 0001: Portable document truth and guarded external edits

Status: Accepted, 2026-11-07.

Context: The prototype mixed interaction state, persistence failures and external edits. Decorative groups did not behave as containers. A public plugin must preserve user work and keep capabilities explicit.

Decision: Plain Mermaid plus versioned layout comments is the durable document. Frames store explicit member IDs. Shared pure domain operations own movement and arrangement. SVG routing and guide geometry are derived. Failed saves reject flush; recoverable snapshots remain private in plugin data. External writes serialize and acquire memory/disk revision guards. MCP and note reading are separate opt-ins; AI stays in the external assistant.

Constraints: No nested frames, silent source flattening, stale retries or overwriting conflicted drafts. No network service is needed for core editing. Node/Electron adapters load only on desktop. Unsupported source stays available as source.

Consequences: Generic Mermaid does not reproduce interactive geometry. A conflict can block edits until recovery/reload; recovery is a separate Board file. The bridge remains a disclosed local capability rather than pretending to be risk-free. Settings require Obsidian 1.13+ for searchable declarative controls.

Follow-up: Verify mobile before enabling it; improve dense-route algorithms with real fixtures; split further UI concerns when warranted. Retain tests for membership, route preservation, failed flushes and concurrency.
