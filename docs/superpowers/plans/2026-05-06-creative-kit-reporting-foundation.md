# Creative Kit Reporting Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the database, RLS, storage, and report-task foundation for Creative Kit assets and campaign performance reporting.

**Architecture:** This slice creates the truth layer before UI: new campaign brief, asset, reporting plan, report task, and evidence records; private Supabase Storage buckets; RLS and storage policies; pure TypeScript task generation; and application-acceptance hooks that create report tasks. UI work comes in the next plan after this foundation is verified.

**Tech Stack:** Supabase Postgres, Supabase Storage, RLS, Next.js Server Actions, TypeScript, Zod, Vitest.

---

## Scope

This plan intentionally covers only the foundation.

Included:

- Schema for Creative Kit blocks, campaign assets, reporting plans, report tasks, and performance evidence.
- RLS policies for brand, accepted creator, admin, and public brief access.
- Private storage buckets for campaign assets and campaign evidence.
- Storage object policies tied to metadata rows and path ownership.
- TypeScript database types for the new tables and enums.
- Pure report task generation utilities.
- Missed-report status utilities.
- Privileged helper that creates report tasks when a creator becomes a campaign member.
- Acceptance-flow hooks for brand acceptance and creator counter-offer acceptance.

Excluded from this plan:

- Campaign builder UI.
- Brand campaign workspace tabs.
- Creator campaign room UI.
- Signed URL server actions.
- File upload UI.
- Report charts and export.
- Scheduled job deployment.

Those are separate plans because each has its own browser smoke path.

## Intentionality Map

Every item in this slice has a downstream job.

- `campaign_brief_blocks`: feeds creator instructions, public apply copy, review criteria, and translated brief structure.
- `campaign_assets`: gives accepted creators brand files without exposing private materials to applicants.
- `campaign_reporting_plans`: defines the proof contract before the campaign launches.
- `campaign_report_tasks`: turns the proof contract into per-creator accountability.
- `campaign_report_tasks.task_key`: makes generated tasks idempotent for each creator and reporting period.
- `content_performance.report_task_id`: ties numbers to a reporting obligation.
- `content_performance.verification_status`: tells the brand how much to trust reported numbers.
- `content_performance_evidence`: stores screenshot or export proof for report integrity.
- `campaign-assets` bucket: stores private Creative Kit files.
- `campaign-evidence` bucket: stores private proof files.
- Missed report logic: tells the brand when final reporting is incomplete because a creator did not submit proof.

## Files

- Create: `supabase/migrations/<generated>_creative_kit_reporting_foundation.sql`
- Modify: `src/types/database.ts`
- Create: `src/lib/reporting/task-schedule.ts`
- Create: `src/lib/reporting/task-schedule.test.ts`
- Create: `src/lib/reporting/report-task-status.ts`
- Create: `src/lib/reporting/report-task-status.test.ts`
- Modify: `src/lib/supabase/privileged.ts`
- Modify: `src/app/actions/applications.ts`
- Create: `src/app/actions/applications-report-tasks.test.ts`

## Task 1: Create Supabase Migration

**Files:**

- Create by CLI: `supabase/migrations/<generated>_creative_kit_reporting_foundation.sql`

- [ ] **Step 1: Generate the migration file**

Run:

```bash
supabase migration new creative_kit_reporting_foundation
```

Expected:

```text
Created new migration at supabase/migrations/<timestamp>_creative_kit_reporting_foundation.sql
```

- [ ] **Step 2: Replace the generated migration contents**

Paste this SQL into the generated migration file:

