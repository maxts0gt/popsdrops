# Review Batch 6 - Final Cleanup And Release Smoke

**Date:** 2026-05-16

## Intent

Finish the review hygiene pass without deleting useful release evidence, then prove the full brand to creator to report loop with one release smoke command.

## Changes

- Removed the ignored `.playwright-cli/` scratch capture directory.
- Kept `output/` because the smoke screenshots and email previews are intentional release evidence referenced by review notes.
- Moved application-flow smoke data setup away from `/auth/dev-login` so fixture creation does not burn Supabase magic-link OTP verifications.
- Added short-lived local dev-login session caching per role. Release smoke can switch between creator, brand, and admin without minting a fresh Supabase auth session on every browser hop.
- Hardened browser smoke dev-login transitions with one shared retry helper that captures the final browser state on failure.
- Routed release browser smoke scripts through that shared login helper instead of one-shot redirects.
- Hardened content/report smoke waits to use route state and stable test ids instead of brittle visible copy.
- Kept cleanup scoped. No broad `git clean` was used because dry-run output included real untracked source, tests, migrations, and docs.

## Proof

- `npm test -- scripts/smoke-campaign-detail.test.mjs scripts/smoke-content-report-workflow.test.mjs scripts/smoke-content-report-recovery.test.mjs scripts/smoke-content-report-late.test.mjs scripts/smoke-product-notification-actions.test.mjs`
- `npm test -- src/lib/dev-users.test.ts scripts/smoke-application-flow.test.mjs scripts/smoke-product-notification-actions.test.mjs`
- `npm run smoke:content-report-late`
- `npm run smoke:product-notification-actions`
- `npm run smoke:release`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- Direct dev-login probe: repeated `creator` and `brand` debug hits returned cached sessions with expected redirects.

## Browser Note

Codex in-app browser smoke opened `/auth/dev-login?role=brand`, reached `/b/home`, then opened `/b/campaigns/4707edb5-dcab-4b2d-b5eb-7e79f0e1f010/report`. DOM proof found the report title, Share, Export, and Evidence Trail. Console warning/error logs were empty. Screenshot capture timed out in the browser bridge, so visual screenshots remain covered by the Playwright smoke artifacts in `output/playwright/`.

## Remaining Review Risk

- The working tree is intentionally broad. Stage and review by story batch, not all at once.
- Generated evidence in `output/` is ignored and should stay out of source review unless a specific screenshot is needed for a PR note.
