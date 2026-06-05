-- Campaign agreement gate.
-- Brands configure rules and optional PDF agreements.
-- Accepted creators must sign before protected campaign work unlocks.

create schema if not exists app_private;

create table if not exists public.campaign_agreements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  version integer not null,
  status text not null default 'draft',
  gate_mode text not null,
  title text not null,
  rules jsonb not null default '{}'::jsonb,
  agreement_body text,
  preview_enabled boolean not null default false,
  preview_summary jsonb not null default '{}'::jsonb,
  file_bucket text,
  file_path text,
  file_name text,
  file_mime_type text,
  file_size_bytes bigint,
  file_sha256 text,
  content_hash text not null,
  requires_typed_name boolean not null default true,
  requires_reacceptance boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_agreements_status_check check (
    status in ('draft', 'published', 'archived')
  ),
  constraint campaign_agreements_gate_mode_check check (
    gate_mode in (
      'rules_acknowledgement',
      'typed_signature',
      'brand_agreement',
      'rules_and_brand_agreement'
    )
  ),
  constraint campaign_agreements_version_unique unique (campaign_id, version),
  constraint campaign_agreements_id_campaign_unique unique (id, campaign_id),
  constraint campaign_agreements_bucket_check check (
    file_bucket is null or file_bucket = 'campaign-agreements'
  ),
  constraint campaign_agreements_pdf_check check (
    file_mime_type is null or file_mime_type = 'application/pdf'
  ),
  constraint campaign_agreements_file_size_check check (
    file_size_bytes is null or file_size_bytes > 0
  ),
  constraint campaign_agreements_file_path_check check (
    file_path is null or (
      app_private.uuid_path_segment(file_path, 1) = campaign_id
      and app_private.uuid_path_segment(file_path, 2) = id
    )
  )
);

comment on table public.campaign_agreements is
  'Versioned campaign rules and brand-provided agreement gate for accepted creators.';

create unique index if not exists campaign_agreements_one_published_idx
  on public.campaign_agreements (campaign_id)
  where status = 'published';

create index if not exists campaign_agreements_campaign_status_idx
  on public.campaign_agreements (campaign_id, status, version desc);

create table if not exists public.campaign_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.campaign_agreements(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_member_id uuid not null references public.campaign_members(id) on delete cascade,
  application_id uuid references public.campaign_applications(id) on delete set null,
  creator_id uuid not null references public.profiles(id),
  typed_name text not null,
  accepted_rules jsonb not null default '{}'::jsonb,
  accepted_content_hash text not null,
  accepted_version integer not null,
  ip_hash text,
  user_agent text,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint campaign_agreement_acceptances_name_check check (length(trim(typed_name)) >= 2),
  constraint campaign_agreement_acceptances_scope_fkey foreign key (
    agreement_id,
    campaign_id
  ) references public.campaign_agreements (
    id,
    campaign_id
  ) on delete cascade
);

comment on table public.campaign_agreement_acceptances is
  'Immutable creator acknowledgement or signature records for campaign agreement versions.';

create unique index if not exists campaign_agreement_acceptances_active_unique
  on public.campaign_agreement_acceptances (agreement_id, creator_id)
  where revoked_at is null;

create index if not exists campaign_agreement_acceptances_campaign_creator_idx
  on public.campaign_agreement_acceptances (campaign_id, creator_id, accepted_at desc);

alter table public.campaign_agreements enable row level security;
alter table public.campaign_agreement_acceptances enable row level security;

