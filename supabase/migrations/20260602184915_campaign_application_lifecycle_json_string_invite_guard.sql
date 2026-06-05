-- Support creator social accounts stored as JSON strings as well as JSON
-- objects. The smoke/dev creator stores tiktok/instagram as "@handle" JSONB
-- strings, while production profiles may store { handle, url, followers }.

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
      ),
      social_account as (
        select
          lower(coalesce(account ->> 'handle', '')) as object_handle,
          lower(coalesce(account ->> 'url', '')) as object_url,
          trim(both '"' from lower(coalesce(account::text, ''))) as scalar_value
      )
      select exists (
        select 1
          from invite_contact, social_account
         where invite_contact.bare_handle <> ''
           and (
             social_account.object_handle in (
               invite_contact.raw_handle,
               invite_contact.bare_handle,
               '@' || invite_contact.bare_handle
             )
             or social_account.scalar_value in (
               invite_contact.raw_handle,
               invite_contact.bare_handle,
               '@' || invite_contact.bare_handle
             )
             or social_account.object_url like
               '%/' || invite_contact.bare_handle
             or social_account.object_url like
               '%/@' || invite_contact.bare_handle
             or social_account.object_url like
               '%/' || invite_contact.bare_handle || '/%'
             or social_account.object_url like
               '%/@' || invite_contact.bare_handle || '/%'
             or social_account.object_url like
               '%/' || invite_contact.bare_handle || '?%'
             or social_account.object_url like
               '%/@' || invite_contact.bare_handle || '?%'
             or social_account.scalar_value like
               '%/' || invite_contact.bare_handle
             or social_account.scalar_value like
               '%/@' || invite_contact.bare_handle
             or social_account.scalar_value like
               '%/' || invite_contact.bare_handle || '/%'
             or social_account.scalar_value like
               '%/@' || invite_contact.bare_handle || '/%'
             or social_account.scalar_value like
               '%/' || invite_contact.bare_handle || '?%'
             or social_account.scalar_value like
               '%/@' || invite_contact.bare_handle || '?%'
           )
      )
    )
  end;
$$;

comment on function app_private.creator_social_account_matches_invite(jsonb, text) is
  'Matches a normalized @handle invite against creator social account JSON objects, URLs, or JSON string shorthand.';

grant execute on function app_private.creator_social_account_matches_invite(jsonb, text)
  to authenticated, service_role;
