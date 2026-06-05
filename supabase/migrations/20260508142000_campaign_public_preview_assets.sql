-- Creator-facing campaign preview assets.
-- Brands can mark selected Creative Kit images as public so creators can
-- understand the opportunity before joining, while member and brand assets
-- remain behind the agreement gate.

alter table public.campaign_assets
  drop constraint if exists campaign_assets_visibility_check;

alter table public.campaign_assets
  add constraint campaign_assets_visibility_check
  check (visibility in ('public', 'member', 'brand'));

create or replace function app_private.can_read_campaign_asset_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_assets asset
     where asset.storage_path = object_name
       and asset.status <> 'archived'
       and (
         app_private.current_user_is_admin()
         or app_private.is_campaign_brand(asset.campaign_id)
         or (
           asset.status = 'ready'
           and asset.visibility = 'public'
           and exists (
             select 1
               from public.campaigns campaign
              where campaign.id = asset.campaign_id
                and campaign.status in (
                  'recruiting',
                  'in_progress',
                  'publishing',
                  'monitoring',
                  'completed'
                )
           )
         )
         or (
           asset.status = 'ready'
           and asset.visibility = 'member'
           and app_private.current_user_has_campaign_agreement_access(asset.campaign_id)
         )
       )
  );
$$;

drop policy if exists campaign_assets_select_access on public.campaign_assets;
create policy campaign_assets_select_access
  on public.campaign_assets
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.is_campaign_brand(campaign_id)
    or (
      status = 'ready'
      and visibility = 'public'
      and exists (
        select 1
          from public.campaigns campaign
         where campaign.id = campaign_assets.campaign_id
           and campaign.status in (
             'recruiting',
             'in_progress',
             'publishing',
             'monitoring',
             'completed'
           )
      )
    )
    or (
      status = 'ready'
      and visibility = 'member'
      and app_private.current_user_has_campaign_agreement_access(campaign_id)
    )
  );
