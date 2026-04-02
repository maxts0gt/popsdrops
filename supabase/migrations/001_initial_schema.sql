-- ============================================================
-- 001_initial_schema.sql
-- PopsDrops: tables, enums, triggers, indexes, extensions
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('creator', 'brand', 'admin');
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE campaign_status AS ENUM ('draft', 'recruiting', 'in_progress', 'publishing', 'monitoring', 'completed', 'paused', 'cancelled');
CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn', 'counter_offer');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'approved', 'revision_requested', 'published');
CREATE TYPE platform_type AS ENUM ('tiktok', 'instagram', 'snapchat', 'youtube', 'facebook');
CREATE TYPE notification_type AS ENUM (
  'account_approved', 'account_rejected',
  'campaign_match',
  'application_received', 'application_accepted', 'application_rejected', 'counter_offer',
  'content_submitted', 'content_approved', 'revision_requested',
  'new_message',
  'campaign_completed',
  'review_received',
  'content_due_soon',
  'payment_sent', 'payment_received',
  'tier_upgrade'
);
CREATE TYPE payment_status_type AS ENUM ('pending', 'invoiced', 'paid', 'overdue');
CREATE TYPE creator_tier AS ENUM ('new', 'rising', 'established', 'top');
CREATE TYPE measurement_type AS ENUM ('initial_48h', 'final_7d', 'extended_30d');

-- ============================================================
-- TABLES
-- ============================================================

-- 1. profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  email text NOT NULL,
  status user_status DEFAULT 'pending',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. creator_profiles
CREATE TABLE creator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  bio text,
  primary_market text,
  tiktok jsonb,
  instagram jsonb,
  snapchat jsonb,
  youtube jsonb,
  facebook jsonb,
  niches text[] DEFAULT '{}',
  markets text[] DEFAULT '{}',
  languages text[] DEFAULT '{}',
  content_formats text[] DEFAULT '{}',
  rate_card jsonb,
  rate_currency text DEFAULT 'USD',
  rating numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  campaigns_completed integer DEFAULT 0,
  completion_rate numeric DEFAULT 0,
  avg_response_time_hours numeric,
  tier creator_tier DEFAULT 'new',
  tier_evaluated_at timestamptz,
  ranking_score numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  profile_completeness numeric DEFAULT 0,
  profile_embedding vector(1536),
  search_vector tsvector,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. brand_profiles
CREATE TABLE brand_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  industry text,
  target_markets text[] DEFAULT '{}',
  platforms text[] DEFAULT '{}',
  website text,
  logo_url text,
  description text,
  budget_range text,
  contact_name text,
  contact_email text,
  contact_phone text,
  preferred_language text DEFAULT 'en',
  rating numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. playbooks
CREATE TABLE playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  defaults jsonb NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. campaigns
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES profiles(id),
  playbook_id uuid REFERENCES playbooks(id),
  title text NOT NULL,
  brief_description text,
  brief_requirements text,
  brief_dos text,
  brief_donts text,
  brief_translated jsonb,
  platforms platform_type[] DEFAULT '{}',
  markets text[] DEFAULT '{}',
  niches text[] DEFAULT '{}',
  budget_min numeric,
  budget_max numeric,
  budget_currency text DEFAULT 'USD',
  max_creators integer,
  status campaign_status DEFAULT 'draft',
  application_deadline timestamptz,
  content_due_date timestamptz,
  posting_window_start timestamptz,
  posting_window_end timestamptz,
  monitoring_end_date timestamptz,
  usage_rights_duration text,
  usage_rights_territory text,
  usage_rights_paid_ads boolean DEFAULT false,
  max_revisions integer DEFAULT 3,
  compliance_notes text,
  campaign_embedding vector(1536),
  report_data jsonb,
  target_reach integer,
  target_engagement_rate numeric,
  total_spend numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 6. campaign_deliverables
CREATE TABLE campaign_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  content_type text NOT NULL,
  quantity integer DEFAULT 1,
  notes text,
  deadline timestamptz
);

-- 7. campaign_applications
CREATE TABLE campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES profiles(id),
  proposed_rate numeric,
  pitch text,
  status application_status DEFAULT 'pending',
  counter_rate numeric,
  counter_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, creator_id)
);

-- 8. campaign_members
CREATE TABLE campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES profiles(id),
  accepted_rate numeric,
  payment_status payment_status_type DEFAULT 'pending',
  payment_confirmed_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, creator_id)
);

-- 9. content_submissions
CREATE TABLE content_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_member_id uuid NOT NULL REFERENCES campaign_members(id) ON DELETE CASCADE,
  content_url text,
  caption text,
  platform platform_type,
  status submission_status DEFAULT 'draft',
  feedback text,
  version integer DEFAULT 1,
  parent_submission_id uuid REFERENCES content_submissions(id),
  revision_count integer DEFAULT 0,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. content_performance
CREATE TABLE content_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  measurement_type measurement_type NOT NULL,
  views integer,
  reach integer,
  impressions integer,
  likes integer,
  reactions jsonb,
  comments integer,
  shares integer,
  saves integer,
  sends integer,
  screenshots integer,
  replies integer,
  clicks integer,
  completion_rate numeric,
  avg_watch_time_seconds numeric,
  subscriber_gains integer,
  screenshot_url text,
  reported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 11. campaign_messages
