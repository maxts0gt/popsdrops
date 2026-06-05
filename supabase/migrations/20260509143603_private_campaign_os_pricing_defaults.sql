ALTER TABLE public.campaigns
  ALTER COLUMN campaign_mode SET DEFAULT 'private',
  ALTER COLUMN creator_sourcing_required SET DEFAULT false,
  ALTER COLUMN service_fee_cents SET DEFAULT 14900,
  ALTER COLUMN service_package_snapshot SET DEFAULT '{
    "mode": "private",
    "feeCents": 14900,
    "currency": "usd",
    "creatorSourcingRequired": false,
    "requiresCustomPricing": false,
    "tierKey": "workspace",
    "includedCreatorCount": 10,
    "includedActiveDays": 45,
    "includedReportingDays": 14,
    "estimatedMaxCreators": 1,
    "estimatedMarketCount": 1,
    "estimatedActiveDays": 0,
    "estimatedReportingDays": 0,
    "creatorOverageBlocks": 0,
    "activeDayOverageBlocks": 0,
    "reportingDayOverageBlocks": 0,
    "overageFeeCents": 0,
    "scopeKeys": [
      "mode.private.scope.workspace",
      "mode.private.scope.invite",
      "mode.private.scope.report"
    ]
  }'::jsonb;

COMMENT ON COLUMN public.campaigns.campaign_mode IS
  'PopsDrops operating model: private is the invite-only campaign OS; sourced is Enterprise Concierge, custom quoted before launch.';

COMMENT ON COLUMN public.campaigns.creator_sourcing_required IS
  'True only for Enterprise Concierge campaigns where PopsDrops has agreed to sourcing support.';

COMMENT ON COLUMN public.campaigns.service_package_snapshot IS
  'Immutable campaign OS pricing details captured when the campaign was created.';

COMMENT ON TABLE public.enterprise_concierge_requests IS
  'Brand-owned requests for high-touch Concierge sourcing quotes before any custom campaign workspace is created.';
