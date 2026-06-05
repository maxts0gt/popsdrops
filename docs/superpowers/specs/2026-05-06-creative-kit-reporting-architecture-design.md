# Creative Kit and Reporting Architecture Design

Date: 2026-05-06
Status: Proposed for user review

## Purpose

PopsDrops is not only a place to create creator campaigns. It is a cross-border campaign system that helps brands give creators the right materials, keep work on schedule, collect evidence, and produce reportable market proof.

This design adds the missing product spine:

1. Creative Kit tells creators what to make.
2. Reporting Plan tells creators what proof to return.
3. Report Tasks create accountability by creator and due date.
4. Evidence Storage protects trust in manual performance data.
5. Campaign pages show readiness, missing items, and final proof without pretending unavailable data exists.

## Product Principles

- Every product choice must be intentional. If a field, status, tab, chart, upload, or line of copy does not serve a downstream job, remove it.
- Do not fake analytics. If daily data was not submitted or fetched, show the gap.
- Default to final-only reporting because it is easiest for brands and creators.
- Make daily or weekly reporting available when the campaign needs it.
- Treat missed reports as real campaign state, not just a warning badge.
- Keep private brand materials private. Applicants do not receive internal assets.
- Label metric trust level clearly: creator-submitted, screenshot-verified, or platform-verified later.
- Keep brand workflow self-running. PopsDrops should not manually approve routine creator work.

## Intentionality Gate

Before implementation, every proposed item must answer all required questions below.

Required questions:

1. What user job does this serve?
2. Which user sees or edits it?
3. What downstream output uses it?
4. Does it help matching, instruction, scheduling, evidence, reporting, pricing, compliance, or trust?
5. What happens if it is missing, late, wrong, or rejected?

Removal rules:

- If it does not change creator behavior, brand decisions, campaign operations, report quality, pricing clarity, or access control, remove it.
- If it only explains the interface but the interface can be made clearer, remove the text and improve the interface.
- If it creates data that is never used in matching, workflow, reporting, audit, or permissions, remove the field.
- If it adds a new status without a user action, system action, or report consequence, remove the status.
- If it creates a tab with fewer than two real jobs, merge it into another tab.
- If it creates a chart that cannot be trusted or explained, do not ship the chart.
- If it requires manual PopsDrops intervention for routine work, redesign it so the platform can run itself.

Implementation requirement:

- Each new field or table column must include a short downstream-use note in the implementation plan.
- Each new UI section must include a primary job and empty-state behavior.
- Each new report element must state its data source and what missing data means.

## Campaign Builder Shape

The campaign builder keeps five steps.

### 1. Campaign Setup

Captures the operating model, campaign title, campaign description, product or offer, platforms, and target markets.

Downstream use:

- Public campaign summary
- Creator discovery
- Campaign workspace header
- Report segmentation

### 2. Creator Fit

Captures creator count, audience markets, languages, niches, requirements, exclusions, and creator fit notes.

Downstream use:

- Sourced campaign shortlist
- Creator matching
- Applicant review
- Report slices by creator type and market

### 3. Creative Kit

Replaces a narrow "content brief" mindset with a complete kit.

MVP fields:

- Product notes
- Brand vibe
- Required talking points
- Avoid or restricted claims
- CTA
- Hashtags
- Example references
- Asset uploads

Downstream use:

- Creator campaign room
- Content submission checklist
- Brand review criteria
- Revision reasons

### 4. Budget, Timeline, and Reporting

Captures creator cash, product value, fulfillment estimate, PopsDrops fee, campaign dates, application close date, content due date, performance due date, and reporting cadence.

Reporting cadence options:

- Final only, default
- Weekly
- Daily during launch window
- Custom dates

Downstream use:

- Creator tasks
- Deadline reminders
- Missed report detection
- Report freshness and integrity

### 5. Review and Launch

Shows the full operating plan before launch.

Review must show:

