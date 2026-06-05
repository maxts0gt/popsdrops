import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID,
  PRODUCT_NOTIFICATION_ACTION_TYPES,
  buildRejectionApplicationTargets,
  buildProductNotificationActionSmokeTargets,
  validateProductNotificationActionSmoke,
} from "./smoke-product-notification-actions.mjs";

describe("product action notification email smoke contract", () => {
  it("targets disposable campaigns and the critical product notification types", () => {
    expect(buildProductNotificationActionSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID,
      rejectionCampaignId: "a0000000-0000-4000-8000-000000000109",
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID}`,
      brandReportUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID}`,
      rejectionApplyUrl: "http://127.0.0.1:4000/apply/a0000000-0000-4000-8000-000000000109",
      rejectionDiscoverUrl: "http://127.0.0.1:4000/i/discover/a0000000-0000-4000-8000-000000000109",
      rejectionBrandCampaignUrl: "http://127.0.0.1:4000/b/campaigns/a0000000-0000-4000-8000-000000000109",
    });
    expect(PRODUCT_NOTIFICATION_ACTION_TYPES).toEqual([
      "application_rejected",
      "campaign_update",
      "report_correction_requested",
      "campaign_completed",
    ]);
  });

  it("rejects a smoke result that did not send every notification email", () => {
    expect(() =>
      validateProductNotificationActionSmoke({
        notificationResults: [
          { type: "application_rejected", queueStatus: "sent" },
        ],
        consoleErrors: [],
      }),
    ).toThrow(/missing product notification/i);
  });

  it("submits the rejection application through the private invite URL", () => {
    const targets = buildProductNotificationActionSmokeTargets({});

    expect(
      buildRejectionApplicationTargets(targets, "11111111-2222-4333-8444-555555555555"),
    ).toMatchObject({
      campaignId: "a0000000-0000-4000-8000-000000000109",
      applyUrl:
        "http://127.0.0.1:4000/apply/a0000000-0000-4000-8000-000000000109?invite=11111111-2222-4333-8444-555555555555",
      discoverUrl:
        "http://127.0.0.1:4000/i/discover/a0000000-0000-4000-8000-000000000109?invite=11111111-2222-4333-8444-555555555555",
      brandCampaignUrl:
        "http://127.0.0.1:4000/b/campaigns/a0000000-0000-4000-8000-000000000109",
    });
  });

  it("moves the workflow campaign into active work before creator content submission", () => {
    const script = readFileSync(
      new URL("./smoke-product-notification-actions.mjs", import.meta.url),
      "utf8",
    );

    expect(script).toContain("transitionSmokeCampaignToActiveWork");
    expect(script.indexOf("await transitionSmokeCampaignToActiveWork")).toBeLessThan(
      script.indexOf("await submitCreatorDraft"),
    );
  });

  it("accepts sent queue rows for every product notification action", () => {
    expect(
      validateProductNotificationActionSmoke({
        notificationResults: PRODUCT_NOTIFICATION_ACTION_TYPES.map((type) => ({
          type,
          queueStatus: "sent",
        })),
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("drives product actions instead of inserting notifications directly", () => {
    const script = readFileSync(
      new URL("./smoke-product-notification-actions.mjs", import.meta.url),
      "utf8",
    );

    expect(script).toContain("rejectCreatorApplication");
    expect(script).toContain("sendBrandAnnouncement");
    expect(script).toContain("requestReportCorrection");
    expect(script).toContain("completeReadyCampaign");
    expect(script).toContain("waitForSentProductNotificationEmail");
    expect(script).toContain("creator-product-notification-smoke@example.invalid");
    expect(script).toContain("brand-product-notification-smoke@example.invalid");
    expect(script).not.toContain('|| "max@popsdrops.com"');
    expect(script).not.toContain('||\n  "support@tengrivertex.com"');
    expect(script).not.toContain('.from("notifications").insert');
  });

  it("exposes the product-action smoke through npm", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:product-notification-actions"]).toBe(
      "node scripts/smoke-product-notification-actions.mjs",
    );
  });
});
