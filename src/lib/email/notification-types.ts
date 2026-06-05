export const EMAIL_NOTIFICATION_TYPES = [
  "account_approved",
  "account_rejected",
  "account_suspended",
  "account_restored",
  "account_review_reopened",
  "brand_team_invitation",
  "application_received",
  "application_accepted",
  "application_rejected",
  "counter_offer",
  "campaign_match",
  "content_submitted",
  "content_approved",
  "revision_requested",
  "campaign_completed",
  "campaign_update",
  "payment_received",
  "report_ready_for_review",
  "report_correction_requested",
  "report_correction_resubmitted",
  "report_follow_up_requested",
  "data_deletion_scheduled",
  "data_deletion_completed",
  "data_export_ready",
  "privacy_request_denied",
] as const;

export type EmailNotificationType = (typeof EMAIL_NOTIFICATION_TYPES)[number];

export function isEmailNotificationType(
  type: string,
): type is EmailNotificationType {
  return (EMAIL_NOTIFICATION_TYPES as readonly string[]).includes(type);
}
