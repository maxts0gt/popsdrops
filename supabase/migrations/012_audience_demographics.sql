-- ============================================================
-- 012_audience_demographics.sql
-- Add audience demographics JSONB storage to social_connections.
-- Stores age, gender, and location breakdowns fetched from
-- platform APIs (Instagram insights, etc.).
-- ============================================================

ALTER TABLE social_connections
  ADD COLUMN IF NOT EXISTS audience_demographics jsonb DEFAULT NULL;

ALTER TABLE social_connections
  ADD COLUMN IF NOT EXISTS audience_demographics_updated_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN social_connections.audience_demographics IS
  'Audience breakdown: ageRanges, genderSplit, topCountries, topCities. Values are 0-1 ratios.';

COMMENT ON COLUMN social_connections.audience_demographics_updated_at IS
  'When audience_demographics was last fetched from the platform API.';
