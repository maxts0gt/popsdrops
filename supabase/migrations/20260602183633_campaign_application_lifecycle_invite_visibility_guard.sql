-- Keep direct Data API creator applications aligned with campaign visibility.
-- UI/server actions already enforce private-invite links, but the database
-- function behind application RLS must also reject direct insert bypasses.

set search_path = public, extensions, pg_temp;

create or replace function app_private.creator_social_account_matches_invite(
  account jsonb,
  normalized_contact text
)
returns boolean
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select case
    when account is null then false
    else (
      with invite_contact as (
        select
          lower(trim(normalized_contact)) as raw_handle,
          regexp_replace(lower(trim(normalized_contact)), '^@+', '') as bare_handle
      )
      select exists (
        select 1
          from invite_contact
         where invite_contact.bare_handle <> ''
           and (
             lower(coalesce(account ->> 'handle', '')) in (
               invite_contact.raw_handle,
               invite_contact.bare_handle,
               '@' || invite_contact.bare_handle
             )
             or lower(coalesce(account ->> 'url', '')) like
               '%/' || invite_contact.bare_handle
             or lower(coalesce(account ->> 'url', '')) like
               '%/@' || invite_contact.bare_handle
             or lower(coalesce(account ->> 'url', '')) like
               '%/' || invite_contact.bare_handle || '/%'
             or lower(coalesce(account ->> 'url', '')) like
               '%/@' || invite_contact.bare_handle || '/%'
             or lower(coalesce(account ->> 'url', '')) like
               '%/' || invite_contact.bare_handle || '?%'
             or lower(coalesce(account ->> 'url', '')) like
               '%/@' || invite_contact.bare_handle || '?%'
             or lower(coalesce(account::text, '')) like
               '%"handle": "@' || invite_contact.bare_handle || '"%'
             or lower(coalesce(account::text, '')) like
               '%"handle": "' || invite_contact.bare_handle || '"%'
           )
      )
    )
  end;
$$;

comment on function app_private.creator_social_account_matches_invite(jsonb, text) is
  'Matches a normalized @handle invite against a creator social account JSON object.';

create or replace function app_private.creator_matches_campaign_application_invite(
  campaign_uuid uuid,
  creator_uuid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaign_creator_invites invite
      join public.profiles profiles
        on profiles.id = creator_uuid
      left join public.creator_profiles creator_profile
        on creator_profile.profile_id = profiles.id
     where creator_uuid = auth.uid()
       and invite.campaign_id = campaign_uuid
       and invite.status in ('manual', 'queued', 'sent')
       and (
         (
           invite.contact_type = 'email'
           and lower(trim(profiles.email)) = invite.normalized_contact
         )
         or (
           invite.contact_type = 'handle'
           and (
             app_private.creator_social_account_matches_invite(
               creator_profile.tiktok,
               invite.normalized_contact
             )
             or app_private.creator_social_account_matches_invite(
               creator_profile.instagram,
               invite.normalized_contact
             )
             or app_private.creator_social_account_matches_invite(
               creator_profile.snapchat,
               invite.normalized_contact
             )
             or app_private.creator_social_account_matches_invite(
               creator_profile.youtube,
               invite.normalized_contact
             )
             or app_private.creator_social_account_matches_invite(
               creator_profile.facebook,
               invite.normalized_contact
             )
           )
         )
       )
  );
$$;

comment on function app_private.creator_matches_campaign_application_invite(uuid, uuid) is
  'True when the current creator matches a non-failed email or handle invite for a private campaign.';

create or replace function app_private.can_apply_to_campaign(campaign_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.campaigns campaign
     where campaign.id = campaign_uuid
       and campaign.status = 'recruiting'
       and (
         campaign.application_deadline is null
         or campaign.application_deadline >= current_date
       )
       and (
         coalesce(campaign.service_fee_cents, 0) <= 0
         or campaign.service_fee_status = 'paid'
       )
       and campaign.brand_id <> auth.uid()
       and (
         campaign.recruitment_visibility = 'open_applications'
         or (
           campaign.recruitment_visibility in ('private_invite', 'shortlist_invite')
           and app_private.creator_matches_campaign_application_invite(campaign.id, auth.uid())
         )
       )
  );
$$;

comment on function app_private.can_apply_to_campaign(uuid) is
  'True only while a creator can apply to a recruiting, unlocked campaign and satisfies its recruitment visibility rules.';

grant execute on function app_private.creator_social_account_matches_invite(jsonb, text)
  to authenticated, service_role;
grant execute on function app_private.creator_matches_campaign_application_invite(uuid, uuid)
  to authenticated, service_role;
grant execute on function app_private.can_apply_to_campaign(uuid)
  to authenticated, service_role;
