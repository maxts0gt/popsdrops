import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  new URL("./notification-queue-audit.ts", import.meta.url),
  "utf8",
);

describe("notification queue audit script", () => {
  it("uses the email-backed notification type list as the source of truth", () => {
    expect(script).toContain("EMAIL_NOTIFICATION_TYPES");
    expect(script).toContain("unsupportedTemplates");
  });

  it("defaults to a read-only audit", () => {
    expect(script).toContain("--close-unsupported");
    expect(script).toContain("dryRun");
    expect(script).toContain("No rows were changed");
  });

  it("only closes pending unsupported legacy queue rows", () => {
    expect(script).toContain(".from(\"notification_queue\")");
    expect(script).toContain(".eq(\"status\", \"pending\")");
    expect(script).toContain(".is(\"processed_at\", null)");
    expect(script).toContain("legacy_unsupported_template_closed");
    expect(script).toContain("status: \"unsupported\"");
  });

  it("archives supported legacy rows only before an explicit cutoff", () => {
    expect(script).toContain("--archive-supported-before=");
    expect(script).toContain("archiveSupportedBefore");
    expect(script).toContain(".lt(\"created_at\", archiveSupportedBefore)");
    expect(script).toContain("legacy_supported_not_replayed");
    expect(script).toContain("status: \"archived\"");
  });

  it("exposes the queue audit script through npm", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:notification-queue:audit"]).toBe(
      "npm exec -- tsx scripts/notification-queue-audit.ts",
    );
  });
});
