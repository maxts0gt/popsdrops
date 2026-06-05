import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationName = "enforce_campaign_timeline_constraints.sql";
const migrationDir = new URL("../../../supabase/migrations/", import.meta.url);
const migrationFile = readdirSync(migrationDir).find((fileName) =>
  fileName.endsWith(migrationName),
);

const migrationSource = migrationFile
  ? readFileSync(new URL(migrationFile, migrationDir), "utf8")
  : "";

describe("campaign timeline constraint migration", () => {
  it("backfills impossible campaign timeline dates before adding constraints", () => {
    expect(migrationFile).toBeTruthy();
    expect(migrationSource).toContain("application_deadline > content_due_date");
    expect(migrationSource).toContain("posting_window_start > posting_window_end");
    expect(migrationSource).toContain("performance_due_date < posting_window_end");
  });

  it("adds database checks matching campaign creation validation", () => {
    expect(migrationSource).toContain("campaigns_application_before_content_check");
    expect(migrationSource).toContain("campaigns_posting_window_order_check");
    expect(migrationSource).toContain("campaigns_content_before_posting_end_check");
    expect(migrationSource).toContain("campaigns_performance_after_reporting_window_check");
  });
});
