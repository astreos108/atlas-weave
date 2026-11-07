# Contributing

Open an issue with a minimal Mermaid fixture, expected behavior, actual behavior, OS/Obsidian/plugin versions and a screenshot when useful. Remove private notes, tokens and vault paths. For security issues, use private reporting rather than posting credentials or exploit details publicly.

Use the pinned Node/npm versions, `npm ci`, `npm run check`, `npm run test:ui` and `npm run verify:reproducible`. Include tests at the owner of the behavior: domain invariants, persistence workflows, adapter integration or an essential UI journey. Read `ARCHITECTURE.md` before moving shared rules into UI code.

Keep changes scoped and preserve source-only diagrams. Do not add telemetry, model-provider clients, automatic dependency installation, advertisements or unrelated task-management features. Discuss storage, privacy, capabilities or cross-module contracts in an ADR. Do not manipulate stars, installs, issues, commits, timestamps or scan results to improve a score.

PRs must include relevant verification and disclose what was not tested. CI is evidence, not Obsidian approval or a security guarantee. Dependency updates must preserve licenses and rebuild artifacts from source. Do not edit generated main.js by hand.
