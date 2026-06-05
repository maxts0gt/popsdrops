set search_path = public, extensions, pg_temp;

do $$
begin
  create type public.campaign_recruitment_visibility as enum (
    'private_invite',
    'shortlist_invite',
    'open_applications'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.campaigns
  add column if not exists recruitment_visibility public.campaign_recruitment_visibility
  not null default 'private_invite';

create index if not exists campaigns_recruitment_visibility_status_idx
  on public.campaigns(recruitment_visibility, status, application_deadline);

comment on type public.campaign_recruitment_visibility is
  'Controls how creators can find or access a campaign: private invite, private shortlist, or open applications.';

comment on column public.campaigns.recruitment_visibility is
  'Private by default. Open applications are intentionally discoverable by creators; private and shortlist campaigns require an invite.';
