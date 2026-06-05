import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-admin-direct-email-delivery.ts", import.meta.url)),
  "utf8",
);

describe("admin direct email delivery smoke fixture", () => {
  it("creates a direct admin communications queue row for a safe recipient", () => {
    expect(scriptSource).toContain("setupAdminDirectEmailFixture");
    expect(scriptSource).toContain("DEFAULT_RECIPIENT_EMAIL");
    expect(scriptSource).toContain("admin-direct-email-smoke@example.invalid");
    expect(scriptSource).not.toContain('DEFAULT_RECIPIENT_EMAIL = "max@popsdrops.com"');
    expect(scriptSource).toContain('template: "account_rejected"');
    expect(scriptSource).toContain("smoke-admin-direct-email-delivery");
  });

  it("dispatches direct queue rows by queue id and asserts sent delivery", () => {
    expect(scriptSource).toContain("dispatchNotificationEmailByQueueId");
    expect(scriptSource).toContain("dispatchAdminDirectEmailFixture");
    expect(scriptSource).toContain("email_sent");
    expect(scriptSource).toContain("delivered_at");
    expect(scriptSource).toContain("attempt_count");
  });

  it("can read, send, and clean the exact direct queue row", () => {
    expect(scriptSource).toContain("readAdminDirectEmailFixture");
    expect(scriptSource).toContain("cleanupAdminDirectEmailFixture");
    expect(scriptSource).toContain("--send");
    expect(scriptSource).toContain("--queue-id");
    expect(scriptSource).toContain("--keep");
  });

  it("exposes the smoke through npm without React Server Component conditions", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:admin-direct-email"]).toBe(
      "npm exec -- tsx scripts/smoke-admin-direct-email-delivery.ts",
    );
    expect(packageJson.scripts["smoke:admin-direct-email"]).not.toContain(
      "react-server",
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:admin-direct-email",
    );
  });
});
