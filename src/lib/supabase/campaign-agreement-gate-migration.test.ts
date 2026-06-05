import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(
  new URL("../../../supabase/migrations/", import.meta.url),
);
const migrationSource = readFileSync(
  new URL(
    "../../../supabase/migrations/20260507162720_campaign_agreement_gate.sql",
    import.meta.url,
  ),
  "utf8",
);
const agreementMigrationSource = readdirSync(migrationsDir)
  .filter((file) => file.includes("campaign_agreement"))
  .sort()
  .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
  .join("\n");

describe("campaign agreement gate migration", () => {
  it("creates versioned agreements and immutable creator acceptances", () => {
    expect(migrationSource).toContain("create table if not exists public.campaign_agreements");
    expect(migrationSource).toContain("create table if not exists public.campaign_agreement_acceptances");
    expect(migrationSource).toContain("campaign_agreement_acceptances_active_unique");
    expect(migrationSource).toContain("accepted_content_hash");
    expect(migrationSource).toContain("typed_name text not null");
  });

  it("exposes agreement tables deliberately with RLS enabled", () => {
    expect(migrationSource).toContain("alter table public.campaign_agreements enable row level security");
    expect(migrationSource).toContain("alter table public.campaign_agreement_acceptances enable row level security");
    expect(migrationSource).toContain("grant select, insert, update on table public.campaign_agreements");
    expect(migrationSource).toContain("grant select, insert on table public.campaign_agreement_acceptances");
  });

  it("uses a security invoker member status view", () => {
    expect(migrationSource).toContain("create or replace view public.campaign_member_agreement_status");
    expect(migrationSource).toContain("with (security_invoker = true)");
    expect(migrationSource).toContain("'needs_reacceptance'");
  });

  it("protects agreement files with a private Storage bucket", () => {
    expect(migrationSource).toContain("'campaign-agreements'");
    expect(migrationSource).toContain("can_read_campaign_agreement_object");
    expect(migrationSource).toContain("can_write_campaign_agreement_object");
    expect(migrationSource).toContain("campaign_agreements_objects_select");
    expect(migrationSource).toContain("campaign_agreements_objects_insert");
  });

  it("blocks protected creator work while agreement signature is pending", () => {
    expect(migrationSource).toContain("campaign_member_has_required_agreement");
    expect(migrationSource).toContain("current_user_has_campaign_agreement_access");
    expect(migrationSource).toContain("content_submissions_insert_creator");
    expect(migrationSource).toContain("content_submissions_update_creator");
    expect(migrationSource).toContain("content_performance_insert_creator");
    expect(migrationSource).toContain("content_performance_update_creator");
  });

  it("keeps private campaign assets locked until the accepted creator signs", () => {
    expect(migrationSource).toContain("campaign_assets_select_access");
    expect(migrationSource).toContain("can_read_campaign_asset_object");
    expect(migrationSource).toContain("current_user_has_campaign_agreement_access(asset.campaign_id)");
  });

  it("does not introduce cron, token refresh, or social platform fetchers", () => {
    expect(migrationSource).not.toContain("pg_cron");
    expect(migrationSource).not.toContain("refresh_tokens");
    expect(migrationSource).not.toContain("social_oauth");
  });

  it("locks agreement writes and PDF uploads after recruiting closes", () => {
    expect(agreementMigrationSource).toContain(
      "create or replace function app_private.campaign_accepts_agreement_updates",
    );
    expect(agreementMigrationSource).toContain(
      "campaigns.status in ('draft', 'recruiting')",
    );
    expect(agreementMigrationSource).toContain(
      "campaigns.application_deadline >= current_date",
    );
    expect(agreementMigrationSource).toContain(
      "and app_private.campaign_accepts_agreement_updates(campaign_agreements.campaign_id)",
    );
    expect(agreementMigrationSource).toContain(
      "and app_private.campaign_accepts_agreement_updates(agreement.campaign_id)",
    );
    expect(agreementMigrationSource).toContain(
      "True only while campaign rules and agreement files can still be changed.",
    );
    expect(agreementMigrationSource).not.toContain(
      "grant execute on function app_private.campaign_accepts_agreement_updates(uuid)\n  to anon",
    );
  });
});
