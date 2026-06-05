-- Collapse reporting row policies after brand workspace access moved beyond
-- owner-only checks. Each table/action should have one permissive policy for
-- authenticated users so Supabase does not evaluate duplicate paths per row.

set search_path = public, extensions, pg_temp;

drop policy if exists rls_content_submissions_select_authenticated_9c0cafa8
  on public.content_submissions;
drop policy if exists content_submissions_select_brand
  on public.content_submissions;
drop policy if exists content_submissions_select_access
  on public.content_submissions;

create policy content_submissions_select_access
  on public.content_submissions
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or exists (
      select 1
        from public.campaign_members member
       where member.id = content_submissions.campaign_member_id
         and member.creator_id = (select auth.uid())
    )
    or exists (
      select 1
        from public.campaign_members member
        join public.campaigns
          on campaigns.id = member.campaign_id
       where member.id = content_submissions.campaign_member_id
         and app_private.current_user_can_access_brand_workspace(campaigns.brand_id)
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
    )
    or exists (
      select 1
        from public.campaign_members member
        join public.campaigns
          on campaigns.id = member.campaign_id
       where member.id = content_submissions.campaign_member_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
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
    )
    or exists (
      select 1
        from public.campaign_members member
        join public.campaigns
          on campaigns.id = member.campaign_id
       where member.id = content_submissions.campaign_member_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );

drop policy if exists rls_content_performance_select_authenticated_9e7ef463
  on public.content_performance;
drop policy if exists content_performance_select_brand
  on public.content_performance;
drop policy if exists content_performance_select_access
  on public.content_performance;

create policy content_performance_select_access
  on public.content_performance
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = (select auth.uid())
    )
    or exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
        join public.campaigns
          on campaigns.id = member.campaign_id
       where submission.id = content_performance.submission_id
         and app_private.current_user_can_access_brand_workspace(campaigns.brand_id)
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
    )
  )
  with check (
    app_private.current_user_is_admin()
    or exists (
      select 1
        from public.campaigns
       where campaigns.id = content_performance_evidence.campaign_id
         and app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)
    )
  );
