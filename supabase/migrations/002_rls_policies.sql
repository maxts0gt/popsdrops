-- ============================================================
-- 002_rls_policies.sql
-- PopsDrops: Row Level Security policies for all tables
-- ============================================================

-- Enable RLS on every table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultural_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE function_execution_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================

-- Users can see their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

-- Users can see approved profiles
CREATE POLICY profiles_select_approved ON profiles
  FOR SELECT USING (status = 'approved');

-- Users can update their own profile
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = (SELECT auth.uid()));

-- Admin can see all profiles
CREATE POLICY profiles_admin_select ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- Admin can update any profile (for approvals)
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CREATOR_PROFILES
-- ============================================================

-- Anyone authenticated can view approved creator profiles (for /explore, /c/[slug])
CREATE POLICY creator_profiles_select_approved ON creator_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = creator_profiles.profile_id AND status = 'approved')
  );

-- Creators can see their own profile even if not approved
CREATE POLICY creator_profiles_select_own ON creator_profiles
  FOR SELECT USING (profile_id = (SELECT auth.uid()));

-- Creator can update their own profile
CREATE POLICY creator_profiles_update_own ON creator_profiles
  FOR UPDATE USING (profile_id = (SELECT auth.uid()));

-- Creator can insert their own profile
CREATE POLICY creator_profiles_insert_own ON creator_profiles
  FOR INSERT WITH CHECK (profile_id = (SELECT auth.uid()));

-- Admin can see all creator profiles
CREATE POLICY creator_profiles_admin_select ON creator_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- Admin can update any creator profile
CREATE POLICY creator_profiles_admin_update ON creator_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- BRAND_PROFILES
-- ============================================================

-- Any authenticated user can view brand profiles
CREATE POLICY brand_profiles_select_authenticated ON brand_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Brand can update their own profile
CREATE POLICY brand_profiles_update_own ON brand_profiles
  FOR UPDATE USING (profile_id = (SELECT auth.uid()));

-- Brand can insert their own profile
CREATE POLICY brand_profiles_insert_own ON brand_profiles
  FOR INSERT WITH CHECK (profile_id = (SELECT auth.uid()));

-- Admin can see all brand profiles
CREATE POLICY brand_profiles_admin_select ON brand_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- Admin can update any brand profile
CREATE POLICY brand_profiles_admin_update ON brand_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- PLAYBOOKS
-- ============================================================

-- Any authenticated user can view playbooks
CREATE POLICY playbooks_select_authenticated ON playbooks
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin full access
CREATE POLICY playbooks_admin_all ON playbooks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CAMPAIGNS
-- ============================================================

-- Anyone authenticated can see non-draft campaigns
CREATE POLICY campaigns_select_published ON campaigns
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND status != 'draft'
  );

-- Brand can see their own draft campaigns
CREATE POLICY campaigns_select_own_drafts ON campaigns
  FOR SELECT USING (brand_id = (SELECT auth.uid()));

-- Brand role can create campaigns
CREATE POLICY campaigns_insert_brand ON campaigns
  FOR INSERT WITH CHECK (
    brand_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'brand')
  );

-- Brand can update their own campaigns
CREATE POLICY campaigns_update_own ON campaigns
  FOR UPDATE USING (brand_id = (SELECT auth.uid()));

-- Admin can see all campaigns
CREATE POLICY campaigns_admin_select ON campaigns
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- Admin can update any campaign
CREATE POLICY campaigns_admin_update ON campaigns
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CAMPAIGN_DELIVERABLES
-- ============================================================

-- Anyone who can see the campaign can see deliverables
CREATE POLICY campaign_deliverables_select ON campaign_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_deliverables.campaign_id
        AND (campaigns.status != 'draft' OR campaigns.brand_id = (SELECT auth.uid()))
    )
  );

-- Brand can manage deliverables for their campaigns
CREATE POLICY campaign_deliverables_insert_brand ON campaign_deliverables
  FOR INSERT WITH CHECK (is_campaign_brand(campaign_id));

CREATE POLICY campaign_deliverables_update_brand ON campaign_deliverables
  FOR UPDATE USING (is_campaign_brand(campaign_id));

CREATE POLICY campaign_deliverables_delete_brand ON campaign_deliverables
  FOR DELETE USING (is_campaign_brand(campaign_id));

-- Admin full access
CREATE POLICY campaign_deliverables_admin ON campaign_deliverables
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CAMPAIGN_APPLICATIONS
-- ============================================================

-- Brand can see applications for their campaigns
CREATE POLICY campaign_applications_select_brand ON campaign_applications
  FOR SELECT USING (is_campaign_brand(campaign_id));

-- Creator can see their own applications
CREATE POLICY campaign_applications_select_own ON campaign_applications
  FOR SELECT USING (creator_id = (SELECT auth.uid()));

-- Creator role can apply to campaigns
CREATE POLICY campaign_applications_insert_creator ON campaign_applications
  FOR INSERT WITH CHECK (
    creator_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'creator')
  );

-- Brand can update application status (accept/reject/counter)
CREATE POLICY campaign_applications_update_brand ON campaign_applications
  FOR UPDATE USING (is_campaign_brand(campaign_id));

-- Creator can update their own application (withdraw)
CREATE POLICY campaign_applications_update_own ON campaign_applications
  FOR UPDATE USING (creator_id = (SELECT auth.uid()));

-- Admin full access
CREATE POLICY campaign_applications_admin ON campaign_applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CAMPAIGN_MEMBERS
-- ============================================================

