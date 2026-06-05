drop policy if exists enterprise_concierge_requests_insert_brand
  on public.enterprise_concierge_requests;
drop policy if exists enterprise_concierge_requests_select_brand
  on public.enterprise_concierge_requests;
drop policy if exists enterprise_concierge_requests_select_admin
  on public.enterprise_concierge_requests;
drop policy if exists enterprise_concierge_requests_select_access
  on public.enterprise_concierge_requests;
drop policy if exists enterprise_concierge_requests_update_admin
  on public.enterprise_concierge_requests;

create policy enterprise_concierge_requests_insert_brand
  on public.enterprise_concierge_requests
  for insert
  to authenticated
  with check (
    brand_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'brand'
    )
  );

create policy enterprise_concierge_requests_select_access
  on public.enterprise_concierge_requests
  for select
  to authenticated
  using (
    brand_id = (select auth.uid())
    or (select app_private.current_user_is_admin())
  );

create policy enterprise_concierge_requests_update_admin
  on public.enterprise_concierge_requests
  for update
  to authenticated
  using ((select app_private.current_user_is_admin()))
  with check ((select app_private.current_user_is_admin()));
