import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);

const sourcePath = "scripts/smoke-report-share-revoke.mjs";

describe("report share revoke smoke", () => {
  it("exposes a release bad-path command for share revocation and expiry", () => {
    expect(packageJson.scripts["smoke:report-share-revoke"]).toBe(
      `node ${sourcePath}`,
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "smoke:payment-spine",
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "smoke:content-report-recovery",
    );
    expect(packageJson.scripts["smoke:release-bad-paths"]).toContain(
      "smoke:report-share-revoke",
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "smoke:release-bad-paths",
    );
  });

  it("proves active links open, revoked links close, and expired links close", () => {
    const source = readFileSync(resolve(process.cwd(), sourcePath), "utf8");

    expect(source).toContain("DEFAULT_REPORT_SHARE_REVOKE_CAMPAIGN_ID");
    expect(source).toContain("setupApplicationFlowSmokeData");
    expect(source).toContain("REPORT_SHARE_CUSTOM_TITLE");
    expect(source).toContain("configureSharedReportSmokeTitle");
    expect(source).toContain("REPORT_SHARE_ROUTE_RETRY_ATTEMPTS");
    expect(source).toContain("waitForReportShareButton");
    expect(source).toContain("report route not-found retry");
    expect(source).toContain("applyUrl:");
    expect(source).toContain("discoverUrl:");
    expect(source).toContain("report-share-button");
    expect(source).toContain("Create link");
    expect(source).toContain("report-share-url");
    expect(source).toContain("Shared campaign report");
    expect(source).toContain("Expected active share link to include the configured report title.");
    expect(source).toContain("Access expires");
    expect(source).toContain('lowerText.includes("trust decision")');
    expect(source).toContain('lowerText.includes("leadership hold")');
    expect(source).toContain("Performance detail held for evidence review");
    expect(source).toContain(
      "Keep in proof room until at least one proof read is submitted and reviewed.",
    );
    expect(source).toContain("Data source");
    expect(source).toContain("Expected no-proof leadership-hold share link to withhold creator performance.");
    expect(source).toContain("Revoke");
    expect(source).toContain("campaign_report_share_links");
    expect(source).toContain("expires_at");
    expect(source).toContain("This report link is expired, revoked, or no longer exists.");
    expect(source).toContain("cleanupApplicationFlowSmokeData");
  });
});
