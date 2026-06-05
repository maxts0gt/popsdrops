import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildStripePaymentRecoverySmokeTargets,
  validateStripePaymentRecoverySmoke,
} from "./smoke-stripe-payment-recovery.mjs";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);
const smokeSource = readFileSync(
  resolve(process.cwd(), "scripts/smoke-stripe-payment-recovery.mjs"),
  "utf8",
);

describe("stripe payment recovery smoke", () => {
  it("adds an explicit payment-recovery smoke outside the fast critical loop", () => {
    expect(packageJson.scripts["smoke:stripe-recovery"]).toBe(
      "node scripts/smoke-stripe-payment-recovery.mjs",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:stripe-recovery",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "smoke:stripe-recovery",
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "smoke:payment-spine",
    );
  });

  it("builds local recovery smoke targets with every restored surface", () => {
    expect(
      buildStripePaymentRecoverySmokeTargets({
        baseUrl: "http://127.0.0.1:4010/",
        campaignId: "campaign-123",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:4010",
      campaignId: "campaign-123",
      adminLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=admin",
      adminCampaignDetailUrl:
        "http://127.0.0.1:4010/admin/campaigns/campaign-123?focus=finance#admin-finance-exception",
      adminCampaignsUrl:
        "http://127.0.0.1:4010/admin/campaigns?status=all",
      adminRevenueUrl:
        "http://127.0.0.1:4010/admin/revenue?status=paid&campaign=campaign-123#service-fees",
      brandLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=brand",
      brandCampaignUrl: "http://127.0.0.1:4010/b/campaigns/campaign-123",
      creatorLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=creator",
      creatorDiscoverUrl: "http://127.0.0.1:4010/i/discover",
      creatorDiscoverDetailUrl:
        "http://127.0.0.1:4010/i/discover/campaign-123",
      publicApplyUrl: "http://127.0.0.1:4010/apply/campaign-123",
      publicCampaignApiUrl:
        "http://127.0.0.1:4010/api/public/campaigns/campaign-123",
    });
  });

  it("requires failed payment to recover through a fresh checkout before launch unlocks", () => {
    const passingResult = {
      adminDetailClearsExceptionAfterRecovery: true,
      adminDetailShowsExceptionBeforeRecovery: true,
      adminCampaignsShowsExceptionBeforeRecovery: true,
      adminCampaignsShowsPaidState: true,
      adminRevenueShowsRecoveredTrace: true,
      brandReceiptVisible: true,
      brandRecoveryVisible: true,
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_recovered",
      consoleErrors: [],
      creatorDetailVisible: true,
      creatorDiscoverVisible: true,
      finalServiceFeeStatus: "paid",
      initialCheckoutSessionId: "cs_test_failed_old",
      initialServiceFeeStatus: "failed",
      inviteUrl: "http://127.0.0.1:4010/apply/campaign-123",
      launchEnabled: true,
      paymentEventStatuses: ["failed", "invoiced", "paid"],
      publicApiUnlocked: true,
      publicApplyVisible: true,
      recoveredCheckoutSessionId: "cs_test_recovered",
      traceFields: {
        checkoutSessionId: "cs_test_recovered",
        lastEventId: "evt_test_recovered",
        paymentIntentId: "pi_test_recovered",
      },
    };

    expect(() =>
      validateStripePaymentRecoverySmoke({
        ...passingResult,
        finalServiceFeeStatus: "failed",
      }),
    ).toThrow("paid");

    expect(() =>
      validateStripePaymentRecoverySmoke({
        ...passingResult,
        recoveredCheckoutSessionId: "cs_test_failed_old",
      }),
    ).toThrow("fresh checkout");

    expect(() =>
      validateStripePaymentRecoverySmoke({
        ...passingResult,
        paymentEventStatuses: ["failed", "paid"],
      }),
    ).toThrow("failed, invoiced, and paid");

    expect(() =>
      validateStripePaymentRecoverySmoke({
        ...passingResult,
        adminCampaignsShowsExceptionBeforeRecovery: false,
      }),
    ).toThrow("admin exception");

    expect(() =>
      validateStripePaymentRecoverySmoke({
        ...passingResult,
        adminDetailShowsExceptionBeforeRecovery: false,
      }),
    ).toThrow("admin detail exception");

    expect(() =>
      validateStripePaymentRecoverySmoke({
        ...passingResult,
        adminDetailClearsExceptionAfterRecovery: false,
      }),
    ).toThrow("admin detail finance panel");

    expect(() =>
      validateStripePaymentRecoverySmoke({
        ...passingResult,
        publicApiUnlocked: false,
      }),
    ).toThrow("public campaign API");

    expect(validateStripePaymentRecoverySmoke(passingResult)).toEqual({
      ok: true,
    });
  });

  it("uses the large-campaign scoped fee fixture before retrying Checkout", () => {
    expect(smokeSource).toContain("buildStripeLargeCampaignScopeUpdate()");
    expect(smokeSource).toContain("Prepare payment recovery smoke campaign scope");
  });
});
