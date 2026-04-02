-- ============================================================
-- 017_fix_public_apply_rls.sql
-- Broaden the public campaign policy to allow non-draft campaigns
-- (not just recruiting). Brands share invite links for recruiting
-- and in-progress campaigns alike.
-- ============================================================

-- Drop the recruiting-only policy and replace it with a broader non-draft one.
DROP POLICY IF EXISTS campaigns_select_public_recruiting ON campaigns;
CREATE POLICY campaigns_select_public_non_draft ON campaigns
  FOR SELECT USING (status != 'draft');

-- Anonymous users can read deliverables for non-draft campaigns
CREATE POLICY campaign_deliverables_select_public ON campaign_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_deliverables.campaign_id
        AND campaigns.status != 'draft'
    )
  );
