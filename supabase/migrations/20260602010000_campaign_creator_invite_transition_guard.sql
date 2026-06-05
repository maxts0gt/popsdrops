-- Keep private creator invite audit rows honest after import.
--
-- Brand managers can save contacts and queue email outreach while recruiting is
-- open, but applied/sent status belongs to the creator application path. This
-- prevents direct Data API updates from rewriting invite identity or creating a
-- false "applied" audit trail.

set search_path = public, extensions, pg_temp;

create or replace function app_private.guard_campaign_creator_invite_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'manual' then
      raise exception 'Campaign invite status is system controlled after import.';
    end if;

    if new.queued_email_id is not null or new.invited_at is not null then
      raise exception 'Campaign invite queue metadata is system controlled after import.';
    end if;

    return new;
  end if;

  if
    new.campaign_id is distinct from old.campaign_id
    or new.contact_type is distinct from old.contact_type
    or new.contact_value is distinct from old.contact_value
    or new.normalized_contact is distinct from old.normalized_contact
    or new.invited_by is distinct from old.invited_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Campaign invite contacts cannot be reassigned after import.';
  end if;

  if
    old.status in ('manual', 'failed')
    and new.status = 'queued'
    and new.contact_type = 'email'
    and new.queued_email_id is not null
    and new.invited_at is not null
    and exists (
      select 1
        from public.notification_queue queued
       where queued.id = new.queued_email_id
         and queued.template = 'campaign_update'
         and queued.status in ('pending', 'sent', 'failed')
         and queued.email = new.contact_value
         and queued.data ->> 'invite_id' = new.id::text
    )
  then
    return new;
  end if;

  if new.status = old.status then
    if
      new.queued_email_id is distinct from old.queued_email_id
      or new.invited_at is distinct from old.invited_at
    then
      raise exception 'Campaign invite queue metadata is system controlled after queuing.';
    end if;

    return new;
  end if;

  raise exception 'Campaign invite status transitions are system controlled after queuing.';
end;
$$;

drop trigger if exists campaign_creator_invites_guard_mutation
  on public.campaign_creator_invites;
create trigger campaign_creator_invites_guard_mutation
  before insert or update on public.campaign_creator_invites
  for each row
  execute function app_private.guard_campaign_creator_invite_mutation();

comment on function app_private.guard_campaign_creator_invite_mutation() is
  'Prevents brand-side invite contact rewrites and false applied/sent status transitions.';