```sql
-- Creative Kit and reporting foundation.

create schema if not exists app_private;

revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = 'admin'
  );
$$;

create or replace function app_private.is_campaign_brand(campaign_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaigns
     where id = campaign_uuid
       and brand_id = auth.uid()
  );
$$;

create or replace function app_private.is_campaign_member(campaign_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_members
     where campaign_id = campaign_uuid
       and creator_id = auth.uid()
  );
$$;

create or replace function app_private.is_campaign_member_record(member_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_members
     where id = member_uuid
       and creator_id = auth.uid()
  );
$$;

create or replace function app_private.is_report_task_creator(task_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_report_tasks task
      join public.campaign_members member
        on member.id = task.campaign_member_id
     where task.id = task_uuid
       and member.creator_id = auth.uid()
  );
$$;

create or replace function app_private.uuid_path_segment(object_name text, segment_number integer)
returns uuid
language plpgsql
immutable
as $$
declare
  raw_segment text;
begin
  raw_segment := split_part(object_name, '/', segment_number);
  return raw_segment::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create table if not exists public.campaign_brief_blocks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  block_type text not null,
  title text not null,
  body text,
  items jsonb not null default '[]'::jsonb,
  visibility text not null default 'member',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_brief_blocks_block_type_check check (
    block_type in (
      'product_notes',
      'brand_vibe',
      'talking_points',
      'avoid_claims',
      'cta',
      'hashtags',
      'examples',
      'custom'
    )
  ),
  constraint campaign_brief_blocks_visibility_check check (
    visibility in ('public', 'member', 'brand')
  )
);

create table if not exists public.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  title text not null,
  description text,
  asset_type text not null,
  bucket_id text not null default 'campaign-assets',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  visibility text not null default 'member',
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_assets_asset_type_check check (
    asset_type in (
      'product_image',
      'brand_guideline',
      'reference_video',
      'sell_sheet',
      'logo',
      'document',
      'other'
    )
  ),
  constraint campaign_assets_visibility_check check (
    visibility in ('member', 'brand')
  ),
  constraint campaign_assets_status_check check (
    status in ('uploading', 'ready', 'archived')
  ),
  constraint campaign_assets_bucket_check check (bucket_id = 'campaign-assets'),
  constraint campaign_assets_size_check check (size_bytes > 0)
);

create table if not exists public.campaign_reporting_plans (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.campaigns(id) on delete cascade,
  cadence text not null default 'final_only',
  required_evidence text[] not null default array['post_url', 'manual_metrics', 'screenshot']::text[],
  required_metrics jsonb not null default '{}'::jsonb,
  grace_period_hours integer not null default 24,
  starts_at timestamptz,
  ends_at timestamptz,
  custom_due_dates timestamptz[] not null default '{}'::timestamptz[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_reporting_plans_cadence_check check (
    cadence in ('final_only', 'weekly', 'daily_launch_window', 'custom')
  ),
  constraint campaign_reporting_plans_grace_check check (
    grace_period_hours between 0 and 168
  ),
  constraint campaign_reporting_plans_window_check check (
    starts_at is null or ends_at is null or starts_at < ends_at
  )
);

create table if not exists public.campaign_report_tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_member_id uuid not null references public.campaign_members(id) on delete cascade,
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz not null,
  task_key text not null,
  status text not null default 'pending',
  submitted_at timestamptz,
  verified_at timestamptz,
  missed_at timestamptz,
  excused_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_report_tasks_status_check check (
    status in (
      'pending',
      'submitted',
      'submitted_late',
      'verified',
      'needs_revision',
      'missed',
      'excused'
    )
  ),
  constraint campaign_report_tasks_period_check check (
    period_start is null or period_end is null or period_start < period_end
  ),
  constraint campaign_report_tasks_submitted_check check (
    status not in ('submitted', 'submitted_late', 'verified', 'needs_revision')
    or submitted_at is not null
  ),
  constraint campaign_report_tasks_missed_check check (
    status <> 'missed' or missed_at is not null
  ),
  constraint campaign_report_tasks_excused_check check (
    status <> 'excused' or excused_at is not null
  )
);

alter table public.content_performance
  add column if not exists report_task_id uuid references public.campaign_report_tasks(id) on delete set null,
  add column if not exists verification_status text not null default 'submitted',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id);

alter table public.content_performance
  drop constraint if exists content_performance_verification_status_check;

alter table public.content_performance
  add constraint content_performance_verification_status_check check (
    verification_status in (
      'submitted',
      'screenshot_verified',
      'brand_verified',
      'rejected'
    )
  );

create table if not exists public.content_performance_evidence (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_member_id uuid not null references public.campaign_members(id) on delete cascade,
  report_task_id uuid references public.campaign_report_tasks(id) on delete cascade,
  submission_id uuid references public.content_submissions(id) on delete cascade,
  performance_id uuid references public.content_performance(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  evidence_type text not null,
  bucket_id text not null default 'campaign-evidence',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  verification_status text not null default 'submitted',
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_performance_evidence_type_check check (
    evidence_type in ('screenshot', 'csv', 'analytics_export', 'document', 'other')
  ),
  constraint content_performance_evidence_verification_check check (
    verification_status in ('submitted', 'verified', 'rejected')
  ),
  constraint content_performance_evidence_bucket_check check (bucket_id = 'campaign-evidence'),
  constraint content_performance_evidence_size_check check (size_bytes > 0)
);

create index if not exists campaign_brief_blocks_campaign_visibility_sort_idx
  on public.campaign_brief_blocks (campaign_id, visibility, sort_order);

create index if not exists campaign_assets_campaign_visibility_status_idx
  on public.campaign_assets (campaign_id, visibility, status);

create index if not exists campaign_reporting_plans_campaign_idx
  on public.campaign_reporting_plans (campaign_id);

create index if not exists campaign_report_tasks_campaign_status_due_idx
  on public.campaign_report_tasks (campaign_id, status, due_at);

create index if not exists campaign_report_tasks_member_status_due_idx
  on public.campaign_report_tasks (campaign_member_id, status, due_at);

create unique index if not exists campaign_report_tasks_member_task_key_idx
  on public.campaign_report_tasks (campaign_member_id, task_key);

create index if not exists content_performance_report_task_idx
  on public.content_performance (report_task_id);

create index if not exists content_performance_submission_reported_idx
  on public.content_performance (submission_id, reported_at);

create index if not exists content_performance_evidence_campaign_member_idx
  on public.content_performance_evidence (campaign_id, campaign_member_id);

create index if not exists content_performance_evidence_report_task_idx
  on public.content_performance_evidence (report_task_id);

create index if not exists content_performance_evidence_performance_idx
  on public.content_performance_evidence (performance_id);

alter table public.campaign_brief_blocks enable row level security;
alter table public.campaign_assets enable row level security;
alter table public.campaign_reporting_plans enable row level security;
alter table public.campaign_report_tasks enable row level security;
alter table public.content_performance_evidence enable row level security;

drop policy if exists campaign_brief_blocks_select_access on public.campaign_brief_blocks;
create policy campaign_brief_blocks_select_access on public.campaign_brief_blocks
  for select
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      visibility in ('public', 'member')
      and app_private.is_campaign_member(campaign_id)
    )
    or (
      visibility = 'public'
      and exists (
        select 1
          from public.campaigns
         where campaigns.id = campaign_brief_blocks.campaign_id
           and campaigns.status = 'recruiting'
      )
    )
  );

drop policy if exists campaign_brief_blocks_insert_brand on public.campaign_brief_blocks;
create policy campaign_brief_blocks_insert_brand on public.campaign_brief_blocks
  for insert
  to authenticated
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_brief_blocks_update_brand on public.campaign_brief_blocks;
create policy campaign_brief_blocks_update_brand on public.campaign_brief_blocks
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_brief_blocks_delete_brand on public.campaign_brief_blocks;
create policy campaign_brief_blocks_delete_brand on public.campaign_brief_blocks
  for delete
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_brief_blocks_admin on public.campaign_brief_blocks;
create policy campaign_brief_blocks_admin on public.campaign_brief_blocks
  for all
  to authenticated
  using (app_private.current_user_is_admin())
  with check (app_private.current_user_is_admin());

drop policy if exists campaign_assets_select_access on public.campaign_assets;
create policy campaign_assets_select_access on public.campaign_assets
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      status = 'ready'
      and visibility = 'member'
      and app_private.is_campaign_member(campaign_id)
    )
  );

drop policy if exists campaign_assets_insert_brand on public.campaign_assets;
create policy campaign_assets_insert_brand on public.campaign_assets
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaign_assets_update_brand on public.campaign_assets;
create policy campaign_assets_update_brand on public.campaign_assets
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_assets_delete_brand on public.campaign_assets;
create policy campaign_assets_delete_brand on public.campaign_assets
  for delete
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_assets_admin on public.campaign_assets;
create policy campaign_assets_admin on public.campaign_assets
  for all
  to authenticated
  using (app_private.current_user_is_admin())
  with check (app_private.current_user_is_admin());

drop policy if exists campaign_reporting_plans_select_access on public.campaign_reporting_plans;
create policy campaign_reporting_plans_select_access on public.campaign_reporting_plans
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or app_private.is_campaign_member(campaign_id)
  );

drop policy if exists campaign_reporting_plans_insert_brand on public.campaign_reporting_plans;
create policy campaign_reporting_plans_insert_brand on public.campaign_reporting_plans
  for insert
  to authenticated
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_reporting_plans_update_brand on public.campaign_reporting_plans;
create policy campaign_reporting_plans_update_brand on public.campaign_reporting_plans
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_reporting_plans_delete_brand on public.campaign_reporting_plans;
create policy campaign_reporting_plans_delete_brand on public.campaign_reporting_plans
  for delete
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_reporting_plans_admin on public.campaign_reporting_plans;
create policy campaign_reporting_plans_admin on public.campaign_reporting_plans
  for all
  to authenticated
  using (app_private.current_user_is_admin())
  with check (app_private.current_user_is_admin());

drop policy if exists campaign_report_tasks_select_brand_creator on public.campaign_report_tasks;
create policy campaign_report_tasks_select_brand_creator on public.campaign_report_tasks
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or app_private.is_campaign_member_record(campaign_member_id)
  );

drop policy if exists campaign_report_tasks_update_brand on public.campaign_report_tasks;
create policy campaign_report_tasks_update_brand on public.campaign_report_tasks
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_report_tasks_update_creator_submit on public.campaign_report_tasks;
create policy campaign_report_tasks_update_creator_submit on public.campaign_report_tasks
  for update
  to authenticated
  using (
    app_private.is_campaign_member_record(campaign_member_id)
    and status in ('pending', 'missed', 'needs_revision')
  )
  with check (
    app_private.is_campaign_member_record(campaign_member_id)
    and status in ('submitted', 'submitted_late')
    and submitted_at is not null
  );

drop policy if exists campaign_report_tasks_admin on public.campaign_report_tasks;
create policy campaign_report_tasks_admin on public.campaign_report_tasks
  for all
  to authenticated
  using (app_private.current_user_is_admin())
  with check (app_private.current_user_is_admin());

drop policy if exists content_performance_evidence_select_access on public.content_performance_evidence;
create policy content_performance_evidence_select_access on public.content_performance_evidence
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or app_private.is_campaign_member_record(campaign_member_id)
  );

drop policy if exists content_performance_evidence_insert_creator on public.content_performance_evidence;
create policy content_performance_evidence_insert_creator on public.content_performance_evidence
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and app_private.is_campaign_member_record(campaign_member_id)
  );

drop policy if exists content_performance_evidence_update_brand on public.content_performance_evidence;
create policy content_performance_evidence_update_brand on public.content_performance_evidence
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists content_performance_evidence_admin on public.content_performance_evidence;
create policy content_performance_evidence_admin on public.content_performance_evidence
  for all
  to authenticated
  using (app_private.current_user_is_admin())
  with check (app_private.current_user_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'campaign-assets',
    'campaign-assets',
    false,
    52428800,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'campaign-evidence',
    'campaign-evidence',
    false,
    15728640,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/csv'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function app_private.can_read_campaign_asset_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_assets asset
     where asset.storage_path = object_name
       and asset.status <> 'archived'
       and (
         app_private.current_user_is_admin()
         or app_private.is_campaign_brand(asset.campaign_id)
         or (
           asset.status = 'ready'
           and asset.visibility = 'member'
           and app_private.is_campaign_member(asset.campaign_id)
         )
       )
  );
$$;

create or replace function app_private.can_write_campaign_asset_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_assets asset
     where asset.storage_path = object_name
       and asset.uploaded_by = auth.uid()
       and asset.status = 'uploading'
       and app_private.is_campaign_brand(asset.campaign_id)
  );
$$;

create or replace function app_private.can_read_campaign_evidence_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.content_performance_evidence evidence
     where evidence.storage_path = object_name
       and (
         app_private.current_user_is_admin()
         or app_private.is_campaign_brand(evidence.campaign_id)
         or app_private.is_campaign_member_record(evidence.campaign_member_id)
       )
  );
$$;

create or replace function app_private.can_write_campaign_evidence_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.content_performance_evidence evidence
     where evidence.storage_path = object_name
       and evidence.uploaded_by = auth.uid()
       and app_private.is_campaign_member_record(evidence.campaign_member_id)
  );
$$;

drop policy if exists campaign_assets_objects_select on storage.objects;
create policy campaign_assets_objects_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'campaign-assets'
    and app_private.can_read_campaign_asset_object(name)
  );

drop policy if exists campaign_assets_objects_insert on storage.objects;
create policy campaign_assets_objects_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'campaign-assets'
    and app_private.uuid_path_segment(name, 1) is not null
    and app_private.can_write_campaign_asset_object(name)
  );

drop policy if exists campaign_assets_objects_update on storage.objects;
create policy campaign_assets_objects_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'campaign-assets'
    and app_private.can_write_campaign_asset_object(name)
  )
  with check (
    bucket_id = 'campaign-assets'
    and app_private.can_write_campaign_asset_object(name)
  );

drop policy if exists campaign_assets_objects_delete on storage.objects;
create policy campaign_assets_objects_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'campaign-assets'
    and exists (
      select 1
        from public.campaign_assets asset
       where asset.storage_path = storage.objects.name
         and app_private.is_campaign_brand(asset.campaign_id)
    )
  );

drop policy if exists campaign_evidence_objects_select on storage.objects;
create policy campaign_evidence_objects_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'campaign-evidence'
    and app_private.can_read_campaign_evidence_object(name)
  );

drop policy if exists campaign_evidence_objects_insert on storage.objects;
create policy campaign_evidence_objects_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'campaign-evidence'
    and app_private.uuid_path_segment(name, 1) is not null
    and app_private.uuid_path_segment(name, 2) is not null
    and app_private.uuid_path_segment(name, 3) is not null
    and app_private.uuid_path_segment(name, 4) is not null
    and app_private.can_write_campaign_evidence_object(name)
  );

drop policy if exists campaign_evidence_objects_update on storage.objects;
create policy campaign_evidence_objects_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'campaign-evidence'
    and app_private.can_write_campaign_evidence_object(name)
  )
  with check (
    bucket_id = 'campaign-evidence'
    and app_private.can_write_campaign_evidence_object(name)
  );

drop policy if exists campaign_evidence_objects_delete on storage.objects;
create policy campaign_evidence_objects_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'campaign-evidence'
    and exists (
      select 1
        from public.content_performance_evidence evidence
       where evidence.storage_path = storage.objects.name
         and app_private.is_campaign_member_record(evidence.campaign_member_id)
    )
  );

grant execute on all functions in schema app_private to anon, authenticated, service_role;
```

