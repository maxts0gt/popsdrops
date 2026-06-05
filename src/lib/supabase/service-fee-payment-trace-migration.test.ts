import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260516161557_service_fee_payment_trace.sql",
);

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("service fee payment trace migration", () => {
  it("adds latest Stripe trace fields to campaigns", () => {
    const migration = readMigration();

    for (const column of [
      "service_fee_checkout_session_id",
      "service_fee_payment_intent_id",
      "service_fee_charge_id",
      "service_fee_paid_at",
      "service_fee_failed_at",
      "service_fee_refunded_at",
      "service_fee_disputed_at",
      "service_fee_last_event_id",
      "service_fee_last_event_type",
      "service_fee_last_event_at",
    ]) {
      expect(migration).toContain(column);
    }
  });

  it("adds an append-only campaign payment event table with RLS", () => {
    const migration = readMigration();

    expect(migration).toContain("create table if not exists campaign_payment_events");
    expect(migration).toContain("event_id text not null");
    expect(migration).toContain("event_type text not null");
    expect(migration).toContain("service_fee_status payment_status_type");
    expect(migration).toContain("unique (provider, event_id)");
    expect(migration).toContain("alter table campaign_payment_events enable row level security");
    expect(migration).toContain("campaign_payment_events_select_brand_or_admin");
    expect(migration).toContain("(select auth.uid())");
    expect(migration).not.toMatch(/[^.]auth\.uid\(\)(?!\))/u);
  });
});
