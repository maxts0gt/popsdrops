# Creator Reporting Evidence Templates Design

Date: 2026-05-07
Status: Proposed for user review

## Purpose

PopsDrops reporting must feel like a premium campaign operations system, not a loose form where creators type numbers after the fact. Campaign managers define what proof they need. Creators see those requirements before applying. The platform turns accepted creator work into report tasks, evidence, verified metrics, missed states, and executive-ready campaign reports.

This design refines the existing Creative Kit and Reporting Architecture with a platform-template layer for Instagram, TikTok, YouTube, Facebook, Snapchat, X, and Generic evidence. It does not create separate platform flows. It creates one reporting evidence engine with platform-specific metric definitions.

## Research Basis

Official platform documentation supports a template-based approach because each platform exposes different creator metrics and account requirements.

- Instagram Insights: creator or business account insights include reach, views, interactions, likes, comments, saves, shares, and media/time filters.
- TikTok Analytics and TikTok One reporting: video views, profile views, likes, comments, shares, favorites, average watch time, completion, viewers, and export-style reporting.
- YouTube Studio Analytics: impressions, click-through rate, views, unique viewers, watch time, average view duration, engaged Shorts views, audience metrics, and exports.
- Facebook Page and Professional Dashboard insights: reach, impressions, engagement, views, plays, reactions, comments, shares, clicks, audience, and monetization-related dashboard metrics.
- Snapchat Public Profile analytics: views, viewers, screenshots, swipe-ups, interactions, favorites, reposts, comments, shares, clicks, average view time, total view time, and fixed date windows.
- X metrics: public post metrics include impressions, likes, replies, reposts, quotes, bookmarks, and video views; private metrics such as URL clicks and profile clicks require user context.
- Gemini image understanding and structured outputs: screenshots can be interpreted into structured metric fields, but extracted values need human validation before becoming report truth.

Sources:

- https://www.facebook.com/help/instagram/788388387972460
- https://newsroom.tiktok.com/product-tutorial-tiktok-analytics
- https://ads.tiktok.com/help/article/about-tiktok-one-campaign-reporting?lang=en
- https://support.google.com/youtube/answer/9002587
- https://www.facebook.com/help/131809553587433
- https://www.facebook.com/help/3714470172128723
- https://help.snapchat.com/hc/en-us/articles/24892451593108-Viewing-and-Understanding-Analytics
- https://docs.x.com/x-api/fundamentals/metrics
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/gemini-api/docs/structured-output

## Product Principle

Reporting requirements belong to the campaign, not to PopsDrops as a blanket rule.

The campaign manager decides:

- Which platforms qualify.
- Which content formats qualify.
- Which evidence is required.
- Which metrics matter.
- How often creators must report.
- Whether richer native insights are mandatory or optional.

The creator sees those requirements before applying. If a creator cannot provide the required platform, format, account type, or evidence, the interface makes that clear before they enter the application flow.

## Scope

This design covers:

- Seven reporting platform templates: Instagram, TikTok, YouTube, Facebook, Snapchat, X, and Generic.
- Campaign-level reporting requirements.
- Creator eligibility preview before application.
- Report task generation from cadence and accepted deliverables.
- Creator evidence submission.
- AI extraction records shaped for Gemini.
- Creator confirmation before extracted metrics become report data.
- Brand-side reporting status and missed evidence visibility.

This design does not require:

- Platform API analytics connections.
- OAuth support for X.
- Payment processing.
- Chat.
- Public creator marketplace behavior.
- Manual PopsDrops approvals for routine report submissions.

## Platform Model

Current product platform support remains TikTok, Instagram, Snapchat, YouTube, and Facebook. Reporting templates add X and Generic as evidence templates without turning X into a full social connection platform.

Use two related types:

- `Platform`: supported product platforms used by profiles, campaigns, and OAuth.
- `ReportingPlatform`: platforms that can appear in evidence templates and report tasks.

`ReportingPlatform` values:

