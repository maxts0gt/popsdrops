import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../../../supabase/migrations", import.meta.url);
const migrationSource = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => readFileSync(join(migrationsDir.pathname, fileName), "utf8"))
  .join("\n");

describe("reporting evidence upload Data API grants", () => {
  it("explicitly exposes evidence upload rows to authenticated creator flows", () => {
    expect(migrationSource).toContain(
      "grant select, insert, update on table public.content_performance_evidence",
    );
    expect(migrationSource).toContain("to authenticated, service_role");
  });

  it("exposes the report task tables needed to scope creator evidence uploads", () => {
    expect(migrationSource).toContain(
      "grant select on table public.campaign_report_tasks",
    );
    expect(migrationSource).toContain(
      "grant select on table public.campaign_reporting_plans",
    );
  });
});
