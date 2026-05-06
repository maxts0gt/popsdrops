---
version: alpha
name: PopsDrops
description: Global cross-border creator campaign desk for invite-only brands and vetted creators.
colors:
  primary: "#0F172A"
  primary-foreground: "#FFFFFF"
  background: "#FFFFFF"
  foreground: "#0F172A"
  card: "#FFFFFF"
  muted: "#F1F5F9"
  muted-foreground: "#64748B"
  border: "#E2E8F0"
  hero-background: "#020617"
  accent-teal: "#0D9488"
  accent-amber: "#F59E0B"
  destructive: "#DC2626"
  mobile-dark-background: "#000000"
  mobile-dark-card: "#0A0A0A"
  mobile-dark-foreground: "#FFFFFF"
  mobile-dark-border: "#262626"
typography:
  display:
    fontFamily: Inter
    fontSize: 4.5rem
    fontWeight: 650
    lineHeight: 0.95
    letterSpacing: 0
  h1:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: 650
    lineHeight: 1
    letterSpacing: 0
  h2:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 640
    lineHeight: 1.15
    letterSpacing: 0
  h3:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 620
    lineHeight: 1.3
    letterSpacing: 0
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 560
    lineHeight: 1.2
    letterSpacing: 0
  arabic-body:
    fontFamily: Cairo
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  2xl: 18px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  page-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 0px
  landing-hero:
    backgroundColor: "{colors.hero-background}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.display}"
    rounded: "{rounded.sm}"
    padding: 48px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
  app-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 24px
  feature-chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.2xl}"
    padding: 8px
  input-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  report-metric:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 16px
  mobile-shell-dark:
    backgroundColor: "{colors.mobile-dark-background}"
    textColor: "{colors.mobile-dark-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 0px
  mobile-card-dark:
    backgroundColor: "{colors.mobile-dark-card}"
    textColor: "{colors.mobile-dark-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 20px
  danger-action:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 40px
---

## Overview

PopsDrops is a global cross-border creator campaign desk. It helps brands run creator campaigns in markets they cannot reach alone, and it helps vetted creators receive paid, translated, professional briefs. Lead with global capability, not a geography or niche.

The product personality is "Refined Confidence": premium, minimal, operational, and trustworthy. It should feel like a platform a luxury brand could use without hesitation. The experience should be quiet and sharp, closer to Linear plus Stripe than a public influencer marketplace.

The product bar is set by the clients and talent PopsDrops must be able to serve. Design every workflow as if a Hermes or Chanel campaign manager is reviewing it, and as if the creator talent could be Lisa from BLACKPINK or Lionel Messi. This is an operating standard, not a public claim of current clients. The platform must protect brand reputation, talent privacy, evidence integrity, and executive reporting quality at that level.

The current business posture is invite-led. Brands are reviewed and onboarded. Creators join the invite-only Creator Network and are surfaced for sourced campaigns when there is a strong fit. The marketplace should not feel open, noisy, or empty. If supply is limited, show curation, invite status, and concierge workflows instead of fake abundance.

## Product Goal

Build PopsDrops into a self-running, invite-led cross-border creator campaign platform. Brands should create, run, track, and report private or sourced campaigns without PopsDrops manually operating approvals or campaign work. PopsDrops intervenes only for invite vetting, sourced creator shortlists, and exceptional support. Every UI decision must feel intentional, premium, light, tested, and smoke-tested.

Every product decision must pass the intentionality test:

1. What user job does this serve?
2. What downstream output uses this information?
3. Does this help matching, instruction, approval, reporting, pricing, or compliance?
4. What edge case does this prevent?

If a field, card, or screen does not answer at least one of those questions, remove it.

## Colors

The web platform is monochrome-first. Slate-900 (`#0F172A`) is the primary brand color and should carry navigation, primary actions, headings, and serious interface chrome. White surfaces, slate text, and light slate borders form the default application environment.

Teal (`#0D9488`) and amber (`#F59E0B`) are atmospheric accents only. Use them for subtle landing hero ambience, small chart distinction, or rare status warmth. Do not use teal or amber as button colors, active tabs, badges, navigation, or generic UI chrome.

