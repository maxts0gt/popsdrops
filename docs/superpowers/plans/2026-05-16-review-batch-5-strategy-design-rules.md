# Review Batch 5 - Strategy And Design Rules

**Date:** 2026-05-16

## Intent

Keep canonical product guidance aligned with the product we are actually building: global, private, self-serve, premium, evidence-first, and intentional.

## Changes

- Updated `AGENTS.md`, `CLAUDE.md`, and `docs/SPEC.md` so they no longer frame the product as an MVP.
- Clarified that admin is an internal control tower for approvals, queue health, revenue, audit, and exceptions, not the daily campaign operations team.
- Clarified platform scope: campaign setup supports TikTok, Instagram, Snapchat, YouTube, and Facebook, while reporting templates also support X and Generic proof entries.
- Replaced stale social account connection language with the current evidence-first reporting boundary. Platform-token connections are not part of the current reporting architecture.
- Tightened backend guidance so background automation cannot be inferred from dormant cron, scheduler, token refresh, or platform sync scaffolding.
- Added design contract coverage so stale strategy language cannot re-enter canonical docs quietly.

## Proof

- `npm test -- src/components/design-contract.test.ts`
- `npm test -- src/components/design-contract.test.ts src/lib/reporting/evidence-first-boundary.test.ts src/lib/reporting/platform-templates.test.ts src/app/route-layout-contract.test.ts src/lib/next-proxy-convention.test.ts`
- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- In-app browser smoke on `/b/campaigns/4707edb5-dcab-4b2d-b5eb-7e79f0e1f010/report`: report heading, Share, and Export rendered with zero fresh console errors.
