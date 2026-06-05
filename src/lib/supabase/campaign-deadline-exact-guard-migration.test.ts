import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260604120000_campaign_deadline_exact_lifecycle_guard.sql",
);
const boundaryCloseMigrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260604143000_campaign_deadline_exact_boundary_close.sql",
);

describe("campaign exact deadline guard migration", () => {
  it("centralizes application deadline checks for direct database writes", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      "create or replace function app_private.campaign_application_deadline_is_open",
    );
    expect(migration).toContain("deadline >= now()");
    expect(migration).toContain("deadline = date_trunc('day', deadline)");
    expect(migration).toContain("deadline::date >= current_date");
    expect(migration).toContain(
      "app_private.campaign_application_deadline_is_open(campaign.application_deadline)",
    );
    expect(migration).toContain(
      "app_private.campaign_application_deadline_is_open(campaigns.application_deadline)",
    );
    expect(migration).toContain(
      "app_private.campaign_application_deadline_is_open(campaign_record.application_deadline)",
    );
    expect(migration).not.toContain("application_deadline >= current_date");
  });

  it("closes explicit timestamp deadlines at the exact instant in database guards", () => {
    expect(existsSync(boundaryCloseMigrationPath)).toBe(true);

    const migration = readFileSync(boundaryCloseMigrationPath, "utf8");

    expect(migration).toContain(
      "create or replace function app_private.campaign_application_deadline_is_open",
    );
    expect(migration).toContain("deadline > now()");
    expect(migration).toContain("deadline = date_trunc('day', deadline)");
    expect(migration).toContain("deadline::date >= current_date");
    expect(migration).not.toContain("deadline >= now()");
  });
});
