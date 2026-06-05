import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scriptPath = "scripts/smoke-admin-settings-governance.mjs";

describe("admin settings governance smoke", () => {
  it("is wired as a release smoke and exercises settings plus exception-only privacy actions", () => {
    expect(packageJson.scripts["smoke:admin-settings-governance"]).toBe(
      `node ${scriptPath}`,
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:admin-settings-governance",
    );
    expect(existsSync(scriptPath)).toBe(true);

    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain("Privacy Requests");
    expect(source).not.toContain("Data Rights Requests");
    expect(source).toContain("updatePlatformSetting");
    expect(source).toContain("updateDataRightsRequestStatus");
    expect(source).toContain("assertSelfServePrivacyRow");
    expect(source).toContain("clickPrivacyExceptionResolve");
    expect(source).toContain("clickPrivacyExceptionDeny");
    expect(source).toContain("Self-serve queue");
    expect(source).toContain("Review exception");
    expect(source).toContain("Mark resolved");
    expect(source).toContain("Deny with reason");
    expect(source).toContain("Confirm denial");
    expect(source).toContain("privacy_request_denied");
    expect(source).not.toContain("Cancel request");
    expect(source).not.toContain("clickDataRightsReviewing");
    expect(source).toContain("creator_min_followers");
    expect(source).toContain("enabled_markets");
    expect(source).toContain("updateEnabledMarketsInUi");
    expect(source).toContain("admin-settings-market-picker");
    expect(source).toContain("Save enabled markets");
    expect(source).toContain("data_rights_requests");
    expect(source).toContain("admin_audit_log");
    expect(source).toContain("admin-settings-governance-smoke.png");
  });
});
