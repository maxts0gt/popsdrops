-- Align application-deadline enforcement across app actions and database-edge
-- policies. Calendar-day deadlines encoded at midnight stay open through that
-- date; explicit timestamps close at the exact instant.

set search_path = public, extensions, pg_temp;

create or replace function app_private.campaign_application_deadline_is_open(
  deadline timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    deadline is null
    or deadline >= now()
    or (
      deadline = date_trunc('day', deadline)
      and deadline::date >= current_date
    );
$$;

comment on function app_private.campaign_application_deadline_is_open(timestamptz) is
  'True when a campaign application deadline is still open; midnight timestamps are treated as calendar-day deadlines.';

grant execute on function app_private.campaign_application_deadline_is_open(timestamptz)
  to authenticated, service_role;

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
       and app_private.campaign_application_deadline_is_open(campaigns.application_deadline)
  );
$$;

comment on function app_private.campaign_accepts_application_decisions(uuid) is
  'True only while campaign applications and applicant decisions remain open.';

grant execute on function app_private.campaign_accepts_application_decisions(uuid)
  to authenticated, service_role;

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
       and app_private.campaign_application_deadline_is_open(campaign.application_deadline)
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
         or app_private.campaign_application_deadline_is_open(campaigns.application_deadline)
       )
  );
$$;

comment on function app_private.campaign_accepts_creator_invites(uuid) is
  'True only while a campaign can accept private creator invite management.';

grant execute on function app_private.campaign_accepts_creator_invites(uuid)
  to authenticated, service_role;

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
         or app_private.campaign_application_deadline_is_open(campaigns.application_deadline)
       )
  );
$$;

comment on function app_private.campaign_accepts_agreement_updates(uuid) is
  'True only while campaign rules and agreement files can still be changed.';

grant execute on function app_private.campaign_accepts_agreement_updates(uuid)
  to authenticated, service_role;

create or replace function app_private.enforce_campaign_member_creator_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign_record record;
  paid_creator_capacity integer := 0;
  paid_event_capacity integer := 0;
  paid_event_cents integer := 0;
  campaign_creator_limit integer;
  accepted_creator_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.campaign_id::text));

  select
    status,
    application_deadline,
    max_creators,
    service_fee_cents,
    service_fee_status,
    service_package_snapshot
    into campaign_record
    from public.campaigns
   where id = new.campaign_id
   for update;

  if not found then
    raise exception 'Campaign not found'
      using errcode = 'foreign_key_violation';
  end if;

  if campaign_record.status <> 'recruiting' then
    raise exception 'Campaign membership is closed for this campaign stage'
      using errcode = 'check_violation';
  end if;

  if not app_private.campaign_application_deadline_is_open(campaign_record.application_deadline) then
    raise exception 'The application deadline has already passed'
      using errcode = 'check_violation';
  end if;

  with paid_checkout_sessions as (
    select distinct checkout_session_id
      from public.campaign_payment_events
     where campaign_id = new.campaign_id
       and service_fee_status = 'paid'
       and checkout_session_id is not null
       and checkout_session_id <> ''
  )
  select
    coalesce(sum(
      case
        when event.service_fee_status = 'paid'
          then greatest(coalesce(event.amount_cents, 0), 0)
        else 0
      end
    ), 0),
    coalesce(max(
      case
        when event.service_fee_status = 'paid'
          or paid_checkout_sessions.checkout_session_id is not null
          then greatest(
            case
              when event.event_summary ->> 'creatorCapacity' ~ '^[0-9]+$'
                then (event.event_summary ->> 'creatorCapacity')::integer
              else 0
            end,
            case
              when event.event_summary ->> 'startingCapacity' ~ '^[0-9]+$'
                then (event.event_summary ->> 'startingCapacity')::integer
              else 0
            end,
            case
              when event.event_summary ->> 'startingCreatorCapacity' ~ '^[0-9]+$'
                then (event.event_summary ->> 'startingCreatorCapacity')::integer
              else 0
            end,
            case
              when event.event_summary ->> 'estimatedMaxCreators' ~ '^[0-9]+$'
                then (event.event_summary ->> 'estimatedMaxCreators')::integer
              else 0
            end
          )
        else 0
      end
    ), 0)
    into paid_event_cents, paid_event_capacity
    from public.campaign_payment_events event
    left join paid_checkout_sessions
      on paid_checkout_sessions.checkout_session_id = event.checkout_session_id
   where event.campaign_id = new.campaign_id;

  paid_creator_capacity := greatest(
    paid_event_capacity,
    case
      when campaign_record.service_package_snapshot ->> 'paidCreatorCapacity' ~ '^[0-9]+$'
        then (campaign_record.service_package_snapshot ->> 'paidCreatorCapacity')::integer
      else 0
    end,
    case
      when paid_event_cents >= 14900 then 10
      else 0
    end
  );

  campaign_creator_limit := case
    when coalesce(campaign_record.service_fee_cents, 0) <= 0
      or campaign_record.service_fee_status = 'paid'
      then greatest(coalesce(campaign_record.max_creators, 1), 1)
    else least(
      greatest(coalesce(campaign_record.max_creators, 1), 1),
      paid_creator_capacity
    )
  end;

  select count(*)
    into accepted_creator_count
    from public.campaign_members
   where campaign_id = new.campaign_id;

  if accepted_creator_count >= campaign_creator_limit then
    raise exception 'Campaign creator capacity is full'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_campaign_member_creator_capacity()
  from public, anon, authenticated;

comment on function app_private.enforce_campaign_member_creator_capacity() is
  'Blocks accepted creator rows after recruitment closes and from exceeding paid service-fee creator capacity, using exact application-deadline enforcement.';
