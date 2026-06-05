-- Lock campaign agreement edits to pre-work campaign stages.
-- Campaign rules are governance history once recruiting closes.

set search_path = public, extensions, pg_temp;

create or replace function app_private.campaign_accepts_agreement_updates(
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

comment on function app_private.campaign_accepts_agreement_updates(uuid) is
  'True only while campaign rules and agreement files can still be changed.';

grant execute on function app_private.campaign_accepts_agreement_updates(uuid)
  to authenticated, service_role;

drop policy if exists campaign_agreements_insert_brand
  on public.campaign_agreements;
create policy campaign_agreements_insert_brand
  on public.campaign_agreements
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and app_private.campaign_accepts_agreement_updates(campaign_agreements.campaign_id)
    and app_private.is_campaign_brand(campaign_agreements.campaign_id)
  );

drop policy if exists campaign_agreements_update_brand
  on public.campaign_agreements;
create policy campaign_agreements_update_brand
  on public.campaign_agreements
  for update
  to authenticated
  using (
    app_private.campaign_accepts_agreement_updates(campaign_agreements.campaign_id)
    and app_private.is_campaign_brand(campaign_agreements.campaign_id)
  )
  with check (
    app_private.campaign_accepts_agreement_updates(campaign_agreements.campaign_id)
    and app_private.is_campaign_brand(campaign_agreements.campaign_id)
  );

create or replace function app_private.can_write_campaign_agreement_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_agreements agreement
     where agreement.file_path = object_name
       and agreement.file_bucket = 'campaign-agreements'
       and agreement.status = 'draft'
       and app_private.campaign_accepts_agreement_updates(agreement.campaign_id)
       and app_private.is_campaign_brand(agreement.campaign_id)
  );
$$;
