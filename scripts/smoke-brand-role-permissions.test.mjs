import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);

const sourcePath = "scripts/smoke-brand-role-permissions.mjs";
const source = () => readFileSync(resolve(process.cwd(), sourcePath), "utf8");

describe("brand role permission smoke", () => {
  it("exposes the brand role smoke in the release matrix", () => {
    expect(packageJson.scripts["smoke:brand-role-permissions"]).toBe(
      `node ${sourcePath}`,
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "smoke:brand-role-permissions",
    );
  });

  it("covers every brand team role through real dashboard surfaces", () => {
    const smokeSource = source();

    expect(smokeSource).toContain("buildBrandRolePermissionSmokeTargets");
    expect(smokeSource).toContain("validateBrandRolePermissionSmoke");
    expect(smokeSource).toContain("teamRole=owner");
    expect(smokeSource).toContain("teamRole=admin");
    expect(smokeSource).toContain("teamRole=manager");
    expect(smokeSource).toContain("teamRole=viewer");
    expect(smokeSource).toContain("brand-team-invite-form");
    expect(smokeSource).toContain("brand-team-manage-unavailable");
    expect(smokeSource).toContain("campaign-create-action");
    expect(smokeSource).toContain("campaign-invite-copy");
    expect(smokeSource).toContain("campaign-invite-read-only");
    expect(smokeSource).toContain("report-share-button");
    expect(smokeSource).toContain("report-export-menu");
    expect(smokeSource).toContain("reportExportVisible");
    expect(smokeSource).toContain("reportExportVisible: false");
    expect(smokeSource).toContain("billingCampaignUrl");
    expect(smokeSource).toContain("serviceFeeActionVisible");
    expect(smokeSource).toContain("serviceFeeActionEnabled");
    expect(smokeSource).toContain("serviceFeeActionEnabled: true");
    expect(smokeSource).toContain("serviceFeeActionEnabled: false");
    expect(smokeSource).toContain("campaign-service-fee-action");
    expect(smokeSource).toContain("campaign-report-page");
    expect(smokeSource).toContain("dataset.reportRole !== 'loading'");
  });

  it("uses one live seeded brand campaign for detail and report permission checks", () => {
    const smokeSource = source();

    expect(smokeSource).toContain(
      "process.env.SMOKE_BRAND_ROLE_REPORT_CAMPAIGN_ID || campaignId",
    );
    expect(smokeSource).not.toContain("DEFAULT_REPORT_CAMPAIGN_ID");
    expect(smokeSource).not.toContain("4707edb5-dcab-4b2d-b5eb-7e79f0e1f010");
  });

  it("prepares report evidence for the report permission check", () => {
    const smokeSource = source();

    expect(smokeSource).toContain("assertBrandReportRouteAvailable");
    expect(smokeSource).toContain('redirect: "manual"');
    expect(smokeSource).toContain("response.status === 404");
    expect(smokeSource).toContain("seedReportPerformanceForRoleSmoke");
    expect(smokeSource).toContain("/dev/seed-report-performance");
    expect(smokeSource).toContain(
      "campaignId=${encodeURIComponent(targets.reportCampaignId)}",
    );
    expect(smokeSource).toContain("seedResult.success !== true");
  });

  it("prepares an unpaid service fee campaign for the billing permission check", () => {
    const smokeSource = source();

    expect(smokeSource).toContain("setupApplicationFlowSmokeData");
    expect(smokeSource).toContain("cleanupApplicationFlowSmokeData");
    expect(smokeSource).toContain("service_fee_status: \"pending\"");
    expect(smokeSource).toContain("seedBillingCampaignForRoleSmoke");
    expect(smokeSource).toContain("cleanupBillingCampaignForRoleSmoke");
  });

  it("closes the browser debugging connection before finishing", () => {
    const smokeSource = source();

    expect(smokeSource).toContain("closeCdpClient");
    expect(smokeSource).toContain("await clientClosed");
    expect(smokeSource).toContain('socket.addEventListener("close"');
  });
});
