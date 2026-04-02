-- ============================================================
-- 011_social_connections.sql
-- OAuth token storage for social platform connections.
-- Enables auto-fetching post metrics from Instagram, TikTok,
-- YouTube, and Snapchat via platform APIs.
-- ============================================================

-- Connection status
CREATE TYPE social_connection_status AS ENUM ('active', 'expired', 'revoked', 'error');

-- Social connections table
CREATE TABLE social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,

  -- Platform identity (verified from API)
  platform_user_id text NOT NULL,
  platform_username text,
  platform_display_name text,
  platform_avatar_url text,

  -- OAuth tokens — AES-256-GCM encrypted at application layer.
  -- Decryption key lives only in SOCIAL_TOKEN_ENCRYPTION_KEY env var.
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,

  -- OAuth metadata
  scopes text[] DEFAULT '{}',
  status social_connection_status DEFAULT 'active',
  error_message text,

  -- Refresh tracking
  last_refreshed_at timestamptz,
  refresh_failures integer DEFAULT 0,

  -- Follower count snapshot (verified from API, not self-reported)
  followers_count integer,
  followers_updated_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- One connection per platform per user
  UNIQUE (profile_id, platform)
);

-- Indexes
CREATE INDEX idx_social_connections_profile ON social_connections(profile_id);
CREATE INDEX idx_social_connections_expiry ON social_connections(token_expires_at)
  WHERE status = 'active';

-- RLS
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_connections_select_own ON social_connections
  FOR SELECT USING (profile_id = (SELECT auth.uid()));

CREATE POLICY social_connections_insert_own ON social_connections
  FOR INSERT WITH CHECK (profile_id = (SELECT auth.uid()));

CREATE POLICY social_connections_update_own ON social_connections
  FOR UPDATE USING (profile_id = (SELECT auth.uid()));

CREATE POLICY social_connections_delete_own ON social_connections
  FOR DELETE USING (profile_id = (SELECT auth.uid()));

-- Admin access
CREATE POLICY social_connections_admin_select ON social_connections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON social_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Extend content_performance with data source tracking
-- ============================================================

ALTER TABLE content_performance
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual'
    CHECK (data_source IN ('manual', 'api', 'api_partial'));

COMMENT ON COLUMN content_performance.data_source IS
  'manual = creator self-reported, api = auto-fetched from platform API, api_partial = mix';

-- ============================================================
-- Extend content_submissions with parsed post ID for API lookups
-- ============================================================

ALTER TABLE content_submissions
  ADD COLUMN IF NOT EXISTS platform_post_id text;

COMMENT ON COLUMN content_submissions.platform_post_id IS
  'Extracted from published_url. Used to fetch metrics via platform API.';
