-- Keep creator-owned application mutations inside the open recruiting window.
-- The web action and mobile app both check this, but the database must also
-- reject direct Data API/RPC bypasses.

drop policy if exists campaign_applications_update_own
  on public.campaign_applications;

create policy campaign_applications_update_own
  on public.campaign_applications
  for update
  to authenticated
  using (
    creator_id = (select auth.uid())
    and status in ('pending', 'counter_offer')
    and app_private.can_apply_to_campaign(campaign_applications.campaign_id)
  )
  with check (
    creator_id = (select auth.uid())
    and status = 'withdrawn'
  );

create or replace function public.accept_counter_offer(p_application_id uuid)
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

  if not app_private.can_apply_to_campaign(v_app.campaign_id) then
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

revoke all on function public.accept_counter_offer(uuid) from public;
grant execute on function public.accept_counter_offer(uuid) to authenticated;
