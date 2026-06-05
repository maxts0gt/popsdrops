# Launch Hardening Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current broad PopsDrops product surface into a verified, release-shaped private campaign operating system.

**Architecture:** The app already has the core brand, creator, reporting, admin, email, Supabase, and mobile surfaces. This agenda keeps future work story-sized, ties each story to a smoke path, and prevents scattered feature drift by requiring every important workflow to prove itself through tests and browser smoke before we move on.

**Tech Stack:** Next.js App Router, Supabase Postgres/Auth/Storage/Edge Functions, AWS SES notification templates, Vitest, Playwright smoke scripts, Codex in-app browser smoke.

---

## Operating Rule

Every task below must end with the smallest practical proof that the user workflow works. For user-facing flows, use the Codex in-app browser first. For backend or queue flows, use the matching smoke script. No story is complete just because code compiles.

## Priority Backlog

- [x] **Task 1: Release Smoke Command**
  - Add one npm command that runs the full critical smoke matrix.
  - Verify package scripts include campaign detail, creator campaign, public apply, application flow, application acceptance, counter offer, content report workflow, content report recovery, content report late, notification email, notification preferences, report correction notification, queue-backed email, product notification actions, admin communications retry, and brand access approval.
  - Keep the 100-creator payment spine inside release smoke so large private campaigns prove capacity, checkout, failed/refunded/disputed locks, cancelled checkout, recovery, and admin finance override before release.
  - Keep `npm run smoke:global-proof-room` as the focused buyer-story smoke: release-candidate money-to-report proof followed by the 100-creator private campaign capacity proof.
  - Proof: package-script test, typecheck, lint, build, `npm run smoke:release`.
  - Status: Complete on 2026-05-15. Hardened on 2026-05-27 so `smoke:release` runs the bad-path gate and `smoke:payment-spine` includes 100-creator payment spine coverage.

- [x] **Task 2: Release Story Map**
  - Create a single story map that groups the current broad working tree into coherent product stories.
  - Mark what belongs to private campaign OS, reporting trust, notifications, admin oversight, mobile creator app, localization, and cleanup.
  - Proof: document review plus `git diff --check`.
  - Status: Complete on 2026-05-16. The working tree was mapped into release review batches in `docs/superpowers/plans/2026-05-16-release-story-map.md`.

- [ ] **Task 3: Campaign Creation To Creator Preview Audit**
  - Audit the brand campaign builder against the creator-facing campaign preview.
  - Every brand field must either affect matching, creator instructions, compliance, reporting, pricing, or be removed.
  - Proof: focused tests for field propagation, browser smoke on `/b/campaigns/new`, `/apply/[id]`, and `/i/discover/[id]`.

- [ ] **Task 4: Creator First-Run Campaign Room**
  - Make the creator campaign room feel natural from first entry: brief, rules, tasks, assets, submit, and payment status must read as one handoff.
  - Preserve mobile-first luxury dark direction where intentional.
  - Proof: creator campaign smoke plus in-app browser mobile screenshot.

- [ ] **Task 5: Reporting Trust Closure**
  - Finish edge cases for missed reports, correction returned, rejected evidence history, verified evidence, shared reports, and export artifacts.
  - Keep report pages readable on mobile and desktop.
  - Proof: report workflow, recovery, late-report, share/export, and in-app browser smoke.

- [ ] **Task 6: Email And Notification Confidence**
  - Confirm every operational event that needs email has a queue event, template, preference behavior, retry path, and audit visibility.
  - Proof: queue-backed email, notification preferences, notification email, report correction notification, admin communications retry.

- [ ] **Task 7: Supabase Production Hardening**
  - Review migrations, RLS, bucket policies, Edge Function secrets, function invocation boundaries, advisor findings, and cleanup of removed social OAuth/cron paths.
  - Proof: Supabase advisor review, migration tests, RLS tests, and smoke against remote project where safe.

- [ ] **Task 8: Pricing And Billing Clarity**
  - Finalize the private campaign workspace pricing model in UI and data: $149 base, included limits, overages, invoice/payment status, and no creator payment processing.
  - Decide whether PopsDrops fee collection uses Stripe Checkout or invoice-only for launch.
  - Proof: campaign service package tests, UI smoke on campaign creation and detail.

- [ ] **Task 9: Admin Oversight Scope**
  - Keep admin as control tower, not campaign operator: communications, audit, users, revenue, concierge exceptions, and campaign support.
  - Remove or hide anything that implies admins run normal day-to-day campaign work.
  - Proof: admin table contract tests and in-app browser desktop smoke.

- [ ] **Task 10: Mobile App Release Readiness**
  - Keep Expo creator app aligned with web creator workflows and shared validation/types.
  - Verify language, dark styling, campaign room, discovery, earnings, profile, and notifications.
  - Proof: `npm run test:mobile` plus Expo smoke when native runtime is available.

## Execution Order

1. Release Smoke Command
2. Release Story Map
3. Campaign Creation To Creator Preview Audit
4. Creator First-Run Campaign Room
5. Reporting Trust Closure
6. Email And Notification Confidence
7. Supabase Production Hardening
8. Pricing And Billing Clarity
9. Admin Oversight Scope
10. Mobile App Release Readiness

## Completion Standard

The agenda is complete when a fresh checkout can run the release smoke command, compile, lint, build, pass core tests, and demonstrate the brand-to-creator-to-report loop in the in-app browser without manual patching.
