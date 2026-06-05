-- Report dashboards subscribe to these tables with Supabase Realtime.

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'content_performance'
  ) then
    alter publication supabase_realtime add table public.content_performance;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'campaign_report_tasks'
  ) then
    alter publication supabase_realtime add table public.campaign_report_tasks;
  end if;
end;
$$;
