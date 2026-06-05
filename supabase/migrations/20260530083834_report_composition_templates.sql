set search_path = public, extensions, pg_temp;

create table if not exists public.report_composition_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  preset_id text not null default 'custom',
  chart_mode_id text not null,
  block_ids text[] not null,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_composition_templates_name_check
    check (char_length(btrim(name)) between 2 and 80),
  constraint report_composition_templates_description_check
    check (description is null or char_length(btrim(description)) <= 160),
  constraint report_composition_templates_preset_check
    check (preset_id in ('leadership', 'proof_audit', 'creator_performance', 'custom')),
  constraint report_composition_templates_chart_mode_check
    check (chart_mode_id in ('trend', 'comparison', 'proof')),
  constraint report_composition_templates_block_ids_check
    check (
      array_length(block_ids, 1) between 1 and 12
      and block_ids <@ array[
        'executive_summary',
        'channel_story',
        'proof_sources',
        'report_trust',
        'creator_table',
        'recommendations'
      ]::text[]
      and block_ids @> array['report_trust']
    )
);

comment on table public.report_composition_templates is
  'Reusable brand-workspace report compositions for executive-ready campaign exports.';

create unique index if not exists report_composition_templates_brand_name_unique
  on public.report_composition_templates (brand_id, lower(btrim(name)));

create unique index if not exists report_composition_templates_one_default
  on public.report_composition_templates (brand_id)
  where is_default;

create index if not exists report_composition_templates_brand_updated_idx
  on public.report_composition_templates (brand_id, updated_at desc);

drop trigger if exists set_updated_at on public.report_composition_templates;
create trigger set_updated_at
  before update on public.report_composition_templates
  for each row execute function public.update_updated_at();

alter table public.report_composition_templates enable row level security;

grant select, insert, update, delete on public.report_composition_templates to authenticated;
grant select, insert, update, delete on public.report_composition_templates to service_role;

drop policy if exists report_composition_templates_select_access
  on public.report_composition_templates;
create policy report_composition_templates_select_access
  on public.report_composition_templates
  for select
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.current_user_can_access_brand_workspace(brand_id)
  );

drop policy if exists report_composition_templates_write_access
  on public.report_composition_templates;
create policy report_composition_templates_write_access
  on public.report_composition_templates
  for all
  to authenticated
  using (
    app_private.current_user_is_admin()
    or app_private.current_user_can_manage_brand_workspace(brand_id)
  )
  with check (
    app_private.current_user_is_admin()
    or app_private.current_user_can_manage_brand_workspace(brand_id)
  );
