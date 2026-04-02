-- ============================================================
-- 016_public_apply_rls.sql
-- Historically this migration exposed brand joins for the public apply page.
-- The page now uses a server-owned safe fetch path, so we do not expose
-- profile or brand_profile rows to anonymous clients.
-- ============================================================

-- Anonymous users can read non-draft campaigns (for public apply page)
CREATE POLICY campaigns_select_public_recruiting ON campaigns
  FOR SELECT USING (status != 'draft');
