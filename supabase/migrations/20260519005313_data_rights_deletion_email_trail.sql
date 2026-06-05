-- Queue required privacy emails from the automatic account deletion lifecycle.
-- The database owns this trail so scheduled and completed deletion notices do
-- not depend on a Next.js request staying alive.

create or replace function app_private.queue_data_rights_deletion_email()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
begin
  if tg_op = 'INSERT'
    and new.request_type = 'deletion'
    and new.status = 'scheduled'
  then
    insert into public.notification_queue (email, template, data, priority)
    values (
      new.email,
      'data_deletion_scheduled',
      jsonb_build_object(
        'title', 'Data deletion scheduled',
        'body', 'Your PopsDrops account deletion request is scheduled.',
        'recipientName', 'PopsDrops member',
        'data', jsonb_build_object(
          'request_id', new.id,
          'scheduled_for', new.scheduled_for,
          'verification_due_at', new.verification_due_at,
          'retention_note', new.retention_note
        )
      ),
      'immediate'
    );
  elsif tg_op = 'UPDATE'
    and new.request_type = 'deletion'
    and new.status = 'completed'
    and old.status is distinct from 'completed'
  then
    insert into public.notification_queue (email, template, data, priority)
    values (
      old.email,
      'data_deletion_completed',
      jsonb_build_object(
        'title', 'Data deletion completed',
        'body', 'Your PopsDrops account deletion request has been processed.',
        'recipientName', 'PopsDrops member',
        'data', jsonb_build_object(
          'request_id', new.id,
          'processed_at', new.processed_at,
          'completed_at', new.completed_at,
          'retention_note', new.retention_note
        )
      ),
      'immediate'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists data_rights_requests_deletion_email_trail
  on public.data_rights_requests;

create trigger data_rights_requests_deletion_email_trail
  after insert or update of status
  on public.data_rights_requests
  for each row
  execute function app_private.queue_data_rights_deletion_email();

revoke all on function app_private.queue_data_rights_deletion_email()
  from public, anon, authenticated;
grant execute on function app_private.queue_data_rights_deletion_email()
  to service_role;

comment on function app_private.queue_data_rights_deletion_email() is
  'Queues required operational emails when account deletion is scheduled and completed.';
