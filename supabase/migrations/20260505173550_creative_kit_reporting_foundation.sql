-- Creative Kit and reporting foundation.
-- This slice creates the protected data layer for campaign assets,
-- report obligations, missed-report states, and performance evidence.

CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id = auth.uid()
       AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_campaign_brand(campaign_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.campaigns
     WHERE id = campaign_uuid
       AND brand_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_campaign_member(campaign_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.campaign_members
     WHERE campaign_id = campaign_uuid
       AND creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_campaign_member_record(member_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.campaign_members
     WHERE id = member_uuid
       AND creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_submission_creator(submission_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.content_submissions submission
      JOIN public.campaign_members member
        ON member.id = submission.campaign_member_id
     WHERE submission.id = submission_uuid
       AND member.creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_performance_creator(performance_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.content_performance performance
      JOIN public.content_submissions submission
        ON submission.id = performance.submission_id
      JOIN public.campaign_members member
        ON member.id = submission.campaign_member_id
     WHERE performance.id = performance_uuid
       AND member.creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app_private.uuid_path_segment(
  object_name text,
  segment_number integer
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  raw_segment text;
BEGIN
  raw_segment := split_part(object_name, '/', segment_number);
  RETURN raw_segment::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.campaign_brief_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  title text NOT NULL,
  body text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'member',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_brief_blocks_block_type_check CHECK (
    block_type IN (
      'product_notes',
      'brand_vibe',
      'talking_points',
      'avoid_claims',
      'cta',
      'hashtags',
      'examples',
      'custom'
    )
  ),
  CONSTRAINT campaign_brief_blocks_visibility_check CHECK (
    visibility IN ('public', 'member', 'brand')
  )
);

COMMENT ON TABLE public.campaign_brief_blocks IS
  'Modular Creative Kit instructions used for creator guidance, review criteria, and report context.';

CREATE TABLE IF NOT EXISTS public.campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  description text,
  asset_type text NOT NULL,
  bucket_id text NOT NULL DEFAULT 'campaign-assets',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  visibility text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_assets_asset_type_check CHECK (
    asset_type IN (
      'product_image',
      'brand_guideline',
      'reference_video',
      'sell_sheet',
      'logo',
      'document',
      'other'
    )
  ),
  CONSTRAINT campaign_assets_visibility_check CHECK (
    visibility IN ('member', 'brand')
  ),
  CONSTRAINT campaign_assets_status_check CHECK (
    status IN ('uploading', 'ready', 'archived')
  ),
  CONSTRAINT campaign_assets_bucket_check CHECK (bucket_id = 'campaign-assets'),
  CONSTRAINT campaign_assets_size_check CHECK (size_bytes > 0),
  CONSTRAINT campaign_assets_storage_path_check CHECK (
    app_private.uuid_path_segment(storage_path, 1) = campaign_id
    AND app_private.uuid_path_segment(storage_path, 2) = id
  )
);

COMMENT ON TABLE public.campaign_assets IS
  'Private Creative Kit file metadata. Files are read through policy-protected signed URLs.';

CREATE TABLE IF NOT EXISTS public.campaign_reporting_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  cadence text NOT NULL DEFAULT 'final_only',
  required_evidence text[] NOT NULL DEFAULT ARRAY['post_url', 'manual_metrics', 'screenshot']::text[],
  required_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  grace_period_hours integer NOT NULL DEFAULT 24,
  starts_at timestamptz,
  ends_at timestamptz,
  custom_due_dates timestamptz[] NOT NULL DEFAULT '{}'::timestamptz[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_reporting_plans_cadence_check CHECK (
    cadence IN ('final_only', 'weekly', 'daily_launch_window', 'custom')
  ),
  CONSTRAINT campaign_reporting_plans_grace_check CHECK (
    grace_period_hours BETWEEN 0 AND 168
  ),
  CONSTRAINT campaign_reporting_plans_window_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
  )
);

COMMENT ON TABLE public.campaign_reporting_plans IS
  'Campaign proof contract that drives report tasks, reminders, and report completeness.';

CREATE TABLE IF NOT EXISTS public.campaign_report_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  campaign_member_id uuid NOT NULL REFERENCES public.campaign_members(id) ON DELETE CASCADE,
  task_key text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz,
  verified_at timestamptz,
  missed_at timestamptz,
  excused_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_report_tasks_status_check CHECK (
    status IN (
      'pending',
      'submitted',
      'submitted_late',
      'verified',
      'needs_revision',
      'missed',
      'excused'
    )
  ),
  CONSTRAINT campaign_report_tasks_period_check CHECK (
    period_start IS NULL OR period_end IS NULL OR period_start < period_end
  ),
  CONSTRAINT campaign_report_tasks_submitted_check CHECK (
    status NOT IN ('submitted', 'submitted_late', 'verified', 'needs_revision')
    OR submitted_at IS NOT NULL
  ),
  CONSTRAINT campaign_report_tasks_missed_check CHECK (
    status <> 'missed' OR missed_at IS NOT NULL
  ),
  CONSTRAINT campaign_report_tasks_excused_check CHECK (
    status <> 'excused' OR excused_at IS NOT NULL
  ),
  CONSTRAINT campaign_report_tasks_member_task_unique UNIQUE (
    campaign_member_id,
    task_key
  ),
  CONSTRAINT campaign_report_tasks_scope_unique UNIQUE (
    id,
    campaign_id,
    campaign_member_id
  )
);

COMMENT ON TABLE public.campaign_report_tasks IS
  'Per-creator reporting obligations generated from a campaign reporting plan.';
COMMENT ON COLUMN public.campaign_report_tasks.task_key IS
  'Stable generation key such as final, weekly:2026-05-01, daily:2026-05-07, or custom:<iso>.';

CREATE OR REPLACE FUNCTION app_private.is_report_task_creator(task_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.campaign_report_tasks task
      JOIN public.campaign_members member
        ON member.id = task.campaign_member_id
     WHERE task.id = task_uuid
       AND member.creator_id = auth.uid()
  );
$$;

ALTER TABLE public.content_performance
  ADD COLUMN IF NOT EXISTS report_task_id uuid REFERENCES public.campaign_report_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.content_performance
  DROP CONSTRAINT IF EXISTS content_performance_verification_status_check;

ALTER TABLE public.content_performance
  ADD CONSTRAINT content_performance_verification_status_check CHECK (
    verification_status IN (
      'submitted',
      'screenshot_verified',
      'brand_verified',
      'rejected'
    )
  );

COMMENT ON COLUMN public.content_performance.report_task_id IS
  'Optional link from metric numbers to the report task they satisfy.';
COMMENT ON COLUMN public.content_performance.verification_status IS
  'Trust label for report numbers: submitted, screenshot_verified, brand_verified, or rejected.';

CREATE TABLE IF NOT EXISTS public.content_performance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  campaign_member_id uuid NOT NULL REFERENCES public.campaign_members(id) ON DELETE CASCADE,
  report_task_id uuid NOT NULL REFERENCES public.campaign_report_tasks(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.content_submissions(id) ON DELETE CASCADE,
  performance_id uuid REFERENCES public.content_performance(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  evidence_type text NOT NULL,
  bucket_id text NOT NULL DEFAULT 'campaign-evidence',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  verification_status text NOT NULL DEFAULT 'submitted',
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_performance_evidence_task_scope_fkey FOREIGN KEY (
    report_task_id,
    campaign_id,
    campaign_member_id
  ) REFERENCES public.campaign_report_tasks (
    id,
    campaign_id,
    campaign_member_id
  ) ON DELETE CASCADE,
  CONSTRAINT content_performance_evidence_type_check CHECK (
    evidence_type IN ('screenshot', 'csv', 'analytics_export', 'document', 'other')
  ),
  CONSTRAINT content_performance_evidence_verification_check CHECK (
    verification_status IN ('submitted', 'verified', 'rejected')
  ),
  CONSTRAINT content_performance_evidence_bucket_check CHECK (
    bucket_id = 'campaign-evidence'
  ),
  CONSTRAINT content_performance_evidence_size_check CHECK (size_bytes > 0),
  CONSTRAINT content_performance_evidence_storage_path_check CHECK (
    app_private.uuid_path_segment(storage_path, 1) = campaign_id
    AND app_private.uuid_path_segment(storage_path, 2) = campaign_member_id
    AND app_private.uuid_path_segment(storage_path, 3) = report_task_id
    AND app_private.uuid_path_segment(storage_path, 4) = id
  )
);

COMMENT ON TABLE public.content_performance_evidence IS
  'Private evidence files that support creator-submitted performance metrics.';

CREATE INDEX IF NOT EXISTS campaign_brief_blocks_campaign_visibility_sort_idx
  ON public.campaign_brief_blocks (campaign_id, visibility, sort_order);

CREATE INDEX IF NOT EXISTS campaign_assets_campaign_visibility_status_idx
  ON public.campaign_assets (campaign_id, visibility, status);

CREATE INDEX IF NOT EXISTS campaign_reporting_plans_campaign_idx
  ON public.campaign_reporting_plans (campaign_id);

CREATE INDEX IF NOT EXISTS campaign_report_tasks_campaign_status_due_idx
  ON public.campaign_report_tasks (campaign_id, status, due_at);

CREATE INDEX IF NOT EXISTS campaign_report_tasks_member_status_due_idx
  ON public.campaign_report_tasks (campaign_member_id, status, due_at);

CREATE INDEX IF NOT EXISTS content_performance_report_task_idx
  ON public.content_performance (report_task_id);

CREATE INDEX IF NOT EXISTS content_performance_submission_reported_idx
  ON public.content_performance (submission_id, reported_at);

CREATE INDEX IF NOT EXISTS content_performance_evidence_campaign_member_idx
  ON public.content_performance_evidence (campaign_id, campaign_member_id);

CREATE INDEX IF NOT EXISTS content_performance_evidence_report_task_idx
  ON public.content_performance_evidence (report_task_id);

CREATE INDEX IF NOT EXISTS content_performance_evidence_performance_idx
  ON public.content_performance_evidence (performance_id);

ALTER TABLE public.campaign_brief_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_reporting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_report_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_performance_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_brief_blocks_select_access
  ON public.campaign_brief_blocks;
CREATE POLICY campaign_brief_blocks_select_access
  ON public.campaign_brief_blocks
  FOR SELECT
  USING (
    app_private.current_user_is_admin()
    OR app_private.is_campaign_brand(campaign_id)
    OR (
      visibility IN ('public', 'member')
      AND app_private.is_campaign_member(campaign_id)
    )
    OR (
      visibility = 'public'
      AND EXISTS (
        SELECT 1
          FROM public.campaigns
         WHERE campaigns.id = campaign_brief_blocks.campaign_id
           AND campaigns.status = 'recruiting'
      )
    )
  );

DROP POLICY IF EXISTS campaign_brief_blocks_insert_brand
  ON public.campaign_brief_blocks;
CREATE POLICY campaign_brief_blocks_insert_brand
  ON public.campaign_brief_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_brief_blocks_update_brand
  ON public.campaign_brief_blocks;
CREATE POLICY campaign_brief_blocks_update_brand
  ON public.campaign_brief_blocks
  FOR UPDATE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id))
  WITH CHECK (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_brief_blocks_delete_brand
  ON public.campaign_brief_blocks;
CREATE POLICY campaign_brief_blocks_delete_brand
  ON public.campaign_brief_blocks
  FOR DELETE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_brief_blocks_admin
  ON public.campaign_brief_blocks;
CREATE POLICY campaign_brief_blocks_admin
  ON public.campaign_brief_blocks
  FOR ALL
  TO authenticated
  USING (app_private.current_user_is_admin())
  WITH CHECK (app_private.current_user_is_admin());

DROP POLICY IF EXISTS campaign_assets_select_access ON public.campaign_assets;
CREATE POLICY campaign_assets_select_access
  ON public.campaign_assets
  FOR SELECT
  TO authenticated
  USING (
    app_private.current_user_is_admin()
    OR app_private.is_campaign_brand(campaign_id)
    OR (
      status = 'ready'
      AND visibility = 'member'
      AND app_private.is_campaign_member(campaign_id)
    )
  );

DROP POLICY IF EXISTS campaign_assets_insert_brand ON public.campaign_assets;
CREATE POLICY campaign_assets_insert_brand
  ON public.campaign_assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND app_private.is_campaign_brand(campaign_id)
  );

DROP POLICY IF EXISTS campaign_assets_update_brand ON public.campaign_assets;
CREATE POLICY campaign_assets_update_brand
  ON public.campaign_assets
  FOR UPDATE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id))
  WITH CHECK (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_assets_delete_brand ON public.campaign_assets;
CREATE POLICY campaign_assets_delete_brand
  ON public.campaign_assets
  FOR DELETE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_assets_admin ON public.campaign_assets;
CREATE POLICY campaign_assets_admin
  ON public.campaign_assets
  FOR ALL
  TO authenticated
  USING (app_private.current_user_is_admin())
  WITH CHECK (app_private.current_user_is_admin());

DROP POLICY IF EXISTS campaign_reporting_plans_select_access
  ON public.campaign_reporting_plans;
CREATE POLICY campaign_reporting_plans_select_access
  ON public.campaign_reporting_plans
  FOR SELECT
  TO authenticated
  USING (
    app_private.current_user_is_admin()
    OR app_private.is_campaign_brand(campaign_id)
    OR app_private.is_campaign_member(campaign_id)
  );

DROP POLICY IF EXISTS campaign_reporting_plans_insert_brand
  ON public.campaign_reporting_plans;
CREATE POLICY campaign_reporting_plans_insert_brand
  ON public.campaign_reporting_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_reporting_plans_update_brand
  ON public.campaign_reporting_plans;
CREATE POLICY campaign_reporting_plans_update_brand
  ON public.campaign_reporting_plans
  FOR UPDATE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id))
  WITH CHECK (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_reporting_plans_delete_brand
  ON public.campaign_reporting_plans;
CREATE POLICY campaign_reporting_plans_delete_brand
  ON public.campaign_reporting_plans
  FOR DELETE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_reporting_plans_admin
  ON public.campaign_reporting_plans;
CREATE POLICY campaign_reporting_plans_admin
  ON public.campaign_reporting_plans
  FOR ALL
  TO authenticated
  USING (app_private.current_user_is_admin())
  WITH CHECK (app_private.current_user_is_admin());

DROP POLICY IF EXISTS campaign_report_tasks_select_brand_creator
  ON public.campaign_report_tasks;
CREATE POLICY campaign_report_tasks_select_brand_creator
  ON public.campaign_report_tasks
  FOR SELECT
  TO authenticated
  USING (
    app_private.current_user_is_admin()
    OR app_private.is_campaign_brand(campaign_id)
    OR app_private.is_campaign_member_record(campaign_member_id)
  );

DROP POLICY IF EXISTS campaign_report_tasks_update_brand
  ON public.campaign_report_tasks;
CREATE POLICY campaign_report_tasks_update_brand
  ON public.campaign_report_tasks
  FOR UPDATE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id))
  WITH CHECK (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS campaign_report_tasks_admin
  ON public.campaign_report_tasks;
CREATE POLICY campaign_report_tasks_admin
  ON public.campaign_report_tasks
  FOR ALL
  TO authenticated
  USING (app_private.current_user_is_admin())
  WITH CHECK (app_private.current_user_is_admin());

DROP POLICY IF EXISTS content_performance_evidence_select_access
  ON public.content_performance_evidence;
CREATE POLICY content_performance_evidence_select_access
  ON public.content_performance_evidence
  FOR SELECT
  TO authenticated
  USING (
    app_private.current_user_is_admin()
    OR app_private.is_campaign_brand(campaign_id)
    OR app_private.is_campaign_member_record(campaign_member_id)
  );

DROP POLICY IF EXISTS content_performance_evidence_insert_creator
  ON public.content_performance_evidence;
CREATE POLICY content_performance_evidence_insert_creator
  ON public.content_performance_evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND app_private.is_campaign_member_record(campaign_member_id)
    AND app_private.is_report_task_creator(report_task_id)
    AND (
      submission_id IS NULL
      OR app_private.is_submission_creator(submission_id)
    )
    AND (
      performance_id IS NULL
      OR app_private.is_performance_creator(performance_id)
    )
  );

