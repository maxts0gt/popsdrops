import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../../../supabase/migrations", import.meta.url);
const migrationSource = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => readFileSync(join(migrationsDir.pathname, fileName), "utf8"))
  .join("\n");

describe("campaign assets public creator preview policy", () => {
  it("allows only ready public campaign assets to appear before membership", () => {
    expect(migrationSource).toContain("campaign_assets_visibility_check");
    expect(migrationSource).toContain("visibility in ('public', 'member', 'brand')");
    expect(migrationSource).toContain("status = 'ready'");
    expect(migrationSource).toContain("visibility = 'public'");
    expect(migrationSource).toContain("campaign_assets_select_access");
  });

  it("lets signed URLs honor the same public asset rule through Storage RLS", () => {
    expect(migrationSource).toContain("can_read_campaign_asset_object");
    expect(migrationSource).toContain("asset.visibility = 'public'");
    expect(migrationSource).toContain("asset.status = 'ready'");
  });
});
