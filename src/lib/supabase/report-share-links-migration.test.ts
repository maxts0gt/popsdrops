import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  new URL("../../../supabase/migrations/20260506121202_report_share_links.sql", import.meta.url),
  "utf8",
);

describe("report share links migration", () => {
  it("stores only token hashes and keeps public viewing out of table RLS", () => {
    expect(migrationSource).toContain("create table if not exists public.campaign_report_share_links");
    expect(migrationSource).toContain("token_hash text not null");
    expect(migrationSource).toContain("unique (token_hash)");
    expect(migrationSource).not.toContain("token text");
    expect(migrationSource).toContain("alter table public.campaign_report_share_links enable row level security");
    expect(migrationSource).toContain("grant select, insert, update on public.campaign_report_share_links to authenticated");
    expect(migrationSource).not.toContain("grant select on public.campaign_report_share_links to anon");
  });

  it("limits brand access to links for campaigns they own", () => {
    expect(migrationSource).toContain("campaign_report_share_links_select_brand");
    expect(migrationSource).toContain("campaign.brand_id = auth.uid()");
    expect(migrationSource).toContain("campaign_report_share_links_insert_brand");
    expect(migrationSource).toContain("created_by = auth.uid()");
    expect(migrationSource).toContain("campaign_report_share_links_update_brand");
    expect(migrationSource).toContain("campaign_report_share_links_admin");
  });
});