- `instagram`
- `tiktok`
- `youtube`
- `facebook`
- `snapchat`
- `x`
- `generic`

Rules:

- Existing creator profile and OAuth code keeps using `Platform`.
- Reporting requirement code uses `ReportingPlatform`.
- Campaigns can include report-only platforms only when the brand configures custom evidence.
- Generic template allows brands to run an intentional evidence workflow for newsletters, blogs, retail partner dashboards, offline screenshots, or platforms not yet modeled.

## Metric Templates

Each template defines metric keys, labels, field type, whether the metric is commonly required, evidence expectation, and whether the value is usually public or private.

### Instagram

Primary metrics:

- `views`
- `reach`
- `impressions`
- `likes`
- `comments`
- `shares`
- `saves`
- `profile_visits`
- `link_clicks`

Evidence expectation:

- Public content URL.
- Insights screenshot for reach, impressions, saves, shares, profile visits, and link clicks.
- Manual public count entry can satisfy likes and comments when the campaign allows lighter proof.

Eligibility notes:

- Richer insights usually require a creator or business account.
- Campaign can require professional insights when proof quality matters.

### TikTok

Primary metrics:

- `views`
- `likes`
- `comments`
- `shares`
- `favorites`
- `avg_watch_time_seconds`
- `completion_rate`
- `profile_views`

Evidence expectation:

- Public content URL.
- Analytics screenshot for average watch time, completion, traffic, and profile views.

Eligibility notes:

- Public post stats cover basic engagement.
- Native analytics screenshot is required when retention or audience signal matters.

### YouTube

Primary metrics:

- `views`
- `impressions`
- `impressions_click_through_rate`
- `watch_time_minutes`
- `avg_view_duration_seconds`
- `likes`
- `comments`
- `shares`
- `subscribers_gained`

Evidence expectation:

- Public video or Short URL.
- YouTube Studio screenshot or export for impressions, watch time, click-through rate, and subscriber gains.

Eligibility notes:

- Public content page is not enough for performance reporting beyond basic views and public engagement.

### Facebook

Primary metrics:

- `reach`
- `impressions`
- `views`
- `reactions`
- `comments`
- `shares`
- `clicks`
- `profile_visits`

Evidence expectation:

- Public post URL.
- Page or professional dashboard screenshot for reach, impressions, clicks, and deeper engagement.

Eligibility notes:

- Campaign manager should specify whether personal profile content is allowed or whether Page/professional insights are required.

### Snapchat

Primary metrics:

- `views`
- `viewers`
- `screenshots`
- `shares`
- `swipe_ups`
- `avg_view_time_seconds`
- `total_view_time_seconds`
- `comments`
- `favorites`

Evidence expectation:

- Content link when available.
- Public Profile analytics screenshot for private metrics.

Eligibility notes:

- Snapchat has different visibility and metric behavior than feed-first platforms, so screenshots are often the realistic proof layer.

### X

Primary metrics:

- `impressions`
- `likes`
- `replies`
- `reposts`
- `quotes`
- `bookmarks`
- `clicks`
- `video_views`

Evidence expectation:

- Public post URL.
- Analytics screenshot for impressions, bookmarks, clicks, and private engagement.

Eligibility notes:

- X is a reporting template, not a full PopsDrops social connection platform in this slice.

### Generic

Primary metrics:

- `views`
- `reach`
- `impressions`
- `engagements`
- `clicks`
- `screenshots`
- `conversions`
- `custom_1`
- `custom_2`
- `custom_3`

Evidence expectation:

- URL or file reference when available.
- Screenshot, CSV, PDF, or analytics export.
- Brand-defined custom metric labels.

Eligibility notes:

- Generic must not become a dumping ground. The brand must name the platform, define the evidence, and choose the metrics before launch.

## Reporting Cadence

Reporting cadence is a campaign requirement.

Allowed cadences:

