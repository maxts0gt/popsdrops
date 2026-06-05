alter table public.content_performance_metric_values
  drop constraint if exists content_performance_metric_values_unique;

alter table public.content_performance_metric_values
  add constraint content_performance_metric_values_unique
  unique (performance_id, platform, metric_key);
