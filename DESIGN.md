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
  helper-action:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 36px
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

The current business posture is invite-led and private by default. Brands are reviewed and onboarded, then use PopsDrops as a private campaign OS for creators they already want to invite. Concierge sourcing is rare, custom quoted, and reserved for high-touch situations where PopsDrops has explicitly scoped creator targets, market complexity, outreach labor, feasibility, and brand risk. Do not imply that a fixed low fee buys creator sourcing or unlimited PopsDrops labor.

## Product Goal

Build PopsDrops into a self-running, invite-led cross-border creator campaign platform. Brands should create, run, track, and report private campaigns without PopsDrops manually operating day-to-day campaign work. PopsDrops intervenes only for invite vetting, accepted Concierge sourcing scopes, and exceptional support. Every UI decision must feel intentional, premium, light, tested, and smoke-tested.

The default paid unit is the Private Campaign OS. Current launch pricing is $149 per private campaign workspace. The base includes up to 10 accepted creators, 45 active campaign days, and 14 reporting days after the campaign ends. Overage pricing must stay visible and mechanical: $49 per additional 10 accepted creators, $49 per additional 30 active days, and $29 per additional 30 reporting days. Enterprise Concierge is custom quote only, not a self-serve package.

Every product decision must pass the intentionality test:

1. What user job does this serve?
2. What downstream output uses this information?
3. Does this help matching, instruction, approval, reporting, pricing, or compliance?
4. What edge case does this prevent?

If a field, card, or screen does not answer at least one of those questions, remove it.

Data-driven compliance, privacy, security, and legal surfaces must use human product language first. In user-facing navigation and headings, prefer "Privacy & data" and "Privacy requests" over internal legal labels such as "data rights". Keep data export and deletion workflows self-serve and automatic wherever possible, with admin surfaces reserved for exceptions, audit evidence, and legally required review.

Bulk creator intake must stay a lightweight import tray, not a CRM. The tray should show open seats, duplicates, invalid rows, and over-capacity rows before save; email contacts may queue through notifications when the invite link is unlocked, while handles remain manual outreach.

If a pasted invite list exceeds open seats, keep the user inside the same flow. Show the extra contact count and provide one quiet action to review the nearest paid creator capacity, preselected in billing scope. Do not make the manager hunt through setup tabs or guess why valid contacts were not saved.

Saved invite lists need lightweight row controls. At 50 or 100 creators, managers must be able to search contacts, filter by outreach state, send saved email invites after the campaign unlocks, and remove mistakes without leaving the creator workspace. Keep this as a compact tray, not a CRM, pipeline, chat inbox, or creator database.

Bulk applicant decisions must remain seat-aware and reversible before submission. Managers can select multiple pending applicants, see selected count beside open paid seats, and accept only inside capacity. Decline selected is allowed for cleanup, but bulk actions must stay quiet helper controls above the applicant table, not the main story of the campaign page.

## Everyday Design Rules

Use Don Norman's product principles as a practical quality bar, not as theory. Every PopsDrops workflow must make the possible action visible, the result understandable, and the recovery path clear.

1. Discoverability: a brand or creator should know what can be done without trial and error. If a field is editable, it must look editable. If a card is clickable, it must signal selection. If a table can sort, the header must behave like a control.
2. Signifiers: controls need visible cues. Do not rely on hidden hover states, unexplained icons, vague labels, or placeholder-only instructions. The label, icon, position, and state must all point to the same action.
3. Natural mapping: the screen order must match the real campaign order. Brief before creator instructions. Requirements before application. Content approval before publishing. Proof before metrics. Timeline controls should visually map to dates, milestones, and consequences.
4. Feedback: every action needs immediate evidence. Save, upload, submit, copy, share, export, sign, apply, approve, reject, and request correction must show what happened and what is next.
5. Constraints: prevent invalid states before users create them. Global market scope cannot combine with country targeting. Dates cannot produce impossible timelines. Platform-specific report fields must match the selected platform. Creator gates must appear before locked materials.
6. Conceptual model: users should understand PopsDrops as a campaign operating room, not a database. Brands create campaigns, set rules, invite or source creators, review work, and read reports. Creators discover opportunities, accept rules, make content, submit proof, and track payment status.
7. Error recovery: assume expert users still make slips. Errors should explain the fix, keep entered work intact, and offer a clear next action. Do not blame the user, hide state, or require a page refresh to recover.
8. Knowledge in the world: keep important state visible at the moment of decision. Selected countries stay visible outside dropdowns. Agreement status stays visible before creator acceptance. Report trust states stay visible near performance data. Totals and formulas stay visible where budgets are edited.

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

