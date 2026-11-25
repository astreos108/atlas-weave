---
title: AtlasWeave Recording Plan
updated: 2026-11-22
status: ready for rehearsal
release: 0.10.0
---
# AtlasWeave Recording Plan

[Editable Figma storyboard — YouTube page](https://www.figma.com/design/0xL0BfEkidmpWDXY8FpEeo/Atlasweave?node-id=18-519)

[[atlasweave-video|Script]] · [[AtlasWeave Captions]] · [[AtlasWeave Promotional Copy]] · [[qa-0.10.0/PUBLIC-RELEASE-RETEST|Public release QA]]

The Figma plan contains eight 16:9 composition guides with timings, narration, cursor actions, overlays and take checks. It uses the product palette and a copy of the existing logo. Its editable diagrams are storyboards, not final screenshots or proposed new product UI. The editorial typeface is Inter; native footage retains Obsidian’s actual system typography.

## Before capture

Use a separate synthetic recording vault with public AtlasWeave 0.10.0. Keep these planning notes in Nexlmac. The successful QA environment was macOS / Obsidian 1.15.1; display that exact scope in the proof shot. Rehearse the final recording fixture after any cleanup or content change—prior QA does not certify a newly edited fixture.

Prepare two thoughts: “Chlorophyll breaks down” and “Yellow pigments”, joined by “reveals”. The second thought’s inline Markdown is:

```text
[[Why leaves change color#^autumn-pigment|Yellow pigments]]
```

The source passage is:

> As chlorophyll breaks down in autumn, yellow carotenoids already present in the leaf become visible. ^autumn-pigment

The tested source note had 80 filler paragraphs before this passage. For a polished recording, use meaningful synthetic surrounding content if desired, then rehearse the exact edited fixture. The destination must be sufficiently far below the opening view to make passage navigation visible. Do not manually scroll to create the appearance of a successful link jump.

Prepare a resettable starting board for the construction take and a completed copy for the opening payoff. Use separate copies so retakes do not destroy the demonstration state. Hide unrelated board nodes from the recording composition or remove them in the disposable recording copy before rehearsal. Do not alter production study notes for filming.

Capture at 3840×2160 / 30 fps if available, deliver 1920×1080. Increase native app zoom until each thought and source passage is legible at delivery size. Use a stable window position, neutral desktop, notifications off and a visible cursor. Keep personal paths, account details and unrelated vault content outside the crop. Preserve a clean master without captions.

## Shot list

| Shot / file | Time | Starting state and action | Framing / edit | Accept the take when |
| --- | --- | --- | --- | --- |
| 01 · `01-payoff` | 00:00–00:04 | Finished two-thought board. Trace the “reveals” connector once. | Tight board crop. Hook overlay; no long logo intro. | Both thoughts and their relation are readable immediately. |
| 02 · `02-context` | 00:04–00:10 | Reveal app title and board. Briefly show the synthetic source note, then return. | Wider Obsidian context, then settle on the board. | The viewer can identify AtlasWeave as a board in Obsidian. |
| 03 · `03-build` | 00:10–00:18 | From reset copy, create/edit the two thoughts and label the connection. | Keep text and cursor in the same crop. Trim idle typing only. | Each edit is legible; the sequence does not suggest automatic note conversion. |
| 04 · `04-inline-link` | 00:18–00:25 | Add the exact `note#^block\|alias` link and finish editing. | Close crop on the field and rendered “Yellow pigments” alias. | The link retains its alias and exact block destination. |
| 05 · `05-06-reopen-jump` | 00:25–00:30 | Wait for saved status, close the board, quick-switch back to the same board. | Start a continuous capture and keep it running through shot 06. | Save, close and reopen are visible; no hidden setup or navigation cut. |
| 06 · same continuous file | 00:30–00:39 | Plain-click “Yellow pigments”. Let native Obsidian navigate. Hold the target for ≥3 seconds. | Keep clicked alias and arriving passage legible. Small version label. Real speed; no manual scroll. | Exact `autumn-pigment` passage appears; no modifier, toolbar link or concealed cut. |
| 07 · `07-explain` | 00:39–00:45 | Native Back to the board, trace the relation once. | Hold a readable board view. Overlay invites explanation. | The connection is clear without implying a measured learning gain. |
| 08 · `08-end-card` | 00:45–00:52 | Hold existing AtlasWeave logo beside the map and single CTA. | “Try AtlasWeave in Obsidian” + install-guide subline. | CTA is readable for the full end beat. No Kairo branding or second CTA. |

The exact narration lives in [[atlasweave-video]]; use it word-for-word for the first take. Caption cues are supplied in [[AtlasWeave Captions]] and the adjacent SRT. If natural narration needs more room, extend the edit and retime the cues rather than rushing a UI action or falsifying the proof sequence.

## Capture order

1. Rehearse the source destination with the public build after reopening the final fixture.
2. Capture shots 05–06 first as one take; this is the essential proof footage. If it fails, fix the fixture or interaction and retest before continuing.
3. Record the finished-board opening, context and return shots.
4. Record construction and inline-link editing on the disposable reset copy.
5. Capture the end card and record narration in a quiet setting.
6. Assemble the 52-second cut. Fit the narration around real action timing; keep the 05–06 proof intact.

## Editing and caption placement

Keep a clear lower caption band without covering the clicked alias, target paragraph or version label. Use no more than two caption lines with a high-contrast backing. Avoid overlapping a caption with an overlay that repeats the same words; hide the redundant overlay where appropriate. Verify the export with sound off and at phone size. Do not speed up shots 05–06. Keep click audio subtle; music is optional and subordinate to narration.

An optional vertical cut should be reframed shot by shot, not mechanically center-cropped. Preserve both the link click and resulting paragraph. Do not promise a native mobile plugin experience from vertical footage.

## Publishing handoff

Primary links: [0.10.0 public release](https://github.com/astreos108/atlas-weave/releases/tag/0.10.0) and [manual install guide](https://github.com/astreos108/atlas-weave#install). Do not say “find it in Community plugins” as an installation shortcut. GitHub publication is not Community directory approval.

Kairo stays below the AtlasWeave explanation in the description as a secondary signup link. Its public signup URL is intentionally left open at the user’s request; add it when supplied. No Kairo end card, spoken mention, pinned-comment CTA or storyboard shot is planned.

Use the Court-aligned copy in [[AtlasWeave Promotional Copy]]. No financial, recall, retention, conversion, universal compatibility or virality promise. Save the final clean master, captioned master and retimed SRT together. Recording and posting are subsequent steps; this plan does not claim the video has been recorded or published.
