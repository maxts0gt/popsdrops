import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  new URL("./smoke-notification-preferences.ts", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

describe("notification preferences smoke script", () => {
  it("proves disabled message email becomes a skipped queue row", () => {
    expect(script).toContain("dispatchNotificationEmailByNotificationId");
    expect(script).toContain("email_messages: false");
    expect(script).toContain("status !== \"skipped\"");
    expect(script).toContain("email_preference_suppressed");
  });

  it("runs with the React Server condition so server-only modules can load", () => {
    expect(packageJson.scripts["smoke:notification-preferences"]).toContain(
      "--conditions react-server",
    );
    expect(packageJson.scripts["smoke:notification-preferences"]).toContain(
      "scripts/smoke-notification-preferences.ts",
    );
  });
});
