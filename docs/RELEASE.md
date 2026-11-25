AtlasWeave 0.10.1 improves free-floating text and file identification in Obsidian.

- Free-floating text has no card background, border, or padding. It grows horizontally as you type, supports explicit newlines, and wraps after dragging a side handle to set a width. The wrap width survives reopening. Rich formatting remains available.
- Text annotations no longer show shape-color controls or automatic connector anchors; existing saved edges are retained.
- AtlasWeave files display an MRMD badge in the file explorer. The label remains visible with themes that use relative font sizes. Existing .board filenames are unchanged.
- Includes the AtlasWeave plugin-ID rename and compatible dependency updates merged since 0.10.0. The current installation folder is atlasweave.

Desktop Obsidian 1.13.0 or later is required. Download main.js, manifest.json, styles.css, and THIRD_PARTY_NOTICES.txt into CONFIG_DIR/plugins/atlasweave/ (usually .obsidian/plugins/atlasweave/), then enable AtlasWeave. If upgrading an older installation in rea-whimsical, back up its data.json, disable that older copy, and move its settings into the atlasweave folder rather than running both copies.
