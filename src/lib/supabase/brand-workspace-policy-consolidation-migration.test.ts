import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationsDir = path.join(projectRoot, "supabase/migrations");

function getConsolidationMigration() {
  const migrationName = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_consolidate_brand_workspace_campaign_policies.sql"),
  );

  if (!migrationName) return "";
  return readFileSync(path.join(migrationsDir, migrationName), "utf8");
}

describe("brand workspace campaign policy consolidation", () => {
  it("removes the old owner-only consolidated campaign policies and keeps one workspace-aware path", () => {
    const migration = getConsolidationMigration();

    expect(migration).toContain("drop policy if exists rls_campaigns_insert_authenticated_06bd9f8a");
    expect(migration).toContain("drop policy if exists rls_campaigns_select_authenticated_086453a2");
    expect(migration).toContain("drop policy if exists rls_campaigns_update_authenticated_4f6cd5ab");
    expect(migration).toContain("drop policy if exists campaigns_select_own_drafts");
    expect(migration).toContain("status <> 'draft'::public.campaign_status");
    expect(migration).toContain("app_private.current_user_can_access_brand_workspace(brand_id)");
    expect(migration).toContain("profiles.id = (select auth.uid())");
    expect(migration).toContain("invited_by = (select auth.uid())");
  });
});
