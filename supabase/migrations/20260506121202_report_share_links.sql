create table if not exists public.campaign_report_share_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null,
  token_prefix text not null,
  label text not null default 'Client report',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_report_share_links_token_hash_unique unique (token_hash),
  constraint campaign_report_share_links_token_prefix_check check (
    length(token_prefix) between 6 and 16
  ),
  constraint campaign_report_share_links_expiry_check check (
    expires_at is null or expires_at > created_at
  )
);

comment on table public.campaign_report_share_links is
  'Secure no-login campaign report links. The raw token is never stored.';
comment on column public.campaign_report_share_links.token_hash is
  'SHA-256 hash of the report share token. Raw tokens are returned once at creation time only.';
comment on column public.campaign_report_share_links.token_prefix is
  'Short non-secret prefix for brand operators to identify links.';

create index if not exists campaign_report_share_links_campaign_created_idx
  on public.campaign_report_share_links (campaign_id, created_at desc);

create index if not exists campaign_report_share_links_token_hash_active_idx
  on public.campaign_report_share_links (token_hash)
  where revoked_at is null;

create trigger set_updated_at
  before update on public.campaign_report_share_links
  for each row execute function public.update_updated_at();

alter table public.campaign_report_share_links enable row level security;

grant select, insert, update on public.campaign_report_share_links to authenticated;

drop policy if exists campaign_report_share_links_select_brand
  on public.campaign_report_share_links;
create policy campaign_report_share_links_select_brand
  on public.campaign_report_share_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_report_share_links.campaign_id
        and campaign.brand_id = auth.uid()
    )
  );

drop policy if exists campaign_report_share_links_insert_brand
  on public.campaign_report_share_links;
create policy campaign_report_share_links_insert_brand
  on public.campaign_report_share_links
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_report_share_links.campaign_id
        and campaign.brand_id = auth.uid()
    )
  );

drop policy if exists campaign_report_share_links_update_brand
  on public.campaign_report_share_links;
create policy campaign_report_share_links_update_brand
  on public.campaign_report_share_links
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_report_share_links.campaign_id
        and campaign.brand_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_report_share_links.campaign_id
        and campaign.brand_id = auth.uid()
    )
  );

drop policy if exists campaign_report_share_links_admin
  on public.campaign_report_share_links;
create policy campaign_report_share_links_admin
  on public.campaign_report_share_links
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.role = 'admin'
    )
  );
