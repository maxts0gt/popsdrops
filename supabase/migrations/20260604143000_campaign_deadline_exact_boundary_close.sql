-- Close explicit timestamp application deadlines at the exact instant while
-- preserving calendar-day behavior for midnight date-style deadlines.

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
    or deadline > now()
    or (
      deadline = date_trunc('day', deadline)
      and deadline::date >= current_date
    );
$$;

comment on function app_private.campaign_application_deadline_is_open(timestamptz) is
  'True when a campaign application deadline is still open; midnight timestamps are treated as calendar-day deadlines while explicit timestamps close at the exact instant.';

grant execute on function app_private.campaign_application_deadline_is_open(timestamptz)
  to authenticated, service_role;
