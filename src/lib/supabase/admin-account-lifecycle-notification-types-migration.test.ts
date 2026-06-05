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

describe("admin account lifecycle notification schema", () => {
  it("adds explicit notification types for admin account lifecycle actions", () => {
    for (const notificationType of [
      "account_suspended",
      "account_restored",
      "account_review_reopened",
    ]) {
      expect(migrationSource).toContain(
        `alter type notification_type add value if not exists '${notificationType}'`,
      );
      expect(databaseTypesSource).toContain(`| '${notificationType}'`);
    }
  });
});
