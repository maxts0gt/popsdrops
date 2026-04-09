# PopsDrops

Global cross-border influencer marketing platform connecting brands with vetted micro-creators across any market. Also provides market-entry brokerage services connecting brands with local distributors.

**Positioning:** PopsDrops is a GLOBAL platform. Not MENA. Not any specific region. Lead with cross-border capability, never geography. Think: the platform Chanel or Hermès would use to run creator campaigns in markets they can't reach.

**Legal Entity:** Tengri Vertex, LLC — Delaware LLC, principal office San Francisco, California. D/b/a PopsDrops.

## Tech Stack

- **Framework:** Next.js 16.1.7+ (App Router, Turbopack, React Compiler, PPR) deployed on Vercel — pinned to ≥16.1.7 for CSRF fix (CVE-2026-27978)
- **Database/Auth/Storage/Realtime:** Supabase (Postgres + Auth + Storage + Realtime + pgvector + pg_trgm)
- **AI:** Vercel AI SDK (`ai` package) + Gemini API (translation, recommendations) + Cohere embed-v3 (multilingual embeddings for semantic search/matching)
- **Email:** AWS SES + React Email templates — SPF/DKIM/DMARC/SNS bounce handling configured
- **Translation:** Static bundled UI i18n — 30 curated locales generated offline with Gemini and checked into the repo. Runtime AI translation remains only for dynamic content like briefs.
- **Search:** Hybrid — tsvector (keyword) + pg_trgm (fuzzy) + pgvector with HNSW (semantic)
- **DNS:** Cloudflare (DNS only, no proxy — domain registered there)
- **Analytics:** Vercel Analytics (free)
- **Monitoring:** Axiom (OTel + Vercel log drains) + `function_execution_log` table
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Animation:** Motion v12 (`motion/react`)
- **Icons:** Lucide React
- **Fonts:** Inter (Latin/Cyrillic) + Cairo (Arabic) — both Google Fonts, variable
- **Forms:** React Hook Form + Zod (shared validation client + server)
- **Tables:** TanStack Table v8 via shadcn DataTable
- **Command Palette:** cmdk via shadcn Command
- **Toasts:** Sonner
- **Rate Limiting:** Upstash Redis + @upstash/ratelimit
- **Bot Protection:** Cloudflare Turnstile (signup/public forms)
- **Mobile:** Expo (React Native) app for creators in `mobile/` — shares types, constants, validations via `shared/`. NativeWind for styling, Expo Router for navigation.
- **Testing:** Playwright (E2E) + Vitest (unit/component)
- **CI/CD:** GitHub Actions — lint + type check + test on every PR

## What This Is NOT

- NO Stripe Connect — we do NOT handle payments (payment status tracking only: pending/invoiced/paid)
- NO PostHog — use Vercel Analytics only
- NO passwords — Google OAuth + magic link + OTP fallback only
- NO Cloudflare proxy — DNS only mode, Vercel handles CDN/edge
- NO Novel/Tiptap — broken RTL, XSS CVEs. Use structured forms for briefs
- NO WhatsApp integration for MVP — email is the only notification channel
- NO dark mode for MVP — light only
- NO PWA / Capacitor — Expo (React Native) for mobile
- NO self-serve signup for brands — invite-only, vetted, concierge onboarded
- NO chat system for MVP — email notifications only
- NO payment processing — status tracking only
- NO placeholder pages — every page must have real, intentional content

## Design System

### Visual Identity

**Color:** Slate-900 (`#0F172A`) as primary brand color. Monochrome UI. Teal (`#0D9488`) and Amber (`#F59E0B`) used only as subtle atmospheric accents (gradient orbs in hero), never as UI chrome. White surfaces. Slate neutrals.

**Typography:** Inter (Latin/Cyrillic) + Cairo (Arabic). Both variable, visually matched. Never use Noto Sans Arabic (too generic). CJK uses system fonts.

**Components:** rounded-xl cards, rounded-lg buttons, shadow-sm default, 8px spacing grid. Cards use `ring-1 ring-slate-900/[0.03]` for subtle depth.

### Philosophy — "Refined Confidence"

Premium, global, minimal. The kind of platform luxury brands would trust. Not flashy, not minimal-boring — intentional in every detail. Like Linear meets Stripe.

