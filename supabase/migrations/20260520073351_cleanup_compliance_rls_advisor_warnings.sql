set search_path = public, extensions, pg_temp;

drop policy if exists data_rights_requests_admin
  on public.data_rights_requests;
drop policy if exists data_rights_requests_select_own
  on public.data_rights_requests;
drop policy if exists data_rights_requests_insert_own
  on public.data_rights_requests;
drop policy if exists data_rights_requests_select_access
  on public.data_rights_requests;
drop policy if exists data_rights_requests_insert_access
  on public.data_rights_requests;
drop policy if exists data_rights_requests_update_admin
  on public.data_rights_requests;

create policy data_rights_requests_select_access
  on public.data_rights_requests
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  );

create policy data_rights_requests_insert_access
  on public.data_rights_requests
  for insert
  to authenticated
  with check (
    (
      profile_id = (select auth.uid())
      and (
        (
          request_type = 'deletion'
          and status = 'scheduled'
          and scheduled_for is not null
        )
        or (
          request_type <> 'deletion'
          and status = 'pending'
        )
      )
    )
    or (select app_private.current_user_is_admin())
  );

create policy data_rights_requests_update_admin
  on public.data_rights_requests
  for update
  to authenticated
  using ((select app_private.current_user_is_admin()))
  with check ((select app_private.current_user_is_admin()));

drop policy if exists legal_consents_admin
  on public.legal_consents;
drop policy if exists legal_consents_select_own
  on public.legal_consents;
drop policy if exists legal_consents_insert_own
  on public.legal_consents;
drop policy if exists legal_consents_insert_public_request
  on public.legal_consents;
drop policy if exists legal_consents_select_access
  on public.legal_consents;
drop policy if exists legal_consents_insert_access
  on public.legal_consents;

create policy legal_consents_select_access
  on public.legal_consents
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  );

create policy legal_consents_insert_access
  on public.legal_consents
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  );

create policy legal_consents_insert_public_request
  on public.legal_consents
  for insert
  to anon
  with check (
    profile_id is null
    and email is not null
    and source = 'request_invite'
  );
