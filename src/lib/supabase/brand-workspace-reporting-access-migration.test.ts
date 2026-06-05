import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationsDir = path.join(projectRoot, "supabase/migrations");

function getReportingAccessMigration() {
  const migrationName = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_brand_workspace_reporting_access.sql"),
  );

  if (!migrationName) return "";
  return readFileSync(path.join(migrationsDir, migrationName), "utf8");
}

describe("brand workspace reporting access migration", () => {
  it("lets accepted brand teammates read report evidence rows without granting viewer review writes", () => {
    const migration = getReportingAccessMigration();

    expect(migration).toContain("drop policy if exists content_submissions_select_brand");
    expect(migration).toContain("create policy content_submissions_select_brand");
    expect(migration).toContain("app_private.current_user_can_access_brand_workspace(campaigns.brand_id)");

    expect(migration).toContain("drop policy if exists content_submissions_update_brand");
    expect(migration).toContain("create policy content_submissions_update_brand");
    expect(migration).toContain("app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)");

    expect(migration).toContain("drop policy if exists content_performance_select_brand");
    expect(migration).toContain("create policy content_performance_select_brand");
    expect(migration).toContain("app_private.current_user_can_access_brand_workspace(campaigns.brand_id)");

    expect(migration).toContain("drop policy if exists content_performance_evidence_update_brand");
    expect(migration).toContain("create policy content_performance_evidence_update_brand");
    expect(migration).toContain("app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)");

    expect(migration).toContain("drop policy if exists content_performance_metric_values_update_access");
    expect(migration).toContain("create policy content_performance_metric_values_update_access");
    expect(migration).toContain("app_private.current_user_can_manage_brand_workspace(task_campaigns.brand_id)");
  });
});
