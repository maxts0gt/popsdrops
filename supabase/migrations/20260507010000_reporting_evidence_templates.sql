-- Reporting evidence templates, campaign requirements, sparse metric values,
-- and AI extraction audit records.

alter table public.campaign_reporting_plans
  drop constraint if exists campaign_reporting_plans_cadence_check;

alter table public.campaign_reporting_plans
  add constraint campaign_reporting_plans_cadence_check check (
    cadence in ('final_only', 'weekly', 'daily_launch_window', 'custom', 'per_post')
  );

create table if not exists public.reporting_metric_definitions (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  metric_key text not null,
  label text not null,
  field_type text not null,
  evidence_scope text not null,
  is_default boolean not null default false,
  is_private_metric boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint reporting_metric_definitions_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint reporting_metric_definitions_field_type_check check (
    field_type in ('integer', 'decimal', 'percentage', 'duration_seconds', 'currency', 'text')
  ),
  constraint reporting_metric_definitions_evidence_scope_check check (
    evidence_scope in ('public', 'native_insights', 'brand_defined')
  ),
  constraint reporting_metric_definitions_unique unique (platform, metric_key)
);

comment on table public.reporting_metric_definitions is
  'Canonical reporting metric templates used by campaign requirements, creator evidence forms, AI extraction schemas, and report labels.';

create table if not exists public.campaign_reporting_requirements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  platform text not null,
  platform_label text,
  content_format text not null,
  account_requirement text not null default 'public_post_ok',
  evidence_types text[] not null default array['public_url', 'manual_metrics', 'screenshot']::text[],
  required_metric_keys text[] not null default '{}'::text[],
  ai_extraction_allowed boolean not null default true,
  creator_confirmation_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_reporting_requirements_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint campaign_reporting_requirements_account_check check (
    account_requirement in (
      'public_post_ok',
      'native_insights_required',
      'business_or_creator_account_required',
      'brand_defined'
    )
  ),
  constraint campaign_reporting_requirements_evidence_types_check check (
    evidence_types <@ array[
      'public_url',
      'manual_metrics',
      'screenshot',
      'analytics_export',
      'csv',
      'document'
    ]::text[]
  ),
  constraint campaign_reporting_requirements_generic_label_check check (
    platform <> 'generic' or nullif(trim(coalesce(platform_label, '')), '') is not null
  )
);

comment on table public.campaign_reporting_requirements is
  'Campaign-specific proof requirements used before application, during report task submission, and in final report completeness.';

create table if not exists public.content_performance_metric_values (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references public.content_performance(id) on delete cascade,
  report_task_id uuid references public.campaign_report_tasks(id) on delete cascade,
  platform text not null,
  metric_key text not null,
  metric_label text not null,
  metric_value numeric,
  metric_text text,
  source_type text not null default 'creator_manual',
  extraction_confidence numeric,
  confirmed_by_creator boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_performance_metric_values_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint content_performance_metric_values_source_check check (
    source_type in (
      'creator_manual',
      'ai_extracted',
      'creator_confirmed',
      'brand_verified',
      'platform_api'
    )
  ),
  constraint content_performance_metric_values_value_check check (
    metric_value is not null or nullif(trim(coalesce(metric_text, '')), '') is not null
  ),
  constraint content_performance_metric_values_confidence_check check (
    extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)
  ),
  constraint content_performance_metric_values_unique unique (performance_id, metric_key)
);

comment on table public.content_performance_metric_values is
  'Sparse metric values submitted or confirmed for a content performance read. Supports platform-specific and Generic metrics without schema bloat.';

create table if not exists public.content_performance_ai_extractions (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.content_performance_evidence(id) on delete cascade,
  report_task_id uuid not null references public.campaign_report_tasks(id) on delete cascade,
  platform text not null,
  model text not null,
  input_sha256 text not null,
  extracted_metrics jsonb not null,
  confidence_summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending_confirmation',
  created_at timestamptz not null default now(),
  constraint content_performance_ai_extractions_platform_check check (
    platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'snapchat', 'x', 'generic')
  ),
  constraint content_performance_ai_extractions_status_check check (
    status in (
      'pending_confirmation',
      'accepted_by_creator',
      'edited_by_creator',
      'rejected_by_creator',
      'superseded'
    )
  )
);

