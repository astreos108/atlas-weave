# Security policy

Supported release: the latest public 0.7.x release. Earlier local prototypes are not public supported releases.

Report vulnerabilities privately through this repository's Security advisories / Report a vulnerability feature. Do not put tokens, private notes or working exploits in public issues. If private reporting is unavailable, open an issue requesting a private contact without sensitive details. Obsidian policy violations can also be reported to Obsidian through its official support channels.

Security-relevant capabilities: Vault read/write; deliberate clipboard read/write; owner-only local credential; optional authenticated loopback server; opt-in Markdown note search/excerpts. External assistants may transmit requested content to their own model provider. Core editing makes no remote requests and includes no telemetry or embedded AI.

The MCP owner token is a local credential, not a model API key. Treat the vault configuration and recovery data as private. Disable MCP when unused. The listener rejects browser Origin requests and stale revisions; it is not a sandbox against malicious local processes or other plugins with vault access.

Known limits: no external penetration audit, no verified mobile support, imperfect dense routing, partial clipboard adapters and no automatic backlink/rename indexing for `.board` links. npm audit and lint do not prove absence of vulnerabilities. Release attestations establish build provenance, not software safety.
