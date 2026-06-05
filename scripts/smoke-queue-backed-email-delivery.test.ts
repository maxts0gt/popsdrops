import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-queue-backed-email-delivery.ts", import.meta.url)),
  "utf8",
);

describe("queue backed email delivery smoke fixture", () => {
  it("creates report follow-up notifications through the product builder", () => {
    expect(scriptSource).toContain("buildReportFollowUpNotification");
    expect(scriptSource).toContain("setupQueueBackedEmailFixture");
    expect(scriptSource).toContain("report_follow_up_requested");
    expect(scriptSource).toContain("Queue backed email smoke");
  });

  it("dispatches through the real notification queue and asserts sent delivery", () => {
    expect(scriptSource).toContain("installServerOnlySmokeHook");
    expect(scriptSource).toContain("../src/lib/email/notification-queue");
    expect(scriptSource).toContain("email_reports: true");
    expect(scriptSource).toContain("email_sent");
    expect(scriptSource).toContain("delivered_at");
  });

  it("routes the smoke profile to the requested recipient and restores it", () => {
    expect(scriptSource).toContain("previous_email");
    expect(scriptSource).toContain("restoreSmokeProfile");
    expect(scriptSource).toContain("readRecipientArg");
    expect(scriptSource).toContain("queue-backed-email-smoke@example.invalid");
    expect(scriptSource).not.toContain('DEFAULT_RECIPIENT_EMAIL = "max@popsdrops.com"');
  });

  it("runs as a one-command smoke with cleanup by default", () => {
    expect(scriptSource).toContain("runQueueBackedEmailSmoke");
    expect(scriptSource).toContain("!hasModeArg");
    expect(scriptSource).toContain("cleanupQueueBackedEmailFixture(result.notificationId)");
  });

  it("exposes the smoke through npm with react-server conditions", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:queue-backed-email"]).toBe(
      "npm exec -- tsx scripts/smoke-queue-backed-email-delivery.ts",
    );
  });
});
