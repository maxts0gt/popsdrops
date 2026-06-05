-- Resolve Supabase advisor warnings from auth_rls_initplan and
-- multiple_permissive_policies without weakening the campaign access model.

-- ---------------------------------------------------------------------------
-- Remove older generated authenticated policies where a newer, agreement-aware
-- policy now owns the same table/action.
-- ---------------------------------------------------------------------------

drop policy if exists rls_campaign_assets_select_authenticated_bc36697e
  on public.campaign_assets;
drop policy if exists rls_campaign_brief_blocks_select_authenticated_593730c2
  on public.campaign_brief_blocks;
drop policy if exists rls_campaign_report_tasks_select_authenticated_58023e45
  on public.campaign_report_tasks;
drop policy if exists rls_content_performance_insert_authenticated_8d2adc40
  on public.content_performance;
drop policy if exists rls_content_performance_update_authenticated_32207f2f
  on public.content_performance;
drop policy if exists rls_content_submissions_insert_authenticated_07fde69a
  on public.content_submissions;
drop policy if exists rls_content_submissions_update_authenticated_83d5e715
  on public.content_submissions;

-- ---------------------------------------------------------------------------
-- Agreement gate policies: cache the current user id as an init plan and preserve the
-- intentional brand/admin/creator access paths from the consolidated policies.
-- ---------------------------------------------------------------------------

drop policy if exists campaign_agreements_insert_brand
  on public.campaign_agreements;
create policy campaign_agreements_insert_brand
  on public.campaign_agreements
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaign_agreement_acceptances_insert_creator
  on public.campaign_agreement_acceptances;
create policy campaign_agreement_acceptances_insert_creator
  on public.campaign_agreement_acceptances
  for insert
  to authenticated
  with check (
    creator_id = (select auth.uid())
    and exists (
      select 1
      from public.campaign_agreements agreement
      where agreement.id = campaign_agreement_acceptances.agreement_id
        and agreement.campaign_id = campaign_agreement_acceptances.campaign_id
        and agreement.status = 'published'
        and agreement.content_hash = campaign_agreement_acceptances.accepted_content_hash
        and agreement.version = campaign_agreement_acceptances.accepted_version
    )
    and exists (
      select 1
      from public.campaign_members member
      where member.id = campaign_agreement_acceptances.campaign_member_id
        and member.campaign_id = campaign_agreement_acceptances.campaign_id
        and member.creator_id = (select auth.uid())
    )
    and (
      application_id is null
      or exists (
        select 1
        from public.campaign_applications application
        where application.id = campaign_agreement_acceptances.application_id
          and application.campaign_id = campaign_agreement_acceptances.campaign_id
          and application.creator_id = (select auth.uid())
      )
    )
  );

drop policy if exists campaign_agreement_acceptances_select_access
  on public.campaign_agreement_acceptances;
create policy campaign_agreement_acceptances_select_access
  on public.campaign_agreement_acceptances
  for select
  to authenticated
  using (
    (select app_private.current_user_is_admin())
    or creator_id = (select auth.uid())
    or app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists content_submissions_insert_creator
  on public.content_submissions;
create policy content_submissions_insert_creator
  on public.content_submissions
  for insert
  to authenticated
  with check (
    (select app_private.current_user_is_admin())
    or exists (
      select 1
      from public.campaign_members member
      where member.id = content_submissions.campaign_member_id
        and member.creator_id = (select auth.uid())
        and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_submissions_update_creator
  on public.content_submissions;
create policy content_submissions_update_creator
  on public.content_submissions
  for update
  to authenticated
  using (
    (select app_private.current_user_is_admin())
    or exists (
      select 1
      from public.campaign_members member
      join public.campaigns campaign
        on campaign.id = member.campaign_id
      where member.id = content_submissions.campaign_member_id
        and campaign.brand_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.campaign_members member
      where member.id = content_submissions.campaign_member_id
        and member.creator_id = (select auth.uid())
        and app_private.campaign_member_has_required_agreement(member.id)
    )
  )
  with check (
    (select app_private.current_user_is_admin())
    or exists (
      select 1
      from public.campaign_members member
      join public.campaigns campaign
        on campaign.id = member.campaign_id
      where member.id = content_submissions.campaign_member_id
        and campaign.brand_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.campaign_members member
      where member.id = content_submissions.campaign_member_id
        and member.creator_id = (select auth.uid())
        and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_insert_creator
  on public.content_performance;
create policy content_performance_insert_creator
  on public.content_performance
  for insert
  to authenticated
  with check (
    (select app_private.current_user_is_admin())
    or exists (
      select 1
      from public.content_submissions submission
      join public.campaign_members member
        on member.id = submission.campaign_member_id
      where submission.id = content_performance.submission_id
        and member.creator_id = (select auth.uid())
        and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

drop policy if exists content_performance_update_creator
  on public.content_performance;
create policy content_performance_update_creator
  on public.content_performance
  for update
  to authenticated
  using (
    (select app_private.current_user_is_admin())
    or exists (
      select 1
      from public.content_submissions submission
      join public.campaign_members member
        on member.id = submission.campaign_member_id
      where submission.id = content_performance.submission_id
        and member.creator_id = (select auth.uid())
        and app_private.campaign_member_has_required_agreement(member.id)
    )
  )
  with check (
    (select app_private.current_user_is_admin())
    or exists (
      select 1
      from public.content_submissions submission
      join public.campaign_members member
        on member.id = submission.campaign_member_id
      where submission.id = content_performance.submission_id
        and member.creator_id = (select auth.uid())
        and app_private.campaign_member_has_required_agreement(member.id)
    )
  );

-- ---------------------------------------------------------------------------
-- Notification preferences: fold admin access into the single action-specific
-- policies so authenticated has one permissive policy per action.
-- ---------------------------------------------------------------------------

drop policy if exists notification_email_preferences_admin
  on public.notification_email_preferences;

drop policy if exists notification_email_preferences_select_own
  on public.notification_email_preferences;
create policy notification_email_preferences_select_own
  on public.notification_email_preferences
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  );

drop policy if exists notification_email_preferences_upsert_own
  on public.notification_email_preferences;
create policy notification_email_preferences_upsert_own
  on public.notification_email_preferences
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  );

drop policy if exists notification_email_preferences_update_own
  on public.notification_email_preferences;
create policy notification_email_preferences_update_own
  on public.notification_email_preferences
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  )
  with check (
    user_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  );
