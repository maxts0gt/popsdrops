import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildAdminServiceFeeOverrideSmokeTargets,
  validateAdminServiceFeeOverrideSmoke,
} from "./smoke-admin-service-fee-override.mjs";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);

describe("admin service fee override smoke", () => {
  it("adds the admin manual finance override smoke to the release bad paths", () => {
    expect(packageJson.scripts["smoke:admin-service-fee-override"]).toBe(
      "node scripts/smoke-admin-service-fee-override.mjs",
    );
    expect(packageJson.scripts["smoke:payment-spine"]).toContain(
      "smoke:admin-service-fee-override",
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "smoke:payment-spine",
    );
  });

  it("builds focused admin and product targets for a manual paid override", () => {
    expect(
      buildAdminServiceFeeOverrideSmokeTargets({
        baseUrl: "http://127.0.0.1:4010/",
        campaignId: "campaign-123",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:4010",
      campaignId: "campaign-123",
      adminCampaignDetailUrl:
        "http://127.0.0.1:4010/admin/campaigns/campaign-123?focus=finance#admin-finance-exception",
      adminLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=admin",
      adminRevenueDisputedUrl:
        "http://127.0.0.1:4010/admin/revenue?status=disputed&campaign=campaign-123#service-fees",
      adminRevenuePaidUrl:
        "http://127.0.0.1:4010/admin/revenue?status=paid&campaign=campaign-123#service-fees",
      brandCampaignUrl: "http://127.0.0.1:4010/b/campaigns/campaign-123",
      brandLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=brand",
      creatorDiscoverDetailUrl:
        "http://127.0.0.1:4010/i/discover/campaign-123",
      creatorDiscoverUrl: "http://127.0.0.1:4010/i/discover",
      creatorLoginUrl: "http://127.0.0.1:4010/auth/dev-login?role=creator",
      publicApplyUrl: "http://127.0.0.1:4010/apply/campaign-123",
      publicCampaignApiUrl:
        "http://127.0.0.1:4010/api/public/campaigns/campaign-123",
    });
  });

  it("requires the manual override to unlock only after a note-backed paid stamp", () => {
    const passingResult = {
      adminAuditHasManualNote: true,
      adminDetailClearsExceptionAfterOverride: true,
      adminDetailShowsExceptionBeforeOverride: true,
      adminRevenueShowsManualPaidStamp: true,
      brandLaunchEnabledAfterOverride: true,
      consoleErrors: [],
      creatorDetailVisible: true,
      creatorDiscoverVisible: true,
      finalServiceFeeStatus: "paid",
      manualEventStamped: true,
      publicApiUnlocked: true,
      publicApplyVisible: true,
    };

    expect(() =>
      validateAdminServiceFeeOverrideSmoke({
        ...passingResult,
        manualEventStamped: false,
      }),
    ).toThrow("manual finance event");

    expect(() =>
      validateAdminServiceFeeOverrideSmoke({
        ...passingResult,
        adminAuditHasManualNote: false,
      }),
    ).toThrow("audit note");

    expect(() =>
      validateAdminServiceFeeOverrideSmoke({
        ...passingResult,
        finalServiceFeeStatus: "disputed",
      }),
    ).toThrow("paid");

    expect(() =>
      validateAdminServiceFeeOverrideSmoke({
        ...passingResult,
        brandLaunchEnabledAfterOverride: false,
      }),
    ).toThrow("brand launch");

    expect(validateAdminServiceFeeOverrideSmoke(passingResult)).toEqual({
      ok: true,
    });
  });
});