comment on table public.content_performance_ai_extractions is
  'Audit record for AI extraction attempts. These rows never become report truth until a creator confirms or edits the values.';

create index if not exists reporting_metric_definitions_platform_sort_idx
  on public.reporting_metric_definitions (platform, sort_order);

create index if not exists campaign_reporting_requirements_campaign_sort_idx
  on public.campaign_reporting_requirements (campaign_id, sort_order);

create index if not exists content_performance_metric_values_performance_idx
  on public.content_performance_metric_values (performance_id);

create index if not exists content_performance_metric_values_report_task_idx
  on public.content_performance_metric_values (report_task_id);

create index if not exists content_performance_ai_extractions_task_status_idx
  on public.content_performance_ai_extractions (report_task_id, status);

alter table public.reporting_metric_definitions enable row level security;
alter table public.campaign_reporting_requirements enable row level security;
alter table public.content_performance_metric_values enable row level security;
alter table public.content_performance_ai_extractions enable row level security;

grant select on table public.reporting_metric_definitions
  to anon, authenticated, service_role;
grant insert, update, delete on table public.reporting_metric_definitions
  to service_role;

grant select on table public.campaign_reporting_requirements
  to anon, authenticated, service_role;
grant insert, update, delete on table public.campaign_reporting_requirements
  to authenticated, service_role;

grant select, insert, update on table public.content_performance_metric_values
  to authenticated, service_role;
grant delete on table public.content_performance_metric_values
  to service_role;

grant select, update on table public.content_performance_ai_extractions
  to authenticated, service_role;
grant insert, delete on table public.content_performance_ai_extractions
  to service_role;

drop policy if exists reporting_metric_definitions_read_all
  on public.reporting_metric_definitions;
create policy reporting_metric_definitions_read_all
  on public.reporting_metric_definitions
  for select
  using (true);

drop policy if exists campaign_reporting_requirements_select_access
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_select_access
  on public.campaign_reporting_requirements
  for select
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or app_private.is_campaign_member(campaign_id)
    or exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_reporting_requirements.campaign_id
         and campaigns.status = 'recruiting'
    )
  );

drop policy if exists campaign_reporting_requirements_insert_brand
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_insert_brand
  on public.campaign_reporting_requirements
  for insert
  to authenticated
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_reporting_requirements_update_brand
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_update_brand
  on public.campaign_reporting_requirements
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_reporting_requirements_delete_brand
  on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_delete_brand
  on public.campaign_reporting_requirements
  for delete
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists content_performance_metric_values_select_access
  on public.content_performance_metric_values;
create policy content_performance_metric_values_select_access
  on public.content_performance_metric_values
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_performance_creator(performance_id)
    or (
      report_task_id is not null
      and exists (
        select 1
          from public.campaign_report_tasks task
         where task.id = content_performance_metric_values.report_task_id
           and (
             app_private.is_campaign_brand(task.campaign_id)
             or app_private.is_campaign_member_record(task.campaign_member_id)
           )
      )
    )
    or exists (
      select 1
        from public.content_performance performance
        join public.content_submissions submission
          on submission.id = performance.submission_id
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where performance.id = content_performance_metric_values.performance_id
         and app_private.is_campaign_brand(member.campaign_id)
    )
  );

drop policy if exists content_performance_metric_values_insert_creator
  on public.content_performance_metric_values;
create policy content_performance_metric_values_insert_creator
  on public.content_performance_metric_values
  for insert
  to authenticated
  with check (
    app_private.is_performance_creator(performance_id)
    and (
      report_task_id is null
      or app_private.is_report_task_creator(report_task_id)
    )
  );

drop policy if exists content_performance_metric_values_update_creator
  on public.content_performance_metric_values;
