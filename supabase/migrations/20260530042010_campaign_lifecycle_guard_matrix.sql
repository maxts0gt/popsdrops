-- Centralize campaign phase checks at the database edge so stale tabs or
-- direct Data API calls cannot mutate closed campaign work.

set search_path = public, extensions, pg_temp;

create or replace function app_private.campaign_accepts_creator_work(
  campaign_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaigns
     where campaigns.id = campaign_uuid
       and campaigns.status in ('in_progress', 'publishing', 'monitoring')
  );
$$;

create or replace function app_private.campaign_accepts_content_decisions(
  campaign_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.campaign_accepts_creator_work(campaign_uuid);
$$;

create or replace function app_private.campaign_accepts_proof_submission(
  campaign_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.campaign_accepts_creator_work(campaign_uuid);
$$;

create or replace function app_private.campaign_accepts_proof_decisions(
  campaign_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.campaign_accepts_creator_work(campaign_uuid);
$$;

comment on function app_private.campaign_accepts_creator_work(uuid) is
  'True only while creators can create or revise campaign work.';
comment on function app_private.campaign_accepts_content_decisions(uuid) is
  'True only while brands can review campaign content.';
comment on function app_private.campaign_accepts_proof_submission(uuid) is
  'True only while creators can submit campaign proof.';
comment on function app_private.campaign_accepts_proof_decisions(uuid) is
  'True only while brands can review campaign proof.';

grant execute on function app_private.campaign_accepts_creator_work(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_accepts_content_decisions(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_accepts_proof_submission(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_accepts_proof_decisions(uuid)
  to authenticated, service_role;

drop policy if exists content_submissions_insert_creator
  on public.content_submissions;
create policy content_submissions_insert_creator
  on public.content_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_creator_work(member.campaign_id)
    )
  );

drop policy if exists content_submissions_update_creator
  on public.content_submissions;
drop policy if exists content_submissions_update_brand
  on public.content_submissions;
drop policy if exists content_submissions_update_access
  on public.content_submissions;
create policy content_submissions_update_access
  on public.content_submissions
  for update
  to authenticated
  using (
    app_private.current_user_is_admin()
    or exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_creator_work(member.campaign_id)
    )
    or exists (
      select 1
        from public.campaign_members member
        join public.campaigns
          on campaigns.id = member.campaign_id
       where member.id = content_submissions.campaign_member_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
         and app_private.campaign_accepts_content_decisions(campaigns.id)
    )
  )
  with check (
    app_private.current_user_is_admin()
    or exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_creator_work(member.campaign_id)
    )
    or exists (
      select 1
        from public.campaign_members member
        join public.campaigns
          on campaigns.id = member.campaign_id
       where member.id = content_submissions.campaign_member_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
         and app_private.campaign_accepts_content_decisions(campaigns.id)
    )
  );

drop policy if exists content_performance_insert_creator
  on public.content_performance;
create policy content_performance_insert_creator
  on public.content_performance
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
        join public.campaigns
          on campaigns.id = member.campaign_id
       where submission.id = content_performance.submission_id
         and submission.status = 'published'
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_proof_submission(campaigns.id)
    )
  );

drop policy if exists content_performance_update_creator
  on public.content_performance;
create policy content_performance_update_creator
  on public.content_performance
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
        join public.campaigns
          on campaigns.id = member.campaign_id
       where submission.id = content_performance.submission_id
         and submission.status = 'published'
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_proof_submission(campaigns.id)
    )
  )
  with check (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
        join public.campaigns
          on campaigns.id = member.campaign_id
       where submission.id = content_performance.submission_id
         and submission.status = 'published'
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_proof_submission(campaigns.id)
    )
  );

drop policy if exists content_performance_metric_values_insert_creator
  on public.content_performance_metric_values;
create policy content_performance_metric_values_insert_creator
  on public.content_performance_metric_values
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.content_performance performance
        join public.content_submissions submission
          on submission.id = performance.submission_id
        join public.campaign_members member
          on member.id = submission.campaign_member_id
        join public.campaigns
          on campaigns.id = member.campaign_id
       where performance.id = content_performance_metric_values.performance_id
         and submission.status = 'published'
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_proof_submission(campaigns.id)
    )
    and (
      report_task_id is null
      or app_private.is_report_task_creator(report_task_id)
    )
  );

drop policy if exists content_performance_metric_values_update_creator
  on public.content_performance_metric_values;
drop policy if exists content_performance_metric_values_update_brand
  on public.content_performance_metric_values;
drop policy if exists content_performance_metric_values_update_access
  on public.content_performance_metric_values;
