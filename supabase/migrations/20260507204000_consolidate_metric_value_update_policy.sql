-- Collapse duplicate permissive UPDATE policies into one equivalent policy.
-- This keeps the same creator + brand access model while satisfying the
-- Supabase performance advisor.

drop policy if exists content_performance_metric_values_update_brand
  on public.content_performance_metric_values;

drop policy if exists content_performance_metric_values_update_creator
  on public.content_performance_metric_values;

create policy content_performance_metric_values_update_access
  on public.content_performance_metric_values
  for update
  to authenticated
  using (
    app_private.is_performance_creator(performance_id)
    or (
      report_task_id is not null
      and exists (
        select 1
        from public.campaign_report_tasks task
        where task.id = content_performance_metric_values.report_task_id
          and app_private.is_campaign_brand(task.campaign_id)
      )
    )
  )
  with check (
    app_private.is_performance_creator(performance_id)
    or (
      report_task_id is not null
      and exists (
        select 1
        from public.campaign_report_tasks task
        where task.id = content_performance_metric_values.report_task_id
          and app_private.is_campaign_brand(task.campaign_id)
      )
    )
  );
