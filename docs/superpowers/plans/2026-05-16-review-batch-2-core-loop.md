# Review Batch 2 Core Loop

**Date:** 2026-05-16

**Scope:** Private Campaign OS, Creator Web App, Reporting Trust.

## Decision

Batch 2 is the brand to creator to report loop. The reviewed flow must stay self-serve and evidence-first:

- A brand campaign can be calm and operationally clear without being ready to complete.
- Campaign closeout is only valid from `monitoring`, after content, live URLs, and reports are settled.
- Creator campaign tabs should show attention only when the creator has a real next action.
- Report helper actions stay compact on small screens and remain secondary to the report.

## Product Fixes

- Closeout readiness now rejects non-monitoring campaigns with `campaign_not_active`.
- Brand cockpit next action no longer offers `Complete campaign` for recruiting, in-progress, publishing, draft, completed, paused, or cancelled campaigns.
- Creator room calm state uses `Status` instead of forcing a “next action” label.
- Creator room tab attention dots are suppressed when the room is simply on track.
- Product notification smoke moves the completion fixture into `monitoring` before testing the completed-campaign notification.

## Browser Evidence

- Brand detail: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch2-brand-detail-iab.png`
- Creator room mobile: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch2-creator-room-mobile-iab.png`
- Report desktop: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch2-report-iab.png`
- Report mobile: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch2-report-mobile-iab.png`

## Proof

- `npm test -- src/lib/campaigns/campaign-closeout.test.ts src/lib/campaigns/brand-campaign-cockpit.test.ts 'src/app/(site)/(app)/i/campaigns/[id]/report-task-flow.test.ts' scripts/smoke-creator-campaign.test.mjs scripts/smoke-product-notification-actions.test.mjs`
- `npm run smoke:campaign-detail`
- `npm run smoke:creator-campaign`
- `npm run smoke:content-report-workflow`
- `npm run smoke:content-report-recovery`
- `npm run smoke:content-report-late`
- `npm run smoke:product-notification-actions`
- `git diff --check`
- `npm run lint`
- `npm run build`
- Codex in-app browser smoke on brand detail, creator room mobile, report desktop, and report mobile.

## Result

Completed on 2026-05-16. The core loop is still not staged as a final PR, but the current batch is verified. The remaining work should continue through Review batch 3: notifications and admin oversight.
