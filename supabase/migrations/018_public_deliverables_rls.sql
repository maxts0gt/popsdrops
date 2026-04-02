-- ============================================================
-- 018_public_deliverables_rls.sql
-- Allow anonymous read access to campaign deliverables for
-- non-draft campaigns (needed by public /apply/[id] page).
-- ============================================================

DROP POLICY IF EXISTS campaign_deliverables_select_public ON campaign_deliverables;
CREATE POLICY campaign_deliverables_select_public ON campaign_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_deliverables.campaign_id
        AND campaigns.status != 'draft'
    )
  );