Marketing landing pages may use a dark slate hero with subtle atmosphere. Signed-in web surfaces use light application shells. Do not add broad web dark mode for the current product scope.

Mobile creator surfaces may use the intentional luxury dark direction: pure black, crisp white, restrained borders, and high contrast. This is a mobile product choice, not a global web theme. Keep it stark, calm, and premium.

Status colors should be functional and sparse. Use destructive red only for irreversible or serious actions. Prefer language, grouping, and hierarchy before reaching for color.

## Typography

Use Inter for Latin and Cyrillic interfaces. Use Cairo for Arabic. CJK locales should use system fonts. Do not use Noto Sans Arabic.

Typography should be calm and precise. Use large display type only for true marketing heroes. Dashboards, sidebars, forms, reports, and mobile cards need compact headings that fit operational work.

Letter spacing is always `0`. Do not use negative letter spacing. Do not scale font size with viewport width. Instead, use responsive layout, wrapping, and tighter hierarchy.

Keep copy short. PopsDrops should sound confident, not promotional. Prefer concrete product nouns: campaign, brief, creator, market, report, approval, shortlist, deliverable.

All user-facing strings must go through the i18n system. Add source strings before using them. Use CSS logical properties (`ms-*`, `ps-*`, `start-*`, `text-start`) so RTL layouts are first-class.

## Iconography And Copy Punctuation

Do not use sparkle, magic wand, starburst, or decorative AI icons anywhere in the product. This includes Lucide `Sparkles`, `Sparkle`, `WandSparkles`, `Stars`, and visually similar marks. Use literal operational icons instead: `Users`, `Search`, `Target`, `BadgeCheck`, `FileText`, `BarChart3`, `LineChart`, or `ShieldCheck`.

Copy uses commas, periods, colons, parentheses, or simple hyphens. Do not use em dash characters in UI copy, docs, metadata, comments, generated source strings, or tests.

## Layout

PopsDrops has four product areas:

- Marketing site (`/`): public positioning, dark landing hero only, clean white sections after the hero.
- Creator web app (`/i/*`): mobile-first opportunity workspace with bottom navigation.
- Brand dashboard (`/b/*`): desktop-first campaign operations with sidebar navigation.
- Admin (`/admin/*`): dense internal operations surface for review, intervention, and measurement.

Marketing pages should reveal the real product or a concrete product preview in the first viewport. Do not make generic landing pages that talk around the product.

Brand dashboards are work surfaces. Prioritize scanability, tables, filters, campaign state, next actions, and reporting. Avoid oversized editorial sections, decorative cards, or marketing-style composition inside the dashboard.

Creator surfaces should feel fast and personal. A creator should immediately know the next best action: complete profile, view invite status, review a brief, apply, submit content, respond to revision feedback, or check payment status.

Brief builder layouts must be modular. Think blocks, not a giant text editor. Each block should have a clear purpose and downstream use:

- Product and offer -> creator context and content accuracy.
- Market and audience -> matching, localization, and report segmentation.
- Platform and format -> deliverables and performance metrics.
- Claims and compliance -> review criteria and revision reasons.
- Usage rights -> pricing, approval, and legal clarity.
- Creator criteria -> sourcing and matching.
- Timeline -> reminders and campaign phase movement.
- Reporting goals -> final report structure.

Prefer progressive disclosure. Show the next three useful things. Let users expand when they need detail.

## Elevation & Depth

Use restraint. Default depth is `shadow-sm` with subtle rings like `ring-1 ring-slate-900/[0.03]`. Cards should feel like organized work surfaces, not decorative containers.

Do not nest cards inside cards. Page sections should be full-width bands or unframed layouts with constrained inner content. Cards are for repeated items, modals, preview panes, and genuinely framed tools.

Use hover lift sparingly (`-translate-y-0.5`) on marketing path cards and selectable objects. Operational tables and forms should prioritize stability over motion.

Skeleton loading is preferred over spinners. Loading states should preserve layout and communicate what is arriving.

## Shapes

Use the established radius scale:

- Buttons: rounded-lg / 8px.
- Cards: rounded-xl / about 14px.
- Chips: rounded-full only when they are small, title-only filters or attributes.
- Inputs: rounded-lg / 8px.
- Modals and sheets: rounded-xl where appropriate.