**NOT:** Middle Eastern themed, Silicon Valley generic, or AI-slop aesthetic. No gradients on buttons. No teal/amber colored UI elements. No feature cards with descriptions — use title-only chips.

### Landing Page Pattern

Dark hero (`slate-950`) with atmospheric gradient orbs → clean white content sections. Header is transparent on dark hero, transitions to solid white on scroll. This pattern is ONLY for the landing page — all other pages have white backgrounds with solid headers.

### Key Patterns

- **Dark hero** — Landing page only. `bg-slate-950` with subtle `teal-500/[0.07]` and `amber-500/[0.05]` gradient orbs. Grid texture at 3% opacity.
- **Adaptive header** — `fixed`, transparent with white text on dark hero, `bg-white/90 backdrop-blur-xl` on scroll or on light pages. Uses `usePathname()` to detect.
- **Feature chips** — Title-only (`rounded-full border border-slate-200 px-4 py-2 text-sm`). No descriptions. Fewer strings to translate.
- **Mock UI previews** — Report (landing), Dashboard (for-brands), Media kit (for-creators). Each page has ONE unique visual. Zero overlap.
- **Path cards** — Icons + title + description + "Learn more →". Hover lift with `-translate-y-0.5`.
- **Window chrome** — Colored dots (red/amber/green), dark active tab, tabs for context.

## Architecture

### Four products

- `/` — Marketing site: landing, /for-brands, /for-creators, /partners, /terms, /privacy
- `/i/*` — Creator app (mobile-first, bottom nav)
- `/b/*` — Brand dashboard (desktop-first, sidebar nav)
- `/admin/*` — Admin center (desktop, sidebar) — build later, use Supabase dashboard initially

### Access Model

- **Brands:** Invite-only. Submit request form → admin reviews → approve/reject → magic link email → onboarding
- **Creators:** Open signup. Profile must meet quality threshold (real social accounts, minimums) to appear in brand search results. Incomplete profiles exist but are invisible to brands.
- **Admin:** Max only, initially via Supabase dashboard

### Key Entities

- **Waitlist** — brand/creator requests with company info, social handles, reason for joining. Status: pending/approved/rejected
- **Profiles** — extends Supabase Auth, role-based (creator/brand/admin)
- **Creator Profiles** — social accounts (TikTok, Instagram, Snapchat, YouTube, Facebook), niches, markets, rate card (per-platform per-format), tier, ranking score, profile embedding (vector)
- **Brand Profiles** — company info, target markets, industry, rating
- **Campaigns** — 6-phase lifecycle: draft → recruiting → in_progress → publishing → monitoring → completed (+ paused/cancelled). Structured brief, deliverables, usage rights, budget tracking
- **Campaign Applications** — rate + pitch, with counter-offer support
- **Campaign Members** — accepted creators with payment status tracking
- **Content Submissions** — version history, revision count (max enforced), state machine
- **Content Performance** — platform-specific fields, multiple measurement reads
- **Reviews** — bidirectional post-campaign ratings
- **Notifications** — outbox pattern for reliable email delivery

### 5 Supported Platforms

TikTok, Instagram, Snapchat, YouTube, Facebook. Each has different view/engagement definitions — metrics are NEVER mixed cross-platform.

### Build Order

1. **Database schema** — all tables, RLS policies, TypeScript types
2. **Auth + Waitlist** — Google OAuth + magic link, brand request form, approval flow
3. **Creator side** — onboarding, profile, campaign discovery (supply first)
4. **Brand side** — onboarding, campaign creation, creator discovery, content review
5. **Core loop** — applications, content submissions, approvals, reports
6. **Admin** — only when manual Supabase operations become painful (~100+ users)
7. **Flutter mobile** — creator app, month 3-4

## Auth Flow

Supabase Auth with:
- Google OAuth (primary)
- Magic link via email (AWS SES as custom SMTP)
- OTP fallback (for email prefetchers that consume magic links)
- NO password auth. Ever.

After auth → role-based redirect:
- Creator → `/i/home`
- Brand → `/b/home`
- Admin → `/admin/`

New users → progressive onboarding (2 steps only, rest collected over time).

### Dev Login (Local Development Only)

For local testing, use the dev login bypass at **`/dev/login`**. One-click sign-in as any role — no password auth needed.

