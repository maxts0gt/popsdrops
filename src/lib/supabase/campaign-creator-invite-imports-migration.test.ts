import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const migrationsDir = path.join(projectRoot, "supabase/migrations");
const databaseTypesPath = path.join(projectRoot, "src/types/database.ts");

function getInviteImportMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.includes("campaign_creator_invite"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
}

describe("campaign creator invite imports migration", () => {
  it("stores private campaign invite contacts with workspace RLS and queue traceability", () => {
    const migration = getInviteImportMigrations();
    const databaseTypes = existsSync(databaseTypesPath)
      ? readFileSync(databaseTypesPath, "utf8")
      : "";

    expect(migration).toContain("create table if not exists public.campaign_creator_invites");
    expect(migration).toContain("campaign_id uuid not null references public.campaigns(id) on delete cascade");
    expect(migration).toContain("contact_type text not null check (contact_type in ('email', 'handle'))");
    expect(migration).toContain("status text not null check (status in ('manual', 'queued', 'sent', 'failed'))");
    expect(migration).toContain("queued_email_id uuid references public.notification_queue(id)");
    expect(migration).toContain("unique (campaign_id, normalized_contact)");
    expect(migration).toContain("alter table public.campaign_creator_invites enable row level security");
    expect(migration).toContain("campaign_creator_invites_select_workspace");
    expect(migration).toContain("campaign_creator_invites_insert_manager");
    expect(migration).toContain("campaign_creator_invites_update_manager");
    expect(migration).toContain("app_private.current_user_can_access_brand_workspace(campaigns.brand_id)");
    expect(migration).toContain("app_private.current_user_can_manage_brand_workspace(campaigns.brand_id)");
    expect(migration).toContain("grant select, insert, update on public.campaign_creator_invites to authenticated");
    expect(databaseTypes).toContain("campaign_creator_invites");
  });

  it("keeps direct Data API writes inside the campaign invite lifecycle", () => {
    const migration = getInviteImportMigrations();

    expect(migration).toContain("app_private.campaign_accepts_creator_invites");
    expect(migration).toContain("campaigns.status in ('draft', 'recruiting')");
    expect(migration).toContain("campaigns.status = 'draft'");
    expect(migration).toContain("campaigns.application_deadline is null");
    expect(migration).toContain("campaigns.application_deadline >= current_date");
    expect(migration).not.toContain("campaigns.application_deadline >= now()");
    expect(migration).toContain("app_private.campaign_accepts_creator_invites(campaign_creator_invites.campaign_id)");
  });

  it("keeps invite identity and queued/applied status transitions system-controlled", () => {
    const migration = getInviteImportMigrations();

    expect(migration).toContain(
      "create or replace function app_private.guard_campaign_creator_invite_mutation",
    );
    expect(migration).toContain("tg_op = 'INSERT'");
    expect(migration).toContain("new.status <> 'manual'");
    expect(migration).toContain("new.queued_email_id is not null");
    expect(migration).toContain("new.campaign_id is distinct from old.campaign_id");
    expect(migration).toContain("new.contact_type is distinct from old.contact_type");
    expect(migration).toContain("new.normalized_contact is distinct from old.normalized_contact");
    expect(migration).toContain("new.queued_email_id is distinct from old.queued_email_id");
    expect(migration).toContain("new.invited_at is distinct from old.invited_at");
    expect(migration).toContain("old.status in ('manual', 'failed')");
    expect(migration).toContain("new.status = 'queued'");
    expect(migration).toContain("new.contact_type = 'email'");
    expect(migration).toContain("new.queued_email_id is not null");
    expect(migration).toContain("from public.notification_queue queued");
    expect(migration).toContain("queued.id = new.queued_email_id");
    expect(migration).toContain("queued.template = 'campaign_update'");
    expect(migration).toContain("queued.email = new.contact_value");
    expect(migration).toContain("queued.data ->> 'invite_id' = new.id::text");
    expect(migration).toContain(
      "raise exception 'Campaign invite status transitions are system controlled after queuing.'",
    );
    expect(migration).toContain(
      "create trigger campaign_creator_invites_guard_mutation",
    );
    expect(migration).toContain(
      "before insert or update on public.campaign_creator_invites",
    );
  });
});
