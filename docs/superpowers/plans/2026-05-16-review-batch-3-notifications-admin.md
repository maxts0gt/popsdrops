# Review Batch 3 Notifications Admin

**Date:** 2026-05-16

**Scope:** Notifications And Email Confidence, Admin Oversight.

## Decision

Batch 3 is the trust and operations layer. It should prove that important events reach the right person, email preferences are respected, queue failures are visible, and admin sees exceptions without turning PopsDrops into a manual campaign operations team.

## Product Fixes

- Admin communications attention now shows only active delivery blockers: failed, pending, or unprocessed unsupported queue rows.
- Recent notification history stays in the delivery log and recent notifications, not in the urgent attention strip.
- `DESIGN.md` now locks this rule so historical report follow-up volume does not become a false admin blocker later.
- Public apply smoke now accepts the intentional creator room `Status` label, while still allowing old `Next action` proof for compatible fixtures.

## Browser Evidence

- Admin communications: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch3-admin-communications-clear-iab.png`
- Admin revenue: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch3-admin-revenue-iab.png`
- Admin analytics: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch3-admin-analytics-iab.png`
- Admin campaigns: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch3-admin-campaigns-iab.png`
- Admin campaign detail: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch3-admin-campaignDetail-iab.png`
- Brand notifications: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch3-brandNotifications-iab.png`
- Creator notifications: `/Users/swiftpanda/Developer/popsdrops/output/playwright/batch3-creatorNotifications-iab.png`

## Proof

- `npm test -- src/lib/admin/notification-queue-health.test.ts 'src/app/(site)/(app)/admin/communications/admin-communications-queue.test.ts'`
- `npm test -- src/lib/email/notification-email-coverage.test.tsx src/lib/email/notification-email-subjects.test.tsx src/lib/email/notification-preferences.test.ts src/lib/email/notification-queue-state.test.ts src/lib/email/report-notification-email.test.tsx src/lib/email/send.test.tsx src/lib/admin/notification-queue-health.test.ts 'src/app/(site)/(app)/admin/table-contract.test.ts' 'src/app/(site)/(app)/admin/communications/admin-communications-queue.test.ts' 'src/app/(site)/(app)/admin/revenue/admin-revenue-quality.test.ts' 'src/app/(site)/(app)/admin/analytics/admin-analytics-quality.test.ts' 'src/app/(site)/(app)/admin/campaigns/[id]/admin-campaign-detail-quality.test.ts' scripts/smoke-notification-email-flow.test.tsx scripts/notification-queue-audit.test.ts scripts/smoke-notification-preferences.test.ts scripts/smoke-report-correction-notification.test.ts scripts/smoke-queue-backed-email-delivery.test.ts scripts/smoke-admin-communications-retry.test.ts scripts/smoke-product-notification-actions.test.mjs`
- `npm run smoke:notification-email`
- `npm run smoke:notification-queue:audit`
- `npm run smoke:notification-preferences`
- `npm run smoke:report-correction-notification`
- `npm run smoke:queue-backed-email`
- `npm run smoke:product-notification-actions`
- `npm run smoke:admin-communications-retry`
- `npm test -- scripts/smoke-public-apply.test.mjs`
- `npm run smoke:public-apply`
- `git diff --check`
- `npm test -- 'src/app/(site)/(app)/notifications-report-flow.test.ts' src/lib/admin/notification-queue-health.test.ts 'src/app/(site)/(app)/admin/communications/admin-communications-queue.test.ts'`
- `npm run lint`
- `npm run build`
- `npm run smoke:release`
- Codex in-app browser smoke on admin communications, admin revenue, admin analytics, admin campaigns, admin campaign detail, brand notifications, and creator notifications.

## Result

Completed on 2026-05-16. Batch 3 is verified with the full release smoke gate passing after the public apply contract was aligned to the intentional creator room label. The remaining work should continue through Review batch 4: Supabase operational backend, localization and market fit, and the mobile creator app.