create policy content_performance_metric_values_update_creator
  on public.content_performance_metric_values
  for update
  to authenticated
  using (app_private.is_performance_creator(performance_id))
  with check (app_private.is_performance_creator(performance_id));

drop policy if exists content_performance_metric_values_update_brand
  on public.content_performance_metric_values;
create policy content_performance_metric_values_update_brand
  on public.content_performance_metric_values
  for update
  to authenticated
  using (
    report_task_id is not null
    and exists (
      select 1
        from public.campaign_report_tasks task
       where task.id = content_performance_metric_values.report_task_id
         and app_private.is_campaign_brand(task.campaign_id)
    )
  )
  with check (
    report_task_id is not null
    and exists (
      select 1
        from public.campaign_report_tasks task
       where task.id = content_performance_metric_values.report_task_id
         and app_private.is_campaign_brand(task.campaign_id)
    )
  );

drop policy if exists content_performance_ai_extractions_select_access
  on public.content_performance_ai_extractions;
create policy content_performance_ai_extractions_select_access
  on public.content_performance_ai_extractions
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_report_task_creator(report_task_id)
    or exists (
      select 1
        from public.campaign_report_tasks task
       where task.id = content_performance_ai_extractions.report_task_id
         and app_private.is_campaign_brand(task.campaign_id)
    )
  );

drop policy if exists content_performance_ai_extractions_update_creator
  on public.content_performance_ai_extractions;
create policy content_performance_ai_extractions_update_creator
  on public.content_performance_ai_extractions
  for update
  to authenticated
  using (app_private.is_report_task_creator(report_task_id))
  with check (app_private.is_report_task_creator(report_task_id));

