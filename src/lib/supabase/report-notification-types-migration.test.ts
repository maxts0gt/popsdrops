import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = new URL("../../../supabase/migrations", import.meta.url);
const migrationSource = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => readFileSync(join(migrationsDir.pathname, fileName), "utf8"))
  .join("\n");

const databaseTypesSource = readFileSync(
  new URL("../../types/database.ts", import.meta.url),
  "utf8",
);

describe("report notification schema", () => {
  it("adds explicit notification types for report operations", () => {
    for (const notificationType of [
      "report_correction_requested",
      "report_ready_for_review",
      "report_correction_resubmitted",
      "report_follow_up_requested",
    ]) {
      expect(migrationSource).toContain(
        `alter type notification_type add value if not exists '${notificationType}'`,
      );
      expect(databaseTypesSource).toContain(`| '${notificationType}'`);
    }
  });
});
