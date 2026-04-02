-- ============================================================
-- 016_public_apply_rls.sql
-- Allow anonymous (unauthenticated) SELECT on campaigns,
-- profiles, and brand_profiles so the public apply page
-- at /apply/[id] can load campaign details without auth.
-- ============================================================

-- Anonymous users can read non-draft campaigns (for public apply page)
CREATE POLICY campaigns_select_public_recruiting ON campaigns
  FOR SELECT USING (status != 'draft');

-- Anonymous users can read approved profiles (needed for brand name join)
CREATE POLICY profiles_select_public_approved ON profiles
  FOR SELECT USING (status = 'approved');

-- Anonymous users can read brand profiles (needed for company info join)
CREATE POLICY brand_profiles_select_public ON brand_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = brand_profiles.profile_id
        AND profiles.status = 'approved'
    )
  );
