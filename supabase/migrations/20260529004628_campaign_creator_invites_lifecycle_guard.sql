-- Keep private creator outreach inside the campaign recruiting lifecycle.
-- Draft campaigns can save contacts for planning. Recruiting campaigns can
-- save or send while the application window is still open. Later stages are
-- protected from new invite writes through both app actions and RLS.

set search_path = public, extensions, pg_temp;

create or replace function app_private.campaign_accepts_creator_invites(
  campaign_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaigns
     where campaigns.id = campaign_uuid
       and campaigns.status in ('draft', 'recruiting')
       and (
         campaigns.status = 'draft'
         or campaigns.application_deadline is null
         or campaigns.application_deadline >= current_date
       )
  );
$$;

drop policy if exists campaign_creator_invites_insert_manager
  on public.campaign_creator_invites;
create policy campaign_creator_invites_insert_manager
  on public.campaign_creator_invites
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and app_private.campaign_accepts_creator_invites(campaign_creator_invites.campaign_id)
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
    app_private.campaign_accepts_creator_invites(campaign_creator_invites.campaign_id)
    and exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_creator_invites.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  )
  with check (
    app_private.campaign_accepts_creator_invites(campaign_creator_invites.campaign_id)
    and exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_creator_invites.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );

comment on function app_private.campaign_accepts_creator_invites(uuid) is
  'True only while a campaign can accept private creator invite management.';
