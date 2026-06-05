alter table public.enterprise_concierge_requests
  drop constraint if exists enterprise_concierge_requests_requested_creator_count_check;

alter table public.enterprise_concierge_requests
  add constraint enterprise_concierge_requests_requested_creator_count_check
  check (
    requested_creator_count > 0
    and requested_creator_count <= 5000
  );

comment on constraint enterprise_concierge_requests_requested_creator_count_check
  on public.enterprise_concierge_requests is
  'Enterprise Concierge can be requested for any custom high-touch scope; private self-serve capacity is enforced separately.';
