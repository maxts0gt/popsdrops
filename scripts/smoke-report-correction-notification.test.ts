import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-report-correction-notification.ts", import.meta.url)),
  "utf8",
);

describe("report correction notification smoke fixture", () => {
  it("creates report correction notifications through the product builder", () => {
    expect(scriptSource).toContain("buildReportCorrectionNotification");
    expect(scriptSource).toContain("setupReportCorrectionFixture");
    expect(scriptSource).toContain("report_correction_requested");
    expect(scriptSource).toContain("Smoke report correction fixture");
  });

  it("dispatches safely through report email preferences instead of sending email", () => {
    expect(scriptSource).toContain("dispatchNotificationEmailByNotificationId");
    expect(scriptSource).toContain("email_reports: false");
    expect(scriptSource).toContain("email_preference_suppressed");
    expect(scriptSource).toContain("delivered_at");
  });

  it("runs as a one-command smoke with cleanup by default", () => {
    expect(scriptSource).toContain("runReportCorrectionNotificationSmoke");
    expect(scriptSource).toContain("!hasModeArg");
    expect(scriptSource).toContain("cleanupReportCorrectionFixture(result.notificationId)");
  });

  it("exposes the smoke through npm with react-server conditions", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:report-correction-notification"]).toBe(
      "NODE_OPTIONS='--conditions react-server' npm exec -- tsx scripts/smoke-report-correction-notification.ts",
    );
  });
});
