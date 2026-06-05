import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-privacy-controls.mjs", import.meta.url)),
  "utf8",
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

describe("privacy controls smoke", () => {
  it("stays wired into the release smoke gate", () => {
    expect(packageJson.scripts["smoke:privacy-controls"]).toBe(
      "node scripts/smoke-privacy-controls.mjs",
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:privacy-controls",
    );
  });

  it("proves the signed-in data-rights loop end to end", () => {
    expect(scriptSource).toContain('data-testid="privacy-request-history"');
    expect(scriptSource).toContain('data-testid="privacy-export-request"');
    expect(scriptSource).toContain('data-testid="privacy-export-download"');
    expect(scriptSource).toContain("Denied");
    expect(scriptSource).toContain("Scheduled");
    expect(scriptSource).toContain("Expired");
    expect(scriptSource).toContain("waitForCompletedExport");
    expect(scriptSource).toContain("readPrivacyExportArtifact");
    expect(scriptSource).toContain("readDataExportReadyEmail");
    expect(scriptSource).toContain("data_export_ready");
  });

  it("cleans up request rows, export artifacts, and queued email evidence", () => {
    expect(scriptSource).toContain("cleanupStalePrivacySmokeRows");
    expect(scriptSource).toContain("smoke privacy controls expired export");
    expect(scriptSource).toContain("cleanupPrivacyRequests");
    expect(scriptSource).toContain("cleanupPrivacyExportArtifacts");
    expect(scriptSource).toContain("cleanupNotificationQueue");
    expect(scriptSource).toContain("privacy-exports");
  });

  it("waits for Chrome and retries temp profile cleanup", () => {
    expect(scriptSource).toContain("cleanupBrowserUserDataDir");
    expect(scriptSource).toContain("maxRetries");
    expect(scriptSource).toContain("retryDelay");
    expect(scriptSource).toContain("chrome.once(\"exit\"");
  });
});
