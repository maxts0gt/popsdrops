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

  select
    coalesce(sum(greatest(coalesce(amount_cents, 0), 0)), 0),
    coalesce(max(greatest(
      case
        when event_summary ->> 'creatorCapacity' ~ '^[0-9]+$'
          then (event_summary ->> 'creatorCapacity')::integer
        else 0
      end,
      case
        when event_summary ->> 'startingCapacity' ~ '^[0-9]+$'
          then (event_summary ->> 'startingCapacity')::integer
        else 0
      end,
      case
        when event_summary ->> 'startingCreatorCapacity' ~ '^[0-9]+$'
          then (event_summary ->> 'startingCreatorCapacity')::integer
        else 0
      end,
      case
        when event_summary ->> 'estimatedMaxCreators' ~ '^[0-9]+$'
          then (event_summary ->> 'estimatedMaxCreators')::integer
        else 0
      end
    )), 0)
    into paid_event_cents, paid_event_capacity
    from public.campaign_payment_events
   where campaign_id = new.campaign_id
     and service_fee_status = 'paid';

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
  'Blocks accepted creator rows from exceeding paid service-fee creator capacity.';
