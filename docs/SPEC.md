# PopsDrops

Global cross-border influencer marketing platform connecting brands with vetted micro-creators across any market. PopsDrops also offers market-entry brokerage by connecting brands with local distributors.

PopsDrops is global by design. Product, copy, and visual design should lead with cross-border capability, not any specific geography.

## Stack

- **Web:** Next.js 16.2.1, App Router, React 19, deployed as the product interface layer
- **Mobile:** Expo React Native creator app in `mobile/`
- **Backend:** Supabase Postgres, Auth, Storage, Realtime, Edge Functions, pgvector, pg_trgm
- **AI:** Gemini for dynamic brief translation and evidence extraction, Cohere embed-v3 for multilingual embeddings
- **Email:** AWS SES with React Email templates
- **i18n:** Static checked-in UI bundles for 30 curated locales; runtime AI translation is only for dynamic content
- **Styling:** Tailwind CSS v4, shadcn/ui, Lucide, Motion
- **Forms:** React Hook Form and Zod
- **Testing:** Vitest plus Playwright/E2E coverage

## Product Areas

- `/` marketing site: landing, `/for-brands`, `/for-creators`, `/partners`, legal pages, login and invite request
- `/i/*` creator web app: mobile-first creator workspace
- `/b/*` brand dashboard: desktop-first campaign and creator management
- `/admin/*` admin center: operations surface for approvals, campaigns, users, settings, audit, and reporting
- `mobile/` Expo creator app sharing selected types, constants, validations, and generated locale bundles

## Access Model

- **Brands:** invite-only, reviewed before onboarding
- **Creators:** open signup, with profile quality thresholds before appearing in brand search
- **Admin:** tightly scoped internal operations
- **Auth:** Google OAuth, magic link, OTP fallback; no password auth
- **Local dev:** `/dev/login` supports role-based dev sessions and is blocked in production

## Design Direction

PopsDrops should feel premium, global, minimal, and trustworthy. The visual system is monochrome-first with Slate-900 (`#0F172A`) as the brand color. Teal and amber are subtle atmospheric accents only, not UI chrome. No broad web dark mode for the current product scope; mobile creator surfaces may use intentional luxury dark styling.

Marketing uses the dark landing hero pattern; platform pages use light application surfaces with solid headers, sidebars, bottom navigation where appropriate, skeleton loading, and no dead-end empty states.

## Domain Model

Core entities:

- waitlist requests
- profiles, creator profiles, brand profiles
- campaigns and campaign deliverables
- campaign applications and counter-offers
- campaign members with payment status tracking
- content submissions with revision workflow
- content performance reads with platform-specific metrics
- reviews
- notifications and notification queue
- reporting requirements, evidence records, review state, and correction history
- admin audit log and platform settings

Campaign lifecycle:

`draft -> recruiting -> in_progress -> publishing -> monitoring -> completed`

Additional statuses: `paused`, `cancelled`.

Campaign and reporting platforms:

Campaign setup supports TikTok, Instagram, Snapchat, YouTube, and Facebook as publishing platforms. Reporting templates also support X and Generic proof entries because creators may submit evidence from a required channel that is not a first-class campaign platform yet.

Platform metrics must not be mixed raw across platforms. Use platform-specific definitions and cross-platform equalizers such as CPE when comparing performance.

Creator reporting is evidence-first. Creators submit content links, evidence screenshots or platform exports, and metric values. Gemini may extract values from screenshots, but creators confirm or correct those values before the brand report uses them. Platform-token connections are not part of the current reporting architecture; any future verification layer needs a new product decision, privacy model, and written workflow.

Do not infer backend architecture from dormant implementation scaffolding. Old tables, helpers, or route names are not product requirements. Cron jobs, token refresh, platform API metric fetchers, scheduler extensions, and Vault secrets require an explicit product decision and a written user workflow before implementation.

## i18n Rules

- User-facing UI strings go through `t("key")`.
- Add source strings before using them in components.
- Use logical CSS properties (`ms-*`, `ps-*`, `start-*`, `text-start`) for RTL support.
- Platform names, CPM, and CPE stay in English.
- Legal pages are English-only.
- Demo/mock data stays in English.

## Security Rules

- Keep Next.js pinned at or above the CSRF-fixed baseline.
- Configure `serverActions.allowedOrigins`.
- Use `getUser()` on the server, not `getSession()`.
- Validate every Server Action with Zod.
- Use Turnstile and rate limiting on public forms.
- Never expose service-role keys to clients.
- Keep RLS enabled for exposed Supabase tables.

## Backend Runtime Boundary

Next.js is the product interface layer. Supabase is the operational backend.

Next.js owns page rendering, app shell, forms, dashboard presentation, and thin orchestration. Supabase owns Postgres, Auth, Storage, RLS, Realtime, project secrets, Edge Functions, audit/event writes, AI extraction, dynamic translation, report generation, email dispatch, and explicitly approved lifecycle automation.

Do not put secret-heavy, scheduled, long-running, high-volume, Storage-processing, or lifecycle-critical business logic in Next.js Server Actions by default. Build those operations as Supabase Edge Functions or Postgres functions when the logic belongs close to data. Any background automation needs an explicit product workflow and cannot be inferred from old scaffolding.

Payment secrets are Supabase-only. Stripe Checkout Session creation lives in `create-stripe-checkout-session`; Stripe webhook verification lives in `stripe-webhook`. Next.js may initiate the user action, but it must never read `STRIPE_SECRET_KEY` or webhook signing secrets.

For 1M-user scale, avoid creating two backend cost centers. Supabase should absorb operational backend scale because database compute, Auth MAU, Storage, egress, RLS, Edge Functions, and secrets live there. Vercel/Next.js should not become the place where expensive background jobs, AI jobs, or repeated report processing run.

## Current Implementation Notes

- Supabase migrations live in `supabase/migrations`.
- Supabase Edge Functions live in `supabase/functions`.
- Generated database types live in `src/types/database.ts`.
- Public and platform translation bundles live under `src/lib/i18n/generated`.
- Mobile translation bundles live under `mobile/lib/generated`.
- The local web helper script is `.claude/dev.sh`.
- The local Expo web helper script is `.claude/expo-dev.sh`.
