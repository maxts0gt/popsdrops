import { describe, expect, it } from "vitest";

import {
  buildNotificationQueueAttentionItems,
  canRetryNotificationQueueItem,
  canSendNotificationQueueItem,
  formatNotificationDeliveryReason,
  getNotificationQueueRecoveryLabel,
  getNotificationQueueCampaignContext,
  maskNotificationRecipient,
  normalizeNotificationQueueStatusCounts,
} from "./notification-queue-health";

describe("normalizeNotificationQueueStatusCounts", () => {
  it("returns every queue status with zeroes for missing statuses", () => {
    expect(
      normalizeNotificationQueueStatusCounts([
        { status: "failed", count: 2 },
        { status: "skipped", count: 3 },
        { status: "sent", count: "12" },
      ]),
    ).toEqual([
      { status: "pending", count: 0 },
      { status: "failed", count: 2 },
      { status: "skipped", count: 3 },
      { status: "sent", count: 12 },
      { status: "unsupported", count: 0 },
      { status: "archived", count: 0 },
    ]);
  });
});

describe("canRetryNotificationQueueItem", () => {
  it("allows retry for unprocessed failed rows with a supported email template", () => {
    const retryable = {
      notification_id: "2f4b8c5a-0000-4000-9000-888888888888",
      template: "content_approved",
      status: "failed",
      processed_at: null,
    };

    expect(canRetryNotificationQueueItem(retryable)).toBe(true);
    expect(
      canRetryNotificationQueueItem({
        ...retryable,
        notification_id: null,
        template: "account_rejected",
      }),
    ).toBe(true);
    expect(
      canRetryNotificationQueueItem({
        ...retryable,
        template: "legacy_plaintext",
      }),
    ).toBe(false);
    expect(
      canRetryNotificationQueueItem({
        ...retryable,
        status: "sent",
      }),
    ).toBe(false);
    expect(
      canRetryNotificationQueueItem({
        ...retryable,
        processed_at: "2026-05-09T05:28:47.000Z",
      }),
    ).toBe(false);
  });
});

describe("canSendNotificationQueueItem", () => {
  it("allows admins to send pending direct queue rows without a notification record", () => {
    const pendingDirectRow = {
      notification_id: null,
      template: "account_rejected",
      status: "pending",
      processed_at: null,
    };

    expect(canSendNotificationQueueItem(pendingDirectRow)).toBe(true);
    expect(getNotificationQueueRecoveryLabel(pendingDirectRow)).toBe("Send");
    expect(
      getNotificationQueueRecoveryLabel({
        ...pendingDirectRow,
        status: "failed",
      }),
    ).toBe("Retry");
    expect(
      canSendNotificationQueueItem({
        ...pendingDirectRow,
        template: "legacy_plaintext",
      }),
    ).toBe(false);
    expect(
      canSendNotificationQueueItem({
        ...pendingDirectRow,
        processed_at: "2026-05-09T05:28:47.000Z",
      }),
    ).toBe(false);
  });
});

describe("maskNotificationRecipient", () => {
  it("keeps operations useful without exposing the whole recipient email", () => {
    expect(maskNotificationRecipient("campaign.manager@chanel.example")).toBe(
      "c**************r@chanel.example",
    );
    expect(maskNotificationRecipient("li@example.com")).toBe("l*@example.com");
    expect(maskNotificationRecipient("not-an-email")).toBe("not-an-email");
  });
});

describe("formatNotificationDeliveryReason", () => {
  it("turns queue processing reasons into readable operations labels", () => {
    expect(formatNotificationDeliveryReason("email_sent", "sent")).toBe(
      "Email sent",
    );
    expect(
      formatNotificationDeliveryReason(
        "email_preference_suppressed",
        "skipped",
      ),
    ).toBe("Email preference off");
    expect(
      formatNotificationDeliveryReason("unsupported_template", "unsupported"),
    ).toBe("No email template");
    expect(formatNotificationDeliveryReason("email_failed", "failed")).toBe(
      "Delivery failed",
    );
    expect(
      formatNotificationDeliveryReason("legacy_supported_not_replayed", "archived"),
    ).toBe("Legacy email archived");
    expect(
      formatNotificationDeliveryReason(
        "legacy_unsupported_template_closed",
        "archived",
      ),
    ).toBe("Legacy unsupported template");
    expect(formatNotificationDeliveryReason(null, "pending")).toBe(
      "Waiting to send",
    );
    expect(
      formatNotificationDeliveryReason("custom_queue_reason", "failed"),
    ).toBe("Custom queue reason");
  });
});

