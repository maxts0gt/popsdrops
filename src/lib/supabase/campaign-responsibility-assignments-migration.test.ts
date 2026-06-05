import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../../../supabase/migrations", import.meta.url);
const migrationSource = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => readFileSync(join(migrationsDir.pathname, fileName), "utf8"))
  .join("\n");

describe("campaign responsibility assignments migration", () => {
  it("adds one accountable teammate per campaign responsibility", () => {
    expect(migrationSource).toContain("create type public.campaign_responsibility_kind");
    expect(migrationSource).toContain("create table if not exists public.campaign_responsibility_assignments");
    expect(migrationSource).toContain("campaign_id uuid not null references public.campaigns(id) on delete cascade");
    expect(migrationSource).toContain("brand_team_member_id uuid not null references public.brand_team_members(id) on delete cascade");
    expect(migrationSource).toContain("unique (campaign_id, responsibility)");
    expect(migrationSource).toContain("campaign_responsibility_assignments_member_idx");
  });

  it("keeps campaign responsibility data behind brand workspace RLS", () => {
    expect(migrationSource).toContain("alter table public.campaign_responsibility_assignments enable row level security");
    expect(migrationSource).toContain("campaign_responsibility_assignments_select_workspace");
    expect(migrationSource).toContain("campaign_responsibility_assignments_insert_manager");
    expect(migrationSource).toContain("campaign_responsibility_assignments_update_manager");
    expect(migrationSource).toContain("campaign_responsibility_assignments_delete_manager");
    expect(migrationSource).toContain("app_private.current_user_can_access_brand_workspace(campaigns.brand_id)");
    expect(migrationSource).toContain("app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)");
    expect(migrationSource).toContain("grant select, insert, update, delete on public.campaign_responsibility_assignments to authenticated");
  });
});
