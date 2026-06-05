import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./page.tsx", import.meta.url)),
  "utf8",
);

describe("admin dashboard control tower", () => {
  it("turns the admin home into an exception-first control tower", () => {
    expect(source).toContain("async function fetchControlTowerStats");
    expect(source).toContain('export const dynamic = "force-dynamic";');
    expect(source).toContain('from("waitlist")');
    expect(source).toContain('from("profiles")');
    expect(source).toContain('from("campaigns")');
    expect(source).toContain('from("campaign_report_tasks")');
    expect(source).toContain('from("content_performance_evidence")');
    expect(source).toContain('from("notification_queue")');
    expect(source).toContain('from("function_execution_log")');
    expect(source).toContain("reviewSlaBreaches");
    expect(source).toContain("reviewSlaCutoff");

    expect(source).toContain("Control tower");
    expect(source).toContain("What needs attention");
    expect(source).toContain("Proof review SLA");
    expect(source).toContain("submitted proof");
    expect(source).toContain('data-testid="admin-control-tower-summary"');
    expect(source).toContain('data-testid="admin-attention-row"');
    expect(source).toContain("/admin/approvals");
    expect(source).toContain("/admin/campaigns");
    expect(source).toContain("/admin/reports");
    expect(source).toContain("/admin/revenue");
    expect(source).toContain("/admin/communications");
  });

  it("keeps the dashboard operational and free of generic filler", () => {
    expect(source).not.toContain("Platform overview and action items");
    expect(source).not.toContain("Total Users");
    expect(source).not.toContain("Quick Links");
    expect(source).not.toContain("Review Now");
    expect(source).not.toContain("\u2014");
  });
});
