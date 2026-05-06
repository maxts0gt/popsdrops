import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationName = "enable_report_realtime_publication.sql";
const migrationDir = new URL("../../../supabase/migrations/", import.meta.url);
const migrationFile = readdirSync(migrationDir).find((fileName) =>
  fileName.endsWith(migrationName),
);
const migrationSource = migrationFile
  ? readFileSync(new URL(migrationFile, migrationDir), "utf8")
  : "";

describe("report realtime publication migration", () => {
  it("adds report tables to the Supabase realtime publication", () => {
    expect(migrationFile).toBeTruthy();
    expect(migrationSource).toContain("supabase_realtime");
    expect(migrationSource).toContain("public.content_performance");
    expect(migrationSource).toContain("public.campaign_report_tasks");
    expect(migrationSource).toContain("alter publication");
  });
});
