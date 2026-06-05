-- auth.identities.email is generated in current Supabase Auth. Keep the
-- processor focused on identity_data for email tombstoning.

create or replace function app_private.process_due_data_deletion_requests(
  batch_size integer default 100
)
returns table (
  request_id uuid,
  deleted_profile_id uuid,
  result text
)
language plpgsql
security definer
set search_path = public, auth, app_private, pg_temp
as $$
declare
  deletion_request record;
  audit_admin_id uuid;
  tombstone_email text;
begin
  for deletion_request in
    select id, profile_id, email
    from public.data_rights_requests
    where request_type = 'deletion'
      and status = 'scheduled'
      and scheduled_for <= now()
    order by scheduled_for asc, created_at asc
    limit greatest(1, least(coalesce(batch_size, 100), 500))
    for update skip locked
  loop
    request_id := deletion_request.id;
    deleted_profile_id := deletion_request.profile_id;
    tombstone_email :=
      'deleted+'
      || replace(deletion_request.profile_id::text, '-', '')
      || '@deleted.popsdrops.local';

    begin
      update public.data_rights_requests
      set status = 'processing',
          processing_error = null,
          reviewed_at = coalesce(reviewed_at, now())
      where id = deletion_request.id;

      delete from public.notification_email_preferences
      where user_id = deletion_request.profile_id;

      delete from public.notifications
      where user_id = deletion_request.profile_id;

      update public.notification_queue
      set email = tombstone_email,
          data = '{}'::jsonb
      where lower(email) = lower(deletion_request.email);

      update public.waitlist
      set email = tombstone_email,
          full_name = 'Deleted user',
          company_name = null,
          industry = null,
          website = null,
          budget_range = null,
          social_url = null,
          follower_range = null,
          markets = '{}',
          reason = null,
          referral_source = null
      where lower(email) = lower(deletion_request.email);

      update public.creator_profiles
      set slug = 'deleted-' || replace(deletion_request.profile_id::text, '-', ''),
          bio = null,
          primary_market = null,
          tiktok = null,
          instagram = null,
          snapchat = null,
          youtube = null,
          facebook = null,
          niches = '{}',
          markets = '{}',
          languages = '{}',
          content_formats = '{}',
          rate_card = null,
          rating = 0,
          review_count = 0,
          avg_response_time_hours = null,
          ranking_score = 0,
          total_earned = 0,
          profile_completeness = 0,
          profile_embedding = null,
          search_vector = null,
          updated_at = now()
      where profile_id = deletion_request.profile_id;

      update public.brand_profiles
      set company_name = 'Deleted company',
          industry = null,
          target_markets = '{}',
          platforms = '{}',
          website = null,
          logo_url = null,
          description = null,
          budget_range = null,
          contact_name = null,
          contact_email = null,
          contact_phone = null,
          preferred_language = 'en',
          updated_at = now()
      where profile_id = deletion_request.profile_id;

      update public.legal_consents
      set email = null
      where profile_id = deletion_request.profile_id;

      update auth.users
      set email = tombstone_email,
          raw_user_meta_data = '{}'::jsonb,
          banned_until = greatest(
            coalesce(banned_until, now()),
            now() + interval '100 years'
          ),
          deleted_at = coalesce(deleted_at, now()),
          updated_at = now()
      where id = deletion_request.profile_id;

      update auth.identities
      set identity_data =
            jsonb_set(
              coalesce(identity_data, '{}'::jsonb),
              '{email}',
              to_jsonb(tombstone_email),
              true
            ),
          updated_at = now()
      where user_id = deletion_request.profile_id;

      update public.profiles
      set full_name = 'Deleted user',
          avatar_url = null,
          email = tombstone_email,
          status = 'suspended',
          onboarding_completed = false,
          updated_at = now()
      where id = deletion_request.profile_id;

      update public.data_rights_requests
      set email = tombstone_email,
          status = 'completed',
          completed_at = now(),
          processed_at = now(),
          processing_error = null
      where id = deletion_request.id;

      select id
      into audit_admin_id
      from public.profiles
      where role = 'admin'
      order by created_at asc
      limit 1;

      if audit_admin_id is not null then
        insert into public.admin_audit_log (
          admin_id,
          action,
          target_type,
          target_id,
          metadata
        )
        values (
          audit_admin_id,
          'process_due_data_deletion_request',
          'data_rights_request',
          deletion_request.id,
          jsonb_build_object(
            'profile_id', deletion_request.profile_id,
            'mode', 'automatic',
            'retention_exception',
            'Campaign, payment, agreement, legal consent, and audit records may remain anonymized or legally retained.'
          )
        );
      end if;

      result := 'completed';
      return next;
    exception
      when others then
        update public.data_rights_requests
        set status = 'failed',
            processing_error = left(sqlerrm, 1000),
            processed_at = now()
        where id = deletion_request.id;

        result := 'failed';
        return next;
    end;
  end loop;
end;
$$;

comment on function app_private.process_due_data_deletion_requests(integer) is
  'Processes due privacy deletion requests in small batches, tombstoning Supabase Auth user fields and anonymizing user-facing PII while preserving legally required campaign, payment, agreement, consent, and audit records.';
