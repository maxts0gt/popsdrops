-- Admin audit log: append-only for authenticated app users under RLS.
-- Service-role and table-owner access can still bypass RLS at the database level.

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,  -- 'approve_profile', 'reject_profile', 'suspend_user', 'unsuspend_user', 'pause_campaign', 'cancel_campaign', 'resume_campaign'
  target_type TEXT NOT NULL,  -- 'profile', 'campaign'
  target_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',  -- reason, target_name, target_role, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: append-only for admins
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_insert ON admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY admin_audit_log_select ON admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No UPDATE or DELETE policies for authenticated app users.

-- Indexes
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);

-- Add missing notification types for campaign lifecycle
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_paused';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_cancelled';