CREATE TABLE campaign_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 12. reviews
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  reviewee_id uuid NOT NULL REFERENCES profiles(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, reviewer_id, reviewee_id)
);

-- 13. notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text,
  read boolean DEFAULT false,
  data jsonb,
  created_at timestamptz DEFAULT now()
);

-- 14. notification_queue
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id),
  email text NOT NULL,
  template text NOT NULL,
  data jsonb,
  priority text DEFAULT 'batched' CHECK (priority IN ('immediate', 'batched')),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 15. market_benchmarks
CREATE TABLE market_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL,
  platform platform_type NOT NULL,
  content_format text NOT NULL,
  follower_tier creator_tier NOT NULL,
  niche text NOT NULL,
  avg_engagement_rate numeric,
  avg_views integer,
  avg_cpe numeric,
  avg_rate_usd numeric,
  p25_rate numeric,
  p75_rate numeric,
  sample_size integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (market, platform, content_format, follower_tier, niche)
);

-- 16. cultural_calendar
CREATE TABLE cultural_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL,
  event_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  marketing_notes text,
  year integer NOT NULL
);

-- 17. market_compliance
CREATE TABLE market_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market text NOT NULL,
  requirement_title text NOT NULL,
  description text,
  severity text DEFAULT 'advisory' CHECK (severity IN ('required', 'advisory')),
  registration_url text,
  updated_at timestamptz DEFAULT now()
);

-- 18. function_execution_log
CREATE TABLE function_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  duration_ms integer,
  error_message text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- campaigns
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_brand_id ON campaigns(brand_id);

-- campaign_applications
CREATE INDEX idx_campaign_applications_campaign_status ON campaign_applications(campaign_id, status);
CREATE INDEX idx_campaign_applications_creator ON campaign_applications(creator_id);

-- campaign_members
CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_creator ON campaign_members(creator_id);

-- creator_profiles
CREATE INDEX idx_creator_profiles_slug ON creator_profiles(slug);
CREATE INDEX idx_creator_profiles_niches ON creator_profiles USING GIN (niches);
CREATE INDEX idx_creator_profiles_markets ON creator_profiles USING GIN (markets);
CREATE INDEX idx_creator_profiles_search_vector ON creator_profiles USING GIN (search_vector);

-- campaign_messages
CREATE INDEX idx_campaign_messages_campaign_created ON campaign_messages(campaign_id, created_at);

-- notifications
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read, created_at DESC);

-- notification_queue
CREATE INDEX idx_notification_queue_unprocessed ON notification_queue(processed_at) WHERE processed_at IS NULL;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON brand_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaign_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON content_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON market_compliance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON market_benchmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- handle_new_user: create profile row on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'creator'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- update_creator_rating: recalculate avg rating after new review
CREATE OR REPLACE FUNCTION update_creator_rating()
RETURNS trigger AS $$
DECLARE
  _avg numeric;
  _count integer;
BEGIN
  SELECT AVG(rating), COUNT(*)
    INTO _avg, _count
    FROM reviews
   WHERE reviewee_id = NEW.reviewee_id;

  UPDATE creator_profiles
     SET rating = COALESCE(_avg, 0),
         review_count = _count
   WHERE profile_id = NEW.reviewee_id;

  -- Also update brand_profiles in case the reviewee is a brand
  UPDATE brand_profiles
     SET rating = COALESCE(_avg, 0),
         review_count = _count
   WHERE profile_id = NEW.reviewee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_created
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_creator_rating();

-- queue_notification_email: insert into notification_queue on new notification
CREATE OR REPLACE FUNCTION queue_notification_email()
RETURNS trigger AS $$
DECLARE
  _email text;
  _priority text;
BEGIN
  SELECT email INTO _email FROM profiles WHERE id = NEW.user_id;

  -- Messages are batched, everything else is immediate
  IF NEW.type = 'new_message' THEN
    _priority := 'batched';
  ELSE
    _priority := 'immediate';
  END IF;

  INSERT INTO notification_queue (notification_id, email, template, data, priority)
  VALUES (
    NEW.id,
    _email,
    NEW.type::text,
    jsonb_build_object('title', NEW.title, 'body', NEW.body, 'data', NEW.data),
    _priority
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION queue_notification_email();

-- Update search_vector on creator_profiles
CREATE OR REPLACE FUNCTION update_creator_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.slug, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.niches, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.markets, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.languages, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_creator_search_vector
  BEFORE INSERT OR UPDATE ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION update_creator_search_vector();

-- ============================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- ============================================================

-- Check if current user is a member of a campaign
CREATE OR REPLACE FUNCTION is_campaign_member(campaign_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_id = campaign_uuid
      AND creator_id = (SELECT auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is the brand that owns a campaign
CREATE OR REPLACE FUNCTION is_campaign_brand(campaign_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM campaigns
    WHERE id = campaign_uuid
      AND brand_id = (SELECT auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
