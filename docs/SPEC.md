# PopsDrops

Cross-border influencer marketing platform connecting global brands with vetted micro-creators in MENA, Central Asia, and emerging markets. Also provides market-entry brokerage services connecting brands with local distributors.

## Tech Stack

- **Framework:** Next.js 16.1.7+ (App Router, Turbopack, React Compiler, PPR) deployed on Vercel — pinned to ≥16.1.7 for CSRF fix (CVE-2026-27978)
- **Database/Auth/Storage/Realtime:** Supabase (Postgres + Auth + Storage + Realtime + pgvector + pg_trgm) — Small compute, Realtime spend cap removed
- **AI:** Vercel AI SDK (`ai` package) + Gemini API (translation, recommendations) + Cohere embed-v3 (multilingual embeddings for semantic search/matching)
- **Email:** AWS SES + React Email templates — SPF/DKIM/DMARC/SNS bounce handling configured
- **Translation:** Gemini API (auto-translate briefs to Arabic, French, Russian, Kazakh, Uzbek, Turkish)
- **Search:** Hybrid — tsvector (keyword) + pg_trgm (fuzzy) + pgvector with HNSW (semantic)
- **DNS:** Cloudflare (DNS only, no proxy — domain registered there)
- **Analytics:** Vercel Analytics (free)
- **Monitoring:** Axiom (OTel + Vercel log drains) + `function_execution_log` table
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Animation:** Motion v12 (`motion/react`) + Magic UI / Aceternity UI (landing page)
- **Icons:** Lucide React
- **Fonts:** Inter (Latin/Cyrillic) + Cairo (Arabic) — both Google Fonts, variable
- **Forms:** React Hook Form + Zod (shared validation client + server)
- **Tables:** TanStack Table v8 via shadcn DataTable
- **Command Palette:** cmdk via shadcn Command
- **Toasts:** Sonner
- **Rate Limiting:** Upstash Redis + @upstash/ratelimit
- **Bot Protection:** Cloudflare Turnstile (signup/public forms)
- **Mobile:** PWA with Web Push (Capacitor native wrapper planned for v2)
- **Testing:** Playwright (E2E) + Vitest (unit/component)
- **CI/CD:** GitHub Actions — lint + type check + test on every PR

## What This Is NOT

- NO Stripe Connect — we do NOT handle payments between brands and creators (payment tracking only: pending/invoiced/paid)
- NO PostHog — use Vercel Analytics only
- NO passwords — Google OAuth + magic link + OTP fallback only
- NO Cloudflare proxy — DNS only mode, Vercel handles CDN/edge
- NO Novel/Tiptap — broken RTL, XSS CVEs. Use structured forms for briefs
- NO WhatsApp integration for MVP — email is the only notification channel
- NO dark mode for MVP — light only, architected for future addition via CSS custom properties

## Design System

**Color:** Teal primary (`#0D9488` / teal-600) + Amber accent (`#F59E0B` / amber-500). NOT violet (Aspire owns purple). Teal bridges trust (blue) and Islamic green symbolism. Slate neutrals. Uses Tailwind's built-in scales.

**Typography:** Inter (Latin/Cyrillic) + Cairo (Arabic). Both variable, visually matched. Never use Noto Sans Arabic (too generic).

**Components:** rounded-lg buttons, rounded-xl cards, shadow-sm default, 8px spacing grid. See plan for full component specs.

**Philosophy:** "Modern Souq" — international, professional, with soul. Not Middle Eastern themed, not Silicon Valley. Like a premium coworking space in Dubai Marina.

## Architecture

Full implementation plan: `.claude/plans/typed-plotting-meerkat.md`

### Three apps in one

- `/i/*` — Creator app (mobile-first, bottom nav, daily-briefing-driven)
- `/b/*` — Brand dashboard (desktop-first, sidebar nav, campaign-driven)
- `/admin/*` — Admin operations center (desktop, sidebar with 10 sections)
- `/` — Marketing site (landing, /for-brands, /for-creators, /explore, /market-entry, /rate-calculator, /pricing, /about, /careers, /contact, legal pages, /c/[slug])

### Key Entities

- **Profiles** — extends Supabase Auth, role-based (creator/brand/admin)
- **Creator Profiles** — social accounts (TikTok, Instagram, Snapchat, YouTube, Facebook), niches, markets, rate card (per-platform per-format), tier (new/rising/established/top), ranking score, profile embedding (vector)
- **Brand Profiles** — company info, target markets, industry, rating
- **Campaigns** — 6-phase lifecycle: draft → recruiting → in_progress → publishing → monitoring → completed (+ paused/cancelled). Structured brief (description, requirements, do's, don'ts), deliverables, usage rights, budget tracking
- **Campaign Deliverables** — per-platform content specs (format, quantity, deadline)
- **Campaign Applications** — rate + pitch, with counter-offer support (counter_rate, counter_message)
- **Campaign Members** — accepted creators with payment status tracking
- **Content Submissions** — version history, revision count (max enforced), 6-state machine
- **Content Performance** — platform-specific fields, multiple measurement reads (48h initial, 7d final, 30d extended for YouTube)
- **Campaign Messages** — Broadcast-based realtime chat
- **Reviews** — bidirectional post-campaign ratings
- **Notifications + Notification Queue** — outbox pattern for reliable email delivery
- **Market Benchmarks** — per market × platform × format × tier × niche
- **Cultural Calendar** — Ramadan, Eid, Nauryz, Saudi National Day, etc.
- **Market Compliance** — UAE licensing, Saudi registration, per-market legal requirements
- **Playbooks** — campaign templates
- **Function Execution Log** — Edge Function monitoring

