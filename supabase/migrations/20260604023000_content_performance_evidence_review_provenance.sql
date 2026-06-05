set search_path = public, extensions, pg_temp;

alter table public.content_performance_evidence
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

comment on column public.content_performance_evidence.reviewed_by is
  'Brand workspace reviewer who last decided this proof artifact.';

comment on column public.content_performance_evidence.reviewed_at is
  'Timestamp when the proof artifact was last verified or rejected by the brand workspace.';
