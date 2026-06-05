import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.resolve(__dirname, "../../../supabase/migrations");
const migrationSources = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
  .join("\n");

describe("campaign report goal migration", () => {
  it("stores a report composition snapshot on campaign reporting plans", () => {
    expect(migrationSources).toContain("campaign_reporting_plans");
    expect(migrationSources).toContain("report_template_id");
    expect(migrationSources).toContain("report_preset_id");
    expect(migrationSources).toContain("report_chart_mode_id");
    expect(migrationSources).toContain("report_block_ids");
    expect(migrationSources).toContain("report_composition_templates");
    expect(migrationSources).toContain("campaign_reporting_plans_report_goal_blocks");
  });
});
