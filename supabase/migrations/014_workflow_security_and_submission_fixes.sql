-- ============================================================
-- 014_workflow_security_and_submission_fixes.sql
-- Align workflow actions with RLS and add missing submission metadata.
-- ============================================================

-- Track when a submission was actually published so measurement windows are stable.
ALTER TABLE content_submissions
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE content_submissions
   SET published_at = COALESCE(published_at, reviewed_at, submitted_at, updated_at, created_at)
 WHERE status = 'published'
   AND published_url IS NOT NULL
   AND published_at IS NULL;

COMMENT ON COLUMN content_submissions.published_at IS
  'Timestamp when the creator marked the submission as published.';

-- Check whether the current user can apply to a campaign.
CREATE OR REPLACE FUNCTION public.can_apply_to_campaign(campaign_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM campaigns
     WHERE id = campaign_uuid
       AND status = 'recruiting'
       AND (application_deadline IS NULL OR application_deadline >= now())
       AND brand_id <> auth.uid()
  );
$$;

-- Check whether the current user can review a specific campaign counterparty.
CREATE OR REPLACE FUNCTION public.can_review_campaign_participant(
  campaign_uuid uuid,
  reviewee_uuid uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM campaigns c
     WHERE c.id = campaign_uuid
       AND reviewee_uuid <> auth.uid()
       AND (
         (
           c.brand_id = auth.uid()
           AND EXISTS (
             SELECT 1
               FROM campaign_members cm
              WHERE cm.campaign_id = c.id
                AND cm.creator_id = reviewee_uuid
           )
         )
         OR
         (
           c.brand_id = reviewee_uuid
           AND EXISTS (
             SELECT 1
               FROM campaign_members cm
              WHERE cm.campaign_id = c.id
                AND cm.creator_id = auth.uid()
           )
         )
       )
  );
$$;

DROP POLICY IF EXISTS campaign_applications_insert_creator ON campaign_applications;
CREATE POLICY campaign_applications_insert_creator ON campaign_applications
  FOR INSERT WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM profiles
       WHERE id = auth.uid()
         AND role = 'creator'
    )
    AND public.can_apply_to_campaign(campaign_id)
  );

DROP POLICY IF EXISTS campaign_applications_update_own ON campaign_applications;
CREATE POLICY campaign_applications_update_own ON campaign_applications
  FOR UPDATE
  USING (
    creator_id = auth.uid()
    AND status IN ('pending', 'counter_offer')
  )
  WITH CHECK (
    creator_id = auth.uid()
    AND status = 'withdrawn'
  );

DROP POLICY IF EXISTS reviews_insert_authenticated ON reviews;
CREATE POLICY reviews_insert_authenticated ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND auth.uid() IS NOT NULL
    AND public.can_review_campaign_participant(campaign_id, reviewee_id)
  );

DROP POLICY IF EXISTS content_performance_update_creator ON content_performance;
CREATE POLICY content_performance_update_creator ON content_performance
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
        FROM content_submissions
        JOIN campaign_members
          ON campaign_members.id = content_submissions.campaign_member_id
       WHERE content_submissions.id = content_performance.submission_id
         AND campaign_members.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM content_submissions
        JOIN campaign_members
          ON campaign_members.id = content_submissions.campaign_member_id
       WHERE content_submissions.id = content_performance.submission_id
         AND campaign_members.creator_id = auth.uid()
    )
  );