- What creators will see
- What assets become available after acceptance
- What report tasks will be generated
- Estimated total spend
- Missing required fields
- Risk checks, such as no CTA, no usage rights, no performance due date, or no required evidence

## Database Design

### campaign_brief_blocks

Stores modular Creative Kit instructions.

Fields:

- `id uuid primary key`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `block_type text not null`
- `title text not null`
- `body text`
- `items jsonb not null default '[]'`
- `visibility text not null default 'member'`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed `block_type` values:

- `product_notes`
- `brand_vibe`
- `talking_points`
- `avoid_claims`
- `cta`
- `hashtags`
- `examples`
- `custom`

Allowed `visibility` values:

- `public`
- `member`
- `brand`

Rules:

- Public blocks can appear on public apply and creator discovery surfaces.
- Member blocks are visible only after creator acceptance.
- Brand blocks are internal campaign notes.

### campaign_assets

Stores metadata for files in the Creative Kit.

Fields:

- `id uuid primary key`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `uploaded_by uuid not null references profiles(id)`
- `title text not null`
- `description text`
- `asset_type text not null`
- `bucket_id text not null default 'campaign-assets'`
- `storage_path text not null unique`
- `file_name text not null`
- `mime_type text not null`
- `size_bytes bigint not null`
- `visibility text not null default 'member'`
- `status text not null default 'ready'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed `asset_type` values:

- `product_image`
- `brand_guideline`
- `reference_video`
- `sell_sheet`
- `logo`
- `document`
- `other`

Allowed `status` values:

- `uploading`
- `ready`
- `archived`

Rules:

- MVP assets are private.
- No public storage URLs.
- Assets are accessed through short-lived signed URLs after authorization.
- Replacing an asset creates a new row or archives the old row. Do not use blind overwrite.

### campaign_reporting_plans

Stores the reporting contract for a campaign.

Fields:

- `id uuid primary key`
- `campaign_id uuid not null unique references campaigns(id) on delete cascade`
- `cadence text not null default 'final_only'`
- `required_evidence text[] not null default array['post_url', 'manual_metrics', 'screenshot']`
- `required_metrics jsonb not null default '{}'`
- `grace_period_hours integer not null default 24`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `custom_due_dates timestamptz[] not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed `cadence` values:

- `final_only`
- `weekly`
- `daily_launch_window`
- `custom`

Metric rules:

- Required metrics are platform-specific.
- Do not require fields a platform cannot reasonably provide.
- Cross-platform reports use normalized comparisons like CPE, never raw blended engagement totals.

### campaign_report_tasks

Stores the actual reporting obligations generated from the reporting plan.

Fields:

- `id uuid primary key`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `campaign_member_id uuid not null references campaign_members(id) on delete cascade`
- `period_start timestamptz`
- `period_end timestamptz`
- `due_at timestamptz not null`
- `status text not null default 'pending'`
- `submitted_at timestamptz`
- `verified_at timestamptz`
- `missed_at timestamptz`
- `excused_at timestamptz`
- `review_note text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed stored statuses:

- `pending`
- `submitted`
- `submitted_late`
- `verified`
- `needs_revision`
- `missed`
- `excused`

Derived UI states:

- `due_soon`, shown when a pending task is close to due.
- `overdue`, shown before the grace period expires.

Rules:

- Report tasks are generated when a creator becomes a campaign member.
- If the campaign is final-only, generate one task per member using `performance_due_date`.
- If the campaign is weekly, generate one task per member per weekly period.
- If the campaign is daily launch window, generate one task per member per launch day.
- If the campaign is custom, generate one task per member per custom due date.
- If a due date plus grace period passes without submission, a scheduled job marks the task `missed`.
- A creator can submit late. A missed task becomes `submitted_late`, preserving accountability.
- A brand can mark a missed task `excused` when the report is no longer required.

### content_performance changes

Keep `content_performance` as the table for numbers. Add:

- `report_task_id uuid references campaign_report_tasks(id) on delete set null`
- `verification_status text not null default 'submitted'`
- `verified_at timestamptz`
- `verified_by uuid references profiles(id)`

Allowed `verification_status` values:

- `submitted`
- `screenshot_verified`
- `brand_verified`
- `rejected`

Rules:

- `data_source = 'manual'` remains the default.
- Future API reads can use `api` or `api_partial`.
- A metric row is always tied to one content submission.
- A report task can contain multiple metric rows because one creator may publish multiple posts.

### content_performance_evidence

Stores metadata for screenshots, CSVs, or other proof files.

Fields:

- `id uuid primary key`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `campaign_member_id uuid not null references campaign_members(id) on delete cascade`
- `report_task_id uuid references campaign_report_tasks(id) on delete cascade`
- `submission_id uuid references content_submissions(id) on delete cascade`
- `performance_id uuid references content_performance(id) on delete cascade`
- `uploaded_by uuid not null references profiles(id)`
- `evidence_type text not null`
- `bucket_id text not null default 'campaign-evidence'`
- `storage_path text not null unique`
- `file_name text not null`
- `mime_type text not null`
- `size_bytes bigint not null`
- `verification_status text not null default 'submitted'`
- `review_note text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Allowed `evidence_type` values:

