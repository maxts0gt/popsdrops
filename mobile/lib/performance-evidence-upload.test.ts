import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const actionsSource = readFileSync(
  join(currentDir, "campaign-actions.ts"),
  "utf8",
);
const migrationsDir = join(currentDir, "../../supabase/migrations");
const migrationFiles = readdirSync(migrationsDir);
const migrationFile = migrationFiles.find((file) =>
  file.endsWith("_creator_report_task_submit_rpc.sql"),
);
if (!migrationFile) {
  throw new Error("Missing creator report task submission RPC migration");
}
const migrationSource = readFileSync(
  join(migrationsDir, migrationFile),
  "utf8",
);
const advisorCleanupMigrationFile = migrationFiles.find((file) =>
  file.endsWith("_supabase_security_advisor_cleanup.sql"),
);
const advisorCleanupMigrationSource = advisorCleanupMigrationFile
  ? readFileSync(join(migrationsDir, advisorCleanupMigrationFile), "utf8")
  : "";

describe("mobile performance evidence upload", () => {
  it("prepares metadata before storage upload because storage RLS depends on it", () => {
    expect(actionsSource).toContain("export async function uploadPerformanceEvidenceFile");
    expect(actionsSource).toContain(".from(\"content_performance_evidence\")");
    expect(actionsSource).toContain(".insert({");
    expect(actionsSource).toContain(".storage.from(EVIDENCE_BUCKET_ID).upload");
    expect(actionsSource.indexOf(".insert({")).toBeLessThan(
      actionsSource.indexOf(".storage.from(EVIDENCE_BUCKET_ID).upload"),
    );
  });

  it("links uploaded evidence and marks the creator report task submitted", () => {
    expect(actionsSource).toContain("evidence_id?: string");
    expect(actionsSource).toContain(".from(\"content_performance_evidence\")");
    expect(actionsSource).toContain("link_creator_performance_evidence");
    expect(actionsSource).toContain("submit_creator_report_task");
  });

  it("uses a constrained RPC instead of broad creator update access on report tasks", () => {
    expect(migrationSource).toContain("create or replace function public.submit_creator_report_task");
    expect(migrationSource).toContain("create or replace function public.link_creator_performance_evidence");
    expect(migrationSource).toContain("app_private.is_report_task_creator(p_task_id)");
    expect(migrationSource).toContain("app_private.is_performance_creator(p_performance_id)");
    expect(migrationSource).toContain("least(p_submitted_at, now())");
    expect(migrationSource).toContain("grant execute on function public.submit_creator_report_task");
    expect(migrationSource).toContain(
      "grant execute on function public.link_creator_performance_evidence",
    );
    expect(migrationSource).not.toContain("campaign_report_tasks_update_creator");
  });

  it("keeps the mobile RPC contract while moving security-definer work private", () => {
    expect(advisorCleanupMigrationFile).toBeTruthy();
    expect(advisorCleanupMigrationSource).toContain(
      "create or replace function app_private.submit_creator_report_task",
    );
    expect(advisorCleanupMigrationSource).toContain(
      "create or replace function public.submit_creator_report_task",
    );
    expect(advisorCleanupMigrationSource).toContain(
      "return query select * from app_private.submit_creator_report_task",
    );
    expect(advisorCleanupMigrationSource).toContain(
      "grant execute on function public.submit_creator_report_task",
    );
    expect(advisorCleanupMigrationSource).toContain(
      "create or replace function app_private.link_creator_performance_evidence",
    );
    expect(advisorCleanupMigrationSource).toContain(
      "create or replace function public.link_creator_performance_evidence",
    );
    expect(advisorCleanupMigrationSource).toContain(
      "return query select * from app_private.link_creator_performance_evidence",
    );
    expect(advisorCleanupMigrationSource).toContain(
      "grant execute on function public.link_creator_performance_evidence",
    );
  });
});