Numbers and nouns must agree. One-count states use singular copy, for example "1 creator" and "1 proof". Do not ship dashboard strings such as "1 creators" or "1 reports" because they make operational data feel careless.

All user-facing strings must go through the i18n system. Add source strings before using them. Use CSS logical properties (`ms-*`, `ps-*`, `start-*`, `text-start`) so RTL layouts are first-class.

## Iconography And Copy Punctuation

Do not use sparkle, magic wand, starburst, lightning, zap, bolt, or decorative AI icons anywhere in the product. This includes Lucide `Sparkles`, `Sparkle`, `WandSparkles`, `Stars`, `Zap`, `Bolt`, `Lightning`, and visually similar marks. Use literal operational icons instead: `Users`, `Search`, `Target`, `BadgeCheck`, `FileText`, `BarChart3`, `LineChart`, `Heart`, `Percent`, or `ShieldCheck`.

Every icon must earn its place by matching the content beside it. Campaign activity should use campaign or brief icons, reports should use chart or file icons, creator matching should use search or target icons, engagement should use interaction or percentage icons, and completed or empty states should use check or status icons. Do not use generic energy, magic, or decorative symbols to make a section feel exciting.

Copy uses commas, periods, colons, parentheses, or simple hyphens. Do not use em dash characters in UI copy, docs, metadata, comments, generated source strings, or tests.

## Layout

PopsDrops has four product areas:

- Marketing site (`/`): public positioning, dark landing hero only, clean white sections after the hero.
- Creator web app (`/i/*`): mobile-first opportunity workspace with bottom navigation.
- Brand dashboard (`/b/*`): desktop-first campaign operations with sidebar navigation.
- Admin (`/admin/*`): dense internal operations surface for review, intervention, and measurement.

Marketing pages should reveal the real product or a concrete product preview in the first viewport. Do not make generic landing pages that talk around the product.

Brand dashboards are work surfaces. Prioritize scanability, tables, filters, campaign state, next actions, and reporting. Avoid oversized editorial sections, decorative cards, or marketing-style composition inside the dashboard.

Brand campaign detail pages start with a compact command center: one next action, one health strip, and one small utility row for share or invite links. Do not stack separate hero cards for budget, applicants, content, rules, and invite links before the manager sees the operational priority.

The command center is operational, not billing. Keep PopsDrops fees, invoices, and payment status out of the health strip unless the single next action is specifically a billing blocker. Creator budget, accepted creators, content, reports, and blockers belong there because they determine what the campaign manager does next.

Private campaign workspaces can be drafted before payment, but launch and invite sharing stay locked until the PopsDrops fee is paid. The payment gate belongs beside launch readiness, not inside the operational health strip. The blocked state must name the exact consequence: pay to launch, launch to reveal the invite link, or complete setup to reveal the invite link.

Payment UX is web-first for brand campaign managers, but payment secrets never live in the web app runtime. The web dashboard may start the payment action; Supabase Edge Functions create Checkout Sessions, verify Stripe webhooks, and update the durable campaign fee status.

Next-action controls must name the exact work: Review corrections, Review proof, Configure rules, Add image, Copy invite link. Do not use generic labels such as Open when the user is deciding what operational task to do. The icon beside the action must describe the object or risk, such as a warning file for proof corrections, not a generic refresh, energy, or decorative symbol.

