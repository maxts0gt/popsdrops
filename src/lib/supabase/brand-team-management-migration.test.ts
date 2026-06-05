import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const migrationsDir = path.join(projectRoot, "supabase/migrations");
const databaseTypesPath = path.join(projectRoot, "src/types/database.ts");

function getBrandTeamMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.includes("brand_team_"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
}

describe("brand team management migration", () => {
  it("stores brand workspace members and invitations with explicit RLS", () => {
    const migration = getBrandTeamMigrations();
    const databaseTypes = existsSync(databaseTypesPath)
      ? readFileSync(databaseTypesPath, "utf8")
      : "";

    expect(migration).toContain("create type public.brand_team_role");
    expect(migration).toContain(
      "create type public.brand_team_invitation_status",
    );
    expect(migration).toContain(
      "create table if not exists public.brand_team_members",
    );
    expect(migration).toContain(
      "brand_id uuid not null references public.profiles(id)",
    );
    expect(migration).toContain(
      "user_id uuid not null references public.profiles(id)",
    );
    expect(migration).toContain("unique (brand_id, user_id)");
    expect(migration).toContain(
      "create table if not exists public.brand_team_invitations",
    );
    expect(migration).toContain("email citext not null");
    expect(migration).toContain("unique (brand_id, email)");
    expect(migration).toContain(
      "alter table public.brand_team_members enable row level security",
    );
    expect(migration).toContain(
      "alter table public.brand_team_invitations enable row level security",
    );
    expect(migration).toContain("brand_team_members_select_workspace");
    expect(migration).toContain("brand_team_members_insert_admin");
    expect(migration).toContain("brand_team_members_update_admin");
    expect(migration).toContain("brand_team_members_delete_admin");
    expect(migration).toContain("brand_team_invitations_select_workspace");
    expect(migration).toContain("brand_team_invitations_insert_admin");
    expect(migration).toContain("brand_team_invitations_update_admin");
    expect(migration).toContain("app_private.current_user_is_admin()");
    expect(migration).toContain("member.accepted_at is not null");
    expect(migration).toContain(
      "grant select, insert, update, delete on public.brand_team_members to authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update on public.brand_team_invitations to authenticated",
    );
    expect(migration).toContain("insert into public.brand_team_members");
    expect(databaseTypes).toContain("export type BrandTeamRole");
    expect(databaseTypes).toContain("export type BrandTeamInvitationStatus");
  });
});
