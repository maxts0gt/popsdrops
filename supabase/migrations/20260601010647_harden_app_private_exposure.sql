-- Finalize app_private as an authenticated-only helper schema.
-- Older migrations temporarily granted broad anonymous execution so RLS/storage
-- policies could settle while features were still moving. Private-beta hardening
-- keeps public RPC wrappers stable and removes direct anonymous access to
-- private lifecycle helpers.

revoke usage on schema app_private from anon, public;
grant usage on schema app_private to authenticated, service_role;

revoke execute on all functions in schema app_private from anon, public;

grant execute on function app_private.can_apply_to_campaign(uuid)
  to authenticated, service_role;
grant execute on function app_private.can_review_campaign_participant(uuid, uuid)
  to authenticated, service_role;
grant execute on function app_private.accept_counter_offer(uuid)
  to authenticated, service_role;

grant execute on function app_private.current_user_can_view_brand_team(uuid)
  to authenticated, service_role;
grant execute on function app_private.current_user_can_manage_brand_team(uuid)
  to authenticated, service_role;
grant execute on function app_private.current_user_can_access_brand_workspace(uuid)
  to authenticated, service_role;
grant execute on function app_private.current_user_can_manage_brand_workspace(uuid)
  to authenticated, service_role;
grant execute on function app_private.is_campaign_brand(uuid)
  to authenticated, service_role;

grant execute on function app_private.campaign_accepts_creator_invites(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_accepts_application_decisions(uuid)
  to authenticated, service_role;
do $$
begin
  if to_regprocedure('app_private.campaign_accepts_agreement_updates(uuid)') is not null then
    execute 'grant execute on function app_private.campaign_accepts_agreement_updates(uuid) to authenticated, service_role';
  end if;
end $$;
grant execute on function app_private.campaign_accepts_creator_work(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_accepts_content_decisions(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_accepts_proof_submission(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_accepts_proof_decisions(uuid)
  to authenticated, service_role;

grant execute on function app_private.published_campaign_agreement(uuid)
  to authenticated, service_role;
grant execute on function app_private.campaign_member_has_required_agreement(uuid)
  to authenticated, service_role;
grant execute on function app_private.current_user_has_campaign_agreement_access(uuid)
  to authenticated, service_role;
grant execute on function app_private.can_read_campaign_agreement_object(text)
  to authenticated, service_role;
grant execute on function app_private.can_write_campaign_agreement_object(text)
  to authenticated, service_role;
grant execute on function app_private.can_read_campaign_asset_object(text)
  to authenticated, service_role;
grant execute on function app_private.can_write_campaign_agreement_object(text)
  to authenticated, service_role;

grant execute on function app_private.submit_creator_report_task(uuid, timestamptz)
  to authenticated, service_role;
grant execute on function app_private.link_creator_performance_evidence(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function app_private.process_due_data_deletion_requests(integer)
  to service_role;
grant execute on function app_private.queue_data_rights_deletion_email()
  to service_role;

comment on schema app_private is
  'Private helper schema for RLS, triggers, and service-role operations. Anonymous clients must use public tables/RPC wrappers protected by RLS, not direct app_private function calls.';
