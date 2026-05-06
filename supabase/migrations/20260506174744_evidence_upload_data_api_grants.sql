-- Explicit Data API grants for creator evidence upload flows.
-- Supabase no longer exposes new tables automatically, so grants must be
-- stated alongside RLS policies.

grant select, insert, update on table public.content_performance_evidence
  to authenticated, service_role;

grant delete on table public.content_performance_evidence
  to service_role;

grant select on table public.campaign_report_tasks
  to authenticated, service_role;

grant select on table public.campaign_reporting_plans
  to authenticated, service_role;
