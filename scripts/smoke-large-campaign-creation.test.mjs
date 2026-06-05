import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildLargeCampaignCreationSmokeTargets,
  validateLargeCampaignCreationPaymentSmoke,
  validateLargeCampaignCreationSmoke,
} from "./smoke-large-campaign-creation.mjs";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);

describe("large private campaign creation smoke contract", () => {
  it("exposes the smoke as part of the payment spine", () => {
    expect(packageJson.scripts["smoke:large-campaign-creation"]).toBe(
      "node scripts/smoke-large-campaign-creation.mjs",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "smoke:large-campaign-creation",
    );
  });

  it("builds the brand builder, brand list, and admin revenue targets", () => {
    expect(
      buildLargeCampaignCreationSmokeTargets({
        baseUrl: "http://127.0.0.1:4010/",
        campaignTitle: "Global Beauty 100-Creator Proof Launch",
      }),
    ).toEqual({
      adminLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=admin",
      adminRevenueUrl: "http://127.0.0.1:4010/admin/revenue#service-fees",
      baseUrl: "http://127.0.0.1:4010",
      brandCampaignsUrl: "http://127.0.0.1:4010/b/campaigns",
      brandLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=brand",
      campaignNewUrl: "http://127.0.0.1:4010/b/campaigns/new",
      campaignTitle: "Global Beauty 100-Creator Proof Launch",
    });
  });

  it("uses a board-ready default campaign title for saved smoke screenshots", () => {
    expect(buildLargeCampaignCreationSmokeTargets({}).campaignTitle).toBe(
      "Global Beauty 100-Creator Proof Launch",
    );
  });

  it("rejects smoke proof that hides the full $590 initial fee", () => {
    expect(() =>
      validateLargeCampaignCreationSmoke({
        adminRevenueRowText:
          "Global Beauty 100-Creator Proof Launch Creator capacity 100 PopsDrops fee $590 Balance due $441",
        brandDetailText:
          "Global Beauty 100-Creator Proof Launch Billing and scope Creator capacity 100 PopsDrops fee $590 Balance due $441 Pay $441",
        brandListRowText: "Global Beauty 100-Creator Proof Launch Balance due $441",
        builderReviewText:
          "Global Beauty 100-Creator Proof Launch Billing and scope Creator capacity 100 PopsDrops fee $590 Report goal Leadership brief",
        campaignReportPlan: {
          report_preset_id: "leadership",
          report_chart_mode_id: "trend",
          report_block_ids: [
            "executive_summary",
            "channel_story",
            "report_trust",
            "recommendations",
          ],
        },
        consoleErrors: [],
      }),
    ).toThrow(/\$590/);
  });

  it("accepts the intended first-run 100-creator pending balance state", () => {
    expect(
      validateLargeCampaignCreationSmoke({
        adminRevenueRowText:
          "Global Beauty 100-Creator Proof Launch Creator capacity 100 $590 Balance due $590",
        brandDetailText:
          "Global Beauty 100-Creator Proof Launch Billing and scope Creator capacity 100 PopsDrops fee $590 Balance due $590 Pay $590",
        brandListRowText: "Global Beauty 100-Creator Proof Launch Balance due $590",
        builderReviewText:
          "Global Beauty 100-Creator Proof Launch Billing and scope 100 creator capacity Creator capacity 100 PopsDrops fee $590 Report goal Leadership brief Report chart Trend view Report blocks Executive summary Report trust",
        campaignReportPlan: {
          report_preset_id: "leadership",
          report_chart_mode_id: "trend",
          report_block_ids: [
            "executive_summary",
            "channel_story",
            "report_trust",
            "recommendations",
          ],
        },
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects smoke proof when campaign creation does not save the report goal plan", () => {
    expect(() =>
      validateLargeCampaignCreationSmoke({
        adminRevenueRowText:
          "Global Beauty 100-Creator Proof Launch Creator capacity 100 $590 Balance due $590",
        brandDetailText:
          "Global Beauty 100-Creator Proof Launch Billing and scope Creator capacity 100 PopsDrops fee $590 Balance due $590 Pay $590",
        brandListRowText: "Global Beauty 100-Creator Proof Launch Balance due $590",
        builderReviewText:
          "Global Beauty 100-Creator Proof Launch Billing and scope 100 creator capacity Creator capacity 100 PopsDrops fee $590 Report goal Leadership brief Report chart Trend view Report blocks Executive summary Report trust",
        campaignReportPlan: {
          report_preset_id: "creator_performance",
          report_chart_mode_id: "comparison",
          report_block_ids: ["executive_summary", "report_trust"],
        },
        consoleErrors: [],
      }),
    ).toThrow(/Leadership brief report goal/);
  });

  it("rejects payment proof that does not complete Stripe checkout for the full initial fee", () => {
    expect(() =>
      validateLargeCampaignCreationPaymentSmoke({
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        brandReceiptVisible: true,
        checkoutShowsInitialFee: true,
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
        inviteUrl: "http://127.0.0.1:4000/apply/campaign",
        launchEnabled: true,
        paymentEventCount: 1,
        paymentEventsShowInitialFee: false,
        publicApplyShowsComplianceNotes: true,
        publicApplyHeroImageReady: true,
        publicApplyVisible: true,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        consoleErrors: [],
      }),
    ).toThrow(/\$590/);
  });

  it("rejects public creator invite proof that drops compliance notes", () => {
    expect(() =>
      validateLargeCampaignCreationPaymentSmoke({
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        brandReceiptVisible: true,
        checkoutShowsInitialFee: true,
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
        inviteUrl: "http://127.0.0.1:4000/apply/campaign",
        launchEnabled: true,
        paymentEventCount: 2,
        paymentEventsShowInitialFee: true,
        publicApplyShowsComplianceNotes: false,
        publicApplyHeroImageReady: true,
        publicApplyVisible: true,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        consoleErrors: [],
      }),
    ).toThrow(/compliance notes/);
  });

  it("rejects public creator invite proof captured before the hero image renders", () => {
    expect(() =>
      validateLargeCampaignCreationPaymentSmoke({
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        brandReceiptVisible: true,
        checkoutShowsInitialFee: true,
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
        inviteUrl: "http://127.0.0.1:4000/apply/campaign",
        launchEnabled: true,
        paymentEventCount: 2,
        paymentEventsShowInitialFee: true,
        publicApplyShowsComplianceNotes: true,
        publicApplyHeroImageReady: false,
        publicApplyVisible: true,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        consoleErrors: [],
      }),
    ).toThrow(/hero image/);
  });

  it("accepts the intended first-run 100-creator Stripe-paid launch state", () => {
    expect(
      validateLargeCampaignCreationPaymentSmoke({
        adminCampaignsShowsPaymentState: true,
        adminRevenueShowsTrace: true,
        brandReceiptVisible: true,
        checkoutShowsInitialFee: true,
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
        inviteUrl: "http://127.0.0.1:4000/apply/campaign",
        launchEnabled: true,
        paymentEventCount: 2,
        paymentEventsShowInitialFee: true,
        publicApplyShowsComplianceNotes: true,
        publicApplyHeroImageReady: true,
        publicApplyVisible: true,
        serviceFeeStatus: "paid",
        traceFields: {
          checkoutSessionId: "cs_test_123",
          lastEventId: "evt_test_123",
          paymentIntentId: "pi_test_123",
        },
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("creates a 100-creator campaign, pays the full initial fee through Stripe, and launches it", () => {
    const source = readFileSync(
      new URL("./smoke-large-campaign-creation.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("trackRuntimeContexts");
    expect(source).toContain("DEFAULT_COMPLIANCE_NOTES");
    expect(source).toContain("clickVisibleButtonAndWait");
    expect(source).toContain('Boolean(document.querySelector("#title"))');
    expect(source).not.toContain('clickTab(client, "Setup")');
    expect(source).toContain("fillStripeCheckoutTestPayment");
    expect(source).toContain("waitForCampaignServiceFeeStatus");
    expect(source).toContain('data-testid="creator-capacity-preset-100"');
    expect(source).toContain("createSmokeCampaignImageFile");
    expect(source).toContain("canvas.toBlob");
    expect(source).not.toContain("SMOKE_IMAGE_BASE64");
    expect(source).toContain("#complianceNotes");
    expect(source).toContain("publicApplyShowsComplianceNotes");
    expect(source).toContain("publicApplyHeroImageReady");
    expect(source).toContain("public apply compliance notes");
    expect(source).toContain("public apply hero image");
    expect(source).toContain("campaign-report-goal-preset");
    expect(source).toContain("Leadership brief");
    expect(source).toContain("Report chart");
    expect(source).toContain("Report blocks");
    expect(source).toContain("Read smoke campaign report goal plan");
    expect(source).toContain("reportGoalScreenshotPath");
    expect(source).toContain("focusReportGoalSelector");
    expect(source).toContain("campaign report goal selector visible");
    expect(source).toContain("focusReportGoalOutputPreview");
    expect(source).toContain("campaign report proof output visible");
    expect(source).toContain("campaign-report-output-preview");
    expect(source).toContain("Proof output");
    expect(source).toContain("Trend view");
    expect(source).toContain("large-campaign-creation-report-goal-smoke.png");
    expect(source).toContain("report_preset_id");
    expect(source).toContain("report_chart_mode_id");
    expect(source).toContain("report_block_ids");
    expect(source).toContain("naturalWidth > 0");
    expect(source).toContain("large-campaign-creation-public-apply-smoke.png");
    expect(source).toContain("captureBeyondViewport: true");
    expect(source).toContain("process.exit(0);");
    expect(source).toContain("Stripe Checkout $590 initial campaign fee");
    expect(source).toContain('document.body.innerText.includes("$590")');
    expect(source).toContain('data-testid="campaign-service-fee-action"');
    expect(source).toContain('data-testid="campaign-service-fee-receipt"');
    expect(source).toContain('data-testid="campaign-service-fee-reference"');
    expect(source).toContain('data-testid="campaign-launch-action"');
    expect(source).toContain('data-testid="campaign-invite-strip"');
    expect(source).toContain('from("campaign_payment_events")');
    expect(source).toContain("amount_cents) === 59000");
    expect(source).toContain("checkout.session.completed");
    expect(source).toContain("admin campaigns paid first-run service fee state");
    expect(source).toContain("public apply launched large campaign");
  });

  it("waits for open applications visibility before leaving the campaign model step", () => {
    const source = readFileSync(
      new URL("./smoke-large-campaign-creation.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("selectOpenApplicationsVisibility");
    expect(source).toContain(
      "open applications visibility selected",
    );
    expect(source).toContain(
      'button?.getAttribute("aria-pressed") === "true"',
    );
    expect(source).toContain("clickScopedButtonUntilPressed");
    expect(source).toContain(
      "'[data-testid=\"campaign-recruitment-visibility\"] button'",
    );
    expect(source).toContain(
      "candidate.innerText.includes",
    );
  });
});