Do not use pill-shaped rectangles as a substitute for familiar icons in controls. Use Lucide icons for common actions, with tooltips when the icon is not obvious.

Keep fixed-format UI stable. Boards, grids, toolbars, counters, tiles, tabs, and icon buttons need stable dimensions so hover states, dynamic labels, or translated text do not shift the layout.

Metric cards must keep numeric values on a shared baseline. Labels may wrap, especially in translated UI, but the primary number row cannot move up or down between sibling cards. Use fixed row structure or reserved label height, and keep secondary detail anchored to the bottom.

## Components

### Campaign Builder

The campaign builder is the core brand product. It should feel like assembling an intentional operating brief, not filling out paperwork. Use structured blocks with clear labels, smart defaults, validation, and preview summaries.

Every campaign block should expose what it controls downstream. A brand should understand that adding a claim, market, creator criterion, or reporting goal affects matching, creator instructions, review, or reporting.

Private and sourced campaign modes should be distinct:

- Private campaign: the brand brings creators or promoters; PopsDrops provides the campaign workspace, brief, approval flow, reminders, and report.
- Sourced campaign: PopsDrops helps find or shortlist creators; the platform should emphasize fit, criteria, and reviewable recommendations.

Pricing UI should present price, scope, who sources creators, included operations, and one next action. Do not bury pricing in long paragraphs.

### Creator Network

The Creator Network should feel curated and professional. Avoid open marketplace signals such as endless browsing, inflated counts, or empty public directories. When there are not enough creators or campaigns, use invite status, profile readiness, and "we will consider you for sourced campaigns" flows.

Creator profile completion must be progressive. Ask for the minimum needed now, then collect richer data when it improves matching or campaign readiness.

### Reports

Reporting is a core reason brands should choose PopsDrops. Reports must be designed from the beginning, not bolted on.

Never sum or average raw metrics across platforms when definitions differ. Keep TikTok, Instagram, Snapchat, YouTube, and Facebook metrics platform-specific. Use cross-platform equalizers such as CPE only when definitions are clear.

Reports should define what each number means, show source/platform, include creator-level detail, and produce an executive-ready summary. The interface should help a brand answer: what worked, why, what to do next, and who to rebook.

### Empty States

Zero dead ends. Every empty state has exactly one primary CTA. Use empty states to move the user forward: create campaign, request shortlist, complete profile, invite creators, submit content, or review report.

### Forms

Use React Hook Form and Zod-backed validation patterns. Inline validation should be specific and recoverable. Avoid giant free-text fields unless the field is intentionally dynamic content.

Do not use Novel or Tiptap. Briefs are structured forms because RTL, translation, compliance, and reporting all depend on structure.

### Navigation

Creators think in opportunities. Brands think in campaigns. Navigation labels, empty states, and primary CTAs should respect that mental model.

Use one primary action per screen. Secondary actions should be visible but quiet. Destructive actions require clear confirmation and should never be the default.

## Do's and Don'ts

Do:

- Keep PopsDrops global, premium, and cross-border.
- Use market or category templates as presets, never as hardcoded architecture.
- Design the brief builder as modular blocks with downstream consequences.
- Treat reporting as a product advantage and design for it early.
- Use concise copy, real data, and clear next actions.
- Verify significant UI changes in both desktop web and mobile-width in-app browser views.
- Preserve RTL, i18n, and long-string resilience in every component.
- Use charts, tables, summaries, and status hierarchy before adding explanatory text.

Don't:

- Do not position PopsDrops as MENA-only, K-beauty-only, or any single-region platform.
- Do not build an open marketplace feel during the invite-only stage.
- Do not add placeholder pages or fake abundance.
- Do not use teal or amber as routine UI chrome.
- Do not add gradients to buttons.
- Do not create feature-card walls with long descriptions.
- Do not mix platform metrics as if they share definitions.
- Do not add chat, WhatsApp, password auth, PWA, Stripe Connect, or creator payment processing for the current product scope.
- Do not hardcode user-facing strings outside the i18n system.
- Do not make UI that requires the user to understand internal platform logic before taking the next action.
