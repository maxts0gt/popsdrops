import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTIFICATION_EMAIL_PREFERENCES,
  getNotificationEmailCategory,
  isNotificationEmailSuppressed,
  normalizeNotificationEmailPreferences,
} from "./notification-preferences";

describe("notification email preferences", () => {
  it("treats account notifications as required email", () => {
    expect(getNotificationEmailCategory("account_approved")).toBe("required");
    expect(getNotificationEmailCategory("account_suspended")).toBe("required");
    expect(getNotificationEmailCategory("account_restored")).toBe("required");
    expect(getNotificationEmailCategory("account_review_reopened")).toBe(
      "required",
    );
    expect(getNotificationEmailCategory("brand_team_invitation")).toBe(
      "required",
    );
    expect(getNotificationEmailCategory("data_deletion_scheduled")).toBe(
      "required",
    );
    expect(getNotificationEmailCategory("privacy_request_denied")).toBe(
      "required",
    );
    expect(getNotificationEmailCategory("data_export_ready")).toBe("required");
    expect(
      isNotificationEmailSuppressed("account_rejected", {
        campaignUpdates: false,
        campaignActivity: false,
        reports: false,
      }),
    ).toBe(false);
    expect(
      isNotificationEmailSuppressed("data_deletion_completed", {
        campaignUpdates: false,
        campaignActivity: false,
        reports: false,
      }),
    ).toBe(false);
  });

  it("maps operational notification types to the smallest preference group", () => {
    expect(getNotificationEmailCategory("campaign_update")).toBe(
      "campaignUpdates",
    );
    expect(getNotificationEmailCategory("report_ready_for_review")).toBe(
      "reports",
    );
    expect(getNotificationEmailCategory("content_submitted")).toBe(
      "campaignActivity",
    );
  });

  it("suppresses only the disabled group while keeping the in-app notification alive", () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_EMAIL_PREFERENCES,
      campaignUpdates: false,
    };

    expect(isNotificationEmailSuppressed("campaign_update", preferences)).toBe(
      true,
    );
    expect(
      isNotificationEmailSuppressed("report_follow_up_requested", preferences),
    ).toBe(false);
  });

  it("normalizes missing database rows to opt-in operational defaults", () => {
    expect(normalizeNotificationEmailPreferences(null)).toEqual(
      DEFAULT_NOTIFICATION_EMAIL_PREFERENCES,
    );
    expect(
      normalizeNotificationEmailPreferences({
        email_messages: false,
        email_campaign_activity: null,
        email_reports: true,
      }),
    ).toEqual({
      campaignUpdates: false,
      campaignActivity: true,
      reports: true,
    });
  });
});
