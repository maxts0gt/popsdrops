alter table public.campaigns
  add column if not exists service_fee_checkout_session_id text,
  add column if not exists service_fee_payment_intent_id text,
  add column if not exists service_fee_charge_id text,
  add column if not exists service_fee_paid_at timestamptz,
  add column if not exists service_fee_failed_at timestamptz,
  add column if not exists service_fee_refunded_at timestamptz,
  add column if not exists service_fee_disputed_at timestamptz,
  add column if not exists service_fee_last_event_id text,
  add column if not exists service_fee_last_event_type text,
  add column if not exists service_fee_last_event_at timestamptz;

create index if not exists idx_campaigns_service_fee_checkout_session_id
  on public.campaigns(service_fee_checkout_session_id)
  where service_fee_checkout_session_id is not null;

create index if not exists idx_campaigns_service_fee_payment_intent_id
  on public.campaigns(service_fee_payment_intent_id)
  where service_fee_payment_intent_id is not null;

create index if not exists idx_campaigns_service_fee_last_event_at
  on public.campaigns(service_fee_last_event_at desc)
  where service_fee_last_event_at is not null;

create table if not exists campaign_payment_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider text not null default 'stripe' check (provider = 'stripe'),
  event_id text not null,
  event_type text not null,
  service_fee_status payment_status_type,
  checkout_session_id text,
  payment_intent_id text,
  charge_id text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text check (currency is null or currency = lower(currency)),
  event_summary jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table campaign_payment_events enable row level security;

revoke all on table public.campaign_payment_events from anon;
grant select on table public.campaign_payment_events to authenticated;

drop policy if exists campaign_payment_events_select_brand_or_admin
  on public.campaign_payment_events;
create policy campaign_payment_events_select_brand_or_admin
  on public.campaign_payment_events
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = campaign_payment_events.campaign_id
         and campaigns.brand_id = (select auth.uid())
    )
    or (select app_private.current_user_is_admin())
  );

create index if not exists idx_campaign_payment_events_campaign_received_at
  on public.campaign_payment_events(campaign_id, received_at desc);

create index if not exists idx_campaign_payment_events_payment_intent
  on public.campaign_payment_events(payment_intent_id)
  where payment_intent_id is not null;

create index if not exists idx_campaign_payment_events_charge
  on public.campaign_payment_events(charge_id)
  where charge_id is not null;

comment on column public.campaigns.service_fee_checkout_session_id is
  'Latest Stripe Checkout Session id for the PopsDrops campaign service fee.';
comment on column public.campaigns.service_fee_payment_intent_id is
  'Latest Stripe PaymentIntent id associated with the campaign service fee.';
comment on column public.campaigns.service_fee_charge_id is
  'Latest Stripe Charge id associated with the campaign service fee when Stripe exposes it.';
comment on column public.campaigns.service_fee_last_event_id is
  'Latest Stripe event id or app-created checkout trace id processed for this campaign service fee.';
comment on table public.campaign_payment_events is
  'Append-only Stripe trace events for PopsDrops campaign service fee checkout, payment, refund, dispute, and failure handling.';
