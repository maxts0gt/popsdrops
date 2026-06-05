import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationName = "backfill_report_tasks_existing_members.sql";
const migrationDir = new URL("../../../supabase/migrations/", import.meta.url);
const migrationFile = readdirSync(migrationDir).find((fileName) =>
  fileName.endsWith(migrationName),
);

const migrationSource = migrationFile
  ? readFileSync(new URL(migrationFile, migrationDir), "utf8")
  : "";

describe("report task backfill migration", () => {
  it("creates final report tasks for existing accepted members", () => {
    expect(migrationFile).toBeTruthy();
    expect(migrationSource).toContain("insert into public.campaign_report_tasks");
    expect(migrationSource).toContain("from public.campaign_members member");
    expect(migrationSource).toContain("campaign.performance_due_date");
    expect(migrationSource).toContain("'final'");
    expect(migrationSource).toContain("on conflict (campaign_member_id, task_key) do nothing");
  });

  it("connects existing performance reads to backfilled tasks", () => {
    expect(migrationSource).toContain("update public.content_performance performance");
    expect(migrationSource).toContain("set report_task_id = latest_performance.task_id");
    expect(migrationSource).toContain("performance.report_task_id is null");
  });

  it("marks backfilled tasks submitted when matching metrics already exist", () => {
    expect(migrationSource).toContain("update public.campaign_report_tasks task");
    expect(migrationSource).toContain("submitted_late");
    expect(migrationSource).toContain("submitted_at = submitted_tasks.submitted_at");
  });
});
