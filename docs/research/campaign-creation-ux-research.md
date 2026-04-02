# Campaign Creation UX Research

Research date: 2026-03-31

## 1. How Top Platforms Structure Campaign Creation

### Aspire (aspire.io)
- **Approach:** Two workflow types — Standard (sequential, one stage at a time) and Flexible (all stages accessible simultaneously)
- **Wizard:** Pre-built brief templates with customizable stages. Claims "spin up end-to-end campaigns in minutes"
- **Customization:** Custom stages beyond defaults, with configurable actions/statuses/forms. Stages can be designated as Prerequisite (sequential) or Flexible (any order)
- **Automation:** If-then logic for workflows that adapt to performance/engagement/milestones. Multi-step branching workflows
- **Brief templates:** Include messaging guidelines, deliverables, due dates, content ownership/rights
- **Integrations:** Gmail, Outlook, PayPal, Shopify, WooCommerce baked into workflow
- **G2 rating for ease of use:** 8.8/10 — highest among competitors
- **G2 complaints:** Interface can be "clunky at times," hindering navigation

### CreatorIQ
- **Approach:** "Instant campaign set-up" — input requirements, choose modules, follow step-by-step flow
- **Key pattern:** Everything happens without leaving the campaign page — inviting creators, sharing briefs, approving content
- **Creator portal:** Dedicated portal for creators to manage briefs, payments, and collaboration
- **Strength:** Deep data/analytics, one-sheet exports for client reporting
- **G2 complaints:** Interface is "overwhelming," learning curve, UI is "not intuitive" and "cluttered"
- **Takeaway:** Power at the cost of simplicity. Enterprise tool, not startup-friendly UX

### GRIN
- **Approach:** End-to-end creator management integrated with eCommerce
- **Key UX pattern: "Live URLs"** — branded landing pages where creators can see campaign requirements, choose products to promote, fill out shipping/payment info, and submit proposals. This is a standout pattern
- **Creator dashboard:** Personalized portals to access briefs, upload content for approval, track links
- **E-commerce integration:** Syncs with Shopify/WooCommerce for inventory, product lists, fulfillment, order tracking
- **AI:** "Gia" AI assistant automates search, outreach, and routine tasks
- **G2 complaints:** Discovery process is "tricky or limited"

### Upfluence
- **Approach:** Integrated campaign management with CRM and automated workflows
- **Focus:** E-commerce integration, sales tracking, ROI measurement from creator content
- **G2 note:** "Robust but complex for beginners" — once configured, works well
- **Strength:** Centralizes outreach, analytics, payment workflows

### Later (formerly Mavrck)
- **Approach:** Visual-first dashboard, intuitive navigation
- **Strength:** Easier to use than data-heavy tools, especially for campaign planning and creator communication
- **Shopify integration:** Deep integration for workflow
- **Positioning:** Best for mid-market, visual/social-first brands

### Traackr
- **Approach:** Campaign setup wizard with feature selection — enable only what you need, skip advanced analytics
- **Key UX pattern: Modular campaign setup** — choose which features/modules to activate per campaign
- **Workflows:** Suggested steps you can reorganize, or create your own from scratch
- **Brief detail:** "Remarkably detailed on content requirements, account for all fees, spell out products creators will receive"
- **Fee suggestion:** Uses historical data about influencer past performance to suggest appropriate fees
- **Payments:** Global payments in local currencies directly in-platform
- **Takeaway:** The modular "enable what you need" pattern is excellent for reducing complexity

### Cross-Platform Patterns

| Pattern | Used By | Notes |
|---------|---------|-------|
| Modular feature activation | Traackr | Enable only needed campaign features |
| Creator-facing branded pages | GRIN | Creators see requirements, choose products, submit |
| Pre-built brief templates | Aspire | Templates for common campaign types |
| In-page campaign management | CreatorIQ | Never leave campaign page for core actions |
| AI-assisted setup | GRIN (Gia) | Automates routine setup tasks |
| Customizable workflow stages | Aspire | Prerequisite vs. flexible stages |
| Fee suggestion from data | Traackr | Historical performance-based rate suggestions |

---

## 2. Campaign Brief Fields — Comprehensive Structure

Based on Aspire, Modash, inBeat, Meltwater, InfluenceFlow, and Upfluence templates:

### Section 1: Brand & Campaign Overview
- Campaign name
- Campaign objective (awareness / engagement / conversions / UGC)
- Campaign description (2-3 sentences — the "why")
- Target audience (demographics, psychographics, pain points)
- Key messaging (2-3 non-negotiable talking points, benefit > feature)
- Campaign timeline (start date, end date)
- Brand voice/tone guidance