**How it works:**
- `/dev/login` page shows role cards (Creator, Brand, Admin)
- Clicking a card hits `/auth/dev-login?role=creator|brand|admin`
- Server route uses `SUPABASE_SERVICE_ROLE_KEY` to generate a magic link via admin API, verifies it server-side, sets session cookies, and redirects to the appropriate home page
- Users are auto-provisioned on first login (profile + role-specific profile created automatically)
- Blocked in production (`NODE_ENV === "production"` returns 404)

**Dev user emails:** `creator@dev.popsdrops.com`, `brand@dev.popsdrops.com`, `admin@dev.popsdrops.com`

**Direct URL login:** `http://localhost:3000/auth/dev-login?role=brand` (skips the UI page)

## Design Principles

1. **Every tap is intentional.** One clear next action per screen.
2. **Two products in one shell.** Creators think "opportunities." Brands think "campaigns."
3. **Mobile-first for creators, desktop-first for brands.**
4. **Zero dead ends.** Every empty state has exactly one CTA.
5. **No page reloads for in-context actions.** Sheets, modals, intercepting routes.
6. **Optimistic UI everywhere.** Actions feel instant.
7. **Smart defaults.** Pre-fill from profile data.
8. **Skeleton loading, never spinners.**
9. **Earn trust through transparency.** Ratings, response times, benchmarks.
10. **Progressive disclosure.** Show 3 things. Let the user ask for more.
11. **No placeholders.** Every page ships with real content or doesn't ship.
12. **Fewer words.** Charts and dashboards speak better than copy. Less text = less to translate.
13. **Premium positioning.** Design as if Chanel is evaluating us. Every pixel matters.

## What Creators Need

- Find paid work → **Campaign discovery + apply**
- Know what to make → **Brief (auto-translated to their language)**
- Submit work → **Content upload + revision flow**
- Track payments → **Earnings tracking** (status only, not processing)
- Look professional → **Profile / media kit**
- Know their worth → **Rate benchmarks**

## What Brands Need

- Describe what they want → **Campaign builder** (structured brief)
- Find the right creators → **Creator discovery + AI matching**
- Manage the work → **Content review + approve/reject**
- Prove ROI → **Campaign report**
- Track spend → **Budget tracking**

## What Admin Needs

- Control who's in → **Waitlist review + approve/reject**
- See what's happening → **Dashboard** (active campaigns, flags)
- Intervene when needed → **User management**
- Measure the business → **Platform metrics**

## Business Logic

### Platform-Specific Metrics

Every platform measures differently. We NEVER sum or average raw metrics cross-platform.

- **Views**: TikTok = any play. YouTube long-form = 30 seconds. Instagram = any play. Snapchat = ~1 second.
- **Engagement**: Platform-specific interactions weighted differently (saves 12x, shares 6x, comments 4x a like).
- **CPM**: Different denominators per platform. Use CPE (Cost Per Engagement) as cross-platform equalizer.

### Campaign Lifecycle — 6 Phases

Draft → Recruiting → In Progress → Publishing → Monitoring → Completed (+ Paused/Cancelled)

### Creator Tiers

New → Rising (3+ campaigns, 4.0+ rating) → Established (10+, 4.5+) → Top (25+, 4.7+, manual review). MVP ships New + Rising only.

## i18n — Static, Premium, Fast

The platform ships with 30 reviewed UI locales bundled into the web and mobile apps. Language switching is instant and does not call Gemini or the database at runtime for fixed interface copy.

### How it works

English source strings live in `src/lib/i18n/strings.ts` organized by page key. Locale bundles are generated offline into checked-in JSON artifacts for public web, signed-in web, and mobile. Route shells seed those bundles at render time, so UI copy is served directly from the app bundle.

**Runtime behavior:**
1. Build-time bundle generation — Gemini generates locale JSON offline
2. App bundle / prerendered HTML — web serves bundled copy directly
3. In-memory UI state — switching locales is just a bundle swap, no network translation call

**Locale detection:** Cookie → profile preference → Accept-Language header → English default. Unsupported locales fall back to English; UI does not generate new locales on demand.

**RTL detection:** Known RTL set (ar, he, fa, ur, ps, sd, yi, dv, ku, ckb, ug) + `Intl.Locale.getTextInfo()` for dynamic detection.

