set search_path = public, extensions, pg_temp;

alter table public.report_composition_templates
  add column if not exists report_presentation jsonb not null default jsonb_build_object(
    'coverMode', 'campaign_visual',
    'typography', 'quiet',
    'density', 'editorial'
  );

alter table public.campaign_reporting_plans
  add column if not exists report_presentation jsonb not null default jsonb_build_object(
    'coverMode', 'campaign_visual',
    'typography', 'quiet',
    'density', 'editorial'
  );

alter table public.report_composition_templates
  drop constraint if exists report_composition_templates_presentation_shape,
  add constraint report_composition_templates_presentation_shape
    check (
      jsonb_typeof(report_presentation) = 'object'
      and coalesce(report_presentation->>'coverMode', 'campaign_visual')
        in ('campaign_visual', 'proof_room')
      and coalesce(report_presentation->>'typography', 'quiet')
        in ('quiet', 'compact')
      and coalesce(report_presentation->>'density', 'editorial')
        in ('editorial', 'compact')
    ),
  drop constraint if exists report_composition_templates_block_ids_check,
  add constraint report_composition_templates_block_ids_check
    check (
      array_length(block_ids, 1) between 1 and 12
      and block_ids <@ array[
        'report_framing',
        'executive_summary',
        'channel_story',
        'proof_sources',
        'report_trust',
        'creator_table',
        'recommendations'
      ]::text[]
      and block_ids @> array['report_trust']
    );

alter table public.campaign_reporting_plans
  drop constraint if exists campaign_reporting_plans_report_goal_blocks,
  add constraint campaign_reporting_plans_report_goal_blocks
    check (
      cardinality(report_block_ids) between 1 and 12
      and 'report_trust' = any(report_block_ids)
      and report_block_ids <@ array[
        'report_framing',
        'executive_summary',
        'channel_story',
        'proof_sources',
        'report_trust',
        'creator_table',
        'recommendations'
      ]::text[]
    ),
  drop constraint if exists campaign_reporting_plans_report_presentation_shape,
  add constraint campaign_reporting_plans_report_presentation_shape
    check (
      jsonb_typeof(report_presentation) = 'object'
      and coalesce(report_presentation->>'coverMode', 'campaign_visual')
        in ('campaign_visual', 'proof_room')
      and coalesce(report_presentation->>'typography', 'quiet')
        in ('quiet', 'compact')
      and coalesce(report_presentation->>'density', 'editorial')
        in ('editorial', 'compact')
    );

comment on column public.report_composition_templates.report_presentation is
  'Executive report presentation settings: cover mode, typography, and density.';

comment on column public.campaign_reporting_plans.report_presentation is
  'Campaign-specific executive report presentation settings.';
