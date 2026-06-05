import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildStripeCheckoutWebhookSmokeTargets,
  validateStripeCheckoutWebhookSmoke,
} from "./smoke-stripe-checkout-webhook.mjs";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);
const smokeSource = readFileSync(
  resolve(process.cwd(), "scripts/smoke-stripe-checkout-webhook.mjs"),
  "utf8",
);

describe("stripe checkout webhook smoke", () => {
  it("adds an explicit external Stripe smoke command outside the fast critical loop", () => {
    expect(packageJson.scripts["smoke:stripe-checkout"]).toBe(
      "node scripts/smoke-stripe-checkout-webhook.mjs",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:stripe-checkout",
    );
  });

  it("builds local checkout smoke targets with the service-fee campaign id", () => {
    expect(
      buildStripeCheckoutWebhookSmokeTargets({
        baseUrl: "http://127.0.0.1:4010/",
        campaignId: "campaign-123",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:4010",
      campaignId: "campaign-123",
      adminLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=admin",
      adminCampaignsUrl: "http://127.0.0.1:4010/admin/campaigns",
      adminRevenueUrl: "http://127.0.0.1:4010/admin/revenue",
      brandLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=brand",
      brandCampaignUrl: "http://127.0.0.1:4010/b/campaigns/campaign-123",
      creatorLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=creator",
      creatorDiscoverUrl: "http://127.0.0.1:4010/i/discover",
      creatorDiscoverDetailUrl:
        "http://127.0.0.1:4010/i/discover/campaign-123",
      publicApplyUrl: "http://127.0.0.1:4010/apply/campaign-123",
    });
  });

  it("uses the large private campaign pricing story for checkout and admin revenue proof", () => {
    expect(smokeSource).toContain("service_fee_cents: 59000");
    expect(smokeSource).toContain("max_creators: 100");
    expect(smokeSource).toContain("estimatedMaxCreators: 100");
    expect(smokeSource).toContain("checkoutShowsLargeCampaignFee");
    expect(smokeSource).toContain("adminRevenueShowsScope");
  });

  it("waits for the shared premium smoke campaign title instead of stale fixture copy", () => {
    expect(smokeSource).toContain("getSmokeCampaignTitle");
    expect(smokeSource).toContain("getSmokeCampaignTitle()");
    expect(smokeSource).not.toContain('"Application Flow Smoke Campaign"');
  });

  it("charges only the unpaid upgrade balance after the base private fee is already paid", () => {
    expect(smokeSource).toContain("STRIPE_INITIAL_PAID_CREATOR_CAPACITY_CENTS");
    expect(smokeSource).toContain(
      "amount_cents: STRIPE_INITIAL_PAID_CREATOR_CAPACITY_CENTS",
    );
    expect(smokeSource).toContain('document.body.innerText.includes("$441")');
    expect(smokeSource).toContain("paymentEventsShowUpgradeBalance");
  });

  it("requires the proof to come from Stripe checkout, webhook-paid status, and an unlocked launch", () => {
    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "http://127.0.0.1:4000/not-stripe",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("Stripe-hosted Checkout");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "invoiced",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("webhook-paid");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: false,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("admin revenue");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: false,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("100-creator campaign fee");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: false,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("paid creator capacity scope");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: false,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("brand billing");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: false,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("admin campaigns");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: false,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toThrow("creator detail");

    expect(() =>
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: false,
        consoleErrors: [],
      }),
    ).toThrow("public apply");

    expect(
      validateStripeCheckoutWebhookSmoke({
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
        paymentEventCount: 3,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        adminRevenueShowsScope: true,
        brandReceiptVisible: true,
        checkoutShowsLargeCampaignFee: true,
        creatorDetailVisible: true,
        creatorDiscoverVisible: true,
        launchEnabled: true,
        inviteUrl: "http://127.0.0.1:4000/apply/campaign-123",
        publicApplyVisible: true,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });
});
