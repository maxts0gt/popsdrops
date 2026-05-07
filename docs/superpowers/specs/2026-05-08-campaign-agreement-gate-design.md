# Campaign Agreement Gate Design

Date: 2026-05-08
Status: Proposed for user review

## Purpose

PopsDrops needs a creator-side gate that protects brand trust before a creator starts work. A brand can define campaign rules, disclosure obligations, usage rights, reporting duties, and optionally attach a brand-provided agreement or NDA. After the brand accepts a creator, the creator must review and sign the required gate before they can enter the campaign room, access private creative kit assets, submit content, or complete reporting tasks.

This is not a generic legal-document generator. PopsDrops provides a clean campaign rules template and acceptance workflow. Brands provide their own legal agreement when they need NDA, exclusivity, confidentiality, or custom contract language.

## Client And Talent Bar

The workflow must be credible for the operating standard of Hermes or Chanel campaign managers and talent as visible as Lisa from BLACKPINK or Lionel Messi. That does not mean PopsDrops claims those brands or people as current clients. It means the workflow must protect brand reputation, creator privacy, exact agreement versions, and audit evidence at that level.

Product consequences:

- No casual legal claims.
- No unclear creator obligations.
- No creator access to private campaign materials before required acceptance.
- No unversioned agreements.
- No overwritten agreement history.
- No agreement status that the brand cannot inspect.
- No hidden platform disclosure rules.

## Research Basis

Official platform and legal sources support a formal acceptance gate for sponsored creator work.

- FTC influencer guidance says creators must clearly disclose material connections to brands, including payment, free products, or other value. It also says platform disclosure tools may help but should not be assumed sufficient on their own.
- Instagram and Facebook branded content guidance requires the paid partnership label for branded content and treats payment, free gifts, loans, and affiliate links as exchanges of value.
- YouTube identifies paid product placements, endorsements, sponsorships, and free products as paid promotion contexts that can trigger disclosure.
- X requires organic paid partnership posts to use its Paid Partnership disclosure.
- Snap Creator Marketplace terms distinguish platform terms from separate brand-creator license terms and agreements.
- Aspire positions image rights and digital term sheets as built-in creator workflow.
- GRIN creator terms tie brand campaign content rights to the rights each brand selects and the creator accepts in the platform.
- ESIGN supports electronic signatures and records when the record can be retained and accurately reproduced.
- eIDAS defines multiple levels of electronic signature in Europe, so PopsDrops should keep a strong audit trail but avoid overclaiming that a typed-name acceptance is equivalent to every jurisdiction's highest legal signature standard.

Sources:

- https://www.ftc.gov/influencers
- https://www.facebook.com/help/instagram/616901995832907/
- https://www.facebook.com/help/instagram/1317960375957564/
- https://support.google.com/youtube/answer/10588440
- https://help.x.com/en/rules-and-policies/paid-partnerships-policy
- https://www.snap.com/terms/creator-marketplace
- https://www.aspire.io/content-creation
- https://grin.co/terms-of-use-influencers/
- https://www.law.cornell.edu/uscode/text/15/7001
- https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/What+is+eSignature

## Product Principle

Agreement requirements belong to the campaign.

The brand decides whether the campaign needs:

- No gate.
- Rules acknowledgement only.
- Typed-name signature.
- Brand-provided agreement or NDA.
- Both campaign rules and brand-provided agreement.

The creator sees key requirements before applying. The binding acceptance happens after the brand accepts the creator and before the creator unlocks the campaign room.

Use the language "acknowledge", "accept", and "sign". Do not call it creator "approval". The brand sets the rules. The creator accepts them.

## Scope

This design covers:

- Campaign-level agreement gate configuration.
- A default PopsDrops campaign rules template.
- Brand-provided agreement upload or pasted agreement text.
- Creator pre-application requirements preview.
- Creator post-acceptance gate before campaign room access.
- Typed-name signature and acknowledgement records.
- Versioned agreement snapshots.
- Audit fields for evidence and dispute resolution.
- Brand-side visibility into agreement status.
- RLS and Storage behavior for private agreement files.

This design does not cover:

