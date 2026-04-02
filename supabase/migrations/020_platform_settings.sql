-- Platform settings key-value store
-- Used by admin settings page for configurable platform rules

CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY platform_settings_select ON platform_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can modify
CREATE POLICY platform_settings_update ON platform_settings
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY platform_settings_insert ON platform_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Seed default settings
INSERT INTO platform_settings (key, value) VALUES
  ('enabled_markets', '["us","gb","ae","sa","kw","qa","bh","om","eg","jo","ma","iq","tr","kz","uz","de","fr","nl","se","jp","kr","id","my","th","ph","vn","br","mx","ng","ke"]'::jsonb),
  ('creator_min_followers', '500'::jsonb),
  ('auto_approve_creators', 'false'::jsonb),
  ('max_revisions_per_submission', '3'::jsonb),
  ('sla_approval_hours', '24'::jsonb);