DROP POLICY IF EXISTS content_performance_evidence_update_brand
  ON public.content_performance_evidence;
CREATE POLICY content_performance_evidence_update_brand
  ON public.content_performance_evidence
  FOR UPDATE
  TO authenticated
  USING (app_private.is_campaign_brand(campaign_id))
  WITH CHECK (app_private.is_campaign_brand(campaign_id));

DROP POLICY IF EXISTS content_performance_evidence_admin
  ON public.content_performance_evidence;
CREATE POLICY content_performance_evidence_admin
  ON public.content_performance_evidence
  FOR ALL
  TO authenticated
  USING (app_private.current_user_is_admin())
  WITH CHECK (app_private.current_user_is_admin());

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'campaign-assets',
    'campaign-assets',
    false,
    52428800,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'campaign-evidence',
    'campaign-evidence',
    false,
    15728640,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/csv'
    ]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION app_private.can_read_campaign_asset_object(
  object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.campaign_assets asset
     WHERE asset.storage_path = object_name
       AND asset.status <> 'archived'
       AND (
         app_private.current_user_is_admin()
         OR app_private.is_campaign_brand(asset.campaign_id)
         OR (
           asset.status = 'ready'
           AND asset.visibility = 'member'
           AND app_private.is_campaign_member(asset.campaign_id)
         )
       )
  );
