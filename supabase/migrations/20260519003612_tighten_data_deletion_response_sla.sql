-- Tighten account deletion response target for Korea-forward privacy posture.
--
-- Product policy: deletion still auto-processes after the 7-day grace window,
-- but the compliance response target is 10 days instead of the broader
-- GDPR/CCPA windows. This keeps admin work low while giving users a stricter
-- trust promise.

update public.data_rights_requests
set verification_due_at = least(
      coalesce(verification_due_at, created_at + interval '10 days'),
      created_at + interval '10 days'
    ),
    retention_note = 'Deletion is scheduled automatically after 7 days, and the compliance response is due within 10 days. Legal, tax, fraud, reporting, and contractual records are retained or anonymized only where required.',
    updated_at = now()
where request_type = 'deletion'
  and status in ('scheduled', 'processing', 'failed');
