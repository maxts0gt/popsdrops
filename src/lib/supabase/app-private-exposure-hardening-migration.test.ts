import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(
  new URL("../../../supabase/migrations/", import.meta.url),
);

const hardeningMigrationName = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_harden_app_private_exposure.sql"),
);

const hardeningMigrationSource = hardeningMigrationName
  ? readFileSync(path.join(migrationsDir, hardeningMigrationName), "utf8")
  : "";
const allMigrationSources = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
  .join("\n");

describe("app_private exposure hardening migration", () => {
  it("removes anonymous execution from private helper functions after older broad grants", () => {
    expect(hardeningMigrationName).toBeTruthy();
    expect(hardeningMigrationSource).toContain(
      "revoke usage on schema app_private from anon",
    );
    expect(hardeningMigrationSource).toContain(
      "revoke execute on all functions in schema app_private from anon",
    );
    expect(hardeningMigrationSource).toContain(
      "grant usage on schema app_private to authenticated, service_role",
    );
    expect(hardeningMigrationSource).not.toContain(
      "grant usage on schema app_private to anon",
    );
    expect(hardeningMigrationSource).not.toContain(
      "grant execute on all functions in schema app_private to anon",
    );
  });

  it("keeps direct app_private helper grants scoped to authenticated users and service role", () => {
    for (const functionSignature of [
      "app_private.campaign_accepts_agreement_updates(uuid)",
      "app_private.campaign_accepts_creator_work(uuid)",
      "app_private.campaign_accepts_content_decisions(uuid)",
      "app_private.campaign_accepts_proof_submission(uuid)",
      "app_private.campaign_accepts_proof_decisions(uuid)",
      "app_private.campaign_accepts_application_decisions(uuid)",
      "app_private.submit_creator_report_task(uuid, timestamptz)",
      "app_private.link_creator_performance_evidence(uuid, uuid, uuid)",
    ]) {
      expect(hardeningMigrationSource).toContain(
        `grant execute on function ${functionSignature}`,
      );
      expect(hardeningMigrationSource).toContain("to authenticated, service_role");
    }
  });

  it("does not fail when hardening runs before later agreement lifecycle helpers", () => {
    expect(hardeningMigrationSource).toContain(
      "to_regprocedure('app_private.campaign_accepts_agreement_updates(uuid)') is not null",
    );
    expect(hardeningMigrationSource).toContain(
      "grant execute on function app_private.campaign_accepts_agreement_updates(uuid)",
    );
  });

  it("does not leave broad anonymous app_private grants in the migration history", () => {
    expect(allMigrationSources).not.toMatch(
      /grant usage on schema app_private\s+to anon/iu,
    );
    expect(allMigrationSources).not.toMatch(
      /grant execute on all functions in schema app_private\s+to anon/iu,
    );
  });
});
