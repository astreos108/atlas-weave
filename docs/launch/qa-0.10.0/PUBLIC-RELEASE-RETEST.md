# AtlasWeave 0.10.0 public-release retest

Verified November 22, 2026.

- PR #13 merged: https://github.com/astreos108/atlas-weave/pull/13
- Merge: 8c3971fe5ff8f9d1c3f0593ea5fe12e0ca426be2
- Required CI: https://github.com/astreos108/atlas-weave/actions/runs/45047814219 — success
- Release workflow: https://github.com/astreos108/atlas-weave/actions/runs/45048080217 — success
- Published release: https://github.com/astreos108/atlas-weave/releases/tag/0.10.0

## Public artifact identity

Downloaded release assets to `/tmp/atlas-public-0100`. Published SHA256SUMS verified. Installed assets in `/tmp/AtlasWeave-QA.pjOs9P/.obsidian/plugins/atlasweave` match the downloaded files byte-for-byte; installed manifest reports 0.10.0.

| File | SHA256 |
| --- | --- |
| main.js | 7529dcec9b6c6943cae5546cac07789e0c29ce7300fc77b15204c38f80d00060 |
| manifest.json | d570b285a19ce5fe2eb369edbe9c5972e88e38cd04a77ff5ee563506e736b5d8 |
| styles.css | 8d532b9208496ed53e670b1323e108d3109a56ba38247afb0655f48444636423 |
| THIRD_PARTY_NOTICES.txt | dc1e549c44455ccc0504644044506ec686dee9f2ae8896bec955aea83b284bb6 |

## Native test

Environment: macOS, Obsidian 1.15.1, separate clean QA vault `AtlasWeave-QA.pjOs9P`, not Nexlmac.

1. Replaced the already-installed QA plugin with public release assets.
2. Reloaded Obsidian using its reload command.
3. Reopened saved `Inline passage QA.board` through quick switcher.
4. Explicitly selected the QA window using Obsidian's Window menu.
5. Plain-clicked rendered inline `Yellow pigments` link, targeting `Why leaves change color#^autumn-pigment`.
6. Observed native window change to source note. Accessibility state showed filler paragraphs 64–80 and the exact target paragraph: “As chlorophyll breaks down in autumn, yellow carotenoids already present in the leaf become visible. ^autumn-pigment”.

Result: PASS — saved inline block link survives reopening and plain-click opens the exact passage with the public build. No modifier, toolbar link, or manual scrolling used in the successful activation.

Initial attempts with a background window selected an unrelated QA node or switched windows; they are not counted as successful activation tests. Successful test followed explicit Window-menu selection.

Scope: one native synthetic note/block-link scenario; automated regressions additionally exercise Enter and host destination dispatch after remount. This is not evidence of all-platform correctness or guaranteed conversion/virality.
