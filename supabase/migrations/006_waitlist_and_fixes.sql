-- ============================================================
-- 006_waitlist_and_fixes.sql
-- Waitlist table, missing columns, vector indexes, constraints
-- ============================================================

-- ============================================================
-- 1. WAITLIST TABLE — pre-auth interest form for brands + creators
-- ============================================================

CREATE TABLE waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('brand', 'creator')),
  -- Contact
  email text NOT NULL,
  full_name text NOT NULL,
  -- Brand fields
  company_name text,
  industry text,
  website text,
  budget_range text,
  -- Creator fields
  social_url text,
  social_platform platform_type,
  follower_range text,
  -- Shared
  markets text[] DEFAULT '{}',
  reason text,
  referral_source text,
  -- Review workflow
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(email)
);

-- Indexes
CREATE INDEX idx_waitlist_status ON waitlist(status) WHERE status = 'pending';
CREATE INDEX idx_waitlist_email ON waitlist(email);
CREATE INDEX idx_waitlist_type ON waitlist(type);

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON waitlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Public can submit (Turnstile-protected in the app layer)
CREATE POLICY waitlist_insert_public ON waitlist
  FOR INSERT WITH CHECK (true);

-- Admin can read all
CREATE POLICY waitlist_select_admin ON waitlist
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- Admin can update (approve/reject)
CREATE POLICY waitlist_update_admin ON waitlist
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ============================================================
-- 2. MISSING COLUMNS
-- ============================================================

-- profiles: track when a user was approved
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- profiles: track who approved them
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id);

-- playbooks: control visibility
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS published boolean DEFAULT true;

-- creator_profiles: derived platforms array for index-backed filtering
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS platforms platform_type[] DEFAULT '{}';

-- content_submissions: link to which deliverable this fulfills
ALTER TABLE content_submissions ADD COLUMN IF NOT EXISTS deliverable_id uuid REFERENCES campaign_deliverables(id);

-- ============================================================
-- 3. VECTOR INDEXES (HNSW) — critical for AI matching
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_creator_profiles_embedding
  ON creator_profiles USING hnsw (profile_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_campaigns_embedding
  ON campaigns USING hnsw (campaign_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 4. TRIGRAM INDEXES — fuzzy search
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_creator_profiles_slug_trgm
  ON creator_profiles USING GIN (slug gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_bio_trgm
  ON creator_profiles USING GIN (bio gin_trgm_ops);

-- ============================================================
-- 5. PLATFORMS ARRAY INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_creator_profiles_platforms
  ON creator_profiles USING GIN (platforms);

-- ============================================================
-- 6. UNIQUE CONSTRAINT — prevent duplicate performance measurements
-- ============================================================

ALTER TABLE content_performance
  ADD CONSTRAINT uq_performance_submission_measurement
  UNIQUE (submission_id, measurement_type);

-- ============================================================
-- 7. PLATFORMS SYNC TRIGGER
-- Auto-populate creator_profiles.platforms from social JSONB columns
-- ============================================================

CREATE OR REPLACE FUNCTION sync_creator_platforms()
RETURNS trigger AS $$
BEGIN
  NEW.platforms := ARRAY[]::platform_type[];
  IF NEW.tiktok IS NOT NULL THEN
    NEW.platforms := NEW.platforms || 'tiktok'::platform_type;
  END IF;
  IF NEW.instagram IS NOT NULL THEN
    NEW.platforms := NEW.platforms || 'instagram'::platform_type;
  END IF;
  IF NEW.snapchat IS NOT NULL THEN
    NEW.platforms := NEW.platforms || 'snapchat'::platform_type;
  END IF;
  IF NEW.youtube IS NOT NULL THEN
    NEW.platforms := NEW.platforms || 'youtube'::platform_type;
  END IF;
  IF NEW.facebook IS NOT NULL THEN
    NEW.platforms := NEW.platforms || 'facebook'::platform_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_creator_platforms_trigger
  BEFORE INSERT OR UPDATE ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_creator_platforms();

-- ============================================================
-- 8. MAX REVISIONS ENFORCEMENT
-- Prevent content submissions exceeding campaign max_revisions
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_max_revisions()
RETURNS trigger AS $$
DECLARE
  _max_revisions integer;
  _current_count integer;
BEGIN
  -- Only enforce on revisions (not initial submissions)
  IF NEW.parent_submission_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.max_revisions INTO _max_revisions
    FROM campaigns c
    JOIN campaign_members cm ON cm.campaign_id = c.id
   WHERE cm.id = NEW.campaign_member_id;

  SELECT COUNT(*) INTO _current_count
    FROM content_submissions
   WHERE campaign_member_id = NEW.campaign_member_id
     AND parent_submission_id IS NOT NULL;

  IF _current_count >= COALESCE(_max_revisions, 3) THEN
    RAISE EXCEPTION 'Maximum revisions (%) reached for this campaign', _max_revisions;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_max_revisions
  BEFORE INSERT ON content_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_max_revisions();

-- ============================================================
-- 9. NOTIFICATION TYPE: waitlist_approved
-- Add to enum for the approval email flow
-- ============================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'waitlist_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'waitlist_rejected';
