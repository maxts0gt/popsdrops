import { describe, expect, it } from "vitest";

import { isCampaignServiceFeeUnlocked } from "./service-fee-visibility";

describe("campaign service fee visibility", () => {
  it("unlocks creator-facing campaign surfaces only when no fee is due or the fee is paid", () => {
    expect(
      isCampaignServiceFeeUnlocked({
        service_fee_cents: 0,
        service_fee_status: "pending",
      }),
    ).toBe(true);
    expect(
      isCampaignServiceFeeUnlocked({
        service_fee_cents: null,
        service_fee_status: null,
      }),
    ).toBe(true);
    expect(
      isCampaignServiceFeeUnlocked({
        service_fee_cents: 14_900,
        service_fee_status: "paid",
      }),
    ).toBe(true);
    expect(
      isCampaignServiceFeeUnlocked({
        service_fee_cents: 14_900,
        service_fee_status: "pending",
      }),
    ).toBe(false);
    expect(
      isCampaignServiceFeeUnlocked({
        service_fee_cents: 14_900,
        service_fee_status: "invoiced",
      }),
    ).toBe(false);
    expect(
      isCampaignServiceFeeUnlocked({
        service_fee_cents: "14900",
        service_fee_status: "paid",
      }),
    ).toBe(true);
    expect(
      isCampaignServiceFeeUnlocked({
        service_fee_cents: "not a fee",
        service_fee_status: "paid",
      }),
    ).toBe(false);
  });
});
