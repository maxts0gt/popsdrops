import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationsDir = path.join(projectRoot, "supabase/migrations");

function getComplianceAdvisorCleanupMigration() {
  const migrationName = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_cleanup_compliance_rls_advisor_warnings.sql"),
  );

  if (!migrationName) return "";
  return readFileSync(path.join(migrationsDir, migrationName), "utf8");
}

describe("compliance RLS advisor cleanup migration", () => {
  it("consolidates data rights and legal consent policies without per-row auth initplans", () => {
    const migration = getComplianceAdvisorCleanupMigration();

    expect(migration).toContain("drop policy if exists data_rights_requests_admin");
    expect(migration).toContain("drop policy if exists data_rights_requests_select_own");
    expect(migration).toContain("drop policy if exists data_rights_requests_insert_own");
    expect(migration).toContain("create policy data_rights_requests_select_access");
    expect(migration).toContain("create policy data_rights_requests_insert_access");
    expect(migration).toContain("create policy data_rights_requests_update_admin");
    expect(migration).toContain("profile_id = (select auth.uid())");
    expect(migration).toContain("(select app_private.current_user_is_admin())");

    expect(migration).toContain("drop policy if exists legal_consents_admin");
    expect(migration).toContain("drop policy if exists legal_consents_select_own");
    expect(migration).toContain("drop policy if exists legal_consents_insert_own");
    expect(migration).toContain("create policy legal_consents_select_access");
    expect(migration).toContain("create policy legal_consents_insert_access");
    expect(migration).toContain("legal_consents_insert_public_request");
  });
});
