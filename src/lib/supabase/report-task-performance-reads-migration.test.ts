import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  new URL(
    "../../../supabase/migrations/20260507021500_allow_report_task_performance_reads.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("report task performance read uniqueness migration", () => {
  it("moves content performance uniqueness from measurement-only to report-task aware", () => {
    expect(migrationSource).toContain(
      "DROP CONSTRAINT IF EXISTS uq_performance_submission_measurement",
    );
    expect(migrationSource).toContain(
      "content_performance_submission_measurement_legacy_unique",
    );
    expect(migrationSource).toContain("WHERE report_task_id IS NULL");
    expect(migrationSource).toContain(
      "content_performance_submission_report_task_read_idx",
    );
    expect(migrationSource).toContain("WHERE report_task_id IS NOT NULL");
    expect(migrationSource).toContain(
      "allowing multiple measured points per task",
    );
  });
});
