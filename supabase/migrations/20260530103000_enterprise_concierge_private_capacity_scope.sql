alter table public.enterprise_concierge_requests
  drop constraint if exists enterprise_concierge_requests_campaign_mode_check;

alter table public.enterprise_concierge_requests
  add constraint enterprise_concierge_requests_campaign_mode_check
  check (campaign_mode in ('private', 'sourced'));

comment on constraint enterprise_concierge_requests_campaign_mode_check
  on public.enterprise_concierge_requests is
  'Enterprise Concierge requests can represent sourced campaigns or private capacity quotes above self-serve limits.';

comment on column public.enterprise_concierge_requests.campaign_mode is
  'Requested operating model: private for capacity quote review, sourced for Concierge sourcing scope.';

comment on table public.enterprise_concierge_requests is
  'Brand-owned requests for custom campaign scope review, including Concierge sourcing and private capacity above self-serve limits.';
