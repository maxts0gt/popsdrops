import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260522011350_privacy_export_ready_notification.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("privacy export ready notification migration", () => {
  it("adds a durable notification type for completed data exports", () => {
    expect(migration).toContain("alter type notification_type");
    expect(migration).toContain("add value if not exists 'data_export_ready'");
  });
});
