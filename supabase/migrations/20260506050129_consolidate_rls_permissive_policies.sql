-- Consolidate overlapping permissive RLS policies after advisor hardening.
--
-- Supabase's 0006 advisor warns when multiple permissive policies apply to the
-- same role and action. The migration below snapshots public/anon/authenticated
-- policies, expands PUBLIC policies into explicit anon and authenticated role
-- policies, ORs the original access expressions per table/action/role, then
-- drops the overlapping originals.

do $$
declare
  table_rec record;
  policy_rec record;
  action_name text;
  target_role text;
  source_count integer;
  using_expr text;
  check_expr text;
  policy_name text;
begin
  create temp table tmp_policy_merge_source on commit drop as
    select
      schemaname,
      tablename,
      policyname,
      cmd,
      roles,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and exists (
        select 1
          from unnest(roles) role_name
         where role_name::text in ('public', 'anon', 'authenticated')
      );

  for table_rec in
    select distinct schemaname, tablename
      from tmp_policy_merge_source
     order by schemaname, tablename
  loop
    for action_name in
      select unnest(array['select', 'insert', 'update', 'delete'])
    loop
      for target_role in
        select unnest(array['anon', 'authenticated'])
      loop
        select
          count(*),
          string_agg(
            format('(%s)', coalesce(qual, with_check)),
            ' or ' order by policyname
          ),
          string_agg(
            format('(%s)', coalesce(with_check, qual)),
            ' or ' order by policyname
          )
        into source_count, using_expr, check_expr
        from tmp_policy_merge_source
        where schemaname = table_rec.schemaname
          and tablename = table_rec.tablename
          and (cmd = 'ALL' or lower(cmd) = action_name)
          and (
            'public'::name = any(roles)
            or target_role::name = any(roles)
          )
          and (
            (action_name = 'insert' and coalesce(with_check, qual) is not null)
            or (action_name <> 'insert' and coalesce(qual, with_check) is not null)
          );

        if source_count = 0 then
          continue;
        end if;

        policy_name := format(
          'rls_%s_%s_%s_%s',
          left(table_rec.tablename, 24),
          action_name,
          target_role,
          left(md5(table_rec.schemaname || '.' || table_rec.tablename || '.' || action_name || '.' || target_role), 8)
        );

        if action_name = 'select' then
          execute format(
            'create policy %I on %I.%I for select to %I using (%s)',
            policy_name,
            table_rec.schemaname,
            table_rec.tablename,
            target_role,
            using_expr
          );
        elsif action_name = 'insert' then
          execute format(
            'create policy %I on %I.%I for insert to %I with check (%s)',
            policy_name,
            table_rec.schemaname,
            table_rec.tablename,
            target_role,
            check_expr
          );
        elsif action_name = 'update' then
          execute format(
            'create policy %I on %I.%I for update to %I using (%s) with check (%s)',
            policy_name,
            table_rec.schemaname,
            table_rec.tablename,
            target_role,
            using_expr,
            check_expr
          );
        elsif action_name = 'delete' then
          execute format(
            'create policy %I on %I.%I for delete to %I using (%s)',
            policy_name,
            table_rec.schemaname,
            table_rec.tablename,
            target_role,
            using_expr
          );
        end if;
      end loop;
    end loop;

    for policy_rec in
      select distinct policyname
        from tmp_policy_merge_source
       where schemaname = table_rec.schemaname
         and tablename = table_rec.tablename
    loop
      execute format(
        'drop policy if exists %I on %I.%I',
        policy_rec.policyname,
        table_rec.schemaname,
        table_rec.tablename
      );
    end loop;
  end loop;
end;
$$;
