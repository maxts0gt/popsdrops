alter table public.data_rights_requests
  add column if not exists export_storage_bucket text not null default 'privacy-exports',
  add column if not exists export_storage_path text,
  add column if not exists export_file_name text,
  add column if not exists export_mime_type text,
  add column if not exists export_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'data_rights_requests_export_bucket_check'
       and conrelid = 'public.data_rights_requests'::regclass
  ) then
    alter table public.data_rights_requests
      add constraint data_rights_requests_export_bucket_check
      check (export_storage_bucket = 'privacy-exports');
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'privacy-exports',
  'privacy-exports',
  false,
  10485760,
  array['application/json']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists privacy_exports_objects_select
  on storage.objects;

create policy privacy_exports_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'privacy-exports'
    and (
      (select app_private.current_user_is_admin())
      or app_private.uuid_path_segment(name, 1) = (select auth.uid())
    )
  );

comment on column public.data_rights_requests.export_storage_path is
  'Private storage object path for completed privacy export artifacts.';
