-- Separate application intake from campaign selection. Creator applications
-- still close at the application deadline, but brands must be able to resolve
-- pending applicants while the campaign remains in recruiting.

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
  );
$$;

comment on function app_private.campaign_accepts_application_decisions(uuid) is
  'Creator intake stays deadline-gated; brand selection and creator withdrawal remain open while recruiting.';

grant execute on function app_private.campaign_accepts_application_decisions(uuid)
  to authenticated, service_role;

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
      and app_private.campaign_accepts_application_decisions(
        campaign_applications.campaign_id
      )
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

create or replace function app_private.accept_counter_offer(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_app record;
begin
  select
    ca.id,
    ca.campaign_id,
    ca.creator_id,
    ca.status,
    ca.counter_rate
  into v_app
  from public.campaign_applications ca
  where ca.id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.creator_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_app.status != 'counter_offer' then
    raise exception 'No counter-offer to respond to';
  end if;

  if not app_private.campaign_accepts_application_decisions(v_app.campaign_id) then
    raise exception 'Counter-offer responses are closed for this campaign stage';
  end if;

  if v_app.counter_rate is null then
    raise exception 'Counter-offer is missing a proposed rate';
  end if;

  update public.campaign_applications
     set status = 'accepted',
         updated_at = now()
   where id = p_application_id;

  insert into public.campaign_members (campaign_id, creator_id, accepted_rate)
  values (v_app.campaign_id, v_app.creator_id, v_app.counter_rate)
  on conflict (campaign_id, creator_id)
  do update set accepted_rate = excluded.accepted_rate;
end;
$$;

comment on function app_private.accept_counter_offer(uuid) is
  'Creator intake stays deadline-gated; counter-offer responses stay open while recruiting.';

revoke all on function app_private.accept_counter_offer(uuid) from public;
grant usage on schema app_private to authenticated, service_role;
grant execute on function app_private.accept_counter_offer(uuid)
  to authenticated, service_role;
