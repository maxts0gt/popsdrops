import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260509052847_notification_queue_observability.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("notification queue observability migration", () => {
  it("adds explicit queue status and delivery audit columns", () => {
    expect(migration).toContain("add column if not exists status text");
    expect(migration).toContain("add column if not exists attempt_count integer");
    expect(migration).toContain("add column if not exists last_error text");
    expect(migration).toContain("add column if not exists processed_reason text");
    expect(migration).toContain("add column if not exists delivered_at timestamptz");
    expect(migration).toContain("add column if not exists updated_at timestamptz");
  });

  it("constrains status values and indexes retryable rows", () => {
    expect(migration).toContain("notification_queue_status_check");
    expect(migration).toContain("'pending'");
    expect(migration).toContain("'sent'");
    expect(migration).toContain("'failed'");
    expect(migration).toContain("'unsupported'");
    expect(migration).toContain("'archived'");
    expect(migration).toContain("notification_queue_retryable_idx");
    expect(migration).toContain("status in ('pending', 'failed')");
  });

  it("backfills already processed legacy rows as sent without reopening them", () => {
    expect(migration).toContain("where processed_at is not null");
    expect(migration).toContain("status = 'sent'");
    expect(migration).toContain("processed_reason = 'legacy_processed'");
    expect(migration).toContain("delivered_at = processed_at");
  });
});
