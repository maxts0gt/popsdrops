alter table public.enterprise_concierge_requests
  add column if not exists quoted_service_fee_cents integer check (
    quoted_service_fee_cents is null or quoted_service_fee_cents >= 0
  ),
  add column if not exists quoted_service_fee_currency text not null default 'usd' check (
    quoted_service_fee_currency ~ '^[a-z]{3}$'
  ),
  add column if not exists quote_note text,
  add column if not exists quoted_at timestamptz;

comment on column public.enterprise_concierge_requests.quoted_service_fee_cents is
  'Admin-reviewed PopsDrops service fee quote for Enterprise Concierge requests, stored in minor units.';
comment on column public.enterprise_concierge_requests.quote_note is
  'Short admin note explaining what the Enterprise Concierge quote covers.';
comment on column public.enterprise_concierge_requests.quoted_at is
  'Timestamp when the Enterprise Concierge quote was sent to the brand.';
