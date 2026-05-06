import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationName = "consolidate_rls_permissive_policies.sql";
const migrationDir = new URL("../../../supabase/migrations/", import.meta.url);
const migrationFile = readdirSync(migrationDir).find((fileName) =>
  fileName.endsWith(migrationName),
);
const migrationSource = migrationFile
  ? readFileSync(new URL(migrationFile, migrationDir), "utf8")
  : "";

describe("RLS permissive policy consolidation migration", () => {
  it("rebuilds overlapping anon and authenticated policies as one policy per action", () => {
    expect(migrationFile).toBeTruthy();
    expect(migrationSource).toContain("tmp_policy_merge_source");
    expect(migrationSource).toContain("target_role in");
    expect(migrationSource).toContain("create policy");
    expect(migrationSource).toContain("drop policy");
  });
});
