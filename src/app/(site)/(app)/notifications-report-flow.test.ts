import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getCreatorNotificationHref } from "../../../lib/campaigns/creator-campaign-links";
import { getBrandNotificationHref } from "../../../lib/campaigns/brand-campaign-links";

const brandNotificationsSource = readFileSync(
  new URL("./b/notifications/page.tsx", import.meta.url),
  "utf8",
);
const creatorNotificationsSource = readFileSync(
  new URL("./i/notifications/page.tsx", import.meta.url),
  "utf8",
);

describe("report operation notifications", () => {
  it("keeps email delivery controls inside both notification inboxes", () => {
    expect(brandNotificationsSource).toContain(
      "NotificationEmailPreferencesPanel",
    );
    expect(creatorNotificationsSource).toContain(
      "NotificationEmailPreferencesPanel",
    );
  });

  it("uses quiet unread notification states instead of full-height start borders", () => {
    for (const source of [brandNotificationsSource, creatorNotificationsSource]) {
      expect(source).not.toContain("border-s-2");
      expect(source).toContain('data-read-state={!n.read ? "unread" : "read"}');
      expect(source).toContain("ring-slate-900/10");
    }
  });

  it("routes brand report-ready notifications to the campaign report", () => {
    expect(brandNotificationsSource).toContain("report_ready_for_review");
    expect(brandNotificationsSource).toContain("report_correction_resubmitted");
    expect(
      getBrandNotificationHref("report_ready_for_review", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1/report");
  });

  it("routes brand operational notifications to the matching campaign tab", () => {
    expect(
      getBrandNotificationHref("new_application", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1?tab=creators");
    expect(
      getBrandNotificationHref("content_submitted", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1?tab=content");
    expect(
      getBrandNotificationHref("performance_submitted", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1?tab=reporting");
    expect(
      getBrandNotificationHref("application_received", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1?tab=creators");
  });

  it("uses canonical database notification types in both inboxes", () => {
    expect(brandNotificationsSource).toContain("application_received");
    expect(brandNotificationsSource).toContain("review_received");
    expect(creatorNotificationsSource).toContain("content_due_soon");
    expect(creatorNotificationsSource).toContain("payment_received");
    expect(creatorNotificationsSource).toContain("review_received");
  });

  it("routes creator report correction notifications to the campaign room", () => {
    expect(creatorNotificationsSource).toContain("report_correction_requested");
    expect(creatorNotificationsSource).toContain("report_follow_up_requested");
    expect(creatorNotificationsSource).toContain(
      "getCreatorNotificationHref",
    );
    expect(
      getCreatorNotificationHref("report_correction_requested", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/campaigns/campaign-1?tab=submit");
    expect(
      getCreatorNotificationHref("content_due_soon", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/campaigns/campaign-1?tab=tasks");
    expect(
      getCreatorNotificationHref("application_accepted", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/campaigns/campaign-1?tab=brief");
    expect(
      getCreatorNotificationHref("campaign_match", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/discover/campaign-1");
    expect(
      getCreatorNotificationHref("report_follow_up_requested", null),
    ).toBe("/i/campaigns");
  });

  it("marks individual notifications read from the row click", () => {
    for (const source of [brandNotificationsSource, creatorNotificationsSource]) {
      expect(source).toContain("markNotificationRead");
      expect(source).toContain("handleNotificationClick");
      expect(source).toContain("event.preventDefault()");
      expect(source).toContain("await markNotificationRead(n.id)");
      expect(source).toContain("router.push(href)");
      expect(source).toContain('.eq("id", notificationId)');
    }
  });

  it("rolls back mark-all-read when the database update fails", () => {
    for (const source of [brandNotificationsSource, creatorNotificationsSource]) {
      expect(source).toContain("previousNotifications");
      expect(source).toContain("setNotifications(previousNotifications)");
      expect(source).toContain("toast.error(t(\"readUpdateError\"))");
    }
  });

  it("shows an intentional all-read state without replacing the feed", () => {
    for (const source of [brandNotificationsSource, creatorNotificationsSource]) {
      expect(source).toContain("unreadCount === 0");
      expect(source).toContain('t("allCaughtUp")');
    }
  });
});
