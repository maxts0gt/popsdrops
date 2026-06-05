-- Remove the abandoned social OAuth/autofetch architecture.
--
-- PopsDrops reporting is evidence-first: creators submit native platform
-- screenshots and values, then the system extracts and verifies evidence.
-- We do not store creator social OAuth tokens or promise automatic platform
-- metric syncing.

drop table if exists public.social_connections cascade;

drop type if exists public.social_connection_status;

alter table public.content_submissions
  drop column if exists platform_post_id;

alter table public.content_performance
  drop column if exists data_source;
