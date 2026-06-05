create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text,
  consent_type text not null default 'terms_privacy_retention'
    check (consent_type in ('terms_privacy_retention', 'privacy_request')),
  source text not null
    check (source in ('login', 'request_invite', 'settings', 'policy_update')),
  terms_version text not null,
  privacy_version text not null,
  retention_version text not null,
  locale text not null default 'en',
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now(),
  constraint legal_consents_identity_check check (
    profile_id is not null or email is not null
  )
);

create index if not exists legal_consents_profile_id_created_at_idx
  on public.legal_consents (profile_id, created_at desc);

create index if not exists legal_consents_email_created_at_idx
  on public.legal_consents (lower(email), created_at desc)
  where email is not null;

alter table public.legal_consents enable row level security;

drop policy if exists legal_consents_select_own on public.legal_consents;
create policy legal_consents_select_own
  on public.legal_consents
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists legal_consents_insert_own on public.legal_consents;
create policy legal_consents_insert_own
  on public.legal_consents
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists legal_consents_insert_public_request on public.legal_consents;
create policy legal_consents_insert_public_request
  on public.legal_consents
  for insert
  to anon
  with check (
    profile_id is null
    and email is not null
    and source = 'request_invite'
  );

drop policy if exists legal_consents_admin on public.legal_consents;
create policy legal_consents_admin
  on public.legal_consents
  for all
  to authenticated
  using ((select app_private.current_user_is_admin()))
  with check ((select app_private.current_user_is_admin()));

grant insert on public.legal_consents to anon;
grant select, insert on public.legal_consents to authenticated;

create table if not exists public.data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  request_type text not null
    check (request_type in ('export', 'deletion', 'correction')),
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'completed', 'rejected', 'cancelled')),
  details text,
  retention_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_rights_requests_profile_id_created_at_idx
  on public.data_rights_requests (profile_id, created_at desc);

create index if not exists data_rights_requests_status_created_at_idx
  on public.data_rights_requests (status, created_at desc);

drop trigger if exists set_updated_at on public.data_rights_requests;
create trigger set_updated_at
  before update on public.data_rights_requests
  for each row execute function public.update_updated_at();

alter table public.data_rights_requests enable row level security;

drop policy if exists data_rights_requests_select_own on public.data_rights_requests;
create policy data_rights_requests_select_own
  on public.data_rights_requests
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists data_rights_requests_insert_own on public.data_rights_requests;
create policy data_rights_requests_insert_own
  on public.data_rights_requests
  for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and status = 'pending'
  );

drop policy if exists data_rights_requests_admin on public.data_rights_requests;
create policy data_rights_requests_admin
  on public.data_rights_requests
  for all
  to authenticated
  using ((select app_private.current_user_is_admin()))
  with check ((select app_private.current_user_is_admin()));

grant select, insert, update on public.data_rights_requests to authenticated;

comment on table public.legal_consents is
  'Immutable consent ledger for terms, privacy, and retention acknowledgements.';

comment on table public.data_rights_requests is
  'Authenticated queue for privacy export, deletion, and correction reviews.';
