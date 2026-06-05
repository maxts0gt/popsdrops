import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260516150946_resolve_rls_policy_advisor_warnings.sql",
);

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("RLS advisor policy cleanup migration", () => {
  it("removes generated duplicate permissive policies from agreement-aware tables", () => {
    const migration = readMigration();

    for (const policyName of [
      "rls_campaign_assets_select_authenticated_bc36697e",
      "rls_campaign_brief_blocks_select_authenticated_593730c2",
      "rls_campaign_report_tasks_select_authenticated_58023e45",
      "rls_content_performance_insert_authenticated_8d2adc40",
      "rls_content_performance_update_authenticated_32207f2f",
      "rls_content_submissions_insert_authenticated_07fde69a",
      "rls_content_submissions_update_authenticated_83d5e715",
    ]) {
      expect(migration).toContain(`drop policy if exists ${policyName}`);
    }
  });

  it("uses init-plan-safe auth calls in policies that compare the current user", () => {
    const migration = readMigration();

    expect(migration).toContain("(select auth.uid())");
    expect(migration).not.toMatch(/[^.]auth\.uid\(\)(?!\))/u);
    expect(migration).toContain("campaign_agreements_insert_brand");
    expect(migration).toContain("campaign_agreement_acceptances_insert_creator");
    expect(migration).toContain("notification_email_preferences_select_own");
  });

  it("consolidates notification preference admin access into the single own-policy layer", () => {
    const migration = readMigration();

    expect(migration).toContain(
      "drop policy if exists notification_email_preferences_admin",
    );
    expect(migration).toContain(
      "or (select app_private.current_user_is_admin())",
    );
    expect(migration).toContain("notification_email_preferences_upsert_own");
    expect(migration).toContain("notification_email_preferences_update_own");
  });
});
