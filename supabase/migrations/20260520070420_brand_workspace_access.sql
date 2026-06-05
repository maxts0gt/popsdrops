-- Brand workspace campaign access.
--
-- Accepted teammates work inside the brand workspace, not their personal
-- profile id. This keeps the campaign OS self-serve for teams without opening
-- team management controls to every teammate.

set search_path = public, extensions, pg_temp;

create or replace function app_private.current_user_can_access_brand_workspace(
  target_brand_id uuid
)
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
         and member.accepted_at is not null
    )
    or app_private.current_user_is_admin();
$$;

create or replace function app_private.current_user_can_manage_brand_workspace(
  target_brand_id uuid
)
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
         and member.accepted_at is not null
         and member.role in ('owner', 'admin', 'manager')
    )
    or app_private.current_user_is_admin();
$$;

create or replace function app_private.is_campaign_brand(campaign_uuid uuid)
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
       and app_private.current_user_can_access_brand_workspace(campaigns.brand_id)
  );
$$;

drop policy if exists campaigns_select_own_drafts
  on public.campaigns;
create policy campaigns_select_own_drafts
  on public.campaigns
  for select
  to authenticated
  using (app_private.current_user_can_access_brand_workspace(brand_id));

drop policy if exists campaigns_insert_brand
  on public.campaigns;
create policy campaigns_insert_brand
  on public.campaigns
  for insert
  to authenticated
  with check (
    app_private.current_user_can_manage_brand_workspace(brand_id)
    and exists (
      select 1
        from public.profiles
       where profiles.id = auth.uid()
         and profiles.role = 'brand'
         and profiles.status = 'approved'
    )
  );

drop policy if exists campaigns_update_own
  on public.campaigns;
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
       where profiles.id = auth.uid()
         and profiles.role = 'brand'
         and profiles.status = 'approved'
    )
  );

drop policy if exists enterprise_concierge_requests_select_access
  on public.enterprise_concierge_requests;
drop policy if exists enterprise_concierge_requests_select_brand
  on public.enterprise_concierge_requests;
drop policy if exists enterprise_concierge_requests_select_admin
  on public.enterprise_concierge_requests;
create policy enterprise_concierge_requests_select_access
  on public.enterprise_concierge_requests
  for select
  to authenticated
  using (
    app_private.current_user_can_access_brand_workspace(brand_id)
    or app_private.current_user_is_admin()
  );
