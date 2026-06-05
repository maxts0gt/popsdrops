-- Carry brand workspace roles into reporting evidence rows.
--
-- The campaign table already treats accepted brand teammates as workspace
-- users. Reporting rows hang off submissions and performance records, so the
-- standalone report page must use the same workspace model. Read access is
-- available to all accepted teammates. Review writes stay manager-or-higher.

set search_path = public, extensions, pg_temp;

drop policy if exists content_submissions_select_brand
  on public.content_submissions;
create policy content_submissions_select_brand
  on public.content_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.campaign_members
        join public.campaigns
          on campaigns.id = campaign_members.campaign_id
       where campaign_members.id = content_submissions.campaign_member_id
         and app_private.current_user_can_access_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists content_submissions_update_brand
  on public.content_submissions;
create policy content_submissions_update_brand
  on public.content_submissions
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.campaign_members
        join public.campaigns
          on campaigns.id = campaign_members.campaign_id
       where campaign_members.id = content_submissions.campaign_member_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  )
  with check (
    exists (
      select 1
        from public.campaign_members
        join public.campaigns
          on campaigns.id = campaign_members.campaign_id
       where campaign_members.id = content_submissions.campaign_member_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists content_performance_select_brand
  on public.content_performance;
create policy content_performance_select_brand
  on public.content_performance
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.content_submissions
        join public.campaign_members
          on campaign_members.id = content_submissions.campaign_member_id
        join public.campaigns
          on campaigns.id = campaign_members.campaign_id
       where content_submissions.id = content_performance.submission_id
         and app_private.current_user_can_access_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists content_performance_evidence_update_brand
  on public.content_performance_evidence;
create policy content_performance_evidence_update_brand
  on public.content_performance_evidence
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = content_performance_evidence.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  )
  with check (
    exists (
      select 1
        from public.campaigns
       where campaigns.id = content_performance_evidence.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists content_performance_metric_values_update_access
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
          join public.campaigns task_campaigns
            on task_campaigns.id = task.campaign_id
         where task.id = content_performance_metric_values.report_task_id
           and app_private.current_user_can_manage_brand_workspace(task_campaigns.brand_id)
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
          join public.campaigns task_campaigns
            on task_campaigns.id = task.campaign_id
         where task.id = content_performance_metric_values.report_task_id
           and app_private.current_user_can_manage_brand_workspace(task_campaigns.brand_id)
      )
    )
  );
