const ADMIN_AUDIT_ACTION_LABELS: Record<string, string> = {
  approve_profile: "Approve profile",
  reject_profile: "Reject profile",
  approve_waitlist_request: "Approve access",
  reject_waitlist_request: "Reject access",
  suspend_user: "Suspend access",
  unsuspend_user: "Restore access",
  re_review_profile: "Send to review",
  pause_campaign: "Pause campaign",
  cancel_campaign: "Cancel campaign",
  resume_campaign: "Resume campaign",
  campaign_responsibility_updated: "Assign campaign responsibility",
  extend_content_deadline: "Extend content deadline",
  update_campaign_service_fee_status: "Update service fee",
  excuse_report_task: "Excuse report task",
  retry_report_export: "Retry report export",
  record_proof_review_intervention: "Record proof review intervention",
  update_enterprise_concierge_request_status: "Update Concierge request",
  quote_enterprise_concierge_request: "Quote Concierge request",
  update_data_rights_request_status: "Update privacy request",
  creator_payment_status_updated: "Track creator payment",
  update_setting: "Update setting",
  send_notification_email: "Send email",
  retry_notification_email: "Retry email",
  brand_team_invitation_created: "Invite teammate",
  brand_team_invitation_revoked: "Revoke invite",
  brand_team_invitation_accepted: "Accept invite",
  brand_team_member_role_updated: "Change team role",
  brand_team_member_removed: "Remove teammate",
};

function sentenceCaseAuditAction(action: string): string {
  const words = action
    .split("_")
    .filter(Boolean)
    .map((word) => word.toLowerCase());

  if (words.length === 0) return "Unknown action";

  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

export function getAdminAuditActionLabel(action: string): string {
  return ADMIN_AUDIT_ACTION_LABELS[action] ?? sentenceCaseAuditAction(action);
}
