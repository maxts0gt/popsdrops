import { describe, expect, it } from "vitest";

import {
  getAdminAuditDetailsLabel,
  getAdminAuditTargetLabel,
} from "./audit-entry-display";

describe("admin audit entry display", () => {
  it("uses team invitation email as the target instead of raw ids", () => {
    expect(
      getAdminAuditTargetLabel({
        target_id: "d3923d38-f8f9-411c-a2db-160ef7515218",
        metadata: {
          target_email: "brand-team@example.com",
          target_role: "viewer",
        },
      }),
    ).toBe("brand-team@example.com");
  });

  it("summarizes brand team role changes without exposing raw metadata", () => {
    expect(
      getAdminAuditDetailsLabel({
        action: "brand_team_member_role_updated",
        metadata: {
          previous_role: "manager",
          target_role: "viewer",
        },
      }),
    ).toBe("Manager to Viewer");
  });

  it("shows brand team invite and removal roles as short details", () => {
    expect(
      getAdminAuditDetailsLabel({
        action: "brand_team_invitation_created",
        metadata: { target_role: "admin" },
      }),
    ).toBe("Role: Admin");

    expect(
      getAdminAuditDetailsLabel({
        action: "brand_team_member_removed",
        metadata: { target_role: "viewer" },
      }),
    ).toBe("Role: Viewer");
  });

  it("keeps existing reason details for non-team audit entries", () => {
    expect(
      getAdminAuditDetailsLabel({
        action: "suspend_user",
        metadata: { reason: "Duplicate account" },
      }),
    ).toBe("Duplicate account");
  });

  it("summarizes creator payment status changes with old and new states", () => {
    expect(
      getAdminAuditTargetLabel({
        target_id: "8c7f55b6-3955-4a4c-b739-5964308f5489",
        metadata: {
          campaign_title: "K-Beauty Retail Launch",
          creator_name: "Lisa Manoban",
        },
      }),
    ).toBe("Lisa Manoban");

    expect(
      getAdminAuditDetailsLabel({
        action: "creator_payment_status_updated",
        metadata: {
          previous_status: "pending",
          new_status: "paid",
          campaign_title: "K-Beauty Retail Launch",
        },
      }),
    ).toBe("Pending to Paid for K-Beauty Retail Launch");
  });
});