$$;

CREATE OR REPLACE FUNCTION app_private.can_write_campaign_asset_object(
  object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.campaign_assets asset
     WHERE asset.storage_path = object_name
       AND asset.uploaded_by = auth.uid()
       AND asset.status = 'uploading'
       AND app_private.is_campaign_brand(asset.campaign_id)
  );
$$;

CREATE OR REPLACE FUNCTION app_private.can_read_campaign_evidence_object(
  object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.content_performance_evidence evidence
     WHERE evidence.storage_path = object_name
       AND (
         app_private.current_user_is_admin()
         OR app_private.is_campaign_brand(evidence.campaign_id)
         OR app_private.is_campaign_member_record(evidence.campaign_member_id)
       )
  );
$$;

CREATE OR REPLACE FUNCTION app_private.can_write_campaign_evidence_object(
  object_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.content_performance_evidence evidence
     WHERE evidence.storage_path = object_name
       AND evidence.uploaded_by = auth.uid()
       AND app_private.is_campaign_member_record(evidence.campaign_member_id)
  );
$$;

DROP POLICY IF EXISTS campaign_assets_objects_select ON storage.objects;
CREATE POLICY campaign_assets_objects_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'campaign-assets'
    AND app_private.can_read_campaign_asset_object(name)
  );

DROP POLICY IF EXISTS campaign_assets_objects_insert ON storage.objects;
CREATE POLICY campaign_assets_objects_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-assets'
    AND app_private.uuid_path_segment(name, 1) IS NOT NULL
    AND app_private.uuid_path_segment(name, 2) IS NOT NULL
    AND app_private.can_write_campaign_asset_object(name)
  );

