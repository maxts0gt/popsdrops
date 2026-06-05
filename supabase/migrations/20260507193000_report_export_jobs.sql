create table if not exists public.report_export_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  format text not null,
  status text not null default 'completed',
  storage_bucket text not null default 'report-exports',
  storage_path text,
  file_name text not null,
  mime_type text not null,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint report_export_jobs_format_check check (format in ('json', 'csv', 'html')),
  constraint report_export_jobs_status_check check (status in ('completed', 'failed')),
  constraint report_export_jobs_bucket_check check (storage_bucket = 'report-exports')
);

comment on table public.report_export_jobs is
  'Durable campaign report exports generated from evidence-backed server report data.';

create index if not exists report_export_jobs_campaign_created_idx
  on public.report_export_jobs (campaign_id, created_at desc);

create index if not exists report_export_jobs_requested_by_created_idx
  on public.report_export_jobs (requested_by, created_at desc);

alter table public.report_export_jobs enable row level security;

grant select on public.report_export_jobs to authenticated;
grant select, insert, update on public.report_export_jobs to service_role;

drop policy if exists report_export_jobs_select_brand
  on public.report_export_jobs;
create policy report_export_jobs_select_brand
  on public.report_export_jobs
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'report-exports',
  'report-exports',
  false,
  10485760,
  array[
    'application/json',
    'text/csv',
    'text/html'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists report_exports_objects_select
  on storage.objects;
create policy report_exports_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'report-exports'
    and (
      app_private.current_user_is_admin()
      or app_private.is_campaign_brand(app_private.uuid_path_segment(name, 1))
    )
  );
