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

  if campaign_record.application_deadline is not null
    and campaign_record.application_deadline < current_date then
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
  'Blocks accepted creator rows after recruitment closes and from exceeding paid service-fee creator capacity, including paid checkout sessions whose scope lives on the matching invoiced event.';
