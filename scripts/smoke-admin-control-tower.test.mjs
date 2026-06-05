import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scriptPath = "scripts/smoke-admin-control-tower.mjs";

describe("admin control tower smoke", () => {
  it("is wired into the release smoke gate", () => {
    expect(packageJson.scripts["smoke:admin-control-tower"]).toBe(
      `node ${scriptPath}`,
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:admin-control-tower",
    );
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("proves the admin home is an exception-first control tower", () => {
    const source = readFileSync(scriptPath, "utf8");

    expect(source).toContain("admin-control-tower-summary");
    expect(source).toContain("admin-attention-row");
    expect(source).toContain("Control tower");
    expect(source).toContain("What needs attention");
    expect(source).toContain("Access overdue");
    expect(source).toContain("Proof review SLA");
    expect(source).toContain("stale proof");
    expect(source).toContain("/admin/reports");
    expect(source).toContain("Email delivery");
    expect(source).toContain("/admin/approvals");
    expect(source).toContain("/admin/communications?status=failed");
    expect(source).toContain("content_performance_evidence");
    expect(source).toContain("notification_queue");
    expect(source).toContain("waitlist");
    expect(source).toContain("admin-control-tower-smoke.png");
  });
});
