# Sustainable funding for Atlas Weave

Research checked 2026-11-07. This is a product recommendation, not a forecast of earnings. Public support links establish a funding mechanism, not how much someone earns.

## Observed models

| Model | Primary evidence | Fit for Atlas Weave |
|---|---|---|
| Voluntary donations / sponsorship | [Dataview](https://github.com/blacksmithgu/obsidian-dataview) accepts donations for development. [Obsidian Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) asks for Ko-fi support. | Strong fit now: no accounts, billing service, feature gates or data collection. |
| Education around a free plugin | The [Excalidraw author's README](https://github.com/zsviczian/obsidian-excalidraw-plugin) links a free essentials course, a book and visual-thinking workshops. | Possible later: practical mapping workshops or workflow onboarding, only if the author wants to deliver them. No template library is required. |
| Paid service with an Obsidian companion | [Readwise's official Obsidian export guide](https://github.com/readwiseio/obsidian-readwise) describes its integration. | Poor fit for the current local board: a hosted service adds ongoing costs, privacy obligations and operational work. |
| Feature licenses / optional paid tiers | [Obsidian's payment rules](https://docs.obsidian.md/community-directory/faq) distinguish Free, Optional payment and Paid listings; [official announcement](https://obsidian.md/blog/future-of-plugins/) explicitly allows donation/sponsor links for Free plugins. | Technically possible, but premature before stable adoption. Would need accurate listing disclosures and support/refund/license design. |

The official Community directory is not a payment processor. Payments happen outside Obsidian. Donation-only support can keep the plugin categorized Free. If functionality is gated, or the plugin depends on a paid service, update the listing accordingly; a free alternative/trial does not automatically make it Free.

## Recommendation

**Keep the editor, Mermaid ownership, recovery, export, accessibility and local MCP bridge free.** These are the foundation and the user's data escape routes. Offer optional support without interrupting creation.

Implemented:

- Ko-fi link at the top of README and in `.github/FUNDING.yml` so GitHub can expose Sponsor.
- Native preferences support link and a distinct heart icon in More.
- Static local icons only; no external donation widgets, tracking, banners, startup prompts or payment SDK.
- Donation copy makes clear that payment unlocks nothing and is optional.

A reasonable next experiment is a modest recurring Ko-fi supporter option for people who want to fund maintenance, without promising individual support, guaranteed deadlines or exclusive core features. Suggested amounts, if the author wants to configure them, could be $3 or $5 monthly and a one-time amount chosen by the donor. These are **unvalidated suggestions**, not enabled offers or market-tested prices. No Ko-fi products, memberships, prices or financial settings were changed.

If users later ask for help, the strongest adjacent offers are optional paid workflow onboarding, team training, or a clearly scoped custom import/MCP adapter. Discuss deliverables, ownership, privacy, maintenance and availability first; do not advertise response-time guarantees or consulting slots the author has not committed to providing. They can be delivered outside the plugin, without building a separate commerce system.

## What to avoid now

No forced subscriptions, export/recovery paywalls, embedded model charges, paid templates/wireframes, intrusive donation nags, fake scarcity, usage telemetry or selling vault data. Do not monetize a feature simply because a scan or listing permits it. An MIT repository is reusable and forkable; earning should come from genuine support and optional expertise, not promises of exclusivity over already published code.

## Review after actual adoption

Use genuine GitHub questions, bug reports and voluntary feedback to decide whether people value maintenance or hands-on help. Track voluntary Ko-fi support in Ko-fi itself; do not add plugin telemetry to estimate willingness to pay. Revisit recurring commitments only when the maintenance load and the author's available time are known. No earnings projection or claim of likely conversion is justified yet.
