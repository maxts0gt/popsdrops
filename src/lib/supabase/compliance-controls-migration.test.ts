import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260518132236_compliance_controls.sql",
    import.meta.url,
  ),
  "utf8",
);

const automationMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260518155632_automate_data_rights_deletions.sql",
    import.meta.url,
  ),
  "utf8",
);

const identityFixMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260518161632_fix_data_rights_identity_generated_email.sql",
    import.meta.url,
  ),
  "utf8",
);

const deletionBackfillMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260518162343_backfill_pending_deletion_requests_to_scheduled.sql",
    import.meta.url,
  ),
  "utf8",
);

const deletionResponseSlaMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260519003612_tighten_data_deletion_response_sla.sql",
    import.meta.url,
  ),
  "utf8",
);

function readMigrationBySuffix(suffix: string) {
  const migrationsUrl = new URL("../../../supabase/migrations/", import.meta.url);
  const migrationName = readdirSync(migrationsUrl).find((name) =>
    name.endsWith(`_${suffix}.sql`),
  );

  if (!migrationName) return "";
  return readFileSync(new URL(migrationName, migrationsUrl), "utf8");
}

const deletionEmailTrailMigration = readMigrationBySuffix(
  "data_rights_deletion_email_trail",
);

describe("compliance controls migration", () => {
  it("creates a consent ledger and data-rights request queue", () => {
    expect(migration).toContain(
      "create table if not exists public.legal_consents",
    );
    expect(migration).toContain(
      "create table if not exists public.data_rights_requests",
    );
    expect(migration).toContain("terms_version text not null");
    expect(migration).toContain("privacy_version text not null");
    expect(migration).toContain("retention_version text not null");
    expect(migration).toContain("request_type text not null");
    expect(migration).toContain("status text not null default 'pending'");
  });

  it("enables RLS with owner and admin boundaries", () => {
    expect(migration).toContain(
      "alter table public.legal_consents enable row level security",
    );
    expect(migration).toContain(
      "alter table public.data_rights_requests enable row level security",
    );
    expect(migration).toContain("legal_consents_select_own");
    expect(migration).toContain("legal_consents_insert_own");
    expect(migration).toContain("legal_consents_insert_public_request");
    expect(migration).toContain("data_rights_requests_select_own");
    expect(migration).toContain("data_rights_requests_insert_own");
    expect(migration).toContain("data_rights_requests_admin");
    expect(migration).toContain("auth.uid() = profile_id");
    expect(migration).toContain("app_private.current_user_is_admin()");
  });

  it("exposes only the explicit Data API grants needed for the workflows", () => {
    expect(migration).toContain("grant insert on public.legal_consents to anon");
    expect(migration).toContain(
      "grant select, insert on public.legal_consents to authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update on public.data_rights_requests to authenticated",
    );
  });

  it("does not add dormant lifecycle automation", () => {
    expect(migration).not.toMatch(/platform_api|token_refresh/i);
  });

  it("adds only the explicit privacy deletion automation workflow", () => {
    expect(automationMigration).toContain("scheduled_for timestamptz");
    expect(automationMigration).toContain("processed_at timestamptz");
    expect(automationMigration).toContain("processing_error text");
    expect(automationMigration).toContain(
      "app_private.process_due_data_deletion_requests",
    );
    expect(automationMigration).toContain("request_type = 'deletion'");
    expect(automationMigration).toContain("status = 'scheduled'");
    expect(automationMigration).toContain("scheduled_for <= now()");
    expect(automationMigration).toContain("deleted.popsdrops.local");
    expect(automationMigration).toContain("cron.schedule");
    expect(automationMigration).toContain("process-due-data-deletions-hourly");
    expect(migration).not.toMatch(/platform_api|token_refresh/i);
  });

  it("does not try to write generated Supabase Auth identity email columns", () => {
    expect(identityFixMigration).toContain("auth.identities");
    expect(identityFixMigration).toContain("identity_data");
    expect(identityFixMigration).not.toMatch(
      /update auth\.identities\s+set email = tombstone_email/,
    );
  });

  it("backfills legacy manual deletion requests into automatic scheduled deletion", () => {
    expect(deletionBackfillMigration).toContain("request_type = 'deletion'");
    expect(deletionBackfillMigration).toContain("status = 'pending'");
    expect(deletionBackfillMigration).toContain("status = 'scheduled'");
    expect(deletionBackfillMigration).toContain("created_at + interval '7 days'");
  });

  it("tightens deletion verification to the stricter 10-day response target", () => {
    expect(deletionResponseSlaMigration).toContain("request_type = 'deletion'");
    expect(deletionResponseSlaMigration).toContain("verification_due_at");
    expect(deletionResponseSlaMigration).toContain("interval '10 days'");
    expect(deletionResponseSlaMigration).toContain("response is due within 10 days");
  });

  it("queues required deletion schedule and completion emails from the database lifecycle", () => {
    expect(deletionEmailTrailMigration).toContain("notification_queue");
    expect(deletionEmailTrailMigration).toContain("data_deletion_scheduled");
    expect(deletionEmailTrailMigration).toContain("data_deletion_completed");
    expect(deletionEmailTrailMigration).toContain("old.email");
    expect(deletionEmailTrailMigration).toContain("after insert or update of status");
    expect(deletionEmailTrailMigration).toContain(
      "app_private.queue_data_rights_deletion_email",
    );
  });
});
