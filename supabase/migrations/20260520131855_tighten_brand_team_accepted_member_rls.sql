-- Require accepted brand teammates for team visibility and management.
--
-- Brand workspace campaign RLS already uses accepted members only. The team
-- management helpers must follow the same model so a draft or malformed member
-- row cannot grant access before acceptance.

set search_path = public, extensions, pg_temp;

create or replace function app_private.current_user_can_view_brand_team(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() = target_brand_id
    or exists (
      select 1
        from public.brand_team_members member
       where member.brand_id = target_brand_id
         and member.user_id = auth.uid()
         and member.accepted_at is not null
    )
    or app_private.current_user_is_admin();
$$;

create or replace function app_private.current_user_can_manage_brand_team(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() = target_brand_id
    or exists (
      select 1
        from public.brand_team_members member
       where member.brand_id = target_brand_id
         and member.user_id = auth.uid()
         and member.accepted_at is not null
         and member.role in ('owner', 'admin')
    )
    or app_private.current_user_is_admin();
$$;