- `final_only`: one report task after the monitoring window.
- `per_post`: one report task for each approved published content item.
- `daily_window`: one report task per day during a defined monitoring window.
- `custom_dates`: report tasks on dates selected by the campaign manager.

Rules:

- Default is `final_only`.
- Daily reporting is only shown when the campaign manager explicitly selects it.
- Per-post reporting is best when deliverables publish across multiple days or platforms.
- Custom dates are best for launches, retail drops, event moments, and executive reporting moments.
- Creators can submit late unless the brand closes or excuses the task.
- Missed reports remain visible because missing proof is part of campaign truth.

## Campaign Builder Changes

Add a reporting requirements block to the timeline and reporting step.

Fields:

- Reporting cadence.
- Monitoring window.
- Required evidence types.
- Required platform templates.
- Required metrics per platform.
- Account requirement per platform.
- Whether AI extraction is allowed.
- Whether creator confirmation is required.

Account requirement values:

- `public_post_ok`
- `native_insights_required`
- `business_or_creator_account_required`
- `brand_defined`

Evidence type values:

- `public_url`
- `manual_metrics`
- `screenshot`
- `analytics_export`
- `csv`
- `document`

Intentionality:

- Every selected metric must appear in creator instructions, evidence submission, brand readiness, or final report.
- If a metric is not used downstream, do not show it.
- If a platform requires native insight screenshots, the creator must see that before applying.

## Creator Eligibility Preview

The application page shows a compact eligibility check before the pitch form.

Display:

- Required platforms.
- Required formats.
- Required evidence.
- Required account type.
- Reporting cadence.
- First report due date or final report due date.

States:

- `eligible`: creator has a matching connected or declared platform.
- `needs_confirmation`: creator can continue after confirming they can provide required evidence.
- `not_eligible`: creator lacks a required platform or account condition.

Rules:

- Do not force creator account upgrades globally.
- Do not hide requirements until after application.
- Allow a campaign manager to accept manual evidence when native insights are not required.
- If evidence requirement is strict, block application and explain the missing requirement in one sentence.

## Data Design

The existing tables remain the foundation:

- `campaign_reporting_plans`
- `campaign_report_tasks`
- `content_performance`
- `content_performance_evidence`

Add a sparse metric-values layer for platform-specific fields so we do not keep expanding fixed columns.

### reporting_metric_definitions

Stores canonical metric definitions and platform mappings.

Fields:

- `id uuid primary key`
- `platform text not null`
- `metric_key text not null`
- `label text not null`
- `field_type text not null`
- `evidence_scope text not null`
- `is_default boolean not null default false`
- `is_private_metric boolean not null default false`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

Constraints:

- `platform` in the seven `ReportingPlatform` values.
- `field_type` in `integer`, `decimal`, `percentage`, `duration_seconds`, `currency`, `text`.
- `evidence_scope` in `public`, `native_insights`, `brand_defined`.
- Unique `(platform, metric_key)`.

Downstream use:

- Campaign builder metric checklist.
- Creator evidence form.
- AI extraction schema.
- Report labeling.

### campaign_reporting_requirements

Stores campaign-specific platform proof requirements.

Fields:

- `id uuid primary key`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `platform text not null`
- `platform_label text`
- `content_format text not null`
- `account_requirement text not null default 'public_post_ok'`
- `evidence_types text[] not null default array['public_url', 'manual_metrics', 'screenshot']`
- `required_metric_keys text[] not null default '{}'`
- `ai_extraction_allowed boolean not null default true`
- `creator_confirmation_required boolean not null default true`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- One campaign can have multiple platform requirements.
- Generic requirement must have `platform_label`.
- `required_metric_keys` must match definitions for the platform unless the platform is Generic and a custom label is provided.

Downstream use:

- Creator eligibility preview.
- Report task generation.
- Creator evidence submission form.
- Brand report completeness.

### content_performance_metric_values

Stores exact submitted metric values by report task and content performance row.

Fields:

