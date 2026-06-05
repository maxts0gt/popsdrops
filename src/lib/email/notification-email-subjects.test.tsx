import { describe, expect, it } from "vitest";

import { buildNotificationEmail } from "./notification-email-builder";

const sampleData = {
  title: "Campaign announcement",
  body: "A campaign manager action needs attention.",
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
    brand_name: "Atelier Maison",
    expires_at: "2026-06-03T00:00:00.000Z",
    invited_by_name: "Max Tengri",
    login_url: "https://popsdrops.com/login",
  },
};

describe("notification email subject lines", () => {
  it.each([
    ["content_submitted", "Content submitted: Chrome Launch Smoke Campaign"],
    ["content_approved", "Content approved: Chrome Launch Smoke Campaign"],
    ["revision_requested", "Changes requested: Chrome Launch Smoke Campaign"],
    ["application_received", "Application received: Chrome Launch Smoke Campaign"],
    ["application_accepted", "Application accepted: Chrome Launch Smoke Campaign"],
    ["counter_offer", "Counter offer: Chrome Launch Smoke Campaign, $520"],
    ["brand_team_invitation", "You were invited to Atelier Maison on PopsDrops"],
    ["data_deletion_scheduled", "PopsDrops account deletion scheduled"],
    ["data_deletion_completed", "PopsDrops account deletion completed"],
    ["data_export_ready", "PopsDrops data export ready"],
    ["privacy_request_denied", "PopsDrops privacy request update"],
  ] as const)("uses a concise operational subject for %s", (type, subject) => {
    const email = buildNotificationEmail({
      type,
      recipientName: "Max Tengri",
      data: sampleData,
    });

    expect(email?.subject).toBe(subject);
    expect(email?.subject).not.toContain('"');
    expect(email?.subject).not.toContain(" - ");
  });
});
