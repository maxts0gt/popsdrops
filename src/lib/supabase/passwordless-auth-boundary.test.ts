import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = projectRoot.pathname;

const runtimeRoots = [
  "src",
  "mobile",
  "shared",
  "supabase/functions",
  "scripts",
];

const forbiddenRuntimePatterns = [
  "signInWithPassword",
  "resetPasswordForEmail",
  "current_password",
  "new_password",
  "type=\"password\"",
  "type='password'",
  "password:",
];

function listRuntimeFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      if (
        entry === "node_modules" ||
        entry === ".next" ||
        entry === "generated" ||
        entry === "migrations"
      ) {
        continue;
      }
      files.push(...listRuntimeFiles(path));
      continue;
    }

    if (!/\.(tsx?|jsx?|mjs)$/.test(entry)) continue;
    if (/\.(test|spec)\.(tsx?|jsx?|mjs)$/.test(entry)) continue;
    files.push(path);
  }

  return files;
}

describe("passwordless auth boundary", () => {
  it("does not ship password-based auth entry points", () => {
    const offenders: string[] = [];

    for (const root of runtimeRoots) {
      for (const file of listRuntimeFiles(join(projectRootPath, root))) {
        const source = readFileSync(file, "utf8");
        for (const pattern of forbiddenRuntimePatterns) {
          if (source.includes(pattern)) {
            offenders.push(`${relative(projectRootPath, file)} contains ${pattern}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps Supabase password settings hardened as defense in depth", () => {
    const configSource = readFileSync(new URL("supabase/config.toml", projectRoot), "utf8");

    expect(configSource).toContain("minimum_password_length = 12");
    expect(configSource).toContain(
      'password_requirements = "lower_upper_letters_digits_symbols"',
    );
    expect(configSource).toContain("secure_password_change = true");
  });
});
