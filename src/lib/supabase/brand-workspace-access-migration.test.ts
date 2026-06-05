import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationsDir = path.join(projectRoot, "supabase/migrations");

function getBrandWorkspaceAccessMigration() {
  const migrationName = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_brand_workspace_access.sql"),
  );

  if (!migrationName) return "";
  return readFileSync(path.join(migrationsDir, migrationName), "utf8");
}

describe("brand workspace access migration", () => {
  it("extends campaign RLS to accepted brand teammates without opening team management", () => {
    const migration = getBrandWorkspaceAccessMigration();

    expect(migration).toContain(
      "create or replace function app_private.current_user_can_access_brand_workspace",
    );
    expect(migration).toContain(
      "create or replace function app_private.current_user_can_manage_brand_workspace",
    );
    expect(migration).toContain("member.accepted_at is not null");
    expect(migration).toContain("member.role in ('owner', 'admin', 'manager')");
    expect(migration).toContain("create or replace function app_private.is_campaign_brand");
    expect(migration).toContain("app_private.current_user_can_access_brand_workspace(campaigns.brand_id)");
    expect(migration).toContain("drop policy if exists campaigns_select_own_drafts");
    expect(migration).toContain("drop policy if exists campaigns_insert_brand");
    expect(migration).toContain("drop policy if exists campaigns_update_own");
    expect(migration).toContain("using (app_private.current_user_can_access_brand_workspace(brand_id))");
    expect(migration).toContain("with check (app_private.current_user_can_manage_brand_workspace(brand_id))");
  });
});
