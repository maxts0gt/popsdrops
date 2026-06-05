create table if not exists public.notification_email_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_messages boolean not null default true,
  email_campaign_activity boolean not null default true,
  email_reports boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_email_preferences enable row level security;

drop policy if exists notification_email_preferences_select_own
  on public.notification_email_preferences;
create policy notification_email_preferences_select_own
  on public.notification_email_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists notification_email_preferences_upsert_own
  on public.notification_email_preferences;
create policy notification_email_preferences_upsert_own
  on public.notification_email_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists notification_email_preferences_update_own
  on public.notification_email_preferences;
create policy notification_email_preferences_update_own
  on public.notification_email_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists notification_email_preferences_admin
  on public.notification_email_preferences;
create policy notification_email_preferences_admin
  on public.notification_email_preferences
  for all
  to authenticated
  using ((select app_private.current_user_is_admin()))
  with check ((select app_private.current_user_is_admin()));

grant select, insert, update on public.notification_email_preferences
  to authenticated;

alter table public.notification_queue
  drop constraint if exists notification_queue_status_check;

alter table public.notification_queue
  add constraint notification_queue_status_check
  check (status in ('pending', 'sent', 'failed', 'unsupported', 'skipped', 'archived'));

comment on column public.notification_queue.processed_reason is
  'Terminal delivery reason such as email_sent, unsupported_template, or email_preference_suppressed.';
