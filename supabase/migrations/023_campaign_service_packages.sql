CREATE TYPE campaign_mode_type AS ENUM ('private', 'sourced');

ALTER TABLE campaigns
  ADD COLUMN campaign_mode campaign_mode_type NOT NULL DEFAULT 'sourced',
  ADD COLUMN creator_sourcing_required boolean NOT NULL DEFAULT true,
  ADD COLUMN service_fee_cents integer NOT NULL DEFAULT 49900 CHECK (service_fee_cents >= 0),
  ADD COLUMN service_fee_currency text NOT NULL DEFAULT 'usd' CHECK (service_fee_currency = lower(service_fee_currency)),
  ADD COLUMN service_fee_status payment_status_type NOT NULL DEFAULT 'pending',
  ADD COLUMN service_package_snapshot jsonb NOT NULL DEFAULT '{"mode":"sourced","feeCents":49900,"currency":"usd","creatorSourcingRequired":true,"scopeKeys":[]}'::jsonb;

CREATE INDEX idx_campaigns_campaign_mode ON campaigns(campaign_mode);
CREATE INDEX idx_campaigns_service_fee_status ON campaigns(service_fee_status);

COMMENT ON COLUMN campaigns.campaign_mode IS 'PopsDrops operating model: private means brand brings creators; sourced means PopsDrops helps source creators.';
COMMENT ON COLUMN campaigns.creator_sourcing_required IS 'True when PopsDrops sourcing work is part of the campaign service package.';
COMMENT ON COLUMN campaigns.service_fee_cents IS 'PopsDrops platform service fee in minor currency units, derived server-side from campaign_mode at creation time.';
COMMENT ON COLUMN campaigns.service_fee_status IS 'Payment status for PopsDrops platform service fee. This does not represent creator payout handling.';
COMMENT ON COLUMN campaigns.service_package_snapshot IS 'Immutable launch package details captured when the campaign was created.';
