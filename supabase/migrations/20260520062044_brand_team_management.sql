-- Brand workspace team management.
--
-- This creates the durable team model for brand-side collaboration without
-- changing campaign permissions yet. Campaign access can move onto this
-- foundation in the next intentionally scoped pass.

set search_path = public, extensions, pg_temp;

create extension if not exists citext with schema extensions;

do $$
begin
  create type public.brand_team_role as enum ('owner', 'admin', 'manager', 'viewer');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.brand_team_invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.brand_team_members (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.brand_team_role not null default 'manager',
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, user_id),
  constraint brand_team_owner_is_brand_profile check (brand_id <> user_id or role = 'owner')
);

create table if not exists public.brand_team_invitations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  email citext not null,
  role public.brand_team_role not null default 'manager',
  status public.brand_team_invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, email)
);

create index if not exists brand_team_members_user_id_idx
  on public.brand_team_members(user_id);

create index if not exists brand_team_invitations_brand_status_idx
  on public.brand_team_invitations(brand_id, status, invited_at desc);

create or replace function app_private.current_user_can_view_brand_team(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() = target_brand_id
    or exists (
      select 1
        from public.brand_team_members member
       where member.brand_id = target_brand_id
         and member.user_id = auth.uid()
    )
    or app_private.current_user_is_admin();
$$;

create or replace function app_private.current_user_can_manage_brand_team(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() = target_brand_id
    or exists (
      select 1
        from public.brand_team_members member
       where member.brand_id = target_brand_id
         and member.user_id = auth.uid()
         and member.role in ('owner', 'admin')
    )
    or app_private.current_user_is_admin();
$$;

alter table public.brand_team_members enable row level security;
alter table public.brand_team_invitations enable row level security;

create policy brand_team_members_select_workspace
  on public.brand_team_members
  for select
  to authenticated
  using (app_private.current_user_can_view_brand_team(brand_id));

create policy brand_team_members_insert_admin
  on public.brand_team_members
  for insert
  to authenticated
  with check (app_private.current_user_can_manage_brand_team(brand_id));

create policy brand_team_members_update_admin
  on public.brand_team_members
  for update
  to authenticated
  using (app_private.current_user_can_manage_brand_team(brand_id))
  with check (app_private.current_user_can_manage_brand_team(brand_id));

create policy brand_team_invitations_select_workspace
  on public.brand_team_invitations
  for select
  to authenticated
  using (app_private.current_user_can_view_brand_team(brand_id));

create policy brand_team_invitations_insert_admin
  on public.brand_team_invitations
  for insert
  to authenticated
  with check (
    app_private.current_user_can_manage_brand_team(brand_id)
    and invited_by = auth.uid()
  );

create policy brand_team_invitations_update_admin
  on public.brand_team_invitations
  for update
  to authenticated
  using (app_private.current_user_can_manage_brand_team(brand_id))
  with check (app_private.current_user_can_manage_brand_team(brand_id));

grant select on public.brand_team_members to authenticated;
grant select, insert, update on public.brand_team_invitations to authenticated;

insert into public.brand_team_members (
  brand_id,
  user_id,
  role,
  accepted_at,
  created_at,
  updated_at
)
select
  brand_profiles.profile_id,
  brand_profiles.profile_id,
  'owner'::public.brand_team_role,
  now(),
  now(),
  now()
from public.brand_profiles
on conflict (brand_id, user_id) do update
set
  role = 'owner'::public.brand_team_role,
  accepted_at = coalesce(public.brand_team_members.accepted_at, excluded.accepted_at),
  updated_at = now();