Do not repeat complete checklists as full cards after the same state is already visible in a compact rail. When setup is ready, show a short ready summary. Expand detailed checklist cards only when there are blockers or fixes the manager can act on.

Creator surfaces should feel fast and personal. A creator should immediately know the next best action: complete profile, view invite status, review a brief, apply, submit content, respond to revision feedback, or check payment status.

Pending applicant review is an operational table, not a stack of profile cards. Brand managers are comparing people, rates, markets, fit, pitch, and decision actions, so applicants must render as compact sortable rows with left-aligned headers and stable action controls. Use profile cards only when the page is about one creator, not when the job is comparing many creators.

Accepted creator rows must use one status-cell language across agreement, report, proof, and payment. Each state should have a compact label, optional short detail, consistent border and surface treatment, and non-wrapping row actions. Do not mix heavy badges, bare text, and oversized buttons in the same operational row.

Accepted creator roster filters stay local to the roster. Search and status chips should narrow accepted creator rows before bulk actions, and selecting all should apply only to the visible filtered rows. Do not create a CRM, pipeline, or separate board.

High-volume creator workspaces must expose accepted capacity, open seats, pending applicants, and blocked proof work before tables. A manager running 50 or 100 creators should understand roster health in one scan before sorting rows.

Accepted creator report readiness is visible before roster filters. It summarizes ready reports, review work, missed proof, and payment-open creators so managers do not scan dozens of rows to know whether the campaign is executive-report ready.

Campaign responsibility is a compact accountability panel, not a project-management board. Show one owner per workstream so teams know who is driving approvals, reporting, billing, and overall campaign movement. Do not create task boards, chat systems, or hidden permission rules from responsibility labels.

Campaign list responsibility visibility is a scan aid, not a second task board. Show compact owner chips on campaign rows so managers can see who owns approvals, reporting, billing, and overall movement before opening the proof room.

Responsibility filters should route work, not create another management system. `My work` shows campaigns where the current teammate owns at least one workstream. `Needs owner` shows campaigns with no assigned responsibility yet. Keep both as compact list filters above status tabs so accountability helps scanning without competing with operational urgency.

Responsibility filters stay helper-weight. They should use quiet selected states, not dark primary-button fills, because the campaign's next action and operational pressure remain the main story.

Workstream owner chips belong beside the queue they route. Content review shows the Approvals owner; reporting operations and proof queue show the Reporting owner. Keep these chips quiet and local to the work area so accountability clarifies the next action without creating another dashboard.

Queue filters stay local to content and reporting worklists. Use compact helper-weight chips for `All`, `My work`, and the queue's real action states so a manager can narrow 50 or 100 creator rows without leaving the proof room. `My work` is driven by workstream ownership; it should route accountability, not create item-level task management or chat.

Creator payment controls are tracking only. They may update pending, invoiced, paid, overdue, failed, refunded, or disputed states, but must never imply PopsDrops processes creator payouts. Keep the control compact inside the accepted creator row.

Bulk accepted-creator operations must stay attached to the roster. A manager can select rows to update payment status or follow up missed proof, but those controls remain helper-weight above the accepted creator table. They should clarify work across 50 or 100 creators without becoming a CRM, chat inbox, or payout system.

Paid campaign scope is one commercial control. Creator capacity, active campaign days, proof/reporting days, total fee, paid credit, and balance due must live together so a self-serve manager can scale from 10 to 50 or 100 creators without asking Ops to interpret pricing. Keep the control compact and receipt-like, not a pricing page.

Brief builder layouts must be modular. Think blocks, not a giant text editor. Each block should have a clear purpose and downstream use:

- Product and offer -> creator context and content accuracy.
- Market and audience -> matching, localization, and report segmentation.
- Platform and format -> deliverables and performance metrics.
- Claims and compliance -> review criteria and revision reasons.
- Usage rights -> pricing, approval, and legal clarity.
- Creator criteria -> sourcing and matching.
- Timeline -> reminders and campaign phase movement.
- Reporting goals -> final report structure.

