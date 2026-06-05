import { describe, expect, it } from "vitest";

import { getAdminCampaignAttentionItems } from "./campaign-attention";

const baseCampaign = {
  id: "campaign-1",
  invite_reserved_count: 0,
  member_count: 0,
  paid_creator_capacity: 10,
  report_correction_count: 0,
  report_missed_count: 0,
  service_fee_cents: 25000,
  service_fee_status: "paid" as const,
  title: "Paris Launch",
};

describe("admin campaign attention model", () => {
  it("surfaces unpaid required service fees as launch blockers", () => {
    const items = getAdminCampaignAttentionItems({
      ...baseCampaign,
      service_fee_status: "invoiced",
    });

    expect(items).toEqual([
      expect.objectContaining({
        actionLabel: "Review launch gate",
        detail: "Invoiced service fee blocks invite links and launch actions.",
        href: "/admin/campaigns/campaign-1?focus=launch#admin-launch-readiness",
        kind: "launch",
        label: "Launch blocker",
      }),
    ]);
  });

  it("does not flag paid service fees as launch blockers", () => {
    const items = getAdminCampaignAttentionItems(baseCampaign);

    expect(items.some((item) => item.kind === "launch")).toBe(false);
  });

  it("keeps finance exceptions distinct from launch gates", () => {
    const items = getAdminCampaignAttentionItems({
      ...baseCampaign,
      service_fee_status: "failed",
    });

    expect(items.map((item) => item.kind)).toEqual(["payment", "launch"]);
    expect(items[0]?.href).toBe(
      "/admin/campaigns/campaign-1?focus=finance#admin-finance-exception",
    );
    expect(items[1]?.href).toBe(
      "/admin/campaigns/campaign-1?focus=launch#admin-launch-readiness",
    );
  });

  it("keeps reporting blockers pointed at the reporting exception panel", () => {
    const items = getAdminCampaignAttentionItems({
      ...baseCampaign,
      report_correction_count: 1,
      report_missed_count: 2,
    });

    expect(items).toEqual([
      expect.objectContaining({
        actionLabel: "Open campaign",
        detail: "2 missed, 1 correction report tasks need review.",
        href: "/admin/campaigns/campaign-1?focus=reporting#admin-reporting-exceptions",
        kind: "reporting",
        label: "Reporting exception",
      }),
    ]);
  });

  it("flags invite reservations that exceed paid creator capacity as operations exceptions", () => {
    const items = getAdminCampaignAttentionItems({
      ...baseCampaign,
      invite_reserved_count: 2,
      member_count: 99,
      paid_creator_capacity: 100,
    });

    expect(items).toEqual([
      expect.objectContaining({
        actionLabel: "Open operations",
        detail:
          "101 creator seats reserved for 100 paid slots. Pause outreach or increase capacity.",
        href: "/admin/campaigns/campaign-1?focus=operations#admin-creator-operations",
        kind: "operations",
        label: "Invite capacity exception",
      }),
    ]);
  });
});