- [ ] **Step 3: Run migration syntax check through Supabase**

Run:

```bash
supabase db push --dry-run
```

Expected:

```text
Finished supabase db push.
```

If the CLI does not support `--dry-run`, run:

```bash
supabase db push --help
```

Then use the supported local or linked-project verification command shown by the CLI. Do not apply to production without reviewing the SQL in the generated migration file.

## Task 2: Add Database Types

**Files:**

- Modify: `src/types/database.ts`

- [ ] **Step 1: Add enum-like string types**

Add these exports after `MetricDataSource`:

```ts
export type CampaignBriefBlockType =
  | "product_notes"
  | "brand_vibe"
  | "talking_points"
  | "avoid_claims"
  | "cta"
  | "hashtags"
  | "examples"
  | "custom";

export type CampaignBriefVisibility = "public" | "member" | "brand";

export type CampaignAssetType =
  | "product_image"
  | "brand_guideline"
  | "reference_video"
  | "sell_sheet"
  | "logo"
  | "document"
  | "other";

export type CampaignAssetVisibility = "member" | "brand";

export type CampaignAssetStatus = "uploading" | "ready" | "archived";

export type CampaignReportingCadence =
  | "final_only"
  | "weekly"
  | "daily_launch_window"
  | "custom";

export type CampaignReportTaskStatus =
  | "pending"
  | "submitted"
  | "submitted_late"
  | "verified"
  | "needs_revision"
  | "missed"
  | "excused";

export type PerformanceVerificationStatus =
  | "submitted"
  | "screenshot_verified"
  | "brand_verified"
  | "rejected";

export type PerformanceEvidenceType =
  | "screenshot"
  | "csv"
  | "analytics_export"
  | "document"
  | "other";

export type PerformanceEvidenceVerificationStatus =
  | "submitted"
  | "verified"
  | "rejected";
```

