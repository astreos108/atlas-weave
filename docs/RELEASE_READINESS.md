# Public release readiness and honest scorecards

Sources checked 2026-11-07: [official community directory scorecard help](https://obsidian.md/help/community-directory), [developer policies](https://docs.obsidian.md/community-directory/developer-policies), [official plugin guidelines source](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md), [official ESLint plugin](https://github.com/obsidianmd/eslint-plugin), [automated review / submission overview](https://obsidian.md/blog/future-of-plugins/), and the user's [2024 Obsidian Stats methodology](https://www.obsidianstats.com/posts/2024-12-28-obsidian-plugin-scoring-system).

## What the ratings mean

Official **Health** describes repository hygiene, maintenance, responsiveness and adoption. README/license/contributing metadata, real maintenance, real issue handling, contributors and genuine installs/stars contribute. Exact current numeric thresholds were not found in the public documentation reviewed. A new repository cannot honestly claim established adoption or maintenance history.

Official **Review** describes the latest automated release scan: policy/code practices, known dependency vulnerabilities, build attestations, API use and disclosures such as clipboard/network access. A disclosure is not automatically malicious behavior; an error must still be investigated. Many findings can come from bundled dependencies. Do not hide them, strip functional code to fool the scanner, suppress warnings arbitrarily or claim that another popular plugin's findings establish our safety.

The linked 2024 Obsidian Stats article is a separate historical popularity/maintenance heuristic with weighted GitHub/download metrics. Its published weights are not the current official Review formula. Neither a high popularity score nor a clean audit is a security guarantee.

## Engineering evidence

- Original code with MIT license, generated bundled license notices and optional Ko-fi support.
- Shared domain operations for true frames, membership, moves, side resize and arrangement. Versioned Mermaid storage preserves ownership and export.
- Failed saves reject flush; recovery snapshots restore to a separate board. External mutations serialize and guard UI memory as well as disk revision.
- MCP and note reading off by default. Desktop adapter guards, bounded inputs, owner credential rotation, Origin rejection and no shell/eval endpoint.
- Sanitized generated UI/SVG fragments, textContent labels, scoped plugin CSS, cleaned up lifecycle resources, searchable native settings and no global app singleton.
- Official recommended Obsidian lint configuration for plugin source and manifest/package/license checks. Node CLI/tests use their own correct runtime scope; no selective production rule disabling.
- Pinned lockfile and Node/npm versions, portable browser fixtures, domain/workflow/UI checks, clean independent rebuild comparison, commit-pinned CI actions, dependency auditing and build provenance.

## Release status boundaries

GitHub source and downloadable artifacts are separate from in-app Community listing. The official developer dashboard must run a preview/release scan, show its real findings, and approve the submitted repository before listing. No score, malware result, third-party penetration review or official approval is claimed by local checks.

After publication: sign into the Community developer dashboard, connect the repository, run a preview scan, resolve actual findings and submit. Connecting accounts or accepting new terms remains the author's action. Do not use the obsolete GitHub community-list PR flow as the current submission process.

Initial support is desktop Obsidian 1.13+. Mobile is deliberately not advertised. Dense graph separation and cross-app paste remain limited as documented. Private draft recovery/source snapshots belong to the vault and must not enter Git history.

No fake commits, manufactured issues, fake installs/stars, misleading badges, inflated support claims or scanner bypasses are part of this process. Keep a real changelog and respond to actual bug reports.
