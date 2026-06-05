import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260512144221_notification_email_preferences.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("notification email preferences migration", () => {
  it("adds a user-owned preference table with safe defaults", () => {
    expect(migration).toContain(
      "create table if not exists public.notification_email_preferences",
    );
    expect(migration).toContain("user_id uuid primary key");
    expect(migration).toContain("email_messages boolean not null default true");
    expect(migration).toContain(
      "email_campaign_activity boolean not null default true",
    );
    expect(migration).toContain("email_reports boolean not null default true");
  });

  it("keeps skipped email deliveries visible in the queue audit trail", () => {
    expect(migration).toContain("notification_queue_status_check");
    expect(migration).toContain("'skipped'");
    expect(migration).toContain("processed_reason");
  });

  it("enables owner RLS without exposing cross-user preferences", () => {
    expect(migration).toContain(
      "alter table public.notification_email_preferences enable row level security",
    );
    expect(migration).toContain("notification_email_preferences_select_own");
    expect(migration).toContain("notification_email_preferences_upsert_own");
    expect(migration).toContain("auth.uid() = user_id");
  });
});