Target market selection must express strategy before geography. Use `Global` when the campaign is intentionally not limited to specific markets. Use region scopes such as APAC, EMEA, Americas, or LATAM for broad regional campaigns. Use ISO country selection only when the brand truly needs country-level targeting. Selected scope and country chips must remain visible outside the search dropdown, and `Global` is mutually exclusive with regional or country selections.

Selected tokens must not look like nearby commit actions. If a selected chip sits next to a Save, Submit, Apply, or Create button, use a subtle token surface so the primary action stays visually singular.

Prefer progressive disclosure. Show the next three useful things. Let users expand when they need detail.

Notification inboxes must be calm operational feeds. Unread items should use a small dot plus a subtle surface or ring difference, not a full-height start border, oversized accent, or heavy shadow. Keep notification rows compact enough for scanning, and reserve strong visual weight for the actual next action inside the destination screen.

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

Command-center metric values align to one scan line. The health strip is an operational instrument row, so long labels, translated copy, or optional detail text cannot push numbers higher or lower than sibling metrics.

Dense numeric metric entry should be compact and scannable. Do not stack each metric as a full-width field when users are entering related numbers such as views, reach, impressions, likes, comments, shares, and saves. Use compact horizontal grids or row strips with short labels, stable input heights, numeric placeholders, and enough columns that the user can understand the set in one glance.

Numeric metric inputs must look editable. Use the same visible control language as the budget investment controls: compact card or row, clear label, bordered numeric control, right-aligned tabular numbers, a focused ring, and units inside the control when needed. Do not make metric entry look like static dashboard text.

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

Creator discovery must be visual. Campaign cards and creator-facing campaign detail pages need a real campaign image or brand visual so the creator can understand the opportunity before reading the brief. The brand campaign builder must collect this image as part of Campaign Details before the campaign can move forward. Do not ship text-only opportunity lists when the brand is asking creators to make visual work.

Missing campaign images should never render as a large empty placeholder. If an older or incomplete campaign lacks a public image, use a compact brand visual fallback with the brand initials, platform, and market context. The fallback exists only to protect the creator experience while the brand image requirement is enforced upstream.

Creator application cards must show the real decision path: rate and pitch go to brand review, then the campaign room unlocks only after acceptance. Accepted creators need a direct room link, not a generic campaigns-list detour.

Creator application CTAs must never overlap or sit as a full-width slab on top of the campaign flow rail. The campaign facts, helper apply jump, and flow steps are three different jobs: keep the helper action quiet, inline with the facts when possible, and leave clear breathing room before the step rail.

Invite links are not shareable until creator handoff readiness is complete. If image, brief, deliverables, proof, rules, or readiness gates are missing, hide the raw URL, disable copy, and send the manager to the setup blocker instead of letting a weak invite escape.

Campaign assets have intentional visibility. Public assets are only the preview layer shown before application. Member assets stay behind acceptance and any campaign rules or agreement gate. Brand-only assets stay internal.

Public Creative Kit previews must never look like blank upload placeholders. On creator-facing discovery pages, show public assets as compact, intentional rows with a stable thumbnail surface, title, and platform context. If the image is still loading or missing, the thumbnail fallback should still look branded and deliberate.

### Creator Campaign Rooms

Creator campaign rooms should show handoff work as one compact sequence. Content submission, live URL, and performance proof are one operational flow, so the UI should show the stage, current state, and next action together.

Accepted creator Creative Kit assets must match the public preview quality bar. Use compact branded asset rows with stable thumbnails, asset title, and platform or brand context. Never show a pale empty square or generic upload icon where a premium brand reference should be.

Creator campaign room first viewport order is identity, one quiet next action, tabs, then active content. The creator should immediately know which campaign they are in before seeing what to do next, and the next-action strip should not visually compete with the workspace.

