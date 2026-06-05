import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildStripeNegativeStateEvent,
  buildStripeNegativeStateSmokeTargets,
  validateStripeNegativeStateSmoke,
} from "./smoke-stripe-negative-states.mjs";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);

describe("stripe negative payment-state smoke", () => {
  it("adds an explicit Stripe negative-state smoke command outside the fast critical loop", () => {
    expect(packageJson.scripts["smoke:stripe-negative"]).toBe(
      "node scripts/smoke-stripe-negative-states.mjs",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:stripe-negative",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "smoke:stripe-negative",
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "smoke:payment-spine",
    );
  });

  it("builds local negative-state smoke targets with the service-fee campaign id", () => {
    expect(
      buildStripeNegativeStateSmokeTargets({
        baseUrl: "http://127.0.0.1:4010/",
        campaignId: "campaign-123",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:4010",
      campaignId: "campaign-123",
      adminCampaignDetailUrl:
        "http://127.0.0.1:4010/admin/campaigns/campaign-123?focus=finance#admin-finance-exception",
      adminLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=admin",
      adminCampaignsUrl:
        "http://127.0.0.1:4010/admin/campaigns?status=all",
      adminRevenueUrl:
        "http://127.0.0.1:4010/admin/revenue?status=disputed&campaign=campaign-123#service-fees",
      creatorLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=creator",
      creatorDiscoverUrl: "http://127.0.0.1:4010/i/discover",
      creatorDiscoverDetailUrl:
        "http://127.0.0.1:4010/i/discover/campaign-123",
      publicApplyUrl: "http://127.0.0.1:4010/apply/campaign-123",
      publicCampaignApiUrl:
        "http://127.0.0.1:4010/api/public/campaigns/campaign-123",
    });
  });

  it("builds signed-webhook-compatible failed, refunded, and disputed event payloads", () => {
    expect(
      buildStripeNegativeStateEvent({
        campaignId: "campaign-123",
        status: "failed",
        suffix: "abc123",
      }),
    ).toMatchObject({
      id: "evt_test_failed_abc123",
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: "cs_test_failed_abc123",
          metadata: {
            campaignId: "campaign-123",
            kind: "campaign_service_fee",
          },
          mode: "payment",
          payment_intent: "pi_test_failed_abc123",
          payment_status: "unpaid",
        },
      },
    });

    expect(
      buildStripeNegativeStateEvent({
        campaignId: "campaign-123",
        status: "refunded",
        suffix: "abc123",
      }),
    ).toMatchObject({
      id: "evt_test_refunded_abc123",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_test_refunded_abc123",
          metadata: {
            campaignId: "campaign-123",
            kind: "campaign_service_fee",
          },
          payment_intent: "pi_test_refunded_abc123",
        },
      },
    });

    expect(
      buildStripeNegativeStateEvent({
        campaignId: "campaign-123",
        status: "disputed",
        suffix: "abc123",
      }),
    ).toMatchObject({
      id: "evt_test_disputed_abc123",
      type: "charge.dispute.created",
      data: {
        object: {
          charge: "ch_test_disputed_abc123",
          metadata: {
            campaignId: "campaign-123",
            kind: "campaign_service_fee",
          },
          payment_intent: "pi_test_disputed_abc123",
        },
      },
    });
  });

  it("requires every unsafe money state to stay creator/public locked and visible to admin", () => {
    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("all webhook negative states");

    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: false,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("admin campaigns");

    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: false,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("admin detail");

    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: false,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("admin campaigns payment exception link");

    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: false,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("admin revenue");

    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: false,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("creator detail");

    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: false,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("revenue next action");

    expect(() =>
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: false,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toThrow("compact revenue service-fee layout");

    expect(
      validateStripeNegativeStateSmoke({
        adminDetailShowsException: true,
        adminCampaignsShowsException: true,
        adminListLinksToFinancePanel: true,
        adminRevenueCompactLayout: true,
        adminRevenueFocusesExceptionRow: true,
        adminRevenueShowsNextAction: true,
        campaignStatuses: ["failed", "refunded", "disputed"],
        consoleErrors: [],
        creatorDetailLocked: true,
        creatorDiscoverHidden: true,
        paymentEventStatuses: ["failed", "refunded", "disputed"],
        publicApiLockedStatuses: ["failed", "refunded", "disputed"],
        publicApplyLocked: true,
      }),
    ).toEqual({ ok: true });
  });
});