- [ ] **Step 2: Add table definitions**

Inside `Database["public"]["Tables"]`, add these table definitions:

```ts
      campaign_brief_blocks: {
        Row: {
          id: string;
          campaign_id: string;
          block_type: CampaignBriefBlockType;
          title: string;
          body: string | null;
          items: unknown[];
          visibility: CampaignBriefVisibility;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          block_type: CampaignBriefBlockType;
          title: string;
          body?: string | null;
          items?: unknown[];
          visibility?: CampaignBriefVisibility;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          block_type?: CampaignBriefBlockType;
          title?: string;
          body?: string | null;
          items?: unknown[];
          visibility?: CampaignBriefVisibility;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_assets: {
        Row: {
          id: string;
          campaign_id: string;
          uploaded_by: string;
          title: string;
          description: string | null;
          asset_type: CampaignAssetType;
          bucket_id: "campaign-assets";
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          visibility: CampaignAssetVisibility;
          status: CampaignAssetStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          uploaded_by: string;
          title: string;
          description?: string | null;
          asset_type: CampaignAssetType;
          bucket_id?: "campaign-assets";
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          visibility?: CampaignAssetVisibility;
          status?: CampaignAssetStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          uploaded_by?: string;
          title?: string;
          description?: string | null;
          asset_type?: CampaignAssetType;
          bucket_id?: "campaign-assets";
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          visibility?: CampaignAssetVisibility;
          status?: CampaignAssetStatus;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_reporting_plans: {
        Row: {
          id: string;
          campaign_id: string;
          cadence: CampaignReportingCadence;
          required_evidence: string[];
          required_metrics: Record<string, unknown>;
          grace_period_hours: number;
          starts_at: string | null;
          ends_at: string | null;
          custom_due_dates: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          cadence?: CampaignReportingCadence;
          required_evidence?: string[];
          required_metrics?: Record<string, unknown>;
          grace_period_hours?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          custom_due_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          cadence?: CampaignReportingCadence;
          required_evidence?: string[];
          required_metrics?: Record<string, unknown>;
          grace_period_hours?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          custom_due_dates?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_report_tasks: {
        Row: {
          id: string;
          campaign_id: string;
          campaign_member_id: string;
          task_key: string;
          period_start: string | null;
          period_end: string | null;
          due_at: string;
          status: CampaignReportTaskStatus;
          submitted_at: string | null;
          verified_at: string | null;
          missed_at: string | null;
          excused_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          campaign_member_id: string;
          task_key: string;
          period_start?: string | null;
          period_end?: string | null;
          due_at: string;
          status?: CampaignReportTaskStatus;
          submitted_at?: string | null;
          verified_at?: string | null;
          missed_at?: string | null;
          excused_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          campaign_member_id?: string;
          task_key?: string;
          period_start?: string | null;
          period_end?: string | null;
          due_at?: string;
          status?: CampaignReportTaskStatus;
          submitted_at?: string | null;
          verified_at?: string | null;
          missed_at?: string | null;
          excused_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      content_performance_evidence: {
        Row: {
          id: string;
          campaign_id: string;
          campaign_member_id: string;
          report_task_id: string | null;
          submission_id: string | null;
          performance_id: string | null;
          uploaded_by: string;
          evidence_type: PerformanceEvidenceType;
          bucket_id: "campaign-evidence";
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          verification_status: PerformanceEvidenceVerificationStatus;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          campaign_member_id: string;
          report_task_id?: string | null;
          submission_id?: string | null;
          performance_id?: string | null;
          uploaded_by: string;
          evidence_type: PerformanceEvidenceType;
          bucket_id?: "campaign-evidence";
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          verification_status?: PerformanceEvidenceVerificationStatus;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          campaign_member_id?: string;
          report_task_id?: string | null;
          submission_id?: string | null;
          performance_id?: string | null;
          uploaded_by?: string;
          evidence_type?: PerformanceEvidenceType;
          bucket_id?: "campaign-evidence";
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          verification_status?: PerformanceEvidenceVerificationStatus;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
```