create or replace function app_private.published_campaign_agreement(campaign_uuid uuid)
returns table (
  agreement_id uuid,
  agreement_version integer,
  agreement_hash text,
  agreement_requires_reacceptance boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id, version, content_hash, requires_reacceptance
    from public.campaign_agreements
   where campaign_id = campaign_uuid
     and status = 'published'
   order by version desc
   limit 1;
$$;

create or replace function app_private.campaign_member_has_required_agreement(member_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with member_row as (
    select id, campaign_id, creator_id
      from public.campaign_members
     where id = member_uuid
  ),
  agreement_row as (
    select *
      from app_private.published_campaign_agreement(
        (select campaign_id from member_row)
      )
  )
  select
    not exists (select 1 from agreement_row)
    or exists (
      select 1
        from public.campaign_agreement_acceptances acceptance
        join agreement_row agreement on agreement.agreement_id = acceptance.agreement_id
       where acceptance.campaign_member_id = (select id from member_row)
         and acceptance.creator_id = (select creator_id from member_row)
         and acceptance.revoked_at is null
         and acceptance.accepted_content_hash = agreement.agreement_hash
         and (
           agreement.agreement_requires_reacceptance = false
           or acceptance.accepted_version = agreement.agreement_version
         )
    );
$$;

create or replace function app_private.current_user_has_campaign_agreement_access(campaign_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_members member
     where member.campaign_id = campaign_uuid
       and member.creator_id = auth.uid()
       and app_private.campaign_member_has_required_agreement(member.id)
  )
  or not exists (
    select 1
      from public.campaign_agreements agreement
     where agreement.campaign_id = campaign_uuid
       and agreement.status = 'published'
  );
$$;

create or replace view public.campaign_member_agreement_status
with (security_invoker = true)
as
select
  member.campaign_id,
  member.id as campaign_member_id,
  member.creator_id,
  agreement.id as agreement_id,
  agreement.version as agreement_version,
  case
    when agreement.id is null then 'not_required'
    when acceptance.id is null then 'pending'
    when acceptance.accepted_content_hash <> agreement.content_hash then 'needs_reacceptance'
    when agreement.requires_reacceptance and acceptance.accepted_version <> agreement.version then 'needs_reacceptance'
    else 'signed'
  end as status,
  acceptance.accepted_at,
  acceptance.typed_name
from public.campaign_members member
left join lateral (
  select *
    from public.campaign_agreements agreement
   where agreement.campaign_id = member.campaign_id
     and agreement.status = 'published'
   order by agreement.version desc
   limit 1
) agreement on true
left join public.campaign_agreement_acceptances acceptance
  on acceptance.agreement_id = agreement.id
 and acceptance.creator_id = member.creator_id
 and acceptance.revoked_at is null;

drop policy if exists campaign_agreements_select_access on public.campaign_agreements;
create policy campaign_agreements_select_access
  on public.campaign_agreements
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      status = 'published'
      and app_private.is_campaign_member(campaign_id)
    )
  );

drop policy if exists campaign_agreements_insert_brand on public.campaign_agreements;
create policy campaign_agreements_insert_brand
  on public.campaign_agreements
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaign_agreements_update_brand on public.campaign_agreements;
create policy campaign_agreements_update_brand
  on public.campaign_agreements
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id))
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_agreement_acceptances_select_access on public.campaign_agreement_acceptances;
create policy campaign_agreement_acceptances_select_access
  on public.campaign_agreement_acceptances
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or creator_id = auth.uid()
    or app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaign_agreement_acceptances_insert_creator on public.campaign_agreement_acceptances;
create policy campaign_agreement_acceptances_insert_creator
  on public.campaign_agreement_acceptances
  for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1
        from public.campaign_agreements agreement
       where agreement.id = agreement_id
         and agreement.campaign_id = campaign_id
         and agreement.status = 'published'
         and agreement.content_hash = accepted_content_hash
         and agreement.version = accepted_version
    )
    and exists (
      select 1
        from public.campaign_members member
       where member.id = campaign_member_id
         and member.campaign_id = campaign_id
         and member.creator_id = auth.uid()
    )
    and (
      application_id is null
      or exists (
        select 1
          from public.campaign_applications application
         where application.id = application_id
           and application.campaign_id = campaign_id
           and application.creator_id = auth.uid()
      )
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'campaign-agreements',
  'campaign-agreements',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function app_private.can_read_campaign_agreement_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_agreements agreement
     where agreement.file_path = object_name
       and agreement.file_bucket = 'campaign-agreements'
       and (
         app_private.current_user_is_admin()
         or app_private.is_campaign_brand(agreement.campaign_id)
         or (
           agreement.status = 'published'
           and app_private.is_campaign_member(agreement.campaign_id)
         )
       )
  );
$$;

create or replace function app_private.can_write_campaign_agreement_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_agreements agreement
     where agreement.file_path = object_name
       and agreement.file_bucket = 'campaign-agreements'
       and agreement.status = 'draft'
       and app_private.is_campaign_brand(agreement.campaign_id)
  );
$$;

drop policy if exists campaign_agreements_objects_select on storage.objects;
create policy campaign_agreements_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'campaign-agreements'
    and app_private.can_read_campaign_agreement_object(name)
  );

