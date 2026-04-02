-- ============================================================
-- 005_preferred_locale.sql
-- Add preferred_locale to profiles for language persistence
-- ============================================================

ALTER TABLE profiles ADD COLUMN preferred_locale text DEFAULT 'en';

-- Index for quick lookups
CREATE INDEX idx_profiles_locale ON profiles(preferred_locale);

COMMENT ON COLUMN profiles.preferred_locale IS 'User preferred UI language (ISO 639-1). Detected from browser on first visit, changeable in settings.';
