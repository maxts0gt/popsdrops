import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("create stripe checkout session source contract", () => {
  it("creates Checkout for the unpaid campaign fee balance", () => {
    expect(source).toContain("getCampaignServiceFeeBalance");
    expect(source).toContain('.from("campaign_payment_events")');
    expect(source).toContain("balance.balanceDueCents");
    expect(source).toContain("alreadyPaid: true");
    expect(source).toContain("amount_cents: balance.balanceDueCents");
  });

  it("verifies creator capacity and campaign windows against the saved paid scope before checkout", () => {
    expect(source).toContain("posting_window_start");
    expect(source).toContain("posting_window_end");
    expect(source).toContain("performance_due_date");
    expect(source).toContain("getCampaignCheckoutPricingDays");
    expect(source).toContain("snapshotActiveDays");
    expect(source).toContain("snapshotReportingDays");
    expect(source).toContain(
      "Number(snapshotActiveDays) !== checkoutPricingDays.activeDays",
    );
    expect(source).toContain(
      "Number(snapshotReportingDays) !== checkoutPricingDays.reportingDays",
    );
    expect(source).toContain(
      "Campaign service fee is out of sync. Save the campaign scope before paying.",
    );
  });
});
