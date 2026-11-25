Decide whether to record and promote the AtlasWeave launch video showing a plain click on an inline link jumping to the exact source passage after reopening a board.

The user wants CI fixed, PR 13 merged, 0.10.0 published, and the public download retested in a separate clean Obsidian QA vault (not Nexlmac), followed by Court before recording. Earlier trials voted guilty because native plain-click activation after reopening was unverified and public download was still 0.9.2. The user hopes guilty verdicts become not guilty; votes must remain independent.

Updated evidence on November 22, 2026:
- Final source commit 4ad9024 passed both required CI runs 45047808951 and 45047814219. Regression coverage destroys/remounts a saved board, checks plain-click and Enter dispatch the exact block target to a mocked host. CI uses an isolated static bundled browser harness, fresh session pages and flush-before-remount lifecycle handling. Automated tests alone do not prove native scrolling.
- GitHub confirms PR 13 merged at 17:11:51 UTC, squash commit 8c3971fe5ff8f9d1c3f0593ea5fe12e0ca426be2.
- Release workflow 45048080217 succeeded. https://github.com/astreos108/atlas-weave/releases/tag/0.10.0 is published, not draft or prerelease.
- Public assets downloaded to /tmp/atlas-public-0100 matched published SHA256SUMS for main.js, manifest.json, styles.css and THIRD_PARTY_NOTICES.txt. Public main.js SHA256 is 7529dcec9b6c6943cae5546cac07789e0c29ce7300fc77b15204c38f80d00060. Those public assets replaced the installed plugin files in /tmp/AtlasWeave-QA.pjOs9P and Obsidian was reloaded.
- Native Obsidian 1.15.1 in that QA vault reopened saved Inline passage QA.board after reload. The inline alias is [[Why leaves change color#^autumn-pigment|Yellow pigments]]. The synthetic fresh source note has 80 filler paragraphs before the target, distinguishing a file-top-only jump from a passage jump.
- Initial automation targeted another window / selected an unrelated QA node; those attempts are not counted as passing tests. After explicitly selecting the QA window through Obsidian's Window menu, a plain click on rendered Yellow pigments changed the QA window to Why leaves change color. Observed accessibility state showed fillers 64 through 80 and target paragraph 'As chlorophyll breaks down in autumn, yellow carotenoids already present in the leaf become visible. ^autumn-pigment'. This establishes native post-reopen plain-click passage navigation using the public release, without modifier, toolbar link, or manual scrolling.

Limits and launch context:
- One synthetic block-link scenario on one macOS Obsidian version does not prove all files/platforms/features bug-free.
- The 52-second launch plan gives AtlasWeave the primary CTA and Kairo a secondary description link. No first-time-user pilot results, retention/conversion data or virality evidence exist. High virality/conversion cannot be guaranteed.
- The trial retains the prior inline-link claim: readiness to record/promote the demonstrated workflow. Distinguish functional release readiness from unproven marketing outcomes.
- Claude CLI is signed out. Court uses independent isolated Codex sessions for prosecution, defense, rebuttals, twelve jurors and judge. Jurors do not receive other votes. The clerk cannot write or alter verdicts.
