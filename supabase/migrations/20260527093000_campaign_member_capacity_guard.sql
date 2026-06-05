create or replace function public.enforce_campaign_member_creator_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_creator_limit integer;
  accepted_creator_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.campaign_id::text));

  select max_creators
    into campaign_creator_limit
    from public.campaigns
   where id = new.campaign_id
   for update;

  campaign_creator_limit := greatest(coalesce(campaign_creator_limit, 1), 1);

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

drop trigger if exists enforce_campaign_member_creator_capacity
  on public.campaign_members;

create trigger enforce_campaign_member_creator_capacity
  before insert on public.campaign_members
  for each row
  execute function public.enforce_campaign_member_creator_capacity();

comment on function public.enforce_campaign_member_creator_capacity() is
  'Blocks accepted creator rows from exceeding the campaign paid creator capacity.';