- `screenshot`
- `csv`
- `analytics_export`
- `document`
- `other`

Allowed `verification_status` values:

- `submitted`
- `verified`
- `rejected`

Rules:

- Creators upload evidence only for their own membership.
- Brand can view and verify evidence for its own campaigns.
- Another creator cannot see evidence.
- Evidence files use short-lived signed URLs only.

## Indexes and Constraints

Add check constraints for every controlled text status instead of relying on UI validation.

Recommended indexes:

- `campaign_brief_blocks (campaign_id, visibility, sort_order)`
- `campaign_assets (campaign_id, visibility, status)`
- `campaign_assets (storage_path) unique`
- `campaign_reporting_plans (campaign_id) unique`
- `campaign_report_tasks (campaign_id, status, due_at)`
- `campaign_report_tasks (campaign_member_id, status, due_at)`
- `campaign_report_tasks (campaign_member_id, due_at) unique where status <> 'excused'`
- `content_performance (report_task_id)`
- `content_performance (submission_id, reported_at)`
- `content_performance_evidence (campaign_id, campaign_member_id)`
- `content_performance_evidence (report_task_id)`
- `content_performance_evidence (performance_id)`
- `content_performance_evidence (storage_path) unique`

Uniqueness rules:

- One reporting plan per campaign.
- Final-only cadence creates one active report task per campaign member.
- Custom cadence creates one active report task per campaign member per due date.
- Weekly and daily cadences create one active report task per campaign member per reporting period.

Data constraints:

- `grace_period_hours` must be between 0 and 168.
- `size_bytes` must be greater than 0.
- `due_at` must be present for every report task.
- `period_start` must be before `period_end` when both are present.
- `submitted_at` must be present when status is `submitted`, `submitted_late`, `verified`, or `needs_revision`.
- `missed_at` must be present when status is `missed`.
- `missed_at` remains populated when a missed task later becomes `submitted_late`.
- `excused_at` must be present when status is `excused`.

## Storage Buckets

### campaign-assets

Purpose:

- Brand Creative Kit files.

Settings:

- Private bucket.
- Suggested file limit: 50 MB.
- Allowed MIME groups: images, videos, PDF, common office documents.

Path format:

`{campaign_id}/{asset_id}/{safe_filename}`

Access:

- Brand owner can upload, read, archive, and delete files for its campaign.
- Accepted campaign members can read ready member-visible files.
- Applicants cannot read private asset files.
- Admin can read for support and moderation.

### campaign-evidence

Purpose:

- Creator proof files for report tasks and performance metrics.

Settings:

- Private bucket.
- Suggested file limit: 15 MB.
- Allowed MIME groups: images, PDF, CSV.

Path format:

`{campaign_id}/{campaign_member_id}/{report_task_id}/{evidence_id}/{safe_filename}`

Access:

- Creator can upload and read files for their own campaign membership.
- Brand owner can read files for its campaign.
- Brand can verify or reject evidence metadata, but not silently edit creator files.
- Admin can read for support and moderation.

## RLS and Authorization

All new public tables must have RLS enabled.

Use helper functions in a non-exposed schema, for example `app_private`, for storage policy checks. Avoid new security definer helpers in the exposed `public` schema when possible.

### Table policies

`campaign_brief_blocks`:

- Brand can select, insert, update, delete blocks for campaigns it owns.
- Accepted creators can select `member` and `public` blocks for campaigns where they are members.
- Anonymous users can select only `public` blocks for public recruiting campaigns if the public apply page needs them.
- Admin can access all rows.

`campaign_assets`:

- Brand can select, insert, update, archive, and delete assets for campaigns it owns.
- Accepted creators can select ready member-visible assets for campaigns where they are members.
- Applicants cannot select member-visible assets.
- Admin can access all rows.

`campaign_reporting_plans`:

- Brand can select, insert, update, and delete plans for campaigns it owns.
- Accepted creators can select the plan for campaigns where they are members.
- Admin can access all rows.

`campaign_report_tasks`:

- Brand can select all tasks for campaigns it owns.
- Brand can update task status to `verified`, `needs_revision`, or `excused`.
- Creator can select tasks for their own membership.
- Creator can submit only their own pending, missed, or needs-revision tasks through server actions.
- Admin can access all rows.

`content_performance_evidence`:

- Brand can select and verify evidence for campaigns it owns.
- Creator can insert and select evidence for their own membership.
- Creator cannot update verification fields.
- Admin can access all rows.

### Storage policies

Storage policies on `storage.objects` must check:

- `bucket_id`
- Parsed `campaign_id` from the path
- Parsed `campaign_member_id` for evidence paths
- Matching metadata row exists and is not archived
- Current user is brand owner, accepted member, creator owner, or admin

Upsert is not the default upload path. If replacement is later supported, add SELECT and UPDATE policies intentionally because Supabase Storage upsert requires INSERT, SELECT, and UPDATE permissions.

## Scheduled Jobs

Add a scheduled server job called `evaluateReportTasks`.

Responsibilities:

- Find pending report tasks where `now() > due_at + grace_period_hours`.
- Mark them `missed` and set `missed_at`.
- Queue creator reminders before due date.
- Queue brand notifications when report readiness is blocked.
- Leave verified, excused, and submitted tasks unchanged.

Cadence:

- Daily is enough for MVP.
- Hourly can be used later for launch-day reporting.

Idempotency:

- Running the job twice must not duplicate notifications or change verified tasks.
- Use existing notification queue patterns where possible.

## UI Design

### Brand campaign workspace

Overview should show:

- Campaign status
- Timeline
- Creator count
- Content progress
- Report readiness
- Missed report count
- Next action

Creators tab should show:

- Accepted creators
- Content status
- Report task status
- Missed, late, or verified labels

Creative Kit tab should show:

- Brief blocks
- Files
- Visibility
- Last updated time

Performance tab should show:

- Metrics by platform
- Metrics by reporting period
- Day-by-day charts only when daily tasks exist or daily data was submitted
- Missing periods clearly marked

Report tab should show:

- Live report draft
- Data completeness
- Evidence status
- Creator-level breakdown
- Market-level insights
- Final export later

### Creator campaign room

Creator view should show:

- Creative Kit
- Deliverables
- Content submission
- Report tasks
- Evidence upload
- Payment status

Report tasks should make the next action obvious:

- Submit performance
- Fix requested evidence
- Submitted
- Verified
- Missed

Late submission should remain possible unless the brand closes or excuses the task.

## Report Integrity Rules

Every report metric must carry trust context:

- Creator-submitted means manual numbers without verified evidence.
- Screenshot-verified means evidence was reviewed.
- Brand-verified means the brand accepted the data as usable.
- Platform-verified is reserved for future API integrations.

Reports must not:

- Average raw platform metrics across TikTok, Instagram, YouTube, Snapchat, and Facebook.
- Fill missing days with zero unless the creator explicitly reported zero.
- Hide missed report tasks.
- Treat missing evidence as complete data.

Reports may:

- Show totals per platform.
- Show creator-level performance.
- Show market-level patterns.
- Show content status and evidence coverage.
- Show CPE or other normalized comparison metrics where defensible.

## Edge Cases

- Creator accepted after report tasks were generated: create tasks for the new member immediately.
- Creator removed from campaign: keep historical tasks and evidence, stop future task generation.
- Campaign date changes: regenerate only pending future tasks, preserve submitted and verified tasks.
- Performance due date changes: update pending final-only tasks, preserve submitted and verified tasks.
- Creator submits after missed: change task to `submitted_late`.
- Brand rejects evidence: task becomes `needs_revision`.
- Creator cannot access asset: show a clear unavailable state, not a broken download.
- File upload succeeds but DB update fails: keep the asset row in `uploading` and show retry or cleanup.
- DB row exists but storage object missing: show file unavailable and log for cleanup.
- Campaign is cancelled: stop reminders and mark pending tasks inactive through campaign status logic.

## Implementation Order

1. Add schema, constraints, indexes, and RLS policies.
2. Add private storage buckets and storage object policies.
3. Add server actions for asset upload metadata, signed URLs, report task submission, and evidence verification.
4. Add report task generation on campaign member creation.
5. Add scheduled report task evaluation.
6. Update campaign builder Step 3 and Step 4.
7. Update brand campaign workspace tabs.
8. Update creator campaign room.
9. Update report page and report data labels.

## Tests and Verification

### Database and RLS

- Brand can create and read Creative Kit assets for its own campaign.
- Other brand cannot read those assets.
- Applicant creator cannot read member-visible assets.
- Accepted creator can read member-visible assets.
- Creator can upload evidence only for their own membership.
- Another creator cannot read evidence.
- Brand can read and verify evidence for its campaign.
- Storage object policies reject paths that do not match authorized campaign membership.

### Unit tests

- Report task generator creates correct tasks for final-only, weekly, daily launch window, and custom schedules.
- Changing performance due date updates only pending future tasks.
- Missed task evaluator is idempotent.
- Late submission changes missed task to `submitted_late`.
- Report aggregation labels data source and verification status correctly.

### Intentionality review

- Every campaign builder field has a documented downstream use.
- Every campaign workspace tab has a primary job and at least two real user tasks.
- Every report status has a user-visible consequence.
- Every empty state has one next action or no action when the correct state is completion.
- No helper copy repeats what the component already makes obvious.
- No chart ships without data-source labeling and missing-data behavior.

### Browser smoke tests

- Brand creates campaign with Creative Kit and final-only reporting.
- Brand uploads an asset.
- Creator applies and is accepted.
- Accepted creator sees the Creative Kit asset.
- Creator submits content.
- Creator submits performance numbers and screenshot evidence.
- Brand verifies evidence.
- Campaign report shows verified data.
- Seed an overdue report task, run evaluator, and verify brand workspace shows Missed.

## MVP Decisions

- Use manual creator-submitted metrics first.
- Use screenshot evidence as the trust layer.
- Use final-only reporting by default.
- Keep daily and weekly reporting optional.
- Use private Supabase Storage buckets.
- Do not build platform API analytics before the reporting task system works.
- Do not expose private Creative Kit assets to applicants.
- Do not build chat as part of this slice.

## Definition of Done

This slice is done only when:

- The intentionality review passes with no orphan fields, decorative sections, or unsupported charts.
- Schema and RLS are applied and verified.
- Buckets are private and policy-protected.
- Uploads work for the right users and fail for the wrong users.
- Report tasks are generated, submitted, missed, late-submitted, and verified correctly.
- Brand and creator screens show the same truth.
- Final report labels data completeness and evidence status honestly.
- Browser smoke proves the full brand to creator to report loop.