### 5 Supported Platforms

TikTok, Instagram, Snapchat, YouTube, Facebook. Each has different view/engagement definitions — metrics are NEVER mixed cross-platform.

## Auth Flow

Supabase Auth with:
- Google OAuth (primary)
- Magic link via email (AWS SES as custom SMTP)
- OTP fallback (for MENA email prefetchers that consume magic links)
- NO password auth. Ever.

After auth → role-based redirect:
- Creator → `/i/home`
- Brand → `/b/home`
- Admin → `/admin/`

New users → progressive onboarding (2 steps only, rest collected over time).

## Key Design Principles

1. **Every tap is intentional.** One clear next action per screen. If the user has to think, the page is broken.
2. **Two products in one shell.** Creators think "opportunities." Brands think "campaigns."
3. **Mobile-first for creators, desktop-first for brands.**
4. **Zero dead ends.** Every empty state has exactly one CTA.
5. **No page reloads for in-context actions.** Sheets, modals, intercepting routes.
6. **Optimistic UI everywhere.** Actions feel instant.
7. **Smart defaults.** Pre-fill from profile data. User changes what's wrong, not fills in what's blank.
8. **Skeleton loading, never spinners.**
9. **Earn trust through transparency.** Ratings, response times, completion rates, benchmarks.
10. **Progressive disclosure.** Show 3 things. Let the user ask for more.

## Business Logic

### Platform-Specific Metrics

Every platform measures differently. We NEVER sum or average raw metrics cross-platform.

- **Views**: TikTok = any play. YouTube long-form = 30 seconds. Instagram = any play (since Apr 2025). Snapchat = ~1 second.
- **Engagement**: Platform-specific interactions weighted differently (saves 12x, shares 6x, comments 4x a like).
- **CPM**: Different denominators per platform. Use CPE (Cost Per Engagement) as cross-platform equalizer.
- **PopsDrops Performance Score**: Percentile rank within same platform + tier + niche (0-100).

### Campaign Lifecycle — 6 Phases

Draft → Recruiting → In Progress → Publishing → Monitoring → Completed (+ Paused/Cancelled)

### Creator Tiers

New → Rising (3+ campaigns, 4.0+ rating) → Established (10+, 4.5+) → Top (25+, 4.7+, manual review). MVP ships New + Rising only.

## Backend Architecture

### Supabase Edge Functions (Deno — only DB-triggered work)
- `send-notification` — pg_cron 5-min batch + DB webhook for immediate priority
- `calculate-benchmarks` — pg_cron weekly

### Vercel API Routes / Server Actions (Node.js — everything else)
- `translate-brief` — Gemini API on campaign publish
- `match-creators` — Cohere embed-v3 similarity search
- `generate-report` — Vercel AI SDK generateObject for recommendations
- `update-response-time` — avg response time calculation
- `generate-embeddings` — Cohere embed-v3 on profile/campaign changes

### Security (Non-Negotiable)
- Pin Next.js ≥16.1.7, configure `serverActions.allowedOrigins`
- Rate limiting via Upstash Redis in middleware + per-action
- Cloudflare Turnstile on public forms
- Zod validation on every Server Action
- File upload validation via magic bytes
- getUser() always, getSession() never on server

## Email (AWS SES)

From: `notifications@popsdrops.com`
Templates: React Email (JSX-based, RTL-aware for Arabic)
SPF/DKIM/DMARC configured. SNS bounce/complaint handling. Auto-suppress bounced addresses.

## Business Model

- Creators: FREE forever
- Brands: Free during launch → per-campaign fee ($99-149) → subscription tiers ($299-999/mo)
- Market Entry Brokerage: connect brands with local distributors for MENA market entry, 10% commission on first-year sales (handled offline, sourced through platform)
- Future: Payment facilitation (escrow), benchmark data product for agencies

## Cold Start Strategy

1. Seed Riyadh first (25.3M Snapchat, 18.5M TikTok, Vision 2030 brand spending)
2. Manually recruit 50-100 micro-creators via DMs
3. MENA rate calculator as standalone SEO tool (drives organic inbound)
4. Concierge first 5-10 brand campaigns for free
5. Expansion: Riyadh → Dubai → Cairo → Casablanca → Almaty
