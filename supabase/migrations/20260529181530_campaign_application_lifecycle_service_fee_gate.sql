-- Keep direct Data API creator applications behind the same service-fee gate
-- as the web and mobile application actions.

set search_path = public, extensions, pg_temp;

create or replace function app_private.can_apply_to_campaign(campaign_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaigns campaign
     where campaign.id = campaign_uuid
       and campaign.status = 'recruiting'
       and (
         campaign.application_deadline is null
         or campaign.application_deadline >= current_date
       )
       and (
         coalesce(campaign.service_fee_cents, 0) <= 0
         or campaign.service_fee_status = 'paid'
       )
       and campaign.brand_id <> auth.uid()
  );
$$;

comment on function app_private.can_apply_to_campaign(uuid) is
  'True only while a creator can apply to a recruiting, unlocked campaign.';

grant execute on function app_private.can_apply_to_campaign(uuid)
  to authenticated, service_role;
