-- Accepted brand teammate management.
--
-- Owners and admins can update or remove accepted teammates, while owners stay
-- protected by server actions and the role check constraint.

set search_path = public, extensions, pg_temp;

do $$
begin
  create policy brand_team_members_delete_admin
    on public.brand_team_members
    for delete
    to authenticated
    using (app_private.current_user_can_manage_brand_team(brand_id));
exception
  when duplicate_object then null;
end $$;

grant select, insert, update, delete on public.brand_team_members to authenticated;
