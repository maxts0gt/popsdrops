import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const migrationsDir = path.join(projectRoot, "supabase/migrations");

function readLifecycleGuardMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.includes("campaign_lifecycle_guard_matrix"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
}

describe("campaign lifecycle guard matrix migration", () => {
  it("pushes active-phase rules into Supabase policies for creator work and proof", () => {
    const migration = readLifecycleGuardMigrations();

    expect(migration).toContain(
      "create or replace function app_private.campaign_accepts_creator_work",
    );
    expect(migration).toContain(
      "create or replace function app_private.campaign_accepts_content_decisions",
    );
    expect(migration).toContain(
      "create or replace function app_private.campaign_accepts_proof_submission",
    );
    expect(migration).toContain(
      "create or replace function app_private.campaign_accepts_proof_decisions",
    );
    expect(migration).toContain(
      "campaigns.status in ('in_progress', 'publishing', 'monitoring')",
    );
    expect(migration).toContain("content_submissions_insert_creator");
    expect(migration).toContain("content_submissions_update_access");
    expect(migration).toContain("content_performance_insert_creator");
    expect(migration).toContain("content_performance_update_creator");
    expect(migration).toContain("content_performance_evidence_insert_creator");
    expect(migration).toContain("content_performance_ai_extractions_update_creator");
    expect(migration).toContain("content_performance_metric_values_insert_creator");
  });

  it("requires published submissions before direct metric writes or report-task completion", () => {
    const migration = readLifecycleGuardMigrations();

    expect(migration).toContain("submission.status = 'published'");
    expect(migration).toContain("public.submit_creator_report_task");
    expect(migration).toContain(
      "app_private.campaign_accepts_proof_submission(task.campaign_id)",
    );
    expect(migration).toContain("Report task cannot be submitted");
  });
});