### Rules for writing new components

1. **NEVER hardcode user-facing text.** Every string goes through `t("key")`.
2. **Add strings to `strings.ts` FIRST.** Then use `t("key")` in the component.
3. **Use CSS logical properties.** `ms-4` not `ml-4`, `start-0` not `left-0`, `text-start` not `text-left`.
4. **Flexible layouts.** Never fixed widths on text. Arabic/Russian = 30% longer. CJK = shorter.
5. **Directional icons flip in RTL.** Use `isRTL` from `useI18n()` or `rtl:rotate-180`.
6. **Variables use `{braces}`.** e.g. `t("greeting", { name })`.
7. **Platform names stay in English.** TikTok, Instagram, CPM, CPE — never translated.
8. **Numbers stay in Western Arabic numerals.** Use `Intl.NumberFormat` for formatting.
9. **Legal pages are English-only.** No translation. No i18n hooks.
10. **Demo/mock data stays in English.** Creator names, country names in previews — universal.

### Language switcher

- **Pinned (top):** Current locale + English (always)
- **Divider**
- **All languages:** 30 curated locales sorted alphabetically by native display name

### 30 Curated Locales

en, ar, bn, de, el, es, fa, fr, he, hi, id, it, ja, kk, ko, ms, nl, pl, pt, ro, ru, sv, sw, th, tl, tr, uk, uz, vi, zh

### i18n File Map

- `src/lib/i18n/strings.ts` — English source strings, `LOCALE_DISPLAY_NAMES`, `getLocaleDisplayName()`, `isRTLLocale()`
- `src/lib/i18n/context.tsx` — `I18nProvider`, `useI18n()`, `useTranslation()` hooks
- `src/lib/i18n/server.ts` — `getLocale()`, `getDetectedLocales()`, bundle resolvers
- `src/lib/i18n/generated/public-bundles/*` — public marketing locale bundles
- `src/lib/i18n/generated/platform-bundles/*` — signed-in web locale bundles
- `mobile/lib/generated/mobile-bundles/*` — mobile locale bundles
- `src/lib/supabase/middleware.ts` — Locale detection from cookie → Accept-Language
- `src/components/language-switcher.tsx` — Globe dropdown (default, minimal, dark, header variants)
- `scripts/generate-public-translation-bundles.mjs` — regenerate public locale bundles
- `scripts/generate-platform-translation-bundles.mjs` — regenerate signed-in web locale bundles
- `scripts/generate-mobile-translation-bundles.mjs` — regenerate mobile locale bundles

## Backend Architecture

### Vercel Server Actions (Node.js)
- `translate-brief` — Gemini API on campaign publish
- `match-creators` — Cohere embed-v3 similarity search
- `generate-report` — Vercel AI SDK generateObject
- `generate-embeddings` — Cohere embed-v3 on profile/campaign changes

### Security (Non-Negotiable)
- Pin Next.js ≥16.1.7, configure `serverActions.allowedOrigins`
- Rate limiting via Upstash Redis in middleware + per-action
- Cloudflare Turnstile on public forms
- Zod validation on every Server Action
- File upload validation via magic bytes
- `getUser()` always, `getSession()` never on server

## Email (AWS SES)

From: `notifications@popsdrops.com`
Templates: React Email (JSX-based, RTL-aware)
SPF/DKIM/DMARC configured. SNS bounce/complaint handling.

## Business Model

- Creators: FREE forever
- Brands: Invite-only. Free during launch → per-campaign fee → subscription tiers
- Market Entry Brokerage: connect brands with local distributors, 10% commission on first-year sales (separate service, `/partners` page)

## Marketing Site Pages

| Route | Status | i18n | Notes |
|-------|--------|------|-------|
| `/` | ✅ Built | Translated | Dark hero, campaign report preview |
| `/for-brands` | ✅ Built | Translated | Dashboard preview, feature chips |
| `/for-creators` | ✅ Built | Translated | Media kit preview, feature chips |
| `/partners` | ✅ Built | English only | Brokerage service, two-sided |
| `/terms` | ✅ Built | English only | Real ToS for Tengri Vertex, LLC |
| `/privacy` | ✅ Built | English only | Real Privacy Policy, CCPA/GDPR |
| `/login` | ✅ Built | Translated | Google OAuth + magic link |
