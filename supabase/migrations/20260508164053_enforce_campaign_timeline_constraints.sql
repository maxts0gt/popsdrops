-- Campaign timeline dates must stay operationally possible.
-- Backfill first, then enforce the same constraints at the database layer.

alter table public.campaigns
  drop constraint if exists campaigns_application_before_content_check;
alter table public.campaigns
  drop constraint if exists campaigns_posting_window_order_check;
alter table public.campaigns
  drop constraint if exists campaigns_content_before_posting_end_check;
alter table public.campaigns
  drop constraint if exists campaigns_performance_after_reporting_window_check;

update public.campaigns
set posting_window_end = posting_window_start
where
  posting_window_start is not null
  and posting_window_end is not null
  and posting_window_start > posting_window_end;

update public.campaigns
set content_due_date = posting_window_end
where
  content_due_date is not null
  and posting_window_end is not null
  and content_due_date > posting_window_end;

update public.campaigns
set application_deadline = content_due_date - interval '1 day'
where
  application_deadline is not null
  and content_due_date is not null
  and application_deadline > content_due_date;

update public.campaigns
set performance_due_date = posting_window_end
where
  performance_due_date is not null
  and posting_window_end is not null
  and performance_due_date < posting_window_end;

update public.campaigns
set performance_due_date = content_due_date
where
  performance_due_date is not null
  and posting_window_end is null
  and content_due_date is not null
  and performance_due_date < content_due_date;

alter table public.campaigns
  add constraint campaigns_application_before_content_check
  check (
    application_deadline is null
    or content_due_date is null
    or application_deadline <= content_due_date
  );

alter table public.campaigns
  add constraint campaigns_posting_window_order_check
  check (
    posting_window_start is null
    or posting_window_end is null
    or posting_window_start <= posting_window_end
  );

alter table public.campaigns
  add constraint campaigns_content_before_posting_end_check
  check (
    content_due_date is null
    or posting_window_end is null
    or content_due_date <= posting_window_end
  );

alter table public.campaigns
  add constraint campaigns_performance_after_reporting_window_check
  check (
    performance_due_date is null
    or coalesce(posting_window_end, content_due_date) is null
    or performance_due_date >= coalesce(posting_window_end, content_due_date)
  );
