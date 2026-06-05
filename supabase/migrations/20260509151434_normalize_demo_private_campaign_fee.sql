UPDATE public.campaigns
SET
  campaign_mode = 'private',
  creator_sourcing_required = false,
  service_fee_cents = 14900,
  service_fee_currency = 'usd',
  service_package_snapshot = '{
    "mode": "private",
    "feeCents": 14900,
    "currency": "usd",
    "creatorSourcingRequired": false,
    "requiresCustomPricing": false,
    "tierKey": "workspace",
    "includedCreatorCount": 10,
    "includedActiveDays": 45,
    "includedReportingDays": 14,
    "estimatedMaxCreators": 5,
    "estimatedMarketCount": 2,
    "estimatedActiveDays": 9,
    "estimatedReportingDays": 3,
    "creatorOverageBlocks": 0,
    "activeDayOverageBlocks": 0,
    "reportingDayOverageBlocks": 0,
    "overageFeeCents": 0,
    "scopeKeys": [
      "mode.private.scope.workspace",
      "mode.private.scope.invite",
      "mode.private.scope.report"
    ]
  }'::jsonb
WHERE id = '4707edb5-dcab-4b2d-b5eb-7e79f0e1f010'
  AND title = 'K-Beauty Retail Launch'
  AND campaign_mode = 'sourced'
  AND service_fee_cents = 49900;
