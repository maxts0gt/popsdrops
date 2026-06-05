import { render } from "@react-email/components";
import { describe, expect, it, vi } from "vitest";

vi.mock("./send", () => ({
  sendEmail: vi.fn(),
}));

import {
  buildNotificationEmail,
  EMAIL_NOTIFICATION_TYPES,
} from "./notify";

const activeProductNotificationTypes = [
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

const campaignRelatedNotificationTypes = new Set<string>(
  activeProductNotificationTypes.filter(
    (type) =>
      ![
        "account_approved",
        "account_rejected",
        "account_suspended",
        "account_restored",
        "account_review_reopened",
        "brand_team_invitation",
        "data_deletion_scheduled",
        "data_deletion_completed",
        "data_export_ready",
        "privacy_request_denied",
      ].includes(type),
  ),
);

function sampleDataFor(type: string) {
  return {
    title: "Campaign update",
    body: "A campaign manager action needs your attention.",
    data: {
      accepted_rate: 475,
      campaign_id: "campaign-1",
      campaign_title: "Chrome Launch Smoke Campaign",
      counter_rate: 520,
      creator_name: "Mina Park",
      feedback: "Use the complete native analytics view.",
      message: "Please confirm the revised scope.",
      platform: "Instagram",
      proposed_rate: 425,
      reason: "The campaign manager chose a different creator fit.",
      processed_at: "2026-05-26T00:00:00.000Z",
      request_id: "request-1",
      request_type: "export",
      download_expires_at: "2026-06-05T00:00:00.000Z",
      role: type === "account_approved" ? "brand" : "creator",
      scheduled_for: "2026-05-25T00:00:00.000Z",
      verification_due_at: "2026-05-28T00:00:00.000Z",
      brand_name: "Atelier Maison",
      expires_at: "2026-06-03T00:00:00.000Z",
      invited_by_name: "Max Tengri",
      login_url: "https://popsdrops.com/login",
    },
  };
}

describe("notification email coverage", () => {
  it("email-backs every active product notification that creates campaign work", () => {
    expect(EMAIL_NOTIFICATION_TYPES).toEqual(activeProductNotificationTypes);
  });

  it(
    "renders every email-backed notification through the branded template system",
    async () => {
      for (const type of EMAIL_NOTIFICATION_TYPES) {
        const email = buildNotificationEmail({
          type,
          recipientName: "Max Tengri",
          data: sampleDataFor(type),
        });

        expect(email, type).toBeTruthy();
        expect(email?.subject, type).toMatch(/\S/);

        const html = await render(email!.template);
        expect(html, type).toContain("PopsDrops");
        expect(html, type).toContain("Tengri Vertex, LLC");
        expect(html, type).toContain("Next action");
        if (campaignRelatedNotificationTypes.has(type)) {
          expect(html, type).toContain("Chrome Launch Smoke Campaign");
        }
        expect(html, type).not.toContain("<body><p>");
        expect(html, type).not.toContain(String.fromCharCode(0x2014));
      }
    },
    10000,
  );

  it("keeps the email shell quiet: product header, legal footer, no duplicate legal noise", async () => {
    const email = buildNotificationEmail({
      type: "campaign_completed",
      recipientName: "Max Tengri",
      data: sampleDataFor("campaign_completed"),
    });

    const html = await render(email!.template);

    expect(html).toContain("PopsDrops");
    expect(html).toContain("Campaign operations");
    expect(html.match(/Tengri Vertex, LLC/g)).toHaveLength(1);
    expect(html).not.toContain("fonts.googleapis.com/css2");
  });

  it("uses the notification title for campaign update emails", async () => {
    const email = buildNotificationEmail({
      type: "campaign_update",
      recipientName: "Max Tengri",
      data: {
        title: "Content deadline extended",
        body: "The content deadline has moved to May 18.",
        data: {
          campaign_id: "campaign-1",
          campaign_title: "Chrome Launch Smoke Campaign",
        },
      },
    });

    expect(email?.subject).toBe(
      "Content deadline extended: Chrome Launch Smoke Campaign",
    );

    const html = await render(email!.template);
    expect(html).toContain("Content deadline extended.");
    expect(html).toContain("The content deadline has moved to May 18.");
  });
});
