-- Private campaign invite import tray.
--
-- This stores the brand's explicit creator outreach list for invite-only
-- campaigns. It is intentionally not a creator CRM: one campaign, one contact,
-- and one queue trace when an email invite is sent.

set search_path = public, extensions, pg_temp;

create table if not exists public.campaign_creator_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'handle')),
  contact_value text not null,
  normalized_contact text not null,
  status text not null check (status in ('manual', 'queued', 'sent', 'failed')),
  queued_email_id uuid references public.notification_queue(id),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, normalized_contact)
);

create index if not exists campaign_creator_invites_campaign_status_idx
  on public.campaign_creator_invites(campaign_id, status, created_at desc);

alter table public.campaign_creator_invites enable row level security;

drop policy if exists campaign_creator_invites_select_workspace
  on public.campaign_creator_invites;
create policy campaign_creator_invites_select_workspace
  on public.campaign_creator_invites
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_creator_invites.campaign_id
         and app_private.current_user_can_access_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists campaign_creator_invites_insert_manager
  on public.campaign_creator_invites;
create policy campaign_creator_invites_insert_manager
  on public.campaign_creator_invites
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_creator_invites.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists campaign_creator_invites_update_manager
  on public.campaign_creator_invites;
create policy campaign_creator_invites_update_manager
  on public.campaign_creator_invites
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_creator_invites.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  )
  with check (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_creator_invites.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );

grant select, insert, update on public.campaign_creator_invites to authenticated;

comment on table public.campaign_creator_invites is
  'Per-campaign private invite contacts imported by brand managers.';
