set search_path = public, extensions, pg_temp;

drop policy if exists rls_campaigns_insert_authenticated_06bd9f8a
  on public.campaigns;
drop policy if exists rls_campaigns_select_authenticated_086453a2
  on public.campaigns;
drop policy if exists rls_campaigns_update_authenticated_4f6cd5ab
  on public.campaigns;

drop policy if exists campaigns_select_own_drafts
  on public.campaigns;
drop policy if exists campaigns_insert_brand
  on public.campaigns;
drop policy if exists campaigns_update_own
  on public.campaigns;

create policy campaigns_select_own_drafts
  on public.campaigns
  for select
  to authenticated
  using (
    status <> 'draft'::public.campaign_status
    or app_private.current_user_can_access_brand_workspace(brand_id)
  );

create policy campaigns_insert_brand
  on public.campaigns
  for insert
  to authenticated
  with check (
    app_private.current_user_can_manage_brand_workspace(brand_id)
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'brand'
        and profiles.status = 'approved'
    )
  );

create policy campaigns_update_own
  on public.campaigns
  for update
  to authenticated
  using (app_private.current_user_can_manage_brand_workspace(brand_id))
  with check (app_private.current_user_can_manage_brand_workspace(brand_id));

drop policy if exists enterprise_concierge_requests_insert_brand
  on public.enterprise_concierge_requests;

create policy enterprise_concierge_requests_insert_brand
  on public.enterprise_concierge_requests
  for insert
  to authenticated
  with check (
    app_private.current_user_can_manage_brand_workspace(brand_id)
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'brand'
        and profiles.status = 'approved'
    )
  );

drop policy if exists brand_team_invitations_insert_admin
  on public.brand_team_invitations;

create policy brand_team_invitations_insert_admin
  on public.brand_team_invitations
  for insert
  to authenticated
  with check (
    app_private.current_user_can_manage_brand_team(brand_id)
    and invited_by = (select auth.uid())
  );
