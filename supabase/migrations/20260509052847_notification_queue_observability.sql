alter table public.notification_queue
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists processed_reason text,
  add column if not exists delivered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notification_queue
  drop constraint if exists notification_queue_status_check;

alter table public.notification_queue
  add constraint notification_queue_status_check
  check (status in ('pending', 'sent', 'failed', 'unsupported', 'archived'));

alter table public.notification_queue
  drop constraint if exists notification_queue_attempt_count_check;

alter table public.notification_queue
  add constraint notification_queue_attempt_count_check
  check (attempt_count >= 0);

update public.notification_queue
set
  status = 'sent',
  delivered_at = processed_at,
  processed_reason = 'legacy_processed',
  updated_at = now()
where processed_at is not null
  and status = 'pending';

create index if not exists notification_queue_retryable_idx
  on public.notification_queue (priority, created_at)
  where status in ('pending', 'failed')
    and processed_at is null;

create index if not exists notification_queue_status_idx
  on public.notification_queue (status, template, created_at);
