-- Harden findings surfaced by Supabase database advisors.
--
-- The public schema is exposed through the Supabase Data API, so privileged
-- helper behavior belongs in app_private and public RPC wrappers must remain
-- invoker-only unless intentionally callable.

create schema if not exists extensions;

alter extension vector set schema extensions;
alter extension pg_trgm set schema extensions;

alter function public.sync_creator_platforms() set search_path = public, pg_temp;
alter function public.update_updated_at() set search_path = public, pg_temp;
alter function public.queue_notification_email() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.enforce_max_revisions() set search_path = public, pg_temp;
alter function public.update_creator_rating() set search_path = public, pg_temp;
alter function public.update_creator_search_vector() set search_path = public, pg_temp;
alter function public.is_campaign_brand(uuid) set search_path = public, pg_temp;
alter function public.is_campaign_member(uuid) set search_path = public, pg_temp;

create or replace function app_private.can_apply_to_campaign(campaign_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaigns campaign
     where campaign.id = campaign_uuid
       and campaign.status = 'recruiting'
       and (
         campaign.application_deadline is null
         or campaign.application_deadline >= now()
       )
       and campaign.brand_id <> auth.uid()
  );
$$;

create or replace function app_private.can_review_campaign_participant(
  campaign_uuid uuid,
  reviewee_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaigns campaign
     where campaign.id = campaign_uuid
       and reviewee_uuid <> auth.uid()
       and (
         (
           campaign.brand_id = auth.uid()
           and exists (
             select 1
               from public.campaign_members member
              where member.campaign_id = campaign.id
                and member.creator_id = reviewee_uuid
           )
         )
         or
         (
           campaign.brand_id = reviewee_uuid
           and exists (
             select 1
               from public.campaign_members member
              where member.campaign_id = campaign.id
                and member.creator_id = auth.uid()
           )
         )
       )
  );
$$;

create or replace function app_private.accept_counter_offer(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app record;
begin
  select
    application.id,
    application.campaign_id,
    application.creator_id,
    application.status,
    application.counter_rate
  into v_app
  from public.campaign_applications application
  where application.id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.creator_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_app.status <> 'counter_offer' then
    raise exception 'No counter-offer to respond to';
  end if;

  if v_app.counter_rate is null then
    raise exception 'Counter-offer is missing a proposed rate';
  end if;

  update public.campaign_applications
     set status = 'accepted',
         updated_at = now()
   where id = p_application_id;

  insert into public.campaign_members (campaign_id, creator_id, accepted_rate)
  values (v_app.campaign_id, v_app.creator_id, v_app.counter_rate)
  on conflict (campaign_id, creator_id)
  do update set accepted_rate = excluded.accepted_rate;
end;
$$;

create or replace function public.accept_counter_offer(p_application_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, app_private, pg_temp
as $$
begin
  perform app_private.accept_counter_offer(p_application_id);
end;
$$;

grant usage on schema app_private to anon, authenticated, service_role;
grant execute on function app_private.can_apply_to_campaign(uuid) to authenticated, service_role;
grant execute on function app_private.can_review_campaign_participant(uuid, uuid)
  to authenticated, service_role;
grant execute on function app_private.accept_counter_offer(uuid) to authenticated, service_role;

revoke all on function public.accept_counter_offer(uuid) from public, anon;
grant execute on function public.accept_counter_offer(uuid) to authenticated;

drop policy if exists admin_audit_log_insert on public.admin_audit_log;
create policy admin_audit_log_insert
  on public.admin_audit_log
  for insert
  to authenticated
  with check (app_private.current_user_is_admin());

drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select
  on public.admin_audit_log
  for select
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists brand_profiles_admin_select on public.brand_profiles;
create policy brand_profiles_admin_select
  on public.brand_profiles
  for select
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists brand_profiles_admin_update on public.brand_profiles;
create policy brand_profiles_admin_update
  on public.brand_profiles
  for update
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists brand_profiles_select_authenticated on public.brand_profiles;
create policy brand_profiles_select_authenticated
  on public.brand_profiles
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists campaign_applications_insert_creator
  on public.campaign_applications;
create policy campaign_applications_insert_creator
  on public.campaign_applications
  for insert
  to authenticated
  with check (
    creator_id = (select auth.uid())
    and exists (
      select 1
        from public.profiles profile
       where profile.id = (select auth.uid())
         and profile.role = 'creator'
    )
    and app_private.can_apply_to_campaign(campaign_id)
  );

drop policy if exists campaign_applications_update_own
  on public.campaign_applications;
create policy campaign_applications_update_own
  on public.campaign_applications
  for update
  to authenticated
  using (
    creator_id = (select auth.uid())
    and status in ('pending', 'counter_offer')
  )
  with check (
    creator_id = (select auth.uid())
    and status = 'withdrawn'
  );

drop policy if exists campaign_applications_select_brand
  on public.campaign_applications;
create policy campaign_applications_select_brand
  on public.campaign_applications
  for select
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_applications_update_brand
  on public.campaign_applications;
create policy campaign_applications_update_brand
  on public.campaign_applications
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_assets_insert_brand on public.campaign_assets;
create policy campaign_assets_insert_brand
  on public.campaign_assets
  for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaign_deliverables_delete_brand
  on public.campaign_deliverables;
create policy campaign_deliverables_delete_brand
  on public.campaign_deliverables
  for delete
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_deliverables_insert_brand
  on public.campaign_deliverables;
create policy campaign_deliverables_insert_brand
  on public.campaign_deliverables
  for insert
  to authenticated
  with check (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_deliverables_update_brand
  on public.campaign_deliverables;
create policy campaign_deliverables_update_brand
  on public.campaign_deliverables
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_members_select_brand on public.campaign_members;
create policy campaign_members_select_brand
  on public.campaign_members
  for select
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_members_update_brand on public.campaign_members;
create policy campaign_members_update_brand
  on public.campaign_members
  for update
  to authenticated
  using (app_private.is_campaign_brand(campaign_id));

drop policy if exists campaign_messages_insert_member
  on public.campaign_messages;
create policy campaign_messages_insert_member
  on public.campaign_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      app_private.is_campaign_member(campaign_id)
      or app_private.is_campaign_brand(campaign_id)
    )
  );

drop policy if exists campaign_messages_select_member
  on public.campaign_messages;
create policy campaign_messages_select_member
  on public.campaign_messages
  for select
  to authenticated
  using (
    app_private.is_campaign_member(campaign_id)
    or app_private.is_campaign_brand(campaign_id)
  );

drop policy if exists campaigns_select_published on public.campaigns;
create policy campaigns_select_published
  on public.campaigns
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and status <> 'draft'
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
       where submission.id = content_performance.submission_id
         and member.creator_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
        from public.content_submissions submission
        join public.campaign_members member
          on member.id = submission.campaign_member_id
       where submission.id = content_performance.submission_id
         and member.creator_id = (select auth.uid())
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
    and (
      submission_id is null
      or app_private.is_submission_creator(submission_id)
    )
    and (
      performance_id is null
      or app_private.is_performance_creator(performance_id)
    )
  );

