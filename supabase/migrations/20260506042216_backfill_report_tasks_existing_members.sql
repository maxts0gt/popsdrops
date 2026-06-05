-- Backfill final reporting obligations for campaign members that existed before
-- report tasks were generated during member acceptance.
insert into public.campaign_report_tasks (
  campaign_id,
  campaign_member_id,
  task_key,
  period_start,
  period_end,
  due_at,
  status
)
select
  campaign.id,
  member.id,
  'final',
  null,
  null,
  campaign.performance_due_date,
  'pending'
from public.campaign_members member
join public.campaigns campaign
  on campaign.id = member.campaign_id
where campaign.performance_due_date is not null
on conflict (campaign_member_id, task_key) do nothing;

-- Existing metric rows may already satisfy those backfilled tasks. Link them so
-- report completeness reads from the same source as newly submitted reports.
with latest_performance as (
  select
    performance.id as performance_id,
    task.id as task_id
  from public.campaign_report_tasks task
  join public.content_submissions submission
    on submission.campaign_member_id = task.campaign_member_id
  join public.content_performance performance
    on performance.submission_id = submission.id
  where task.task_key = 'final'
    and performance.report_task_id is null
)
update public.content_performance performance
set report_task_id = latest_performance.task_id
from latest_performance
where performance.id = latest_performance.performance_id;

with submitted_tasks as (
  select
    task.id,
    task.due_at,
    max(performance.reported_at) as submitted_at
  from public.campaign_report_tasks task
  join public.content_performance performance
    on performance.report_task_id = task.id
  where task.task_key = 'final'
    and task.status in ('pending', 'missed')
  group by task.id, task.due_at
)
update public.campaign_report_tasks task
set
  status = case
    when submitted_tasks.submitted_at > submitted_tasks.due_at
      then 'submitted_late'
    else 'submitted'
  end,
  submitted_at = submitted_tasks.submitted_at,
  missed_at = null,
  updated_at = now()
from submitted_tasks
where task.id = submitted_tasks.id
  and task.status in ('pending', 'missed');