DROP POLICY IF EXISTS campaign_assets_objects_update ON storage.objects;
CREATE POLICY campaign_assets_objects_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'campaign-assets'
    AND app_private.can_write_campaign_asset_object(name)
  )
  WITH CHECK (
    bucket_id = 'campaign-assets'
    AND app_private.can_write_campaign_asset_object(name)
  );

DROP POLICY IF EXISTS campaign_assets_objects_delete ON storage.objects;
CREATE POLICY campaign_assets_objects_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'campaign-assets'
    AND EXISTS (
      SELECT 1
        FROM public.campaign_assets asset
       WHERE asset.storage_path = storage.objects.name
         AND (
           app_private.current_user_is_admin()
           OR app_private.is_campaign_brand(asset.campaign_id)
         )
    )
  );

DROP POLICY IF EXISTS campaign_evidence_objects_select ON storage.objects;
CREATE POLICY campaign_evidence_objects_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'campaign-evidence'
    AND app_private.can_read_campaign_evidence_object(name)
  );

DROP POLICY IF EXISTS campaign_evidence_objects_insert ON storage.objects;
CREATE POLICY campaign_evidence_objects_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-evidence'
    AND app_private.uuid_path_segment(name, 1) IS NOT NULL
    AND app_private.uuid_path_segment(name, 2) IS NOT NULL
    AND app_private.uuid_path_segment(name, 3) IS NOT NULL
    AND app_private.uuid_path_segment(name, 4) IS NOT NULL
    AND app_private.can_write_campaign_evidence_object(name)
  );

DROP POLICY IF EXISTS campaign_evidence_objects_update ON storage.objects;
CREATE POLICY campaign_evidence_objects_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'campaign-evidence'
    AND app_private.can_write_campaign_evidence_object(name)
  )
  WITH CHECK (
    bucket_id = 'campaign-evidence'
    AND app_private.can_write_campaign_evidence_object(name)
  );

DROP POLICY IF EXISTS campaign_evidence_objects_delete ON storage.objects;
CREATE POLICY campaign_evidence_objects_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'campaign-evidence'
    AND EXISTS (
      SELECT 1
        FROM public.content_performance_evidence evidence
       WHERE evidence.storage_path = storage.objects.name
         AND (
           app_private.current_user_is_admin()
           OR app_private.is_campaign_member_record(evidence.campaign_member_id)
         )
    )
  );

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private
  TO authenticated, service_role;