Creator room tabs should feel like a quiet map, not a competing card stack. Active tabs use a calm filled surface and even border weight, not a heavy dark outline or dark primary fill that pulls attention away from the current workflow content.

A tab attention dot means a real creator action is waiting. Do not mark Tasks, Brief, or Submit as urgent when the room status is simply on track or informational.

Creator room waiting states are status, not work. If the draft is already with the brand, submitted proof is waiting for brand review, or the room is on track, do not show a fake next-action button. Let the tabs remain the navigation. Reserve next-action buttons for real creator-owned work such as corrections, live URLs, first drafts, or proof.

Creator room tab labels and details must answer three different questions. Brief answers what to make. Tasks answers what is complete. Submit answers where work is sent. Do not use the tabs for duplicate counts if the tab content already carries the count.

Do not stack disconnected cards for content, publishing, and reporting when those items belong to the same handoff. Use compact rails, rows, and status labels so creators can see what is done and what is waiting without reading repeated instructions.

Each submitted post should show draft, live URL, and proof in one row. Creators should not have to compare a content card in one section with a performance card in another section to understand whether a specific post is done.

Creator reporting schedules must be visible as real dated work. If a campaign has final, weekly, daily, custom, or per-post proof tasks, the accepted creator room must show those dates in the Tasks tab with compact horizontal schedule items instead of hiding them behind a single generic report task.

Optional creator-added report reads must be explicit, compact, and attached to the existing reporting schedule. Do not turn them into automatic daily work. Show a small add action only when required reads are settled, then move the creator straight into proof submission.

Draft content links and live post URLs are distinct. Do not ask for a public platform post URL before approval. The review step accepts a draft asset or private preview link, and the publishing step is the only place that should validate a native TikTok, Instagram, Snapchat, YouTube, or Facebook URL.

Approved-content live URL states must name the real sequence: publish the approved post on the selected platform, then paste the live URL. Do not reduce this to "add URL" because creators may paste review links or unapproved drafts.

Brand content worklists must keep proof readiness in the same row as the content submission. A manager should see draft review state, live URL state, and analytics proof state without jumping to the report tab. Proof labels must use the same compact status-cell language as accepted creator rows.

Brand content rows should mirror the creator room sequence: draft, live URL, proof. Use the same order and compact status-cell language on both sides so creators and campaign managers share one mental model for what is waiting.

### Reports

Reporting is a core reason brands should choose PopsDrops. Reports must be designed from the beginning, not bolted on.

Never sum or average raw metrics across platforms when definitions differ. Keep TikTok, Instagram, Snapchat, YouTube, and Facebook metrics platform-specific. Use cross-platform equalizers such as CPE only when definitions are clear.

Reports should define what each number means, show source/platform, include creator-level detail, and produce an executive-ready summary. The interface should help a brand answer: what worked, why, what to do next, and who to rebook.

Report recommendations must be earned by the data on the page. Do not add generic strategy advice or AI-flavored filler. Use compact recommendation cards only when accepted report data can support the claim, such as top creator, best channel, or efficiency.

Report helper actions such as Share, Export, Download, Copy, and Open proof must never compete with the report story. The metrics, charts, evidence, and recommendations are the main content. Helper actions should be compact, quiet, and secondary: small outline buttons, muted text, 36px height when practical, modest icons, and no filled primary treatment unless the action is the single next step on an otherwise empty screen.

On analytics or report pages, avoid placing large action buttons near the title if they pull attention away from the data. If actions sit in the header, keep them visually lighter than the metric cards and charts. Export menus may contain rich options, but the trigger itself should feel like a utility control, not the page CTA. On constrained widths, including tablet-sized report headers, helper actions collapse to icon-only controls with accessible labels instead of wrapping to a new row.

Report trust states must be visible without making the brand read every row. Separate evidence status from proof actions in tables, and summarize the review queue in the trust layer with compact counts for missed reports, corrections, missing proof, and items needing brand review. If evidence is missing, show it as an explicit state, not by hiding the row.