describe("getNotificationQueueCampaignContext", () => {
  it("extracts the campaign context from queued notification payloads", () => {
    expect(
      getNotificationQueueCampaignContext({
        data: {
          campaign_id: "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
          campaignTitle: "K-Beauty Retail Launch",
        },
      }),
    ).toEqual({
      detail: "K-Beauty Retail Launch",
      href: "/admin/campaigns/4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
      label: "Campaign",
    });

    expect(
      getNotificationQueueCampaignContext({
        campaignId: "d0000000-0000-4000-8000-000000000001",
        campaign_title: "Chrome Launch Smoke Campaign",
      }),
    ).toEqual({
      detail: "Chrome Launch Smoke Campaign",
      href: "/admin/campaigns/d0000000-0000-4000-8000-000000000001",
      label: "Campaign",
    });

    expect(getNotificationQueueCampaignContext(null)).toBeNull();
  });
});

describe("buildNotificationQueueAttentionItems", () => {
  it("prioritizes only active queue rows that require admin action", () => {
    const items = buildNotificationQueueAttentionItems({
      activeQueueCounts: [
        { status: "pending", count: 1 },
        { status: "failed", count: 3 },
        { status: "skipped", count: 0 },
        { status: "sent", count: 0 },
        { status: "unsupported", count: 1 },
        { status: "archived", count: 0 },
      ],
      queueCounts: [
        { status: "pending", count: 1 },
        { status: "failed", count: 3 },
        { status: "skipped", count: 0 },
        { status: "sent", count: 14 },
        { status: "unsupported", count: 1 },
        { status: "archived", count: 0 },
      ],
    });

    expect(items).toEqual([
      {
        count: 3,
        detail: "Retry or investigate",
        href: "#failed-deliveries",
        key: "failed",
        label: "Failed emails",
        tone: "danger",
      },
      {
        count: 1,
        detail: "Waiting to send",
        href: "#delivery-log",
        key: "pending",
        label: "Pending emails",
        tone: "warning",
      },
      {
        count: 1,
        detail: "Template coverage",
        href: "#delivery-log",
        key: "unsupported",
        label: "Unsupported templates",
        tone: "warning",
      },
    ]);
  });

  it("does not treat closed unsupported queue rows as active work", () => {
    const items = buildNotificationQueueAttentionItems({
      activeQueueCounts: [
        { status: "pending", count: 0 },
        { status: "failed", count: 0 },
        { status: "skipped", count: 0 },
        { status: "sent", count: 0 },
        { status: "unsupported", count: 0 },
        { status: "archived", count: 0 },
      ],
      queueCounts: [
        { status: "pending", count: 0 },
        { status: "failed", count: 0 },
        { status: "skipped", count: 0 },
        { status: "sent", count: 5 },
        { status: "unsupported", count: 5 },
        { status: "archived", count: 19 },
      ],
    });

    expect(items).toEqual([]);
  });

  it("does not turn recent report follow-up history into an admin blocker", () => {
    const items = buildNotificationQueueAttentionItems({
      activeQueueCounts: [
        { status: "pending", count: 0 },
        { status: "failed", count: 0 },
        { status: "skipped", count: 0 },
        { status: "sent", count: 0 },
        { status: "unsupported", count: 0 },
        { status: "archived", count: 0 },
      ],
      queueCounts: [
        { status: "pending", count: 0 },
        { status: "failed", count: 0 },
        { status: "skipped", count: 0 },
        { status: "sent", count: 6 },
        { status: "unsupported", count: 0 },
        { status: "archived", count: 0 },
      ],
    });

    expect(items).toEqual([]);
  });
});