drop policy if exists creator_profiles_admin_select on public.creator_profiles;
create policy creator_profiles_admin_select
  on public.creator_profiles
  for select
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists creator_profiles_admin_update on public.creator_profiles;
create policy creator_profiles_admin_update
  on public.creator_profiles
  for update
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists cultural_calendar_select_authenticated
  on public.cultural_calendar;
create policy cultural_calendar_select_authenticated
  on public.cultural_calendar
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists market_benchmarks_select_authenticated
  on public.market_benchmarks;
create policy market_benchmarks_select_authenticated
  on public.market_benchmarks
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists market_compliance_select_authenticated
  on public.market_compliance;
create policy market_compliance_select_authenticated
  on public.market_compliance
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists platform_settings_insert on public.platform_settings;
create policy platform_settings_insert
  on public.platform_settings
  for insert
  to authenticated
  with check (app_private.current_user_is_admin());

drop policy if exists platform_settings_update on public.platform_settings;
create policy platform_settings_update
  on public.platform_settings
  for update
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists playbooks_select_authenticated on public.playbooks;
create policy playbooks_select_authenticated
  on public.playbooks
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select
  on public.profiles
  for select
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
  on public.profiles
  for update
  to authenticated
  using (app_private.current_user_is_admin());

drop policy if exists reviews_insert_authenticated on public.reviews;
create policy reviews_insert_authenticated
  on public.reviews
  for insert
  to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and (select auth.uid()) is not null
    and app_private.can_review_campaign_participant(campaign_id, reviewee_id)
  );

drop policy if exists reviews_select_authenticated on public.reviews;
create policy reviews_select_authenticated
  on public.reviews
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists glossary_write on public.translation_glossary;
create policy glossary_write
  on public.translation_glossary
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.profiles profile
       where profile.id = (select auth.uid())
         and profile.role = 'admin'
    )
  );

drop policy if exists translations_insert on public.translations;
create policy translations_insert
  on public.translations
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.profiles profile
       where profile.id = (select auth.uid())
         and profile.role = 'admin'
    )
  );

drop policy if exists translations_update on public.translations;
create policy translations_update
  on public.translations
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.profiles profile
       where profile.id = (select auth.uid())
         and profile.role = 'admin'
    )
  );

