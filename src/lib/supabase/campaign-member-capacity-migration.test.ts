import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260527093000_campaign_member_capacity_guard.sql",
);
const advisorCleanupMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260529170000_supabase_security_advisor_cleanup.sql",
);
const paidCapacityGuardMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260529184300_campaign_member_paid_creator_capacity_guard.sql",
);
const paidCheckoutScopeMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260529225600_campaign_member_capacity_uses_paid_checkout_scope.sql",
);
const lifecycleAcceptanceGuardMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260602093000_campaign_member_lifecycle_acceptance_guard.sql",
);

describe("campaign member capacity migration", () => {
  it("guards accepted creator rows at the database boundary", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create or replace function public.enforce_campaign_member_creator_capacity()");
    expect(migration).toContain("pg_advisory_xact_lock(hashtext(new.campaign_id::text))");
    expect(migration).toContain("select max_creators");
    expect(migration).toContain("from public.campaign_members");
    expect(migration).toContain("accepted_creator_count >= campaign_creator_limit");
    expect(migration).toContain("Campaign creator capacity is full");
    expect(migration).toContain("create trigger enforce_campaign_member_creator_capacity");
    expect(migration).toContain("before insert on public.campaign_members");
  });

  it("keeps the capacity guard as trigger-only private behavior after advisor cleanup", () => {
    expect(existsSync(advisorCleanupMigrationPath)).toBe(true);

    const migration = readFileSync(advisorCleanupMigrationPath, "utf8");

    expect(migration).toContain(
      "create or replace function app_private.enforce_campaign_member_creator_capacity()",
    );
    expect(migration).toContain("create trigger enforce_campaign_member_creator_capacity");
    expect(migration).toContain(
      "execute function app_private.enforce_campaign_member_creator_capacity()",
    );
    expect(migration).toContain(
      "drop function if exists public.enforce_campaign_member_creator_capacity()",
    );
  });

  it("derives accepted capacity from paid service-fee scope before trusting campaign max_creators", () => {
    expect(existsSync(advisorCleanupMigrationPath)).toBe(true);
    expect(existsSync(paidCapacityGuardMigrationPath)).toBe(true);
    expect(existsSync(paidCheckoutScopeMigrationPath)).toBe(true);

    const migration = [
      readFileSync(advisorCleanupMigrationPath, "utf8"),
      readFileSync(paidCapacityGuardMigrationPath, "utf8"),
      readFileSync(paidCheckoutScopeMigrationPath, "utf8"),
    ].join("\n");
    const functionStart = migration.lastIndexOf(
      "create or replace function app_private.enforce_campaign_member_creator_capacity()",
    );
    const triggerStart = migration.indexOf(
      "drop trigger if exists enforce_campaign_member_creator_capacity",
      functionStart,
    );
    const functionBody = migration.slice(functionStart, triggerStart);

    expect(functionBody).toContain("campaign_payment_events");
    expect(functionBody).toContain("event_summary");
    expect(functionBody).toContain("service_fee_status = 'paid'");
    expect(functionBody).toContain("paid_checkout_sessions");
    expect(functionBody).toContain("checkout_session_id");
    expect(functionBody).toContain("paid_creator_capacity");
    expect(functionBody).toContain("creatorCapacity");
    expect(functionBody.indexOf("campaign_payment_events")).toBeLessThan(
      functionBody.indexOf("campaign_creator_limit := case"),
    );
  });

  it("blocks accepted creator rows after recruitment closes before evaluating paid capacity", () => {
    expect(existsSync(lifecycleAcceptanceGuardMigrationPath)).toBe(true);

    const migration = [
      readFileSync(paidCheckoutScopeMigrationPath, "utf8"),
      readFileSync(lifecycleAcceptanceGuardMigrationPath, "utf8"),
    ].join("\n");
    const functionStart = migration.lastIndexOf(
      "create or replace function app_private.enforce_campaign_member_creator_capacity()",
    );
    const functionBody = migration.slice(functionStart);

    expect(functionBody).toContain("status,");
    expect(functionBody).toContain("application_deadline,");
    expect(functionBody).toContain("if campaign_record.status <> 'recruiting' then");
    expect(functionBody).toContain("Campaign membership is closed for this campaign stage");
    expect(functionBody).toContain("campaign_record.application_deadline < current_date");
    expect(functionBody).toContain("The application deadline has already passed");
    expect(functionBody.indexOf("campaign_record.status <> 'recruiting'")).toBeLessThan(
      functionBody.indexOf("with paid_checkout_sessions as"),
    );
    expect(functionBody.indexOf("campaign_record.application_deadline < current_date")).toBeLessThan(
      functionBody.indexOf("with paid_checkout_sessions as"),
    );
  });
});
