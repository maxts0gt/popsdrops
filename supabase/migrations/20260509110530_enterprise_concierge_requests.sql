create table if not exists public.enterprise_concierge_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  campaign_title text not null check (
    char_length(campaign_title) between 3 and 200
  ),
  campaign_mode public.campaign_mode_type not null default 'sourced' check (
    campaign_mode = 'sourced'
  ),
  requested_creator_count integer not null check (
    requested_creator_count > 50 and requested_creator_count <= 5000
  ),
  market_count integer not null check (
    market_count > 0 and market_count <= 250
  ),
  markets text[] not null default '{}',
  platforms text[] not null default '{}',
  creator_budget_cents integer not null default 0 check (
    creator_budget_cents >= 0
  ),
  product_value_cents integer not null default 0 check (
    product_value_cents >= 0
  ),
  fulfillment_budget_cents integer not null default 0 check (
    fulfillment_budget_cents >= 0
  ),
  service_estimate jsonb not null,
  note text,
  status text not null default 'requested' check (
    status in ('requested', 'reviewing', 'quoted', 'closed')
  ),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.enterprise_concierge_requests is
  'Brand-owned requests for sourced campaigns that exceed self-serve scope.';
comment on column public.enterprise_concierge_requests.service_estimate is
  'Immutable pricing estimate captured from the campaign builder when the request was made.';

create index if not exists enterprise_concierge_requests_brand_created_idx
  on public.enterprise_concierge_requests (brand_id, created_at desc);

create index if not exists enterprise_concierge_requests_status_created_idx
  on public.enterprise_concierge_requests (status, created_at desc);

drop trigger if exists set_updated_at on public.enterprise_concierge_requests;
create trigger set_updated_at
  before update on public.enterprise_concierge_requests
  for each row execute function public.update_updated_at();

alter table public.enterprise_concierge_requests enable row level security;

grant select, insert, update on public.enterprise_concierge_requests to authenticated;

drop policy if exists enterprise_concierge_requests_insert_brand
  on public.enterprise_concierge_requests;
create policy enterprise_concierge_requests_insert_brand
  on public.enterprise_concierge_requests
  for insert
  to authenticated
  with check (
    brand_id = auth.uid()
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'brand'
    )
  );

drop policy if exists enterprise_concierge_requests_select_brand
  on public.enterprise_concierge_requests;
create policy enterprise_concierge_requests_select_brand
  on public.enterprise_concierge_requests
  for select
  to authenticated
  using (brand_id = auth.uid());

drop policy if exists enterprise_concierge_requests_select_admin
  on public.enterprise_concierge_requests;
create policy enterprise_concierge_requests_select_admin
  on public.enterprise_concierge_requests
  for select
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists enterprise_concierge_requests_update_admin
  on public.enterprise_concierge_requests;
create policy enterprise_concierge_requests_update_admin
  on public.enterprise_concierge_requests
  for update
  to authenticated
  using (app_private.current_user_is_admin())
  with check (app_private.current_user_is_admin());