-- Brand can see members of their campaigns
CREATE POLICY campaign_members_select_brand ON campaign_members
  FOR SELECT USING (is_campaign_brand(campaign_id));

-- Creator can see their own memberships
CREATE POLICY campaign_members_select_own ON campaign_members
  FOR SELECT USING (creator_id = (SELECT auth.uid()));

-- No direct INSERT for users — service role only (via accept application flow)
-- Brand can update payment status
CREATE POLICY campaign_members_update_brand ON campaign_members
  FOR UPDATE USING (is_campaign_brand(campaign_id));

-- Admin full access
CREATE POLICY campaign_members_admin ON campaign_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CONTENT_SUBMISSIONS
-- ============================================================

-- Creator can see their own submissions (via campaign_member)
CREATE POLICY content_submissions_select_creator ON content_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.id = content_submissions.campaign_member_id
        AND campaign_members.creator_id = (SELECT auth.uid())
    )
  );

-- Brand can see submissions for their campaigns
CREATE POLICY content_submissions_select_brand ON content_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      JOIN campaigns ON campaigns.id = campaign_members.campaign_id
      WHERE campaign_members.id = content_submissions.campaign_member_id
        AND campaigns.brand_id = (SELECT auth.uid())
    )
  );

-- Creator can insert submissions for their memberships
CREATE POLICY content_submissions_insert_creator ON content_submissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.id = content_submissions.campaign_member_id
        AND campaign_members.creator_id = (SELECT auth.uid())
    )
  );

-- Creator can update their own submissions (content_url, caption, status to submitted)
CREATE POLICY content_submissions_update_creator ON content_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_members.id = content_submissions.campaign_member_id
        AND campaign_members.creator_id = (SELECT auth.uid())
    )
  );

-- Brand can update submissions (approve, request revision, feedback)
CREATE POLICY content_submissions_update_brand ON content_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM campaign_members
      JOIN campaigns ON campaigns.id = campaign_members.campaign_id
      WHERE campaign_members.id = content_submissions.campaign_member_id
        AND campaigns.brand_id = (SELECT auth.uid())
    )
  );

-- Admin full access
CREATE POLICY content_submissions_admin ON content_submissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CONTENT_PERFORMANCE
-- ============================================================

-- Creator can see performance for their submissions
CREATE POLICY content_performance_select_creator ON content_performance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_submissions
      JOIN campaign_members ON campaign_members.id = content_submissions.campaign_member_id
      WHERE content_submissions.id = content_performance.submission_id
        AND campaign_members.creator_id = (SELECT auth.uid())
    )
  );

-- Brand can see performance for their campaign submissions
CREATE POLICY content_performance_select_brand ON content_performance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_submissions
      JOIN campaign_members ON campaign_members.id = content_submissions.campaign_member_id
      JOIN campaigns ON campaigns.id = campaign_members.campaign_id
      WHERE content_submissions.id = content_performance.submission_id
        AND campaigns.brand_id = (SELECT auth.uid())
    )
  );

-- Creator can insert performance data
CREATE POLICY content_performance_insert_creator ON content_performance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_submissions
      JOIN campaign_members ON campaign_members.id = content_submissions.campaign_member_id
      WHERE content_submissions.id = content_performance.submission_id
        AND campaign_members.creator_id = (SELECT auth.uid())
    )
  );

-- Admin full access
CREATE POLICY content_performance_admin ON content_performance
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CAMPAIGN_MESSAGES
-- ============================================================

-- Campaign members and brand can see messages
CREATE POLICY campaign_messages_select_member ON campaign_messages
  FOR SELECT USING (
    is_campaign_member(campaign_id) OR is_campaign_brand(campaign_id)
  );

-- Campaign members and brand can send messages
CREATE POLICY campaign_messages_insert_member ON campaign_messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (is_campaign_member(campaign_id) OR is_campaign_brand(campaign_id))
  );

-- Admin full access
CREATE POLICY campaign_messages_admin ON campaign_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- REVIEWS
-- ============================================================

-- Any authenticated user can see reviews
CREATE POLICY reviews_select_authenticated ON reviews
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Authenticated users can create reviews (one per campaign per direction enforced by unique constraint)
CREATE POLICY reviews_insert_authenticated ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = (SELECT auth.uid())
    AND auth.uid() IS NOT NULL
  );

-- Admin full access
CREATE POLICY reviews_admin ON reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

-- Users can see their own notifications
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- Admin full access
CREATE POLICY notifications_admin ON notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- NOTIFICATION_QUEUE
-- ============================================================

-- No direct access for users — service role only
-- Admin can view for debugging
CREATE POLICY notification_queue_admin ON notification_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- MARKET_BENCHMARKS
-- ============================================================

CREATE POLICY market_benchmarks_select_authenticated ON market_benchmarks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY market_benchmarks_admin ON market_benchmarks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- CULTURAL_CALENDAR
-- ============================================================

CREATE POLICY cultural_calendar_select_authenticated ON cultural_calendar
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY cultural_calendar_admin ON cultural_calendar
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- MARKET_COMPLIANCE
-- ============================================================

CREATE POLICY market_compliance_select_authenticated ON market_compliance
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY market_compliance_admin ON market_compliance
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- FUNCTION_EXECUTION_LOG
-- ============================================================

-- Admin only
CREATE POLICY function_execution_log_admin ON function_execution_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
