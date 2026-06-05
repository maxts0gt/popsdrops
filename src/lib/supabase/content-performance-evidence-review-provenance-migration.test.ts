import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const migrationsDir = path.join(projectRoot, "supabase/migrations");

function getEvidenceMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.includes("content_performance_evidence"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
}

describe("content performance evidence review provenance migration", () => {
  it("records who reviewed a proof artifact and when the decision happened", () => {
    const migration = getEvidenceMigrations();

    expect(migration).toContain("alter table public.content_performance_evidence");
    expect(migration).toContain(
      "add column if not exists reviewed_by uuid references public.profiles(id) on delete set null",
    );
    expect(migration).toContain(
      "add column if not exists reviewed_at timestamptz",
    );
    expect(migration).toContain(
      "comment on column public.content_performance_evidence.reviewed_by",
    );
    expect(migration).toContain(
      "comment on column public.content_performance_evidence.reviewed_at",
    );
  });
});