create policy content_performance_metric_values_update_access
  on public.content_performance_metric_values
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.content_performance performance
        join public.content_submissions submission
          on submission.id = performance.submission_id
        join public.campaign_members member
          on member.id = submission.campaign_member_id
        join public.campaigns
          on campaigns.id = member.campaign_id
       where performance.id = content_performance_metric_values.performance_id
         and submission.status = 'published'
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_proof_submission(campaigns.id)
    )
    or (
      report_task_id is not null
      and exists (
        select 1
          from public.campaign_report_tasks task
         where task.id = content_performance_metric_values.report_task_id
           and app_private.is_campaign_brand(task.campaign_id)
           and app_private.campaign_accepts_proof_decisions(task.campaign_id)
      )
    )
  )
  with check (
    exists (
      select 1
        from public.content_performance performance
        join public.content_submissions submission
          on submission.id = performance.submission_id
        join public.campaign_members member
          on member.id = submission.campaign_member_id
        join public.campaigns
          on campaigns.id = member.campaign_id
       where performance.id = content_performance_metric_values.performance_id
         and submission.status = 'published'
         and member.creator_id = (select auth.uid())
         and app_private.campaign_member_has_required_agreement(member.id)
         and app_private.campaign_accepts_proof_submission(campaigns.id)
    )
    or (
      report_task_id is not null
      and exists (
        select 1
          from public.campaign_report_tasks task
         where task.id = content_performance_metric_values.report_task_id
           and app_private.is_campaign_brand(task.campaign_id)
           and app_private.campaign_accepts_proof_decisions(task.campaign_id)
      )
    )
  );

drop policy if exists content_performance_evidence_insert_creator
  on public.content_performance_evidence;
create policy content_performance_evidence_insert_creator
  on public.content_performance_evidence
  for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and app_private.is_campaign_member_record(campaign_member_id)
    and app_private.is_report_task_creator(report_task_id)
    and app_private.campaign_accepts_proof_submission(campaign_id)
    and (
      submission_id is null
      or exists (
        select 1
          from public.content_submissions submission
         where submission.id = content_performance_evidence.submission_id
           and submission.status = 'published'
           and app_private.is_submission_creator(submission.id)
      )
    )
    and (
      performance_id is null
      or app_private.is_performance_creator(performance_id)
    )
  );

drop policy if exists rls_content_performance_evid_update_authenticated_2e4f3664
  on public.content_performance_evidence;
drop policy if exists content_performance_evidence_update_brand
  on public.content_performance_evidence;
drop policy if exists content_performance_evidence_update_access
  on public.content_performance_evidence;
create policy content_performance_evidence_update_access
  on public.content_performance_evidence
  for update
  to authenticated
  using (
    app_private.current_user_is_admin()
    or exists (
      select 1
        from public.campaigns
       where campaigns.id = content_performance_evidence.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
         and app_private.campaign_accepts_proof_decisions(campaigns.id)
    )
  )
  with check (
    app_private.current_user_is_admin()
    or exists (
      select 1
        from public.campaigns
       where campaigns.id = content_performance_evidence.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
         and app_private.campaign_accepts_proof_decisions(campaigns.id)
    )
  );

drop policy if exists content_performance_ai_extractions_update_creator
  on public.content_performance_ai_extractions;
create policy content_performance_ai_extractions_update_creator
  on public.content_performance_ai_extractions
  for update
  to authenticated
  using (
    app_private.is_report_task_creator(report_task_id)
    and exists (
      select 1
        from public.campaign_report_tasks task
       where task.id = content_performance_ai_extractions.report_task_id
         and app_private.campaign_accepts_proof_submission(task.campaign_id)
    )
  )
  with check (
    app_private.is_report_task_creator(report_task_id)
    and exists (
      select 1
        from public.campaign_report_tasks task
       where task.id = content_performance_ai_extractions.report_task_id
         and app_private.campaign_accepts_proof_submission(task.campaign_id)
    )
  );

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

  if not exists (
    select 1
      from public.campaign_report_tasks task
     where task.id = p_task_id
       and app_private.campaign_accepts_proof_submission(task.campaign_id)
  ) then
    raise exception 'Report task cannot be submitted'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
      from public.content_performance performance
      join public.content_submissions submission
        on submission.id = performance.submission_id
     where performance.report_task_id = p_task_id
       and submission.status = 'published'
  ) then
    raise exception 'Report task cannot be submitted'
      using errcode = '23514';
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
  submission_record public.content_submissions%rowtype;
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

  if not app_private.campaign_accepts_proof_submission(evidence_record.campaign_id) then
    raise exception 'Proof submission is closed for this campaign stage'
      using errcode = '23514';
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

  select *
    into submission_record
    from public.content_submissions submission
   where submission.id = p_submission_id;

  if not found or submission_record.status <> 'published' then
    raise exception 'Performance metrics can only be submitted after content is published'
      using errcode = '23514';
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