drop policy if exists campaign_agreements_objects_insert on storage.objects;
create policy campaign_agreements_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'campaign-agreements'
    and app_private.uuid_path_segment(name, 1) is not null
    and app_private.uuid_path_segment(name, 2) is not null
    and app_private.can_write_campaign_agreement_object(name)
  );

drop policy if exists campaign_agreements_objects_update on storage.objects;
create policy campaign_agreements_objects_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'campaign-agreements'
    and app_private.can_write_campaign_agreement_object(name)
  )
  with check (
    bucket_id = 'campaign-agreements'
    and app_private.can_write_campaign_agreement_object(name)
  );

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
           and app_private.current_user_has_campaign_agreement_access(asset.campaign_id)
         )
       )
  );
$$;

drop policy if exists campaign_assets_select_access on public.campaign_assets;
create policy campaign_assets_select_access
  on public.campaign_assets
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      status = 'ready'
      and visibility = 'member'
      and app_private.current_user_has_campaign_agreement_access(campaign_id)
    )
  );

drop policy if exists campaign_brief_blocks_select_access on public.campaign_brief_blocks;
create policy campaign_brief_blocks_select_access
  on public.campaign_brief_blocks
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      visibility = 'member'
      and app_private.current_user_has_campaign_agreement_access(campaign_id)
    )
    or (
      visibility = 'public'
      and (
        app_private.is_campaign_member(campaign_id)
        or exists (
          select 1
            from public.campaigns
           where campaigns.id = campaign_brief_blocks.campaign_id
             and campaigns.status = 'recruiting'
        )
      )
    )
  );

drop policy if exists campaign_report_tasks_select_brand_creator on public.campaign_report_tasks;
create policy campaign_report_tasks_select_brand_creator
  on public.campaign_report_tasks
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      app_private.is_campaign_member_record(campaign_member_id)
      and app_private.campaign_member_has_required_agreement(campaign_member_id)
    )
  );

drop policy if exists campaign_reporting_requirements_select_access on public.campaign_reporting_requirements;
create policy campaign_reporting_requirements_select_access
  on public.campaign_reporting_requirements
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or app_private.current_user_has_campaign_agreement_access(campaign_id)
    or exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_reporting_requirements.campaign_id
         and campaigns.status = 'recruiting'
    )
  );

drop policy if exists content_submissions_insert_creator on public.content_submissions;
create policy content_submissions_insert_creator
  on public.content_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_submissions_update_creator on public.content_submissions;
create policy content_submissions_update_creator
  on public.content_submissions
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  )
  with check (
    exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_insert_creator on public.content_performance;
create policy content_performance_insert_creator
  on public.content_performance
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_update_creator on public.content_performance;
create policy content_performance_update_creator
  on public.content_performance
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  )
  with check (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = auth.uid()
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_metric_values_insert_creator on public.content_performance_metric_values;
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
    and exists (
      select 1
        from public.content_performance performance
        join public.content_submissions submission
          on submission.id = performance.submission_id
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where performance.id = content_performance_metric_values.performance_id
         and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_metric_values_update_access on public.content_performance_metric_values;
create policy content_performance_metric_values_update_access
  on public.content_performance_metric_values
  for update
  to authenticated
  using (
    app_private.is_performance_creator(performance_id)
    or (
      report_task_id is not null
      and exists (
        select 1
          from public.campaign_report_tasks task
         where task.id = content_performance_metric_values.report_task_id
           and app_private.is_campaign_brand(task.campaign_id)
      )
    )
  )
  with check (
    (
      app_private.is_performance_creator(performance_id)
      and exists (
        select 1
          from public.content_performance performance
          join public.content_submissions submission
            on submission.id = performance.submission_id
          join public.campaign_members member
            on member.id = submission.campaign_member_id
         where performance.id = content_performance_metric_values.performance_id
           and app_private.campaign_member_has_required_agreement(member.id)
      )
    )
    or (
      report_task_id is not null
      and exists (
        select 1
          from public.campaign_report_tasks task
         where task.id = content_performance_metric_values.report_task_id
           and app_private.is_campaign_brand(task.campaign_id)
      )
    )
  );

grant select, insert, update on table public.campaign_agreements
  to authenticated, service_role;
grant delete on table public.campaign_agreements
  to service_role;
grant select, insert on table public.campaign_agreement_acceptances
  to authenticated, service_role;
grant update, delete on table public.campaign_agreement_acceptances
  to service_role;
grant select on public.campaign_member_agreement_status
  to authenticated, service_role;
grant execute on all functions in schema app_private
  to authenticated, service_role;
