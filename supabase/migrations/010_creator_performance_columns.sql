-- ============================================================
-- 010_creator_performance_columns.sql
-- Add aggregated performance columns to creator_profiles
-- so brands can see key metrics in discovery without joins.
-- ============================================================

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS total_views bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_engagements bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_engagement_rate numeric DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN creator_profiles.total_views IS 'Aggregated views across all campaign content_performance records';
COMMENT ON COLUMN creator_profiles.total_engagements IS 'Aggregated engagements (likes+comments+shares+saves) across all campaigns';
COMMENT ON COLUMN creator_profiles.avg_engagement_rate IS 'Average engagement rate = total_engagements / total_views * 100';