### Section 2: Product Information
- Product name(s)
- Key differentiators (what sets it apart)
- Product links / landing pages
- Promo codes / affiliate links
- Product shipping details (if physical)

### Section 3: Deliverables (Per-Platform)
- Platform (TikTok, Instagram, YouTube, Snapchat, Facebook)
- Content format per platform (Reels, Stories, Feed posts, Shorts, long-form)
- Number of posts per format
- Technical specs: resolution (min 720px), file type (MP4), aspect ratio (9:16, 1:1, etc.), frame rate (30fps min)
- Video length requirements per platform
- Posting schedule / deadlines
- Draft submission deadline (typically 1 week before posting)

### Section 4: Creative Guidelines
- Do's and Don'ts (specific, not vague)
- Mood board / visual references (3+ examples)
- Required elements (logo visibility, product in frame, specific CTA)
- Caption requirements (key messages, hashtags, @mentions)
- Brand safety guardrails (topics to avoid)
- Tone examples (what sounds like us vs. what doesn't)

### Section 5: Usage Rights & Legal
- Content ownership / usage rights scope
- Usage rights duration
- Exclusivity period and scope
- FTC disclosure requirements (#ad / #sponsored)
- AI content disclosure (new for 2026 — FTC requires disclosure of AI tools)
- Reposting / whitelisting permissions
- GDPR/privacy compliance notes

### Section 6: Review & Approval Process
- Number of revision rounds allowed (typically 1-2)
- Review timeline (e.g., "48-hour turnaround on feedback")
- Who reviews (names/roles)
- What constitutes approval vs. revision request

### Section 7: Compensation & Payment
- Compensation structure (flat fee / commission / hybrid / product exchange)
- Payment amount per deliverable
- Payment schedule (e.g., 50% upfront, 50% on publish)
- Payment method
- Invoice/documentation requirements

---

## 3. Multi-Step Form / Wizard UX Best Practices

### Step Count & Structure
- **Optimal range:** 3-7 steps for most B2B SaaS applications
- **Each step:** One clear theme, only critical fields, logically grouped
- **Rule:** Use the minimum number of steps to keep each screen simple
- **Anti-pattern:** Steps that feel repetitive, non-essential "just in case" fields, no ability to skip optional steps

### Progress Indication
- **Always show:** Current position, total steps, and step labels
- **Formats that work:** Numbered steps with labels (best), progress bars (good), percentage wheels (good for long forms)
- **Psychological benefit:** Reduces anxiety, creates sense of control and momentum
- **Real examples:** Aircall uses percentage completion wheel; Intercom uses minimal progress bar; Zendesk uses one field per page with step indicator

### Navigation
- Clear "Next," "Back," and "Save as Draft" buttons — consistent placement across all steps
- Allow backward navigation without data loss
- Skip options for optional steps
- Never trap users — always provide an exit path

### Auto-Save & Draft Behavior (Critical)
- **Auto-save on blur** (when user leaves a field) + **3 seconds after last keystroke**
- Show "Saving..." during background activity, "Saved" with timestamp when idle
- Allow explicit "Save as Draft" for longer sessions
- Provide "Save for Later" with progress tracking
- Send follow-up reminders for incomplete drafts
- Prevent data loss from network issues or accidental close

### Validation
- **Inline validation** — show errors as soon as they occur, at the step where they happen
- **Actionable error messages** — "Please enter a valid email" not "Invalid input"
- Never delay validation to a later step
- Validate per-step before allowing "Next"

### Conditional Logic
- Dynamically show/hide fields based on prior inputs
- Example: If campaign type is "Product Seeding," show shipping fields; if "Sponsored Post," hide them
- Shorter flows for experienced users, guided flows for new users

### Mobile Considerations
- Design mobile-first with large tap targets
- Minimize fields per step on mobile
- Swipe navigation between steps
- Responsive layouts that stack gracefully

### Real-World SaaS Examples
- **Zendesk:** 8 steps, one field per page, casual copywriting — maximum simplicity
- **Motive:** 4 steps with interactive buttons/icons — fast loading
- **ServiceTitan:** 2 steps, no upfront contact info — lowest friction
- **Aircall:** Percentage wheel, accordion design for grouped questions
- **Intercom:** Progress bar, minimalist, blue gradient background

### Key Metrics to Monitor
- Drop-off rate at each step
- Completion time per step
- Error frequency and types
- Mobile vs. desktop completion rates
- Save-for-later resumption rates

---

## 4. Cross-Border / Multilingual Brief Patterns

### Brief Translation for Creators
- Write brief in brand's language (typically English)
- Auto-translate to creator's preferred language on delivery
- Creators should be able to suggest local idioms/edits (feedback loop)
- Campaign hashtags and CTAs need localization, not just translation — transcreation
- Platform names (TikTok, Instagram) and metrics (CPM, CPE) stay in English

### Content Localization UX Patterns
- **Pseudolocalization testing:** Before real translations, test with expanded pseudo-strings (40-50% longer) to verify layout flexibility
- **Text expansion budgets:** French +20% vs English, Japanese -30-60%, Arabic/Russian +30%. Never use fixed widths on text containers
- **RTL handling:** CSS logical properties (margin-inline-start, not margin-left), flex direction awareness, icon flipping
- **Date/currency/number formatting:** Always use Intl APIs, never hardcode formats

### Patterns from Major Platforms
- **Notion:** Dual-language labeling in language selector (current language + target language name). Supports regional variants (Spanish-Spain vs Spanish-LatAm)
- **Canva:** 100+ languages, 7 Spanish variants — extreme granularity for regional differences
- **Figma localization plugins:** Push source text to translation platform, translators work with screenshots + context, push back to design. The visual context is key

### Key Principles for PopsDrops
1. **Brief is authored in English** (brand side) — structured form, not free-text document
2. **Brief is auto-translated** when creator views it — using existing Gemini translation infrastructure
3. **Per-platform deliverables are structured data**, not prose — translates cleanly
4. **Do's/Don'ts as structured list items**, not paragraphs — easier to translate, harder to misinterpret
5. **Mood board / visual references are universal** — images don't need translation
6. **Numbers, dates, currencies formatted via Intl APIs** — respect creator's locale
7. **Creator can view brief in any language** — same "any language, zero config" approach as rest of platform

---

## 5. What Creators Say They Need

### From Creator Community Research

**Top frustrations with briefs:**
1. **Not enough context** — Creators get partial briefs, don't understand the "why" behind the campaign
2. **Too prescriptive** — Rigid scripts that feel inauthentic. Brands don't trust creators' format knowledge
3. **Too long** — 4+ page briefs lose creator engagement. Nobody reads them
4. **Treated as distribution channels**, not co-creators of value
5. **Flat fees misaligned with performance expectations** — held to KPIs but paid flat
6. **One-off transactional arrangements** — no context for audience, feels forced
7. **Marketing jargon** — Creators aren't familiar with terms like "CTR" or "earned media value"

**What creators actually need:**
1. **Why this campaign exists** — the story, not just the brief
2. **Clear, specific deliverables** — "2 Reels + 2 Stories, posted Jan 21-30, drafts 1 week prior"
3. **Creative freedom with guardrails** — Do's/Don'ts, not scripts. "Steer direction, but how they tell it is up to them"
4. **Visual inspiration** — mood boards, past examples, brand aesthetic references
5. **Simple language** — benefit-focused, not feature-focused. "Detects snoring and inclines" not "automatic incline based on sound detection"
6. **Full campaign timeline** — when to submit, when to expect feedback, when to post
7. **Clear payment terms** — amount, method, schedule, conditions
8. **Early involvement** — "a seat in planning, not just execution"
9. **Performance-based upside** — bonus for exceeding KPIs, not just flat fee

### Brief Effectiveness Principles
- **Shorter is better** — distill to what matters for storytelling
- **One primary KPI** — don't overwhelm with metrics
- **Benefit over feature** — always
- **Trust the creator** — they know their audience better than you
- **Iterate** — update briefs based on performance data from previous campaigns
- **Platform-specific** — TikTok brief should be different from YouTube brief (authenticity vs. production value)

---

## 6. Recommended Campaign Creation Flow for PopsDrops

Based on all research, here's the recommended structure:

### Flow: 5 Steps + Review

**Step 1: Campaign Basics** (the "what")
- Campaign name
- Objective (select: awareness / engagement / conversions / UGC)
- Description (2-3 sentences — the story)
- Target markets (countries/regions)
- Campaign timeline (start/end dates)

**Step 2: Target Creators** (the "who")
- Creator tier preferences (New, Rising, Established, Top)
- Platforms (TikTok, Instagram, Snapchat, YouTube, Facebook — multi-select)
- Niche categories (multi-select from standardized list)
- Minimum follower/engagement thresholds (optional, smart defaults from objective)
- Languages (auto-suggested from target markets)
- Budget range per creator

**Step 3: Deliverables** (the "how" — per-platform)
- For each selected platform, show a card:
  - Content format (Reel, Story, Feed Post, Short, Long-form — platform-specific options)
  - Number of posts per format
  - Video length range
  - Draft deadline
  - Publish deadline
- Usage rights scope and duration
- Exclusivity period (none / 30 days / 60 days / 90 days / custom)
- Max revision rounds (default: 2)

**Step 4: Creative Brief** (the "feel")
- Key messages (structured list, max 3 — benefit-focused)
- Do's (structured list)
- Don'ts (structured list)
- Mood board / reference upload (images, links to existing content)
- Brand voice notes (optional — short text)
- Product details (name, key differentiators, links)
- Promo code / affiliate link (optional)
- Caption requirements (required hashtags, @mentions, CTA)

**Step 5: Compensation** (the "terms")
- Compensation model (flat fee / per-deliverable / hybrid)
- Rate per deliverable or total budget
- Payment schedule (e.g., 50/50, 100% on completion)
- Product gifting details (if applicable)
- Performance bonus (optional — ties to KPI)
- FTC / legal disclosures (auto-populated based on markets)

**Review & Publish**
- Full brief preview (as creator will see it)
- Preview in another language (test translation)
- Save as Draft / Publish
- On publish: auto-translate brief, open for applications

### UX Patterns to Implement

1. **Auto-save on every field change** — "Saved" indicator with timestamp in header
2. **Step labels in sidebar** (not just numbers) — always visible, clickable for non-linear navigation
3. **Smart defaults** — pre-fill from brand profile, previous campaigns, and objective selection
4. **Conditional fields** — show platform-specific options only for selected platforms
5. **Inline validation** — validate on blur, block "Next" only for required fields
6. **Brief preview** — show how creator will see it, updated in real-time as brand fills in fields
7. **Per-platform deliverable cards** — visual, not a table. Each platform gets its own card with relevant format options
8. **Structured lists** for Do's/Don'ts/Key Messages — not free-text paragraphs. Easier to translate, harder to misinterpret
9. **"Save as Template"** — save completed brief as template for future campaigns
10. **Modular activation** (Traackr pattern) — toggle optional sections on/off (e.g., skip product gifting if not applicable)

---

## Sources

### Platform Research
- [Aspire Campaign Management](https://www.aspire.io/platform/campaign-management)
- [Aspire Workflow Customization](https://help.aspireiq.com/en/articles/12167673-beta-how-to-customize-your-workflow)
- [Aspire Automations](https://www.aspire.io/blog/automations)
- [CreatorIQ Campaign Management](https://www.creatoriq.com/influencer-marketing-solution/influencer-campaign-management)
- [GRIN Product Features](https://grin.co/product/)
- [GRIN How It Works](https://grin.co/how-grin-works/)
- [Traackr Campaign Management](https://www.traackr.com/use-cases/campaign-management)
- [CreatorIQ vs GRIN vs Aspire vs Upfluence Comparison](https://getoden.com/blog/creatoriq-vs-grin-vs-aspire-vs-upfluence)
- [Later Influence G2 Reviews](https://www.g2.com/products/later-influence/reviews)
- [Aspire G2 Reviews](https://www.g2.com/products/aspireiq-aspire/reviews)

### Brief Templates & Structure
- [Aspire: What to Include in an Influencer Brief](https://www.aspire.io/blog/what-to-include-in-an-influencer-brief-plus-a-free-template)
- [Modash: 7 Things to Include in Influencer Briefing](https://www.modash.io/blog/influencer-briefing)
- [inBeat: Influencer Brief Templates](https://inbeat.agency/blog/influencer-brief-templates)
- [Meltwater: How to Write an Influencer Brief](https://www.meltwater.com/en/blog/influencer-marketing-brief-template)
- [InfluenceFlow: Campaign Brief Template 2026](https://influenceflow.io/resources/influencer-campaign-brief-template-complete-guide-for-2026/)

### Creator Perspective
- [The Drum: Involve Creators Earlier in Campaign Planning](https://www.thedrum.com/opinion/2025/07/23/involve-creators-earlier-campaign-planning)

### UX Patterns
- [Eleken: Wizard UI Pattern](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained)
- [Webstacks: Multi-Step Form Best Practices](https://www.webstacks.com/blog/multi-step-form)
- [Smart Interface Design Patterns: Multi-Lingual UX](https://smart-interface-design-patterns.com/articles/multi-lingual-ux/)
- [GitLab Design: Saving and Feedback Patterns](https://design.gitlab.com/usability/saving-and-feedback)

### Localization
- [Honeytranslations: Localized Global Influencer Partnerships](https://honeytranslations.com/blog/localized-global-influencer-partnership/)
- [Phrase: Multilingual UX Design](https://phrase.com/blog/posts/how-to-create-good-ux-design-for-multiple-languages/)
- [Localization Station: Figma Localization](https://www.localizationstation.com/posts/figma-localization)