- `id uuid primary key`
- `performance_id uuid not null references content_performance(id) on delete cascade`
- `report_task_id uuid references campaign_report_tasks(id) on delete cascade`
- `platform text not null`
- `metric_key text not null`
- `metric_label text not null`
- `metric_value numeric`
- `metric_text text`
- `source_type text not null default 'creator_manual'`
- `extraction_confidence numeric`
- `confirmed_by_creator boolean not null default false`
- `confirmed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `source_type` in `creator_manual`, `ai_extracted`, `creator_confirmed`, `brand_verified`, `platform_api`.
- `metric_value` or `metric_text` must be present.
- Unique `(performance_id, metric_key)`.

Downstream use:

- Platform-specific charts.
- AI extraction audit.
- Evidence-backed report exports.
- Future platform API mapping.

### content_performance_ai_extractions

Stores raw AI extraction attempts without making them report truth.

Fields:

- `id uuid primary key`
- `evidence_id uuid not null references content_performance_evidence(id) on delete cascade`
- `report_task_id uuid not null references campaign_report_tasks(id) on delete cascade`
- `platform text not null`
- `model text not null`
- `input_sha256 text not null`
- `extracted_metrics jsonb not null`
- `confidence_summary jsonb not null default '{}'`
- `status text not null default 'pending_confirmation'`
- `created_at timestamptz not null default now()`

Allowed statuses:

- `pending_confirmation`
- `accepted_by_creator`
- `edited_by_creator`
- `rejected_by_creator`
- `superseded`

Rules:

- AI extraction never updates report metrics directly.
- Creator confirmation creates or updates `content_performance_metric_values`.
- Store a file hash so duplicate screenshots can be detected.
- Keep extraction records for audit even when the creator edits values.

## RLS and Storage

All new tables must have RLS enabled.

Policy rules:

- Brand can read requirements, metric values, and extraction status for its campaigns.
- Brand can configure campaign requirements for its campaigns.
- Creator can read requirements for campaigns they can apply to or have joined.
- Creator can read and submit metric values only for their own campaign membership.
- Creator can confirm only extraction records tied to their own evidence.
- Admin can access all rows.

Storage remains in the private `campaign-evidence` bucket.

Rules:

- Evidence files use short-lived signed URLs.
- Creator can upload only under their own campaign membership path.
- Brand can view evidence for its own campaign.
- Another creator cannot view evidence.
- AI extraction jobs use service role and must still write rows that preserve creator ownership and campaign scope.

## UI Design

### Brand campaign builder

Use a compact platform matrix, not a long wall of cards.

Columns:

- Platform
- Format
- Evidence
- Required metrics
- Account requirement

Behavior:

- Defaults come from the selected platform template.
- Metric checklist starts with the default set.
- Brand can add optional metrics without seeing every possible field up front.
- Generic platform requires a label before saving.

### Public application page

Show eligibility before the pitch.

Example:

- `Instagram Reel`
- `Insights screenshot required`
- `Final report due May 18`
- `Reach, views, likes, comments, shares, saves`

If blocked:

- One sentence explaining why.
- One quiet secondary action to update social profile when appropriate.

### Creator report task

Show one task with one clear next action.

Sections:

- Content link.
- Required metrics.
- Evidence upload.
- AI extracted values, if available.
- Creator confirmation.

Avoid:

- Asking creators to understand internal report terminology.
- Showing every metric supported by a platform.
- Repeating dates in multiple places.

### Brand campaign workspace

Show report readiness at campaign, creator, and content level.

States:

- `missing`
- `due_soon`
- `submitted`
- `submitted_late`
- `confirmed`
- `verified`
- `missed`
- `excused`

Display rules:

- Missing evidence is visible.
- Missed reports affect readiness.
- Late reports remain usable but labeled.
- Confirmed AI extraction is labeled differently from manual creator entry.

## AI Extraction Flow

1. Creator uploads evidence screenshot.
2. Server validates file type and stores evidence metadata.
3. Extraction job sends the screenshot to Gemini with the selected platform schema.
4. AI response is stored in `content_performance_ai_extractions`.
5. Creator sees extracted values next to editable fields.
6. Creator confirms, edits, or rejects.
7. Confirmed values become `content_performance_metric_values`.
8. Brand sees the source label and evidence link.

Trust labels:

- Manual entry.
- AI extracted, waiting for creator.
- AI extracted and creator confirmed.
- Brand verified.
- Platform API verified later.

Rules:

- Never hide the evidence source.
- Never let AI silently overwrite creator-confirmed values.
- Never mark an AI value as verified before human confirmation.

## Edge Cases

- Campaign requires Instagram professional insights and creator has only a public personal account: block or require confirmation based on brand setting.
- Campaign uses Generic platform without label: cannot launch.
- Creator submits public URL but no screenshot when screenshot is required: task remains incomplete.
- Creator uploads screenshot but AI extraction fails: allow manual entry and keep evidence.
- Creator edits AI values: store final value as creator confirmed and retain original extraction record.
- Creator submits after grace period: status becomes `submitted_late`.
- Campaign date changes: regenerate only pending future tasks.
- Required metrics change after launch: preserve existing submitted data and apply new requirements only to future tasks unless brand explicitly updates open tasks.
- Same screenshot uploaded twice: allow only when attached to a different task, otherwise show duplicate warning.
- X is required but creator has no X platform on profile: show not eligible unless Generic custom proof is allowed by the campaign.

## Testing

Database and policy tests:

- Brand can configure reporting requirements for its campaign.
- Other brand cannot read or update requirements.
- Creator can read application-visible requirements.
- Creator cannot submit metrics for another creator.
- Creator cannot confirm another creator's extraction.
- Brand can view evidence and metric values for its campaign.
- Generic platform requires a label.
- X template can be configured without adding X to OAuth platforms.

Unit tests:

- Reporting template definitions include the seven platforms.
- Required metric keys validate against platform definitions.
- Cadence generator creates tasks for final-only, per-post, daily window, and custom dates.
- Eligibility preview returns eligible, needs confirmation, and not eligible states.
- AI extraction confirmation writes metric values without overwriting unrelated metrics.
- Report aggregation labels metric source and missing data.

Browser smoke:

- Brand creates a campaign requiring Instagram Reel evidence.
- Brand creates a campaign requiring Generic evidence.
- Creator sees eligibility before applying.
- Creator submits a report task with screenshot evidence and manual values.
- Seeded AI extraction appears for creator confirmation.
- Creator edits and confirms extracted values.
- Brand campaign workspace shows confirmed evidence.
- Report page uses confirmed values and labels source quality.

## Implementation Order

1. Add `ReportingPlatform` definitions and platform metric templates.
2. Add database tables for metric definitions, campaign requirements, metric values, and AI extraction records.
3. Add RLS and policy tests before UI work.
4. Add reporting requirement server helpers and validation schemas.
5. Add campaign builder reporting requirement controls.
6. Add creator eligibility preview on apply page.
7. Add creator report task submission and confirmation flow.
8. Add brand workspace readiness and missed report visibility.
9. Add report aggregation from sparse metric values.
10. Add Gemini extraction behind a server action or job with creator confirmation.
11. Run focused unit tests, typecheck, lint, and browser smoke.

## Definition of Done

This slice is done only when:

- Seven reporting templates exist and are tested.
- Campaign manager can define platform-specific evidence requirements.
- Creator sees eligibility before applying.
- Report tasks reflect selected cadence.
- Creator can submit evidence and metric values.
- AI extraction records are stored separately from confirmed metrics.
- Creator confirmation is required before AI values affect reports.
- Brand sees missing, missed, late, submitted, confirmed, and verified states.
- Final reports label data source quality.
- RLS prevents cross-brand and cross-creator access.
- Browser smoke proves the brand to creator to report loop.