- Legal advice.
- PopsDrops-generated NDA language.
- Third-party e-sign providers such as DocuSign.
- Negotiation redlines.
- Payment processing.
- Social account connection or platform API metric fetching.
- Manual PopsDrops review for routine agreement acceptance.

## Campaign Builder Placement

Add the gate to the campaign builder as an optional block inside the Creative Kit or Review and Launch path. It should feel like a trust and access setting, not a full legal workspace.

Recommended placement:

1. Creative Kit captures product notes, brand vibe, talking points, claims, CTA, hashtags, examples, and assets.
2. Agreement Gate sits after Creative Kit because it protects those materials and tells creators what terms apply before they access them.
3. Review and Launch summarizes whether a gate is required and what the creator must sign before joining.

Builder controls:

- Gate required: on or off.
- Gate mode: campaign rules, typed signature, brand agreement, or campaign rules plus brand agreement.
- Rules template: editable sections with short defaults.
- Brand agreement: upload PDF or paste text.
- Acceptance timing: fixed to "after creator acceptance, before campaign room access" for the first shipped version.

## Default Campaign Rules Template

The default template is non-legal operational copy. It should be editable, concise, and structured.

Sections:

- Campaign role: what the creator is joining.
- Disclosure: paid partnership, free product, affiliate, or sponsored language requirements.
- Brand claims: approved claims and restricted claims.
- Content standards: tone, visuals, product handling, safety, and forbidden content.
- Usage rights: how the brand can use creator content, duration, territory, and paid ads permission.
- Confidentiality: private campaign assets and unreleased product information stay private.
- Timeline: application, content due, publishing window, and performance data due dates.
- Reporting evidence: required URL, screenshot, platform export, and manual metric fields.
- Corrections: creator agrees to respond to correction requests by the configured deadline.

Template rules:

- Keep language plain.
- No legal overclaiming.
- No giant paragraphs.
- No em dash characters.
- No platform-specific promise that conflicts with current platform rules.
- Use campaign data to prefill dates, platforms, usage rights, and reporting requirements.

## Creator Flow

### Before Applying

On the public apply screen or invite link, show a compact requirements preview:

- Gate required.
- Brand agreement attached, if present.
- Disclosure required.
- Usage rights summary.
- Reporting evidence required.
- Key dates.

Do not force the creator to sign before applying. Application should stay lightweight.

### After Brand Acceptance

When the creator opens the accepted campaign:

1. If no gate is required, show the campaign room.
2. If a gate is required and unsigned, show the agreement gate first.
3. The gate shows campaign name, brand name, agreement version, rules sections, attached agreement preview or download, and acceptance controls.
4. Creator must check acknowledgement items and type their legal name.
5. On submit, PopsDrops records the acceptance and unlocks the campaign room.

Locked until accepted:

- Private creative kit assets.
- Full member-only instructions.
- Content submission flow.
- Reporting tasks.
- Private signed URLs for agreement attachments if the brand marks them as member-only.

Still visible before accepted:

- Campaign title.
- Public description.
- Brand name.
- Key dates.
- The agreement gate itself.

## Brand Flow

Campaign detail should show agreement status without becoming clutter.

Brand views:

- Campaign setup: gate configured or not configured.
- Members table: agreement status column, sortable.
- Member detail: signed date, typed name, agreement version, and attached document version.
- Operations summary: unsigned accepted creators count when gate is required.

Brand actions:

- View acceptance record.
- Download signed acceptance audit summary.
- Replace draft agreement before launch.
- Publish a new agreement version.
- Require re-acceptance for members if a published agreement changes materially.

Rules:

- A published agreement version is immutable.
- Editing after launch creates a new version.
- Re-acceptance is explicit, not automatic.
- Old acceptance records stay linked to the exact version accepted.

## Data Model

### campaign_agreements

Stores the current and historical agreement versions for a campaign.

Fields:

- `id uuid primary key`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `created_by uuid not null references profiles(id)`
- `version integer not null`
- `status text not null default 'draft'`
- `gate_mode text not null`
- `title text not null`
- `rules jsonb not null default '{}'`
- `agreement_body text`
- `file_bucket text`
- `file_path text`
- `file_name text`
- `file_mime_type text`
- `file_size_bytes bigint`
- `content_hash text not null`
- `requires_typed_name boolean not null default true`
- `requires_reacceptance boolean not null default false`
- `published_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed `status` values:

- `draft`
- `published`
- `archived`

Allowed `gate_mode` values:

- `rules_acknowledgement`
- `typed_signature`
- `brand_agreement`
- `rules_and_brand_agreement`

Constraints:

- Unique `campaign_id, version`.
- Only one published active agreement per campaign.
- `content_hash` must reflect rules, pasted body, file metadata, and file hash when present.

### campaign_agreement_acceptances

Stores creator acceptance records.

Fields:

- `id uuid primary key`
- `agreement_id uuid not null references campaign_agreements(id)`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `campaign_member_id uuid references campaign_members(id) on delete cascade`
- `application_id uuid references campaign_applications(id) on delete set null`
- `creator_id uuid not null references profiles(id)`
- `typed_name text not null`
- `accepted_rules jsonb not null default '{}'`
- `accepted_content_hash text not null`
- `accepted_version integer not null`
- `ip_hash text`
- `user_agent text`
- `accepted_at timestamptz not null default now()`
- `revoked_at timestamptz`

Constraints:

- Unique active acceptance per `agreement_id, creator_id`.
- `accepted_content_hash` must equal the agreement hash at acceptance time.
- Acceptance cannot be inserted for a draft agreement.

### campaign_member_agreement_status

This can be a SQL view rather than a table.

Purpose:

- Gives brand and creator UI a simple source of truth for whether a campaign member is blocked, signed, or needs re-acceptance.

Fields:

- `campaign_id`
- `campaign_member_id`
- `creator_id`
- `agreement_id`
- `agreement_version`
- `status`
- `accepted_at`
- `typed_name`

Allowed `status` values:

- `not_required`
- `pending`
- `signed`
- `needs_reacceptance`

## Storage

Use a private Supabase Storage bucket for agreement attachments.

Bucket:

- `campaign-agreements`

Storage rules:

- Brand owner can upload and read files for their campaign.
- Accepted creators can read only the published agreement file for their campaign gate.
- Applicants can see metadata and requirements preview, but not private agreement files unless the brand explicitly marks the agreement as previewable.
- File access uses short-lived signed URLs after authorization.
- No public URLs.
- Validate uploads by extension, MIME type, size, and magic bytes before storing.

Recommended accepted file types:

- PDF.

Future optional file types:

- DOCX, if converted to a safe preview artifact.

## RLS And Access Control

Campaign agreements:

- Brand owner can create, update draft, publish, archive, and read all versions for their campaigns.
- Accepted campaign members can read published agreement versions required for their own campaign.
- Applicants can read only public preview fields.
- Admin can read all rows.

Agreement acceptances:

- Creator can insert their own acceptance only for a published agreement tied to an accepted application or campaign member.
- Creator can read their own acceptance records.
- Brand owner can read acceptance records for their campaigns.
- Brand owner cannot modify creator acceptance records.
- Admin can read all rows.

Agreement files:

- Never expose through broad Storage policies.
- Use server-side authorization and signed URLs.
- Store audit metadata in Postgres.

## Backend Boundary

Supabase owns durable agreement data, RLS, Storage, and audit records.

Next.js owns:

- Campaign builder UI.
- Creator gate UI.
- Thin server actions for validation and calls to Supabase.
- Brand status presentation.

Supabase owns:

- Tables and RLS policies.
- Private agreement files.
- Acceptance record integrity.
- Database views for member agreement status.
- Optional future Edge Function for PDF acceptance artifact generation.

Do not add cron jobs, social tokens, platform fetchers, or unrelated automation for this feature.

## Edge Cases

Agreement edited after launch:

- Create a new version.
- Existing signed creators keep their old acceptance unless the brand requires re-acceptance.
- Creators needing re-acceptance are blocked from new submissions until accepted.

Creator accepted before agreement is configured:

- If the brand later publishes a required gate, existing members enter `needs_reacceptance`.

Creator uses public apply without full creator profile:

- Show the requirements preview before application.
- If accepted, identify the creator through the accepted application and authenticated session or magic link before allowing signature.

Creator refuses to sign:

- They remain blocked from the campaign room.
- Brand sees pending agreement status and can remove the member.

Agreement file upload fails:

- Keep the agreement in draft.
- Do not publish until file metadata and hash are valid.

Translated UI:

- Interface copy is translated through i18n.
- Legal or brand-provided agreement text is not automatically translated unless the brand provides translations.
- If runtime translation is later offered for comprehension, the source agreement language remains authoritative.

Minors or represented talent:

- Do not ship guardian or agency representative signing in the first version.
- Leave room for future signer role and representative capacity fields.

Global enforceability:

- Store strong audit records.
- Do not state that PopsDrops signatures satisfy every jurisdiction's highest signature standard.

## UI Principles

Brand setup:

- Compact, operational, and optional.
- Avoid heavy legal language unless the brand uploads its own agreement.
- Use `ShieldCheck`, `FileText`, `CheckCircle`, or `PenLine` style icons only when they match the section.
- Never use decorative energy, magic, sparkle, starburst, lightning, zap, or bolt icons.

Creator gate:

- Calm and serious.
- Clear title: `Campaign Rules`.
- Secondary label if a legal file exists: `Brand Agreement`.
- Show only what must be reviewed.
- Use a sticky footer with the typed name field and sign button on mobile.
- No giant wall of text without structure.

Brand status:

- Use a sortable table column.
- Status labels should be short: `Signed`, `Pending`, `Needs signature`.
- Helper actions stay small and secondary.

## i18n

All PopsDrops interface strings must be added to `src/lib/i18n/strings.ts` before use.

Agreement body and brand-uploaded files are campaign content, not UI copy. They remain in the brand's source language unless a future translation feature is explicitly added.

Do not hardcode:

- Button labels.
- Empty states.
- Status names.
- Form labels.
- Toast messages.
- Validation errors.

## Testing And Smoke

Unit tests:

- Agreement hash generation is stable.
- Draft agreements cannot be accepted.
- New published versions do not mutate old acceptances.
- Member agreement status resolves `not_required`, `pending`, `signed`, and `needs_reacceptance`.
- Creator cannot accept another creator's agreement.
- Brand cannot mutate creator acceptance records.

Server action tests:

- Brand can create a draft agreement for its campaign.
- Brand can publish a valid agreement.
- Creator can sign only after acceptance.
- Creator gate blocks unsigned access.
- Signed creator unlocks campaign room.
- Re-acceptance blocks newly protected actions.

RLS tests:

- Brand owner sees agreement and acceptance rows for its campaigns.
- Other brands cannot see them.
- Creator sees only their own acceptance.
- Applicant sees preview fields only.
- Agreement file signed URL requires authorization.

Browser smoke:

- Brand configures campaign rules.
- Creator previews requirement before applying.
- Brand accepts creator.
- Creator opens campaign and sees agreement gate.
- Creator signs with typed name.
- Campaign room unlocks.
- Brand members table shows signed status.
- Private asset access is blocked before signing and allowed after signing.

## Implementation Slices

1. Data foundation: tables, RLS, Storage bucket, status view, and generated types.
2. Agreement domain helpers: hash, validation, status resolution, and typed-name acceptance.
3. Brand builder: campaign rules and agreement setup.
4. Creator gate: post-acceptance lock and signing flow.
5. Brand operations: member agreement status and audit detail.
6. Smoke and hardening: in-app browser flow, negative access checks, and visual review.

## Implementation Decisions

The implementation should use these defaults:

- Signing happens after brand acceptance and before campaign room access.
- PopsDrops ships a non-legal campaign rules template.
- NDAs and custom agreements are brand-provided.
- PDF is the only uploaded legal file type in the first version.
- Legal files are not automatically translated.
- Applicants see a requirements preview by default, not the full private agreement file.
- A brand can explicitly mark an agreement previewable before application, but the default is private until acceptance.
- Unsigned accepted creators count as campaign members with `pending` agreement status because the existing campaign member model already represents brand acceptance.
- Pending agreement status blocks private assets, content submission, and reporting tasks until the creator signs.
- Rules setup and PDF upload ship together because the product need includes brand-provided NDA or agreement support.

Review checkpoints before implementation:

- Confirm the campaign builder placement feels right.
- Confirm the creator gate copy feels premium and not legal-heavy.
- Confirm the brand member status view is enough for the first complete workflow.
