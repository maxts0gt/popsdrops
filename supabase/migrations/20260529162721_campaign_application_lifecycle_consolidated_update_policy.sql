-- Consolidate campaign application update RLS so older broad policies cannot
-- bypass the recruiting/deadline lifecycle guard.

set search_path = public, extensions, pg_temp;

create or replace function app_private.campaign_accepts_application_decisions(
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
       and campaigns.status = 'recruiting'
       and (
         campaigns.application_deadline is null
         or campaigns.application_deadline >= current_date
       )
  );
$$;

comment on function app_private.campaign_accepts_application_decisions(uuid) is
  'True only while campaign applications and applicant decisions remain open.';

grant execute on function app_private.campaign_accepts_application_decisions(uuid)
  to authenticated, service_role;

drop policy if exists campaign_applications_update_own
  on public.campaign_applications;
drop policy if exists campaign_applications_update_brand
  on public.campaign_applications;
drop policy if exists rls_campaign_applications_update_authenticated_335b3251
  on public.campaign_applications;

create policy rls_campaign_applications_update_authenticated_335b3251
  on public.campaign_applications
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.profiles
       where profiles.id = (select auth.uid())
         and profiles.role = 'admin'
    )
    or (
      app_private.is_campaign_brand(campaign_applications.campaign_id)
      and app_private.campaign_accepts_application_decisions(
        campaign_applications.campaign_id
      )
    )
    or (
      creator_id = (select auth.uid())
      and status in ('pending', 'counter_offer')
      and app_private.can_apply_to_campaign(campaign_applications.campaign_id)
    )
  )
  with check (
    exists (
      select 1
        from public.profiles
       where profiles.id = (select auth.uid())
         and profiles.role = 'admin'
    )
    or (
      app_private.is_campaign_brand(campaign_applications.campaign_id)
      and app_private.campaign_accepts_application_decisions(
        campaign_applications.campaign_id
      )
    )
    or (
      creator_id = (select auth.uid())
      and status = 'withdrawn'
    )
  );
