alter table public.campaign_reporting_plans
  add column if not exists report_template_id uuid
    references public.report_composition_templates(id) on delete set null,
  add column if not exists report_preset_id text not null default 'creator_performance',
  add column if not exists report_chart_mode_id text not null default 'comparison',
  add column if not exists report_block_ids text[] not null default array[
    'executive_summary',
    'channel_story',
    'report_trust',
    'creator_table',
    'recommendations'
  ]::text[];

alter table public.campaign_reporting_plans
  drop constraint if exists campaign_reporting_plans_report_goal_preset,
  add constraint campaign_reporting_plans_report_goal_preset
    check (
      report_preset_id in (
        'leadership',
        'proof_audit',
        'creator_performance',
        'custom'
      )
    ),
  drop constraint if exists campaign_reporting_plans_report_goal_chart_mode,
  add constraint campaign_reporting_plans_report_goal_chart_mode
    check (report_chart_mode_id in ('trend', 'comparison', 'proof')),
  drop constraint if exists campaign_reporting_plans_report_goal_blocks,
  add constraint campaign_reporting_plans_report_goal_blocks
    check (
      cardinality(report_block_ids) between 1 and 12
      and 'report_trust' = any(report_block_ids)
      and report_block_ids <@ array[
        'executive_summary',
        'channel_story',
        'proof_sources',
        'report_trust',
        'creator_table',
        'recommendations'
      ]::text[]
    );

create index if not exists campaign_reporting_plans_report_template_idx
  on public.campaign_reporting_plans(report_template_id)
  where report_template_id is not null;
