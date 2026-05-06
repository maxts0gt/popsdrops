alter table public.campaigns
  add column if not exists performance_due_date timestamptz;

comment on column public.campaigns.performance_due_date is
  'Deadline for creators to submit post evidence and native platform performance metrics.';
