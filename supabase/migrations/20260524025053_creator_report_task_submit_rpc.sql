create or replace function public.submit_creator_report_task(
  p_task_id uuid,
  p_submitted_at timestamptz default now()
)
returns table (
  id uuid,
  status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  safe_submitted_at timestamptz := coalesce(least(p_submitted_at, now()), now());
begin
  if not app_private.is_report_task_creator(p_task_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  update public.campaign_report_tasks task
     set status = case
          when task.due_at < safe_submitted_at then 'submitted_late'
          else 'submitted'
        end,
        submitted_at = safe_submitted_at,
        review_note = null,
        updated_at = now()
   where task.id = p_task_id
     and task.status not in ('verified', 'excused')
  returning task.id, task.status, task.submitted_at;

  if not found then
    raise exception 'Report task cannot be submitted'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.submit_creator_report_task(uuid, timestamptz)
  from public;

grant execute on function public.submit_creator_report_task(uuid, timestamptz)
  to authenticated, service_role;

create or replace function public.link_creator_performance_evidence(
  p_evidence_id uuid,
  p_performance_id uuid,
  p_submission_id uuid
)
returns table (
  id uuid,
  performance_id uuid,
  submission_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  evidence_record public.content_performance_evidence%rowtype;
  performance_record public.content_performance%rowtype;
begin
  select *
    into evidence_record
    from public.content_performance_evidence evidence
   where evidence.id = p_evidence_id;

  if not found then
    raise exception 'Evidence not found' using errcode = '02000';
  end if;

  if not app_private.is_report_task_creator(evidence_record.report_task_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not app_private.is_submission_creator(p_submission_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not app_private.is_performance_creator(p_performance_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select *
    into performance_record
    from public.content_performance performance
   where performance.id = p_performance_id;

  if not found then
    raise exception 'Performance report not found' using errcode = '02000';
  end if;

  if performance_record.submission_id <> p_submission_id then
    raise exception 'Performance report does not match submission'
      using errcode = '23514';
  end if;

  if performance_record.report_task_id is distinct from evidence_record.report_task_id then
    raise exception 'Performance report does not match evidence task'
      using errcode = '23514';
  end if;

  if evidence_record.submission_id is not null
    and evidence_record.submission_id <> p_submission_id then
    raise exception 'Evidence does not match submission'
      using errcode = '23514';
  end if;

  if evidence_record.performance_id is not null
    and evidence_record.performance_id <> p_performance_id then
    raise exception 'Evidence has already been linked'
      using errcode = '23505';
  end if;

  return query
  update public.content_performance_evidence evidence
     set performance_id = p_performance_id,
         submission_id = p_submission_id,
         verification_status = 'submitted',
         review_note = null,
         updated_at = now()
   where evidence.id = p_evidence_id
  returning evidence.id, evidence.performance_id, evidence.submission_id;
end;
$$;

revoke all on function public.link_creator_performance_evidence(uuid, uuid, uuid)
  from public;

grant execute on function public.link_creator_performance_evidence(uuid, uuid, uuid)
  to authenticated, service_role;
