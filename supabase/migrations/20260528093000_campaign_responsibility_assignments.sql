-- Campaign responsibility assignments.
--
-- Campaign teams need clear accountability when private workspaces grow to
-- dozens of creators. This table assigns one accepted brand teammate to each
-- operational workstream without changing workspace permissions.

set search_path = public, extensions, pg_temp;

do $$
begin
  create type public.campaign_responsibility_kind as enum (
    'owner',
    'approvals',
    'reporting',
    'billing'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.campaign_responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  brand_team_member_id uuid not null references public.brand_team_members(id) on delete cascade,
  responsibility public.campaign_responsibility_kind not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, responsibility)
);

create index if not exists campaign_responsibility_assignments_campaign_idx
  on public.campaign_responsibility_assignments(campaign_id);

create index if not exists campaign_responsibility_assignments_member_idx
  on public.campaign_responsibility_assignments(brand_team_member_id);

alter table public.campaign_responsibility_assignments enable row level security;

drop policy if exists campaign_responsibility_assignments_select_workspace
  on public.campaign_responsibility_assignments;
create policy campaign_responsibility_assignments_select_workspace
  on public.campaign_responsibility_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_responsibility_assignments.campaign_id
         and app_private.current_user_can_access_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists campaign_responsibility_assignments_insert_manager
  on public.campaign_responsibility_assignments;
create policy campaign_responsibility_assignments_insert_manager
  on public.campaign_responsibility_assignments
  for insert
  to authenticated
  with check (
    assigned_by = (select auth.uid())
    and exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_responsibility_assignments.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
    and exists (
      select 1
        from public.campaigns
        join public.brand_team_members member
          on member.brand_id = campaigns.brand_id
       where campaigns.id = campaign_responsibility_assignments.campaign_id
         and member.id = campaign_responsibility_assignments.brand_team_member_id
         and member.accepted_at is not null
    )
  );

drop policy if exists campaign_responsibility_assignments_update_manager
  on public.campaign_responsibility_assignments;
create policy campaign_responsibility_assignments_update_manager
  on public.campaign_responsibility_assignments
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_responsibility_assignments.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  )
  with check (
    assigned_by = (select auth.uid())
    and exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_responsibility_assignments.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
    and exists (
      select 1
        from public.campaigns
        join public.brand_team_members member
          on member.brand_id = campaigns.brand_id
       where campaigns.id = campaign_responsibility_assignments.campaign_id
         and member.id = campaign_responsibility_assignments.brand_team_member_id
         and member.accepted_at is not null
    )
  );

drop policy if exists campaign_responsibility_assignments_delete_manager
  on public.campaign_responsibility_assignments;
create policy campaign_responsibility_assignments_delete_manager
  on public.campaign_responsibility_assignments
  for delete
  to authenticated
  using (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_responsibility_assignments.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );

grant select, insert, update, delete on public.campaign_responsibility_assignments to authenticated;

comment on table public.campaign_responsibility_assignments is
  'Per-campaign accountability slots for accepted brand teammates. Does not grant permissions.';
