-- Move legacy manual deletion requests into the automatic deletion workflow.

update public.data_rights_requests
set status = 'scheduled',
    scheduled_for = coalesce(scheduled_for, created_at + interval '7 days'),
    verification_due_at = coalesce(verification_due_at, created_at + interval '28 days'),
    retention_note = 'Deletion is scheduled automatically after 7 days. Legal, tax, fraud, reporting, and contractual records are retained or anonymized only where required.',
    updated_at = now()
where request_type = 'deletion'
  and status = 'pending';
