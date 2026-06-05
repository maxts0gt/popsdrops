-- Allow scheduled campaign report reads while preserving legacy one-off measurements.

ALTER TABLE public.content_performance
  DROP CONSTRAINT IF EXISTS uq_performance_submission_measurement;

CREATE UNIQUE INDEX IF NOT EXISTS content_performance_submission_measurement_legacy_unique
  ON public.content_performance (submission_id, measurement_type)
  WHERE report_task_id IS NULL;

CREATE INDEX IF NOT EXISTS content_performance_submission_report_task_read_idx
  ON public.content_performance (submission_id, report_task_id, reported_at)
  WHERE report_task_id IS NOT NULL;

COMMENT ON INDEX public.content_performance_submission_measurement_legacy_unique IS
  'Keeps legacy manual performance reads unique when no report task exists.';

COMMENT ON INDEX public.content_performance_submission_report_task_read_idx IS
  'Speeds report-task time series reads while allowing multiple measured points per task.';
