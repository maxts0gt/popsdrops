import type { EmailNotificationType } from "./notification-types";

export type NotificationEmailPreferenceCategory =
  | "required"
  | "campaignActivity"
  | "campaignUpdates"
  | "reports";

export type NotificationEmailPreferences = {
  campaignActivity: boolean;
  campaignUpdates: boolean;
  reports: boolean;
};

export type NotificationEmailPreferencesRow = {
  email_campaign_activity?: boolean | null;
  email_messages?: boolean | null;
  email_reports?: boolean | null;
} | null;

export const DEFAULT_NOTIFICATION_EMAIL_PREFERENCES: NotificationEmailPreferences =
  {
    campaignActivity: true,
    campaignUpdates: true,
    reports: true,
  };

const NOTIFICATION_EMAIL_CATEGORIES: Record<
  EmailNotificationType,
  NotificationEmailPreferenceCategory
> = {
  account_approved: "required",
  account_rejected: "required",
  account_suspended: "required",
  account_restored: "required",
  account_review_reopened: "required",
  brand_team_invitation: "required",
  application_received: "campaignActivity",
  application_accepted: "campaignActivity",
  application_rejected: "campaignActivity",
  counter_offer: "campaignActivity",
  campaign_match: "campaignActivity",
  content_submitted: "campaignActivity",
  content_approved: "campaignActivity",
  revision_requested: "campaignActivity",
  campaign_completed: "reports",
  campaign_update: "campaignUpdates",
  payment_received: "campaignActivity",
  report_ready_for_review: "reports",
  report_correction_requested: "reports",
  report_correction_resubmitted: "reports",
  report_follow_up_requested: "reports",
  data_deletion_scheduled: "required",
  data_deletion_completed: "required",
  data_export_ready: "required",
  privacy_request_denied: "required",
};

function booleanOrDefault(value: boolean | null | undefined) {
  return typeof value === "boolean" ? value : true;
}

export function getNotificationEmailCategory(
  type: EmailNotificationType,
): NotificationEmailPreferenceCategory {
  return NOTIFICATION_EMAIL_CATEGORIES[type];
}

export function normalizeNotificationEmailPreferences(
  row: NotificationEmailPreferencesRow,
): NotificationEmailPreferences {
  return {
    campaignActivity: booleanOrDefault(row?.email_campaign_activity),
    campaignUpdates: booleanOrDefault(row?.email_messages),
    reports: booleanOrDefault(row?.email_reports),
  };
}

export function isNotificationEmailSuppressed(
  type: EmailNotificationType,
  preferences: NotificationEmailPreferences,
) {
  const category = getNotificationEmailCategory(type);
  if (category === "required") return false;

  return preferences[category] === false;
}