Never show No blockers while report reads are still pending. Pending creator proof is not a brand-owned error, but the command center must say Waiting on reports and point to the reporting queue so the manager can understand the mismatch between received and total reads.

Every data table should support sorting from the column header. Header labels are controls: clicking a data column toggles ascending and descending order, and active sort state must be visible without adding noisy helper copy. Action columns should have their own clear labels, such as Proof and Review, instead of sharing one vague Actions column.

Evidence table proof and review controls are utility actions, not report content. Keep those columns narrow and predictable, with compact 28-32px buttons, muted outline styling, and no wrapping desktop action clusters that pull attention away from status, source, and performance data.

Creator reporting is proof-first. The creator flow should follow source proof, metric validation, submit. Ask for the native analytics screenshot or export before asking for numbers, then let the creator confirm or correct the extracted metrics. This protects report trust, reduces manual entry mistakes, and makes correction requests understandable.

Creator proof-needed states must say what evidence to upload and where it goes. Use language like upload platform analytics, confirm numbers, and send proof to the brand. Do not collapse this work into a generic Report action or a screenshot-only upload when exports are also accepted.

Daily reporting must be campaign-configured, never forced by default. Use Final report for calm standard campaigns, Key reads for checkpoint performance, and Daily window only when the launch, retail drop, event, or executive reporting need justifies creator effort. Creators may add extra reads, but required daily work must be visible before they accept.

AI-assisted reporting must show its hand. If the system fills values from evidence, the creator must see a compact "Review AI suggestions" state and field-level source labels before submission. Manual fallback must be equally clear so nobody mistakes an uploaded proof for extracted data.

Reporting tabs must include an operational proof queue, not only summary cards. Brand managers need creator, platform, proof status, submitted timing, evidence count, and the next action in one sortable table. Summary cards show the shape of the work; the queue is where the work gets handled.

Brand reporting tabs must show the campaign cadence as dated work. A manager should see final, weekly, daily, custom, or post proof windows with due dates and statuses before opening the executive report, using compact horizontal schedule items that mirror the creator Tasks tab.

Proof review actions must live beside the proof row that needs a decision. A manager should be able to open the submitted proof, verify it, or request a correction without jumping to another page. Verified proof becomes quiet. Correction proof shows the creator-facing note and waits for resubmission.

Proof queue rows are evidence-level when one reporting read contains multiple posts. Do not compress TikTok, Instagram, YouTube, Facebook, X, or generic evidence into one ambiguous task row. Each current proof item needs its own creator, platform, proof file, status, and review action so the manager never verifies one post and accidentally thinks the whole read is complete.

Creator correction resubmission must be named as correction work. Do not make creators guess whether they are filing a new report or fixing the brand-requested proof. The CTA should say Resubmit proof and the completion state should say Correction sent.

Returned proof after a correction is brand review work. Once a creator resubmits corrected evidence, the brand surface should stop showing stale correction state and label the row as Correction returned or Needs review so the manager knows the next action is verification.

### Email

Email is a product surface, not a raw transport log. Every real email and every email smoke test must use the branded React Email templates, the PopsDrops layout, and concise product copy. Do not send ad hoc raw HTML to customers, creators, brand managers, or product aliases unless the only goal is debugging SMTP at the infrastructure layer and the recipient has explicitly agreed.

Email templates should look calm in Gmail: white card on a light slate background, PopsDrops identity visible, one clear heading, one short paragraph, one structured context block, and one quiet primary action. Avoid decorative icons, large hero treatments, marketing copy, and repeated explanation. The email should answer: what happened, what campaign it affects, and what action is next.

Admin communications attention strips show active delivery blockers only. Failed, pending, or unprocessed unsupported queue rows belong in Needs attention. Historical notification volume, report follow-up history, sent emails, skipped preferences, archived legacy rows, and processed unsupported rows belong in the delivery log or recent notifications, not the urgent strip.

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
