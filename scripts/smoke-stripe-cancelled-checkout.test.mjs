import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildStripeCancelledCheckoutSmokeTargets,
  validateStripeCancelledCheckoutSmoke,
} from "./smoke-stripe-cancelled-checkout.mjs";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);
const smokeSource = readFileSync(
  resolve(process.cwd(), "scripts/smoke-stripe-cancelled-checkout.mjs"),
  "utf8",
);

describe("stripe cancelled checkout smoke", () => {
  it("adds an explicit cancelled-checkout smoke outside the fast critical loop", () => {
    expect(packageJson.scripts["smoke:stripe-cancelled"]).toBe(
      "node scripts/smoke-stripe-cancelled-checkout.mjs",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:stripe-cancelled",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "smoke:stripe-cancelled",
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "smoke:payment-spine",
    );
  });

  it("builds local cancelled-checkout smoke targets with every locked surface", () => {
    expect(
      buildStripeCancelledCheckoutSmokeTargets({
        baseUrl: "http://127.0.0.1:4010/",
        campaignId: "campaign-123",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:4010",
      campaignId: "campaign-123",
      adminLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=admin",
      adminCampaignsUrl:
        "http://127.0.0.1:4010/admin/campaigns?status=all",
      brandLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=brand",
      brandCampaignUrl: "http://127.0.0.1:4010/b/campaigns/campaign-123",
      checkoutCancelledUrl:
        "http://127.0.0.1:4010/b/campaigns/campaign-123?tab=brief&checkout=cancelled",
      creatorLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=creator",
      creatorDiscoverUrl: "http://127.0.0.1:4010/i/discover",
      creatorDiscoverDetailUrl:
        "http://127.0.0.1:4010/i/discover/campaign-123",
      publicApplyUrl: "http://127.0.0.1:4010/apply/campaign-123",
      publicCampaignApiUrl:
        "http://127.0.0.1:4010/api/public/campaigns/campaign-123",
    });
  });

  it("requires cancelled checkout to stay unpaid, private, retryable, and non-exceptional", () => {
    const passingResult = {
      adminCampaignsShowsFinanceException: false,
      brandCancelledNoticeVisible: true,
      brandRetryVisible: true,
      checkoutCancelledUrl:
        "http://127.0.0.1:4000/b/campaigns/campaign-123?tab=brief&checkout=cancelled",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
      consoleErrors: [],
      creatorDetailLocked: true,
      creatorDiscoverHidden: true,
      launchDisabled: true,
      paymentEventStatuses: ["invoiced"],
      publicApiLocked: true,
      publicApplyLocked: true,
      serviceFeeStatus: "invoiced",
      traceFields: {
        checkoutSessionId: "cs_test_123",
        lastEventId: "cs_test_123",
        paymentIntentId: null,
      },
    };

    expect(() =>
      validateStripeCancelledCheckoutSmoke({
        ...passingResult,
        serviceFeeStatus: "paid",
      }),
    ).toThrow("stay unpaid");

    expect(() =>
      validateStripeCancelledCheckoutSmoke({
        ...passingResult,
        adminCampaignsShowsFinanceException: true,
      }),
    ).toThrow("finance exception");

    expect(() =>
      validateStripeCancelledCheckoutSmoke({
        ...passingResult,
        brandRetryVisible: false,
      }),
    ).toThrow("retry");

    expect(() =>
      validateStripeCancelledCheckoutSmoke({
        ...passingResult,
        creatorDiscoverHidden: false,
      }),
    ).toThrow("creator discovery");

    expect(
      validateStripeCancelledCheckoutSmoke(passingResult),
    ).toEqual({ ok: true });
  });

  it("uses the large-campaign scoped fee fixture before starting Checkout", () => {
    expect(smokeSource).toContain("buildStripeLargeCampaignScopeUpdate()");
    expect(smokeSource).toContain("Prepare cancelled checkout smoke campaign");
  });
});
