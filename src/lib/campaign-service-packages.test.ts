import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_SERVICE_PACKAGES,
  PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS,
  getCampaignServiceEstimate,
  getCampaignServiceFeeBalance,
  getCampaignPaidCreatorCapacity,
  getCampaignServiceInsertFields,
  getCampaignServicePackage,
  getCampaignServicePricingDays,
} from "./campaign-service-packages";

describe("campaign service packages", () => {
  it("defines the private campaign OS and custom Concierge posture", () => {
    expect(CAMPAIGN_SERVICE_PACKAGES.private.feeCents).toBe(14_900);
    expect(CAMPAIGN_SERVICE_PACKAGES.private.includedCreatorCount).toBe(10);
    expect(CAMPAIGN_SERVICE_PACKAGES.private.includedActiveDays).toBe(45);
    expect(CAMPAIGN_SERVICE_PACKAGES.private.includedReportingDays).toBe(14);
    expect(CAMPAIGN_SERVICE_PACKAGES.sourced.feeCents).toBe(0);
    expect(CAMPAIGN_SERVICE_PACKAGES.sourced.includedCreatorCount).toBeUndefined();
    expect(CAMPAIGN_SERVICE_PACKAGES.sourced.includedRecommendationCount).toBeUndefined();
  });

  it("marks Concierge as custom sourcing, not a self-serve creator promise", () => {
    expect(getCampaignServicePackage("private").creatorSourcingRequired).toBe(false);
    expect(getCampaignServicePackage("sourced").creatorSourcingRequired).toBe(true);
  });

  it("prices private campaigns by included limits and visible overages", () => {
    expect(PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS).toBe(100);

    expect(
      getCampaignServiceEstimate("private", {
        maxCreators: 10,
        activeDays: 45,
        reportingDays: 14,
      }),
    ).toMatchObject({
      feeCents: 14_900,
      tierKey: "workspace",
      requiresCustomPricing: false,
      includedCreatorCount: 10,
      includedActiveDays: 45,
      includedReportingDays: 14,
      overageFeeCents: 0,
    });

    expect(
      getCampaignServiceEstimate("private", {
        maxCreators: 11,
        activeDays: 46,
        reportingDays: 15,
      }),
    ).toMatchObject({
      feeCents: 27_600,
      creatorOverageBlocks: 1,
      activeDayOverageBlocks: 1,
      reportingDayOverageBlocks: 1,
      overageFeeCents: 12_700,
    });

    expect(
      getCampaignServiceEstimate("private", {
        maxCreators: 25,
        activeDays: 45,
        reportingDays: 14,
      }),
    ).toMatchObject({
      feeCents: 24_700,
      creatorOverageBlocks: 2,
      activeDayOverageBlocks: 0,
      reportingDayOverageBlocks: 0,
      overageFeeCents: 9_800,
    });

    expect(
      getCampaignServiceEstimate("private", {
        maxCreators: 50,
        activeDays: 45,
        reportingDays: 14,
      }),
    ).toMatchObject({
      feeCents: 34_500,
      creatorOverageBlocks: 4,
      activeDayOverageBlocks: 0,
      reportingDayOverageBlocks: 0,
      overageFeeCents: 19_600,
    });

    expect(
      getCampaignServiceEstimate("private", {
        maxCreators: 100,
        activeDays: 45,
        reportingDays: 14,
      }),
    ).toMatchObject({
      feeCents: 59_000,
      creatorOverageBlocks: 9,
      activeDayOverageBlocks: 0,
      reportingDayOverageBlocks: 0,
      overageFeeCents: 44_100,
    });

    expect(
      getCampaignServiceEstimate("private", {
        maxCreators: 101,
        activeDays: 45,
        reportingDays: 14,
      }),
    ).toMatchObject({
      feeCents: 0,
      tierKey: "enterprise",
      requiresCustomPricing: true,
      scopeDetailKey: "mode.private.scopeDetail.customCapacity",
      customPricingReason: "private_capacity",
    });

    expect(
      getCampaignServiceEstimate("private", {
        maxCreators: 31,
        activeDays: 76,
        reportingDays: 45,
      }),
    ).toMatchObject({
      feeCents: 45_200,
      creatorOverageBlocks: 3,
      activeDayOverageBlocks: 2,
      reportingDayOverageBlocks: 2,
      overageFeeCents: 30_300,
    });
  });

  it("derives pricing days from plain dates or stored ISO timestamps", () => {
    expect(
      getCampaignServicePricingDays({
        postingWindowStart: "2026-06-01",
        postingWindowEnd: "2026-06-10",
        performanceDueDate: "2026-06-24",
      }),
    ).toEqual({ activeDays: 10, reportingDays: 14 });

    expect(
      getCampaignServicePricingDays({
        postingWindowStart: "2026-06-01T00:00:00.000Z",
        postingWindowEnd: "2026-06-10T23:59:59.999Z",
        performanceDueDate: "2026-06-24T23:59:59.999Z",
      }),
    ).toEqual({ activeDays: 10, reportingDays: 14 });
  });

  it("keeps sourced campaigns custom quoted at every creator count", () => {
    expect(
      getCampaignServiceEstimate("sourced", {
        maxCreators: 10,
        marketCount: 1,
      }),
    ).toMatchObject({
      feeCents: 0,
      tierKey: "enterprise",
      requiresCustomPricing: true,
      scopeDetailKey: "mode.sourced.scopeDetail",
    });

    expect(
      getCampaignServiceEstimate("sourced", {
        maxCreators: 24,
        marketCount: 2,
      }),
    ).toMatchObject({
      feeCents: 0,
      tierKey: "enterprise",
      requiresCustomPricing: true,
    });
  });

  it("derives immutable insert fields from the selected mode", () => {
    expect(getCampaignServiceInsertFields("private", {
      maxCreators: 21,
      marketCount: 1,
      activeDays: 60,
      reportingDays: 20,
    })).toMatchObject({
      campaign_mode: "private",
      creator_sourcing_required: false,
      service_fee_cents: 32_500,
      service_fee_currency: "usd",
      service_fee_status: "pending",
      service_package_snapshot: {
        mode: "private",
        tierKey: "workspace",
        includedCreatorCount: 10,
        includedActiveDays: 45,
        includedReportingDays: 14,
        estimatedMaxCreators: 21,
        estimatedActiveDays: 60,
        estimatedReportingDays: 20,
        creatorOverageBlocks: 2,
        activeDayOverageBlocks: 1,
        reportingDayOverageBlocks: 1,
        overageFeeCents: 17_600,
      },
    });

    expect(getCampaignServiceInsertFields("sourced", {
      maxCreators: 5,
      marketCount: 2,
    })).toMatchObject({
      campaign_mode: "sourced",
      creator_sourcing_required: true,
      service_fee_cents: 0,
      service_package_snapshot: {
        mode: "sourced",
        tierKey: "enterprise",
        requiresCustomPricing: true,
        estimatedMaxCreators: 5,
        estimatedMarketCount: 2,
      },
    });
  });

  it("calculates remaining service fee balance after prior paid checkout events", () => {
    expect(
      getCampaignServiceFeeBalance({
        feeCents: 59_000,
        paymentEvents: [
          { amount_cents: 14_900, service_fee_status: "paid" },
          { amount_cents: 44_100, service_fee_status: "invoiced" },
        ],
      }),
    ).toEqual({
      balanceDueCents: 44_100,
      paidCents: 14_900,
      totalFeeCents: 59_000,
    });

    expect(
      getCampaignServiceFeeBalance({
        feeCents: 59_000,
        paymentEvents: [
          { amount_cents: 14_900, service_fee_status: "paid" },
          { amount_cents: 44_100, service_fee_status: "paid" },
        ],
      }),
    ).toMatchObject({
      balanceDueCents: 0,
      paidCents: 59_000,
    });
  });

  it("keeps accepted creator capacity tied to the paid scope during unpaid upgrades", () => {
    expect(
      getCampaignPaidCreatorCapacity({
        maxCreators: 100,
        serviceFeeCents: 59_000,
        serviceFeeStatus: "pending",
        servicePackageSnapshot: {
          estimatedMaxCreators: 100,
          paidCreatorCapacity: 10,
        },
        paymentEvents: [
          {
            amount_cents: 14_900,
            event_summary: { creatorCapacity: 10 },
            service_fee_status: "paid",
          },
          {
            amount_cents: 44_100,
            event_summary: { creatorCapacity: 100 },
            service_fee_status: "invoiced",
          },
        ],
      }),
    ).toBe(10);

    expect(
      getCampaignPaidCreatorCapacity({
        maxCreators: 100,
        serviceFeeCents: 59_000,
        serviceFeeStatus: "paid",
        servicePackageSnapshot: { estimatedMaxCreators: 100 },
        paymentEvents: [
          {
            amount_cents: 59_000,
            event_summary: { creatorCapacity: 100 },
            service_fee_status: "paid",
          },
        ],
      }),
    ).toBe(100);
  });

  it("recovers paid creator capacity from the matching invoiced checkout event", () => {
    expect(
      getCampaignPaidCreatorCapacity({
        maxCreators: 100,
        serviceFeeCents: 66_800,
        serviceFeeStatus: "pending",
        servicePackageSnapshot: {
          estimatedMaxCreators: 100,
          paidCreatorCapacity: 10,
        },
        paymentEvents: [
          {
            amount_cents: 14_900,
            event_summary: { startingCapacity: 10 },
            service_fee_status: "paid",
          },
          {
            amount_cents: 19_600,
            checkout_session_id: "cs_50",
            event_summary: { creatorCapacity: 50 },
            service_fee_status: "invoiced",
          },
          {
            amount_cents: 19_600,
            checkout_session_id: "cs_50",
            event_summary: {},
            service_fee_status: "paid",
          },
          {
            amount_cents: 32_300,
            checkout_session_id: "cs_100",
            event_summary: { creatorCapacity: 100 },
            service_fee_status: "invoiced",
          },
        ],
      }),
    ).toBe(50);
  });
});
