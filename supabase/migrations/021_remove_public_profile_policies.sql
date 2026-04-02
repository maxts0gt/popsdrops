-- ============================================================
-- 021_remove_public_profile_policies.sql
-- Remove anonymous profile access used by the old public apply flow.
-- Public campaign pages now fetch a server-curated payload instead.
-- ============================================================

DROP POLICY IF EXISTS profiles_select_public_approved ON profiles;
DROP POLICY IF EXISTS brand_profiles_select_public ON brand_profiles;