insert into public.reporting_metric_definitions (
  platform,
  metric_key,
  label,
  field_type,
  evidence_scope,
  is_default,
  is_private_metric,
  sort_order
)
values
  ('instagram', 'views', 'Views', 'integer', 'public', true, false, 10),
  ('instagram', 'reach', 'Reach', 'integer', 'native_insights', true, true, 20),
  ('instagram', 'impressions', 'Impressions', 'integer', 'native_insights', true, true, 30),
  ('instagram', 'likes', 'Likes', 'integer', 'public', true, false, 40),
  ('instagram', 'comments', 'Comments', 'integer', 'public', true, false, 50),
  ('instagram', 'shares', 'Shares', 'integer', 'native_insights', true, true, 60),
  ('instagram', 'saves', 'Saves', 'integer', 'native_insights', true, true, 70),
  ('instagram', 'profile_visits', 'Profile visits', 'integer', 'native_insights', false, true, 80),
  ('instagram', 'link_clicks', 'Link clicks', 'integer', 'native_insights', false, true, 90),
  ('tiktok', 'views', 'Views', 'integer', 'public', true, false, 10),
  ('tiktok', 'likes', 'Likes', 'integer', 'public', true, false, 20),
  ('tiktok', 'comments', 'Comments', 'integer', 'public', true, false, 30),
  ('tiktok', 'shares', 'Shares', 'integer', 'public', true, false, 40),
  ('tiktok', 'favorites', 'Favorites', 'integer', 'native_insights', true, true, 50),
  ('tiktok', 'avg_watch_time_seconds', 'Average watch time', 'duration_seconds', 'native_insights', true, true, 60),
  ('tiktok', 'completion_rate', 'Completion rate', 'percentage', 'native_insights', true, true, 70),
  ('tiktok', 'profile_views', 'Profile views', 'integer', 'native_insights', false, true, 80),
  ('youtube', 'views', 'Views', 'integer', 'public', true, false, 10),
  ('youtube', 'impressions', 'Impressions', 'integer', 'native_insights', true, true, 20),
  ('youtube', 'impressions_click_through_rate', 'Impressions CTR', 'percentage', 'native_insights', true, true, 30),
  ('youtube', 'watch_time_minutes', 'Watch time', 'decimal', 'native_insights', true, true, 40),
  ('youtube', 'avg_view_duration_seconds', 'Average view duration', 'duration_seconds', 'native_insights', true, true, 50),
  ('youtube', 'likes', 'Likes', 'integer', 'public', true, false, 60),
  ('youtube', 'comments', 'Comments', 'integer', 'public', true, false, 70),
  ('youtube', 'shares', 'Shares', 'integer', 'native_insights', false, true, 80),
  ('youtube', 'subscribers_gained', 'Subscribers gained', 'integer', 'native_insights', false, true, 90),
  ('facebook', 'reach', 'Reach', 'integer', 'native_insights', true, true, 10),
  ('facebook', 'impressions', 'Impressions', 'integer', 'native_insights', true, true, 20),
  ('facebook', 'views', 'Views', 'integer', 'public', true, false, 30),
  ('facebook', 'reactions', 'Reactions', 'integer', 'public', true, false, 40),
  ('facebook', 'comments', 'Comments', 'integer', 'public', true, false, 50),
  ('facebook', 'shares', 'Shares', 'integer', 'public', true, false, 60),
  ('facebook', 'clicks', 'Clicks', 'integer', 'native_insights', false, true, 70),
  ('facebook', 'profile_visits', 'Profile visits', 'integer', 'native_insights', false, true, 80),
  ('snapchat', 'views', 'Views', 'integer', 'public', true, false, 10),
  ('snapchat', 'viewers', 'Viewers', 'integer', 'native_insights', true, true, 20),
  ('snapchat', 'screenshots', 'Screenshots', 'integer', 'native_insights', true, true, 30),
  ('snapchat', 'shares', 'Shares', 'integer', 'native_insights', true, true, 40),
  ('snapchat', 'swipe_ups', 'Swipe-ups', 'integer', 'native_insights', true, true, 50),
  ('snapchat', 'avg_view_time_seconds', 'Average view time', 'duration_seconds', 'native_insights', true, true, 60),
  ('snapchat', 'total_view_time_seconds', 'Total view time', 'duration_seconds', 'native_insights', false, true, 70),
  ('snapchat', 'comments', 'Comments', 'integer', 'native_insights', false, false, 80),
  ('snapchat', 'favorites', 'Favorites', 'integer', 'native_insights', false, false, 90),
  ('x', 'impressions', 'Impressions', 'integer', 'native_insights', true, true, 10),
  ('x', 'likes', 'Likes', 'integer', 'public', true, false, 20),
  ('x', 'replies', 'Replies', 'integer', 'public', true, false, 30),
  ('x', 'reposts', 'Reposts', 'integer', 'public', true, false, 40),
  ('x', 'quotes', 'Quotes', 'integer', 'public', true, false, 50),
  ('x', 'bookmarks', 'Bookmarks', 'integer', 'native_insights', true, true, 60),
  ('x', 'clicks', 'Clicks', 'integer', 'native_insights', false, true, 70),
  ('x', 'video_views', 'Video views', 'integer', 'public', false, false, 80),
  ('generic', 'views', 'Views', 'integer', 'public', true, false, 10),
  ('generic', 'reach', 'Reach', 'integer', 'public', false, false, 20),
  ('generic', 'impressions', 'Impressions', 'integer', 'public', false, false, 30),
  ('generic', 'engagements', 'Engagements', 'integer', 'public', true, false, 40),
  ('generic', 'clicks', 'Clicks', 'integer', 'public', true, false, 50),
  ('generic', 'screenshots', 'Screenshots', 'integer', 'public', false, false, 60),
  ('generic', 'conversions', 'Conversions', 'integer', 'public', false, false, 70),
  ('generic', 'custom_1', 'Custom metric 1', 'text', 'brand_defined', false, false, 80),
  ('generic', 'custom_2', 'Custom metric 2', 'text', 'brand_defined', false, false, 90),
  ('generic', 'custom_3', 'Custom metric 3', 'text', 'brand_defined', false, false, 100)
on conflict (platform, metric_key) do update
set label = excluded.label,
    field_type = excluded.field_type,
    evidence_scope = excluded.evidence_scope,
    is_default = excluded.is_default,
    is_private_metric = excluded.is_private_metric,
    sort_order = excluded.sort_order;