- [ ] **Step 3: Extend `content_performance` types**

Find the existing `content_performance` `Row`, `Insert`, and `Update` definitions. Add:

```ts
          report_task_id: string | null;
          verification_status: PerformanceVerificationStatus;
          verified_at: string | null;
          verified_by: string | null;
```

For `Insert` and `Update`, use optional properties:

```ts
          report_task_id?: string | null;
          verification_status?: PerformanceVerificationStatus;
          verified_at?: string | null;
          verified_by?: string | null;
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected:

```text
Found 0 errors.
```

## Task 3: Add Report Task Schedule Utility

**Files:**

- Create: `src/lib/reporting/task-schedule.ts`
- Create: `src/lib/reporting/task-schedule.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reporting/task-schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateReportTaskDrafts } from "./task-schedule";

const campaignId = "11111111-1111-1111-1111-111111111111";
const memberId = "22222222-2222-2222-2222-222222222222";

describe("generateReportTaskDrafts", () => {
  it("creates one final report task by default", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-18T23:59:59.999Z",
      reportingPlan: {
        cadence: "final_only",
        gracePeriodHours: 24,
        customDueDates: [],
        startsAt: null,
        endsAt: null,
      },
    });

    expect(tasks).toEqual([
      {
        campaign_id: campaignId,
        campaign_member_id: memberId,
        task_key: "final",
        period_start: null,
        period_end: null,
        due_at: "2026-05-18T23:59:59.999Z",
        status: "pending",
      },
    ]);
  });

  it("creates weekly report tasks inside the reporting window", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-31T23:59:59.999Z",
      reportingPlan: {
        cadence: "weekly",
        gracePeriodHours: 24,
        customDueDates: [],
        startsAt: "2026-05-01T00:00:00.000Z",
        endsAt: "2026-05-20T23:59:59.999Z",
      },
    });

    expect(tasks.map((task) => task.due_at)).toEqual([
      "2026-05-07T23:59:59.999Z",
      "2026-05-14T23:59:59.999Z",
      "2026-05-20T23:59:59.999Z",
    ]);
    expect(tasks[0].period_start).toBe("2026-05-01T00:00:00.000Z");
    expect(tasks[0].period_end).toBe("2026-05-07T23:59:59.999Z");
    expect(tasks.map((task) => task.task_key)).toEqual([
      "weekly:2026-05-01",
      "weekly:2026-05-08",
      "weekly:2026-05-15",
    ]);
  });

  it("creates daily launch-window tasks", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-31T23:59:59.999Z",
      reportingPlan: {
        cadence: "daily_launch_window",
        gracePeriodHours: 24,
        customDueDates: [],
        startsAt: "2026-05-07T00:00:00.000Z",
        endsAt: "2026-05-09T23:59:59.999Z",
      },
    });

    expect(tasks.map((task) => task.due_at)).toEqual([
      "2026-05-07T23:59:59.999Z",
      "2026-05-08T23:59:59.999Z",
      "2026-05-09T23:59:59.999Z",
    ]);
    expect(tasks.map((task) => task.task_key)).toEqual([
      "daily:2026-05-07",
      "daily:2026-05-08",
      "daily:2026-05-09",
    ]);
  });

  it("creates custom report tasks in sorted order", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-31T23:59:59.999Z",
      reportingPlan: {
        cadence: "custom",
        gracePeriodHours: 24,
        customDueDates: [
          "2026-05-20T23:59:59.999Z",
          "2026-05-10T23:59:59.999Z",
        ],
        startsAt: null,
        endsAt: null,
      },
    });

    expect(tasks.map((task) => task.due_at)).toEqual([
      "2026-05-10T23:59:59.999Z",
      "2026-05-20T23:59:59.999Z",
    ]);
    expect(tasks.map((task) => task.task_key)).toEqual([
      "custom:2026-05-10T23:59:59.999Z",
      "custom:2026-05-20T23:59:59.999Z",
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npx vitest run src/lib/reporting/task-schedule.test.ts
```

Expected:

```text
FAIL  src/lib/reporting/task-schedule.test.ts
Error: Failed to resolve import "./task-schedule"
```

- [ ] **Step 3: Implement the schedule utility**

Create `src/lib/reporting/task-schedule.ts`:

```ts
import type {
  CampaignReportingCadence,
  CampaignReportTaskStatus,
} from "@/types/database";

export type ReportingPlanInput = {
  cadence: CampaignReportingCadence;
  gracePeriodHours: number;
  customDueDates: string[];
  startsAt: string | null;
  endsAt: string | null;
};

export type ReportTaskDraft = {
  campaign_id: string;
  campaign_member_id: string;
  task_key: string;
  period_start: string | null;
  period_end: string | null;
  due_at: string;
  status: Extract<CampaignReportTaskStatus, "pending">;
};

export function generateReportTaskDrafts(input: {
  campaignId: string;
  campaignMemberId: string;
  performanceDueDate: string | null;
  reportingPlan: ReportingPlanInput | null;
}): ReportTaskDraft[] {
  const cadence = input.reportingPlan?.cadence ?? "final_only";

  if (cadence === "custom") {
    return uniqueSortedDates(input.reportingPlan?.customDueDates ?? []).map(
      (dueAt) => createDraft(input, `custom:${dueAt}`, null, null, dueAt),
    );
  }

  if (cadence === "weekly") {
    return buildWeeklyTasks(input);
  }

  if (cadence === "daily_launch_window") {
    return buildDailyTasks(input);
  }

  if (!input.performanceDueDate) return [];

  return [
    createDraft(input, "final", null, null, normalizeIso(input.performanceDueDate)),
  ];
}

function buildWeeklyTasks(input: {
  campaignId: string;
  campaignMemberId: string;
  performanceDueDate: string | null;
  reportingPlan: ReportingPlanInput | null;
}): ReportTaskDraft[] {
  const startsAt = input.reportingPlan?.startsAt;
  const endsAt = input.reportingPlan?.endsAt;
  if (!startsAt || !endsAt) return [];

  const tasks: ReportTaskDraft[] = [];
  let periodStart = startOfUtcDay(new Date(startsAt));
  const finalEnd = endOfUtcDay(new Date(endsAt));

  while (periodStart.getTime() <= finalEnd.getTime()) {
    const periodEnd = endOfUtcDay(addDays(periodStart, 6));
    const cappedEnd =
      periodEnd.getTime() > finalEnd.getTime() ? finalEnd : periodEnd;

    tasks.push(
      createDraft(
        input,
        `weekly:${toUtcDateKey(periodStart)}`,
        periodStart.toISOString(),
        cappedEnd.toISOString(),
        cappedEnd.toISOString(),
      ),
    );

    periodStart = startOfUtcDay(addDays(cappedEnd, 1));
  }

  return tasks;
}

function buildDailyTasks(input: {
  campaignId: string;
  campaignMemberId: string;
  performanceDueDate: string | null;
  reportingPlan: ReportingPlanInput | null;
}): ReportTaskDraft[] {
  const startsAt = input.reportingPlan?.startsAt;
  const endsAt = input.reportingPlan?.endsAt;
  if (!startsAt || !endsAt) return [];

  const tasks: ReportTaskDraft[] = [];
  let day = startOfUtcDay(new Date(startsAt));
  const finalEnd = endOfUtcDay(new Date(endsAt));

  while (day.getTime() <= finalEnd.getTime()) {
    const dayEnd = endOfUtcDay(day);
    tasks.push(
      createDraft(
        input,
        `daily:${toUtcDateKey(day)}`,
        day.toISOString(),
        dayEnd.toISOString(),
        dayEnd.toISOString(),
      ),
    );
    day = startOfUtcDay(addDays(day, 1));
  }

  return tasks;
}

function createDraft(
  input: {
    campaignId: string;
    campaignMemberId: string;
  },
  taskKey: string,
  periodStart: string | null,
  periodEnd: string | null,
  dueAt: string,
): ReportTaskDraft {
  return {
    campaign_id: input.campaignId,
    campaign_member_id: input.campaignMemberId,
    task_key: taskKey,
    period_start: periodStart,
    period_end: periodEnd,
    due_at: normalizeIso(dueAt),
    status: "pending",
  };
}

function uniqueSortedDates(dates: string[]) {
  return [...new Set(dates.map(normalizeIso))].sort();
}

function normalizeIso(value: string) {
  return new Date(value).toISOString();
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npx vitest run src/lib/reporting/task-schedule.test.ts
```

Expected:

```text
PASS  src/lib/reporting/task-schedule.test.ts
```

## Task 4: Add Missed Report Status Utility

**Files:**

- Create: `src/lib/reporting/report-task-status.ts`
- Create: `src/lib/reporting/report-task-status.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reporting/report-task-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getReportTaskDisplayStatus,
  getReportTaskMutationForSubmission,
  shouldMarkReportTaskMissed,
} from "./report-task-status";

describe("report task status utilities", () => {
  it("marks a pending task missed after due date plus grace period", () => {
    expect(
      shouldMarkReportTaskMissed({
        status: "pending",
        dueAt: "2026-05-10T10:00:00.000Z",
        gracePeriodHours: 24,
        now: new Date("2026-05-11T10:00:01.000Z"),
      }),
    ).toBe(true);
  });

  it("does not mark submitted or verified tasks missed", () => {
    for (const status of ["submitted", "verified", "excused"] as const) {
      expect(
        shouldMarkReportTaskMissed({
          status,
          dueAt: "2026-05-10T10:00:00.000Z",
          gracePeriodHours: 24,
          now: new Date("2026-05-20T10:00:00.000Z"),
        }),
      ).toBe(false);
    }
  });

  it("shows due soon before due date", () => {
    expect(
      getReportTaskDisplayStatus({
        status: "pending",
        dueAt: "2026-05-10T10:00:00.000Z",
        now: new Date("2026-05-09T12:00:00.000Z"),
      }),
    ).toBe("due_soon");
  });

  it("shows overdue during grace period", () => {
    expect(
      getReportTaskDisplayStatus({
        status: "pending",
        dueAt: "2026-05-10T10:00:00.000Z",
        now: new Date("2026-05-10T10:01:00.000Z"),
      }),
    ).toBe("overdue");
  });

  it("turns missed submissions into submitted late", () => {
    expect(
      getReportTaskMutationForSubmission({
        status: "missed",
        now: new Date("2026-05-12T10:00:00.000Z"),
      }),
    ).toEqual({
      status: "submitted_late",
      submitted_at: "2026-05-12T10:00:00.000Z",
    });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npx vitest run src/lib/reporting/report-task-status.test.ts
```

Expected:

```text
FAIL  src/lib/reporting/report-task-status.test.ts
Error: Failed to resolve import "./report-task-status"
```

- [ ] **Step 3: Implement the status utility**

Create `src/lib/reporting/report-task-status.ts`:

```ts
import type { CampaignReportTaskStatus } from "@/types/database";

export type ReportTaskDisplayStatus =
  | CampaignReportTaskStatus
  | "due_soon"
  | "overdue";

const DUE_SOON_HOURS = 48;

export function shouldMarkReportTaskMissed(input: {
  status: CampaignReportTaskStatus;
  dueAt: string;
  gracePeriodHours: number;
  now: Date;
}) {
  if (input.status !== "pending" && input.status !== "needs_revision") {
    return false;
  }

  const missedAt = addHours(new Date(input.dueAt), input.gracePeriodHours);
  return input.now.getTime() > missedAt.getTime();
}

export function getReportTaskDisplayStatus(input: {
  status: CampaignReportTaskStatus;
  dueAt: string;
  now: Date;
}): ReportTaskDisplayStatus {
  if (input.status !== "pending") return input.status;

  const dueAt = new Date(input.dueAt);
  if (input.now.getTime() > dueAt.getTime()) return "overdue";

  const dueSoonAt = addHours(input.now, DUE_SOON_HOURS);
  if (dueSoonAt.getTime() >= dueAt.getTime()) return "due_soon";

  return "pending";
}

export function getReportTaskMutationForSubmission(input: {
  status: CampaignReportTaskStatus;
  now: Date;
}) {
  return {
    status: input.status === "missed" ? "submitted_late" : "submitted",
    submitted_at: input.now.toISOString(),
  } satisfies {
    status: Extract<CampaignReportTaskStatus, "submitted" | "submitted_late">;
    submitted_at: string;
  };
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npx vitest run src/lib/reporting/report-task-status.test.ts
```

Expected:

```text
PASS  src/lib/reporting/report-task-status.test.ts
```

## Task 5: Add Privileged Report Task Creation

**Files:**

- Modify: `src/lib/supabase/privileged.ts`
- Create: `src/app/actions/applications-report-tasks.test.ts`

- [ ] **Step 1: Write source-level regression test**

Create `src/app/actions/applications-report-tasks.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const applicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);

const privilegedSource = readFileSync(
  new URL("../../lib/supabase/privileged.ts", import.meta.url),
  "utf8",
);

describe("application acceptance report task hooks", () => {
  it("creates report tasks after privileged campaign member upsert", () => {
    expect(privilegedSource).toContain(
      "export async function upsertPrivilegedCampaignMember",
    );
    expect(privilegedSource).toContain(
      "export async function createPrivilegedReportTasksForMember",
    );
    expect(applicationsSource).toContain(
      "await createPrivilegedReportTasksForMember(member.id);",
    );
  });

  it("returns the campaign member row from the privileged upsert", () => {
    expect(privilegedSource).toContain('.select("id, campaign_id, creator_id")');
    expect(privilegedSource).toContain(".single();");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npx vitest run src/app/actions/applications-report-tasks.test.ts
```

Expected:

```text
FAIL  src/app/actions/applications-report-tasks.test.ts
```

- [ ] **Step 3: Update privileged helper**

In `src/lib/supabase/privileged.ts`, replace `upsertPrivilegedCampaignMember` and add `createPrivilegedReportTasksForMember`:

```ts
import { generateReportTaskDrafts } from "@/lib/reporting/task-schedule";
```

```ts
export async function upsertPrivilegedCampaignMember(
  member: CampaignMemberInsert,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaign_members")
    .upsert(member, { onConflict: "campaign_id,creator_id" })
    .select("id, campaign_id, creator_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createPrivilegedReportTasksForMember(memberId: string) {
  const admin = createAdminClient();

  const { data: member, error: memberError } = await admin
    .from("campaign_members")
    .select(
      `id, campaign_id,
       campaigns (
         id,
         performance_due_date,
         posting_window_start,
         posting_window_end
       )`,
    )
    .eq("id", memberId)
    .single();

  if (memberError) throw new Error(memberError.message);
  if (!member) throw new Error("Campaign member not found");

  const campaign = Array.isArray(member.campaigns)
    ? member.campaigns[0]
    : member.campaigns;

  if (!campaign) throw new Error("Campaign not found for report task creation");

  const { data: reportingPlan, error: planError } = await admin
    .from("campaign_reporting_plans")
    .select("cadence, grace_period_hours, custom_due_dates, starts_at, ends_at")
    .eq("campaign_id", member.campaign_id)
    .maybeSingle();

  if (planError) throw new Error(planError.message);

  const taskDrafts = generateReportTaskDrafts({
    campaignId: member.campaign_id,
    campaignMemberId: member.id,
    performanceDueDate: campaign.performance_due_date,
    reportingPlan: reportingPlan
      ? {
          cadence: reportingPlan.cadence,
          gracePeriodHours: reportingPlan.grace_period_hours,
          customDueDates: reportingPlan.custom_due_dates ?? [],
          startsAt: reportingPlan.starts_at,
          endsAt: reportingPlan.ends_at,
        }
      : null,
  });

  if (taskDrafts.length === 0) return [];

  const { data: insertedTasks, error: insertError } = await admin
    .from("campaign_report_tasks")
    .upsert(taskDrafts, {
      onConflict: "campaign_member_id,task_key",
      ignoreDuplicates: true,
    })
    .select("id, campaign_id, campaign_member_id, due_at, status");

  if (insertError) throw new Error(insertError.message);

  return insertedTasks ?? [];
}
```

- [ ] **Step 4: Run targeted test and typecheck**

Run:

```bash
npx vitest run src/lib/reporting/task-schedule.test.ts src/app/actions/applications-report-tasks.test.ts
npm run typecheck
```

Expected:

```text
PASS  src/lib/reporting/task-schedule.test.ts
PASS  src/app/actions/applications-report-tasks.test.ts
Found 0 errors.
```

## Task 6: Hook Report Task Creation Into Acceptance Flows

**Files:**

- Modify: `src/app/actions/applications.ts`

- [ ] **Step 1: Update imports**

Change the privileged import block to:

```ts
import {
  createPrivilegedNotification,
  createPrivilegedReportTasksForMember,
  upsertPrivilegedCampaignMember,
} from "@/lib/supabase/privileged";
```

- [ ] **Step 2: Update brand acceptance path**

Inside `acceptApplication`, replace:

```ts
    await upsertPrivilegedCampaignMember({
      campaign_id: app.campaign_id,
      creator_id: app.creator_id,
      accepted_rate: acceptedRate,
    });
```

with:

```ts
    const member = await upsertPrivilegedCampaignMember({
      campaign_id: app.campaign_id,
      creator_id: app.creator_id,
      accepted_rate: acceptedRate,
    });
    await createPrivilegedReportTasksForMember(member.id);
```

- [ ] **Step 3: Update counter-offer acceptance path**

Inside `respondToCounterOffer`, replace:

```ts
      await upsertPrivilegedCampaignMember({
        campaign_id: app.campaign_id,
        creator_id: user.id,
        accepted_rate: app.counter_rate,
      });
```

with:

```ts
      const member = await upsertPrivilegedCampaignMember({
        campaign_id: app.campaign_id,
        creator_id: user.id,
        accepted_rate: app.counter_rate,
      });
      await createPrivilegedReportTasksForMember(member.id);
```

- [ ] **Step 4: Run targeted test**

Run:

```bash
npx vitest run src/app/actions/applications-report-tasks.test.ts
```

Expected:

```text
PASS  src/app/actions/applications-report-tasks.test.ts
```

## Task 7: Verification Commands

**Files:**

- No file changes.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run src/lib/reporting/task-schedule.test.ts src/lib/reporting/report-task-status.test.ts src/app/actions/applications-report-tasks.test.ts
```

Expected:

```text
PASS  src/lib/reporting/task-schedule.test.ts
PASS  src/lib/reporting/report-task-status.test.ts
PASS  src/app/actions/applications-report-tasks.test.ts
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected:

```text
Found 0 errors.
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected:

```text
No ESLint warnings or errors.
```

- [ ] **Step 4: Run the design contract scan**

Run:

```bash
npx vitest run src/components/design-contract.test.ts
```

Expected:

```text
All design contract tests pass.
```

- [ ] **Step 5: Confirm migration and plan diffs**

Run:

```bash
git diff --check
git status --short
```

Expected:

```text
No whitespace errors.
```

## Task 8: Commit Foundation Slice

**Files:**

- Stage only files touched by this foundation slice.

- [ ] **Step 1: Stage foundation files**

Run:

```bash
git add supabase/migrations/*_creative_kit_reporting_foundation.sql src/types/database.ts src/lib/reporting/task-schedule.ts src/lib/reporting/task-schedule.test.ts src/lib/reporting/report-task-status.ts src/lib/reporting/report-task-status.test.ts src/lib/supabase/privileged.ts src/app/actions/applications.ts src/app/actions/applications-report-tasks.test.ts
```

Expected:

```text
Files staged.
```

- [ ] **Step 2: Review staged files**

Run:

```bash
git diff --cached --name-status
```

Expected staged paths:

```text
A	supabase/migrations/<timestamp>_creative_kit_reporting_foundation.sql
M	src/types/database.ts
A	src/lib/reporting/task-schedule.ts
A	src/lib/reporting/task-schedule.test.ts
A	src/lib/reporting/report-task-status.ts
A	src/lib/reporting/report-task-status.test.ts
M	src/lib/supabase/privileged.ts
M	src/app/actions/applications.ts
A	src/app/actions/applications-report-tasks.test.ts
```

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "feat: add creative kit reporting foundation"
```

Expected:

```text
[codex/business-flow-hardening <hash>] feat: add creative kit reporting foundation
```

## Follow-Up Plans

Create these plans after this foundation passes:

1. Creative Kit and Reporting Server Actions
2. Campaign Builder Creative Kit and Reporting UI
3. Brand Campaign Workspace Creative Kit, Performance, and Missed Reports
4. Creator Campaign Room Reporting Tasks and Evidence Uploads
5. Report Page Data Integrity and Evidence Labels
