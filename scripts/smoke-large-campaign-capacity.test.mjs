import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_LARGE_CAMPAIGN_CAPACITY_CAMPAIGN_ID,
  buildLargeCampaignCapacitySmokeTargets,
  validateLargeCampaignCapacitySmoke,
} from "./smoke-large-campaign-capacity.mjs";

describe("large private campaign capacity smoke contract", () => {
  function withCampaignTitle(title, run) {
    const previousTitle = process.env.SMOKE_CAMPAIGN_TITLE;

    try {
      process.env.SMOKE_CAMPAIGN_TITLE = title;
      return run();
    } finally {
      if (previousTitle === undefined) {
        delete process.env.SMOKE_CAMPAIGN_TITLE;
      } else {
        process.env.SMOKE_CAMPAIGN_TITLE = previousTitle;
      }
    }
  }

  it("targets a disposable 100-creator campaign in the brand workspace", () => {
    expect(buildLargeCampaignCapacitySmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_LARGE_CAMPAIGN_CAPACITY_CAMPAIGN_ID,
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_LARGE_CAMPAIGN_CAPACITY_CAMPAIGN_ID}`,
      brandCampaignsUrl: "http://127.0.0.1:4000/b/campaigns",
      adminLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=admin",
      adminRevenueUrl: `http://127.0.0.1:4000/admin/revenue?campaign=${DEFAULT_LARGE_CAMPAIGN_CAPACITY_CAMPAIGN_ID}#service-fees`,
    });
  });

  it("rejects capacity smoke output that hides either capacity or price", () => {
    withCampaignTitle("US Market Entry Proof Campaign", () => {
      expect(() =>
        validateLargeCampaignCapacitySmoke({
          fiftyBodyText:
            "US Market Entry Proof Campaign Creator capacity 50 PopsDrops fee $345 Balance due $196",
          bodyText: "US Market Entry Proof Campaign Creator capacity 100 PopsDrops fee $590",
          pendingCreatorOperationsText:
            "Creator operations Accepted 1 / 100 100 paid capacity Open seats 99",
          creatorOperationsText: "",
          fiftyCreatorOperationsText:
            "Creator operations Accepted 1 / 50 50 paid capacity Open seats 49",
          payButtonText: "Pay $323",
          paymentEventsShowIncrementalFees: true,
          stripeCheckoutUrls: ["https://checkout.stripe.com/c/pay/cs_test"],
          consoleErrors: [],
        }),
      ).toThrow(/\$668/);
    });
  });

  it("rejects scale readiness output that hides the payment blocker behind generic copy", () => {
    withCampaignTitle("US Market Entry Proof Campaign", () => {
      expect(() =>
        validateLargeCampaignCapacitySmoke({
          fiftyBodyText:
            "US Market Entry Proof Campaign Billing and scope Creator capacity 50 PopsDrops fee $345 Balance due $196 Pay $196",
          bodyText:
            "US Market Entry Proof Campaign Billing and scope Creator capacity 100 Active days 75 Reporting days 44 PopsDrops fee $668 Balance due $323 Pay $323",
          fiftyCreatorOperationsText:
            "Creator operations Accepted 1 / 50 50 paid capacity Open seats 49 Pending review 0 Needs attention 0",
          fiftyCreatorScaleReadinessText:
            "Scale readiness Action needed before scaling 50-creator operating scope Paid capacity 1 / 50 49 open seats Invite pipeline 0 0 queued, 0 manual Payment exposure 1 Proof pressure 0",
          pendingCreatorOperationsText:
            "Creator operations Accepted 1 / 50 50 paid capacity Open seats 49 Pending review 0 Needs attention 0",
          pendingCreatorScaleReadinessText:
            "Scale readiness Action needed before scaling 50-creator operating scope Paid capacity 1 / 50 49 open seats Invite pipeline 0 0 queued, 0 manual Payment exposure 1 Proof pressure 0",
          creatorOperationsText:
            "Creator operations Accepted 1 / 100 100 paid capacity Open seats 99 Pending review 0 Needs attention 0",
          creatorScaleReadinessText:
            "Scale readiness Action needed before scaling 100-creator operating scope Paid capacity 1 / 100 99 open seats Invite pipeline 0 0 queued, 0 manual Payment exposure 1 Proof pressure 0",
          payButtonText: "Pay $323",
          paymentEventsShowIncrementalFees: true,
          stripeCheckoutUrls: [
            "https://checkout.stripe.com/c/pay/cs_test_50",
            "https://checkout.stripe.com/c/pay/cs_test_100",
          ],
          consoleErrors: [],
        }),
      ).toThrow(/payment blocker/i);
    });
  });

  it("uses the shared Node-runtime dev server launcher instead of a private npm launcher", () => {
    const source = readFileSync(
      new URL("./smoke-large-campaign-capacity.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("ensureDevServer");
    expect(source).toContain("await ensureDevServer(targets.baseUrl)");
    expect(source).not.toContain("const npmCommand");
    expect(source).not.toContain("spawn(npmCommand");
  });

  it("accepts the intended 10-paid to 50-paid to 100-creator longer-window upgrade state", () => {
    withCampaignTitle("US Market Entry Proof Campaign", () => {
      expect(
        validateLargeCampaignCapacitySmoke({
          fiftyBodyText:
            "US Market Entry Proof Campaign Billing and scope Creator capacity 50 PopsDrops fee $345 Balance due $196 Pay $196",
          bodyText:
            "US Market Entry Proof Campaign Billing and scope Creator capacity 100 Active days 75 Reporting days 44 PopsDrops fee $668 Balance due $323 Pay $323",
          fiftyCreatorOperationsText:
            "Creator operations Accepted 1 / 50 50 paid capacity Open seats 49 Pending review 0 Needs attention 0",
          fiftyCreatorScaleReadinessText:
            "Scale readiness Creator payments need review Mark open creator payments before inviting more creators. 50-creator operating scope Paid capacity 1 / 50 49 open seats Invite pipeline 0 0 queued, 0 manual Payment exposure 1 Proof pressure 0",
          pendingCreatorOperationsText:
            "Creator operations Accepted 1 / 50 50 paid capacity Open seats 49 Pending review 0 Needs attention 0",
          pendingCreatorScaleReadinessText:
            "Scale readiness Creator payments need review Mark open creator payments before inviting more creators. 50-creator operating scope Paid capacity 1 / 50 49 open seats Invite pipeline 0 0 queued, 0 manual Payment exposure 1 Proof pressure 0",
          creatorOperationsText:
            "Creator operations Accepted 1 / 100 100 paid capacity Open seats 99 Pending review 0 Needs attention 0",
          creatorScaleReadinessText:
            "Scale readiness Creator payments need review Mark open creator payments before inviting more creators. 100-creator operating scope Paid capacity 1 / 100 99 open seats Invite pipeline 0 0 queued, 0 manual Payment exposure 1 Proof pressure 0",
          payButtonText: "Pay $323",
          paymentEventsShowIncrementalFees: true,
          stripeCheckoutUrls: [
            "https://checkout.stripe.com/c/pay/cs_test_50",
            "https://checkout.stripe.com/c/pay/cs_test_100",
          ],
          consoleErrors: [],
        }),
      ).toEqual({ ok: true });
    });
  });

  it("seeds paid 10 capacity, upgrades through the UI, and expects only the balance due", () => {
    const source = readFileSync(
      new URL("./smoke-large-campaign-capacity.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("max_creators: 10");
    expect(source).toContain("service_fee_cents: 14_900");
    expect(source).toContain('service_fee_status: "paid"');
    expect(source).toContain("campaign_payment_events");
    expect(source).toContain("amount_cents: 14_900");
    expect(source).toContain("Verify unpaid capacity upgrade blocks extra accepted creator");
    expect(source).toContain("paidCreatorCapacity: 1");
    expect(source).toContain("Campaign creator capacity is full");
    expect(source).toContain("randomUUID()");
    expect(source).toContain("fillStripeCheckoutTestPayment");
    expect(source).toContain("trackRuntimeContexts");
    expect(source).toContain("waitForCampaignServiceFeeStatus");
    expect(source).toContain("checkout success campaign page settled before next navigation");
    expect(source).not.toContain(
      'process.env.SMOKE_BASE_URL = `http://127.0.0.1:${await findFreePort()}`',
    );
    expect(source).toContain('campaign-capacity-option-${count}');
    expect(source).toContain("count: 50");
    expect(source).toContain("count: 100");
    expect(source).toContain('data-testid="campaign-capacity-save"');
    expect(source).toContain('data-testid="campaign-capacity-price-preview"');
    expect(source).toContain("pre-save ${count} creator capacity price preview");
    expect(source).toContain('balanceDisplay: "$196"');
    expect(source).toContain('totalDisplay: "$345"');
    expect(source).toContain('currentPaidDisplay: "$149"');
    expect(source).toContain('checkoutDescription: "50 creator upgrade"');
    expect(source).toContain("Stripe Checkout ${balanceDisplay} ${checkoutDescription} balance");
    expect(source).toContain("50-creator payment receipt");
    expect(source).toContain("1 / 50");
    expect(source).toContain("Open seats");
    expect(source).toContain("49");
    expect(source).toContain("activeDays: 75");
    expect(source).toContain('balanceDisplay: "$323"');
    expect(source).toContain("reportingDays: 44");
    expect(source).toContain('totalDisplay: "$668"');
    expect(source).toContain('currentPaidDisplay: "$345"');
    expect(source).toContain('checkoutDescription: "100 creator and duration upgrade"');
    expect(source).toContain('button.innerText.includes("Update scope")');
    expect(source).toContain("capacity save settled");
    expect(source).toContain("capacity update toast cleared before billing screenshot");
    expect(source).toContain("pending 100 creator balance keeps 50 paid creator operations");
    expect(source).toContain("pendingCreatorOperationsText");
    expect(source).toContain("pendingCreatorScaleReadinessText");
    expect(source).toContain("final 100 paid creator operations");
    expect(source).toContain("creatorScaleReadinessText");
    expect(source).toContain('data-testid="campaign-service-fee-action"');
    expect(source).toContain('data-testid="campaign-billing-scope"');
    expect(source).toContain('data-testid="campaign-payment-balance-due"');
    expect(source).toContain("brand campaign list balance due");
    expect(source).toContain("Paid credit $345");
    expect(source).toContain("Balance due $323");
    expect(source).toContain("admin revenue paid credit and balance due");
    expect(source).toContain("paymentEventsShowIncrementalFees");
    expect(source).toContain("Number(event.amount_cents) === 19_600");
    expect(source).toContain("Number(event.amount_cents) === 32_300");
    expect(source).toContain("Verify 100 creator longer paid scope");
    expect(source).toContain("service_fee_cents) !== 66_800");
    expect(source).toContain("estimatedActiveDays !== 75");
    expect(source).toContain("estimatedReportingDays !== 44");
    expect(source).toContain("DEFAULT_CREATOR_OPERATIONS_SCREENSHOT_PATH");
    expect(source).toContain("DEFAULT_CREATOR_INVITE_CAPACITY_WARNING_SCREENSHOT_PATH");
    expect(source).toContain("DEFAULT_CREATOR_INVITE_IMPORT_SCREENSHOT_PATH");
    expect(source).toContain("DEFAULT_CREATOR_INVITE_SEND_SCREENSHOT_PATH");
    expect(source).toContain("POPSDROPS_SMOKE_QUEUE_ONLY");
    expect(source).toContain('clickTab(client, "Creators")');
    expect(source).toContain('data-testid="campaign-creator-operations-board"');
    expect(source).toContain('data-testid="campaign-creator-scale-rail"');
    expect(source).toContain("campaign-creator-scale-rail-capacity");
    expect(source).toContain("campaign-creator-scale-rail-invitePipeline");
    expect(source).toContain("campaign-creator-scale-rail-paymentExposure");
    expect(source).toContain("campaign-creator-scale-rail-proofPressure");
    expect(source).toContain('data-testid="campaign-creator-scale-capacity-track"');
    expect(source).toContain('data-testid="campaign-creator-scale-readiness"');
    expect(source).toContain('campaign-creator-scale-readiness-invitePipeline');
    expect(source).toContain('campaign-creator-scale-readiness-paymentExposure');
    expect(source).toContain('campaign-creator-scale-readiness-proofPressure');
    expect(source).toContain("Scale readiness");
    expect(source).toContain("100-creator operating scope");
    expect(source).toContain('data-testid="campaign-creator-open-seats"');
    expect(source).toContain('data-testid="campaign-creator-invite-import"');
    expect(source).toContain('data-testid="campaign-invite-import-textarea"');
    expect(source).toContain('data-testid="campaign-invite-import-submit"');
    expect(source).toContain('data-testid="campaign-invite-import-capacity-warning"');
    expect(source).toContain('data-testid="campaign-invite-import-review-capacity"');
    expect(source).toContain('data-testid="campaign-invite-list-search"');
    expect(source).toContain('data-testid="campaign-invite-list-filter"');
    expect(source).toContain('data-testid="campaign-invite-row"');
    expect(source).toContain('data-testid="campaign-invite-send"');
    expect(source).toContain('data-testid="campaign-invite-remove"');
    expect(source).toContain("review capacity from over-capacity invite list");
    expect(source).toContain("creatorInviteCapacityWarningScreenshotPath");
    expect(source).toContain("bulk-invite-55@example.com");
    expect(source).toContain("Extra contacts: 7");
    expect(source).toContain("Review capacity");
    expect(source).toContain("100");
    expect(source).toContain("visible over-capacity invite warning");
    expect(source).toContain("Review 100-creator capacity");
    expect(source).toContain("48 open seats");
    expect(source).toContain("large-invite-one@example.com");
    expect(source).toContain("large-invite-one@example.com, @lisa.global");
    expect(source).toContain("large-invite-one@example.com; invalid contact; large-invite-two@example.com");
    expect(source).toContain("@lisa.global");
    expect(source).toContain("invalid contact");
    expect(source).toContain('from("campaign_creator_invites")');
    expect(source).toContain('.in("normalized_contact", [...expectedContacts])');
    expect(source).toContain('invite.status !== "manual"');
    expect(source).toContain("large campaign invite import stored manual outreach");
    expect(source).toContain("creator invite import save settled");
    expect(source).toContain("send saved manual email invite after unlock");
    expect(source).toContain("remove saved manual handle invite");
    expect(source).toContain("Find sent saved campaign invite row");
    expect(source).toContain("Find removed saved campaign invite row");
    expect(source).toContain("large-queued-one@example.com");
    expect(source).toContain("large-queued-two@example.com");
    expect(source).toContain("@jisoo.global");
    expect(source).toContain('"Send invites"');
    expect(source).toContain('from("notification_queue")');
    expect(source).toContain('queue.status !== "pending"');
    expect(source).toContain("Expected queued campaign invite emails to remain pending during smoke.");
    expect(source).toContain("creator invite import send settled");
    expect(source).toContain("document.querySelectorAll('[data-sonner-toast]').forEach");
    expect(source).toContain("sonner toast overlay cleared before final invite screenshot");
    expect(source).toContain("1 / 100");
    expect(source).toContain("Open seats");
    expect(source).not.toContain("Persist paid 100-creator service fee balance event");
  });

  it("normalizes CSS-uppercase scale rail labels in browser readiness checks", () => {
    const source = readFileSync(
      new URL("./smoke-large-campaign-capacity.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("scaleRailText.includes(\"paid capacity\")");
    expect(source).toContain("scaleRailText.includes(\"invite pipeline\")");
    expect(source).toContain("scaleRailText.includes(\"payment exposure\")");
    expect(source).toContain("scaleRailText.includes(\"proof pressure\")");
    expect(source).not.toContain('scaleRail.innerText.includes("Paid capacity")');
  });
});
