import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationsDir = path.join(projectRoot, "supabase/migrations");

function getReportingPolicyConsolidationMigration() {
  const migrationName = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_consolidate_brand_workspace_reporting_policies.sql"),
  );

  if (!migrationName) return "";
  return readFileSync(path.join(migrationsDir, migrationName), "utf8");
}

describe("brand workspace reporting policy consolidation", () => {
  it("keeps reporting RLS team-aware without duplicate permissive policies", () => {
    const migration = getReportingPolicyConsolidationMigration();

    expect(migration).toContain("drop policy if exists rls_content_submissions_select_authenticated_9c0cafa8");
    expect(migration).toContain("drop policy if exists content_submissions_select_brand");
    expect(migration).toContain("create policy content_submissions_select_access");
    expect(migration).toContain("app_private.current_user_can_access_brand_workspace(campaigns.brand_id)");

    expect(migration).toContain("drop policy if exists content_submissions_update_creator");
    expect(migration).toContain("drop policy if exists content_submissions_update_brand");
    expect(migration).toContain("create policy content_submissions_update_access");
    expect(migration).toContain("app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)");
    expect(migration).toContain("app_private.campaign_member_has_required_agreement(member.id)");

    expect(migration).toContain("drop policy if exists rls_content_performance_select_authenticated_9e7ef463");
    expect(migration).toContain("drop policy if exists content_performance_select_brand");
    expect(migration).toContain("create policy content_performance_select_access");

    expect(migration).toContain("drop policy if exists rls_content_performance_evid_update_authenticated_2e4f3664");
    expect(migration).toContain("drop policy if exists content_performance_evidence_update_brand");
    expect(migration).toContain("create policy content_performance_evidence_update_access");
  });
});