drop policy if exists waitlist_insert_public on public.waitlist;
create policy waitlist_insert_public
  on public.waitlist
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and email is not null
    and full_name is not null
    and type in ('brand', 'creator')
    and (
      (
        type = 'brand'
        and company_name is not null
        and social_url is null
        and social_platform is null
      )
      or
      (
        type = 'creator'
        and company_name is null
        and social_url is not null
        and social_platform is not null
      )
    )
  );

alter policy brand_profiles_insert_own
  on public.brand_profiles to authenticated;
alter policy brand_profiles_update_own
  on public.brand_profiles to authenticated;
alter policy campaign_applications_admin
  on public.campaign_applications to authenticated;
alter policy campaign_applications_select_own
  on public.campaign_applications to authenticated;
alter policy campaign_deliverables_admin
  on public.campaign_deliverables to authenticated;
alter policy campaign_deliverables_select
  on public.campaign_deliverables to authenticated;
alter policy campaign_members_admin
  on public.campaign_members to authenticated;
alter policy campaign_members_select_own
  on public.campaign_members to authenticated;
alter policy campaign_messages_admin
  on public.campaign_messages to authenticated;
alter policy campaigns_admin_select
  on public.campaigns to authenticated;
alter policy campaigns_admin_update
  on public.campaigns to authenticated;
alter policy campaigns_insert_brand
  on public.campaigns to authenticated;
alter policy campaigns_select_own_drafts
  on public.campaigns to authenticated;
alter policy campaigns_update_own
  on public.campaigns to authenticated;
alter policy content_performance_admin
  on public.content_performance to authenticated;
alter policy content_performance_insert_creator
  on public.content_performance to authenticated;
alter policy content_performance_select_brand
  on public.content_performance to authenticated;
alter policy content_performance_select_creator
  on public.content_performance to authenticated;
alter policy content_submissions_admin
  on public.content_submissions to authenticated;
alter policy content_submissions_insert_creator
  on public.content_submissions to authenticated;
alter policy content_submissions_select_brand
  on public.content_submissions to authenticated;
alter policy content_submissions_select_creator
  on public.content_submissions to authenticated;
alter policy content_submissions_update_brand
  on public.content_submissions to authenticated;
alter policy content_submissions_update_creator
  on public.content_submissions to authenticated;
alter policy creator_profiles_admin_select
  on public.creator_profiles to authenticated;
alter policy creator_profiles_admin_update
  on public.creator_profiles to authenticated;
alter policy creator_profiles_insert_own
  on public.creator_profiles to authenticated;
alter policy creator_profiles_select_own
  on public.creator_profiles to authenticated;
alter policy creator_profiles_update_own
  on public.creator_profiles to authenticated;
alter policy cultural_calendar_admin
  on public.cultural_calendar to authenticated;
alter policy function_execution_log_admin
  on public.function_execution_log to authenticated;
alter policy market_benchmarks_admin
  on public.market_benchmarks to authenticated;
alter policy market_compliance_admin
  on public.market_compliance to authenticated;
alter policy notification_queue_admin
  on public.notification_queue to authenticated;
alter policy notifications_admin
  on public.notifications to authenticated;
alter policy notifications_select_own
  on public.notifications to authenticated;
alter policy notifications_update_own
  on public.notifications to authenticated;
alter policy playbooks_admin_all
  on public.playbooks to authenticated;
alter policy profiles_admin_select
  on public.profiles to authenticated;
alter policy profiles_admin_update
  on public.profiles to authenticated;
alter policy profiles_select_own
  on public.profiles to authenticated;
alter policy profiles_update_own
  on public.profiles to authenticated;
alter policy reviews_admin
  on public.reviews to authenticated;
alter policy social_connections_admin_select
  on public.social_connections to authenticated;
alter policy social_connections_delete_own
  on public.social_connections to authenticated;
alter policy social_connections_insert_own
  on public.social_connections to authenticated;
alter policy social_connections_select_own
  on public.social_connections to authenticated;
alter policy social_connections_update_own
  on public.social_connections to authenticated;
alter policy waitlist_select_admin
  on public.waitlist to authenticated;
alter policy waitlist_update_admin
  on public.waitlist to authenticated;

revoke execute on function public.can_apply_to_campaign(uuid)
  from public, anon, authenticated;
revoke execute on function public.can_review_campaign_participant(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.is_campaign_brand(uuid)
  from public, anon, authenticated;
revoke execute on function public.is_campaign_member(uuid)
  from public, anon, authenticated;
revoke execute on function public.queue_notification_email() from public, anon, authenticated;
revoke execute on function public.update_creator_rating()
  from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
      from pg_proc proc
      join pg_namespace namespace on namespace.oid = proc.pronamespace
     where namespace.nspname = 'public'
       and proc.proname = 'rls_auto_enable'
       and proc.pronargs = 0
  ) then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end;
$$;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
