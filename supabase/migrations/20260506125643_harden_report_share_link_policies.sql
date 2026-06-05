drop policy if exists campaign_report_share_links_select_brand
  on public.campaign_report_share_links;
drop policy if exists campaign_report_share_links_insert_brand
  on public.campaign_report_share_links;
drop policy if exists campaign_report_share_links_update_brand
  on public.campaign_report_share_links;
drop policy if exists campaign_report_share_links_admin
  on public.campaign_report_share_links;

create policy campaign_report_share_links_select_brand
  on public.campaign_report_share_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_report_share_links.campaign_id
        and campaign.brand_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'admin'
    )
  );

create policy campaign_report_share_links_insert_brand
  on public.campaign_report_share_links
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      exists (
        select 1
        from public.campaigns campaign
        where campaign.id = campaign_report_share_links.campaign_id
          and campaign.brand_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.profiles profile
        where profile.id = (select auth.uid())
          and profile.role = 'admin'
      )
    )
  );

create policy campaign_report_share_links_update_brand
  on public.campaign_report_share_links
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_report_share_links.campaign_id
        and campaign.brand_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_report_share_links.campaign_id
        and campaign.brand_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'admin'
    )
  );
