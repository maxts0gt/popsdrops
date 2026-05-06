import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  new URL("../../../supabase/migrations/20260506125643_harden_report_share_link_policies.sql", import.meta.url),
  "utf8",
);

describe("report share link policy hardening migration", () => {
  it("uses one permissive policy per action and caches auth uid lookups", () => {
    expect(migrationSource).toContain("drop policy if exists campaign_report_share_links_admin");
    expect(migrationSource).not.toContain("create policy campaign_report_share_links_admin");
    expect(migrationSource).toContain("campaign_report_share_links_select_brand");
    expect(migrationSource).toContain("campaign_report_share_links_insert_brand");
    expect(migrationSource).toContain("campaign_report_share_links_update_brand");
    expect(migrationSource).toContain("(select auth.uid())");
    expect(migrationSource).not.toContain("= auth.uid()");
    expect(migrationSource).not.toContain("created_by = auth.uid()");
  });
});
