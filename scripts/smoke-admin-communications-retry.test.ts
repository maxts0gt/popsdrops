import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-admin-communications-retry.ts", import.meta.url)),
  "utf8",
);

describe("admin communications retry smoke fixture", () => {
  it("creates a safe failed queue row that can be retried without sending email", () => {
    expect(scriptSource).toContain("setupRetryFixture");
    expect(scriptSource).toContain("status: \"failed\"");
    expect(scriptSource).toContain("email_messages: false");
    expect(scriptSource).toContain("campaign_update");
    expect(scriptSource).toContain("Smoke retry fixture");
  });

  it("can read and clean the exact smoke row after browser retry", () => {
    expect(scriptSource).toContain("readRetryFixture");
    expect(scriptSource).toContain("cleanupRetryFixture");
    expect(scriptSource).toContain("restorePreferences");
    expect(scriptSource).toContain("smoke-admin-communications-retry");
  });

  it("runs the retry dispatch as a one-command smoke with cleanup by default", () => {
    expect(scriptSource).toContain("runAdminCommunicationsRetrySmoke");
    expect(scriptSource).toContain("dispatchNotificationEmailByQueueId");
    expect(scriptSource).toContain("!hasModeArg");
    expect(scriptSource).toContain("cleanupRetryFixture(result.notificationId)");
  });

  it("exposes the smoke through npm with react-server conditions", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:admin-communications-retry"]).toBe(
      "NODE_OPTIONS='--conditions react-server' npm exec -- tsx scripts/smoke-admin-communications-retry.ts",
    );
  });
});
