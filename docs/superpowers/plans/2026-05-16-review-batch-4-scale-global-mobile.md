# Review Batch 4 Scale Global Mobile

**Date:** 2026-05-16

**Scope:** Supabase Operational Backend, Localization And Market Fit, Mobile Creator App.

## Decision

Batch 4 is the scale and global readiness story. Supabase stays the operational backend, fixed UI translation stays bundled, dynamic campaign content stays database-backed, and the mobile creator app must protect auth state like a real production app.

## Product Fixes

- Mobile Supabase auth sessions now use Expo SecureStore instead of AsyncStorage.
- Mobile auth storage uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY` so auth tokens stay in device secure storage and are not migrated to another device backup.
- CI workflows no longer carry the stale `CRON_SECRET` environment value after the cron routes were removed.
- The evidence-first reporting boundary test now prevents cron secrets from quietly re-entering CI.
- Expo SDK patch versions were aligned with Expo Doctor expectations for SDK 54.
- Mobile package overrides pin vulnerable transitive `@xmldom/xmldom` and `postcss` versions to audited-clean releases.

## Browser Evidence

- Codex in-app browser verified `/ja/for-creators`: `lang="ja"`, `dir="ltr"`, Japanese copy, and no fresh console errors.
- Codex in-app browser verified `/ar/for-brands`: `lang="ar"`, `dir="rtl"`, Arabic copy, and no fresh console errors.
- Codex in-app browser verified `/b/campaigns/new` after brand dev login with no fresh console errors.
- Codex in-app browser screenshot capture timed out in the runtime, so visual receipts are from the smoke scripts that captured through the existing Playwright/CDP fallback.

## Smoke Screenshot Evidence

- `/Users/swiftpanda/Developer/popsdrops/output/playwright/campaign-detail-smoke.png`
- `/Users/swiftpanda/Developer/popsdrops/output/playwright/creator-campaign-smoke.png`
- `/Users/swiftpanda/Developer/popsdrops/output/playwright/content-report-brand-verified-smoke.png`
- `/Users/swiftpanda/Developer/popsdrops/output/playwright/content-report-late-brand-smoke.png`
- `/Users/swiftpanda/Developer/popsdrops/output/playwright/product-notification-action-completion-smoke.png`

## Proof

- `npm test -- mobile/lib/mobile-auth-storage.test.ts`
- `npm run test:mobile`
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run doctor`
- `npm --prefix mobile run quality`
- `npm --prefix mobile run release:check`
- `npm audit --omit=dev`
- `npm test -- src/lib/reporting/evidence-first-boundary.test.ts`
- `npm test -- src/lib/i18n/public-bundles.test.ts src/lib/i18n/platform-bundles.test.ts src/lib/i18n/context.test.tsx src/lib/i18n/document.test.ts src/lib/i18n/cache-version.test.ts src/lib/i18n/platform-page-metadata.test.ts src/lib/i18n/public-locale.test.ts src/lib/i18n/public-metadata.test.ts src/app/route-layout-contract.test.ts src/lib/iso-markets.test.ts scripts/release-smoke-matrix.test.ts src/lib/reporting/evidence-first-boundary.test.ts src/lib/reporting/no-social-oauth-boundary.test.ts src/lib/supabase/*.test.ts src/lib/next-proxy-convention.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run smoke:application-acceptance`
- `npm run smoke:counter-offer`
- `npm run smoke:content-report-workflow`
- `npm run smoke:content-report-recovery`
- `npm run smoke:content-report-late`
- `npm run smoke:notification-email`
- `npm run smoke:notification-queue:audit`
- `npm run smoke:notification-preferences`
- `npm run smoke:report-correction-notification`
- `npm run smoke:queue-backed-email`
- `npm run smoke:product-notification-actions`
- `npm run smoke:admin-communications-retry`
- `git diff --check`

## Result

Completed on 2026-05-16. Batch 4 is verified with mobile auth storage hardened, Expo Doctor clean, mobile audit at zero vulnerabilities, stale cron secret scaffolding removed from CI, localized routes smoke-tested in the in-app browser, and all remaining release smoke components passing after the aggregate release smoke session was interrupted.
