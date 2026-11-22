# AtlasWeave architecture map

[Floorplan](https://github.com/haydenschmitty/floorplan) provides an interactive codebase map for contributors. It is development tooling; it is not part of the Obsidian plugin bundle.

From the project directory:

```sh
npm run floorplan
npm run floorplan:open
```

The first command scans the current checkout and generates `floorplan/index.html` and `floorplan/graph.json`. The HTML can be opened directly. The second command refreshes the map and opens Floorplan's local server, with its optional Ask feature configured for the local Codex CLI. Ask requires an installed, signed-in Codex CLI. Generating the map does not require an AI account.

On first use, the runner downloads Floorplan from its official repository and checks out revision `94f81b463b7617e06d873ac71323ce71644c8399`. Git, Node, and network access are required for that installation. Later builds use the cached tool in `floorplan/.tool`, including its MIT license. No global skill installation or application dependency is needed.

The map includes editing, drawing and routing, saved document rules, paste workflows, Obsidian integration, the assistant bridge, and verification. Its tour introduces these areas; flows trace saving, pasting, and assistant changes. Floorplan's automated health findings are heuristics, not a security audit. In particular, its scanner does not recognize the bridge's dynamically handled HTTP routes.

`architecture.json` is the maintained module and tour definition. `descriptions.json` seeds file explanations. Update these alongside architectural changes. Refresh retains local descriptions and review markers; newly added files may need descriptions in the generated map. Keep reviewed descriptions in the seed file for future checkouts. Generated maps, local server state, and the cached tool stay ignored inside `floorplan/`.
