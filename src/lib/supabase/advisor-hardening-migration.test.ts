import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationName = "harden_advisor_findings.sql";
const migrationDir = new URL("../../../supabase/migrations/", import.meta.url);
const migrationFile = readdirSync(migrationDir).find((fileName) =>
  fileName.endsWith(migrationName),
);
const migrationSource = migrationFile
  ? readFileSync(new URL(migrationFile, migrationDir), "utf8")
  : "";

describe("Supabase advisor hardening migration", () => {
  it("moves relocatable extensions out of the exposed public schema", () => {
    expect(migrationFile).toBeTruthy();
    expect(migrationSource).toContain("alter extension vector set schema extensions");
    expect(migrationSource).toContain("alter extension pg_trgm set schema extensions");
  });

  it("pins search paths on legacy public functions", () => {
    expect(migrationSource).toContain("alter function public.handle_new_user() set search_path");
    expect(migrationSource).toContain(
      "alter function public.update_creator_rating() set search_path",
    );
    expect(migrationSource).toContain(
      "alter function public.is_campaign_brand(uuid) set search_path",
    );
  });

  it("moves RLS helper behavior behind app_private and removes public security-definer execution", () => {
    expect(migrationSource).toContain("create or replace function app_private.can_apply_to_campaign");
    expect(migrationSource).toContain(
      "create or replace function app_private.can_review_campaign_participant",
    );
    expect(migrationSource).toContain("create or replace function app_private.accept_counter_offer");
    expect(migrationSource).toContain("security invoker");
    expect(migrationSource).toContain(
      "revoke execute on function public.is_admin() from public, anon, authenticated",
    );
    expect(migrationSource).toContain(
      "revoke execute on function public.queue_notification_email() from public, anon, authenticated",
    );
  });

  it("makes public waitlist insert policy specific instead of always true", () => {
    expect(migrationSource).toContain("drop policy if exists waitlist_insert_public");
    expect(migrationSource).toContain("status = 'pending'");
    expect(migrationSource).toContain("reviewed_by is null");
  });
});
