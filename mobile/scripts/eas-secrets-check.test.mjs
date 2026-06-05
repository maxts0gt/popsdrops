import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEasCliEnvironment,
  buildEasSecretsReport,
  formatEasSecretsReport,
  parseEasSecretNames,
} from "./eas-secrets-check.mjs";

describe("EAS secret readiness", () => {
  it("parses EAS secret names from JSON output", () => {
    const names = parseEasSecretNames(
      JSON.stringify([
        { name: "APPLE_ASC_API_KEY", type: "file" },
        { name: "GOOGLE_SERVICE_ACCOUNT", type: "file" },
      ]),
    );

    expect(names).toEqual(["APPLE_ASC_API_KEY", "GOOGLE_SERVICE_ACCOUNT"]);
  });

  it("parses EAS secret names from table output as a fallback", () => {
    const names = parseEasSecretNames(`
Name                    Type
APPLE_ASC_API_KEY       file
GOOGLE_SERVICE_ACCOUNT  file
`);

    expect(names).toEqual(["APPLE_ASC_API_KEY", "GOOGLE_SERVICE_ACCOUNT"]);
  });

  it("parses EAS long output without confusing field labels for secret names", () => {
    const names = parseEasSecretNames(`
Environment: production
Variables for this project:
ID            35a15d54-c030-43f8-8430-043bcef1cb26
Name          APPLE_ASC_API_KEY
Value         *****
Scope         PROJECT
Visibility    SECRET
Environments  production
type          file
ID            35a15d54-c030-43f8-8430-043bcef1cb27
Name          GOOGLE_SERVICE_ACCOUNT
Value         *****
Scope         PROJECT
Visibility    SECRET
Environments  production
type          file
`);

    expect(names).toEqual(["APPLE_ASC_API_KEY", "GOOGLE_SERVICE_ACCOUNT"]);
  });

  it("reports missing production submit file secrets without leaking values", () => {
    const report = buildEasSecretsReport(["APPLE_ASC_API_KEY"]);
    const formatted = formatEasSecretsReport(report);

    expect(report).toEqual({
      ok: false,
      missing: ["GOOGLE_SERVICE_ACCOUNT"],
      present: ["APPLE_ASC_API_KEY"],
    });
    expect(formatted).toContain("EAS production submit secrets check failed.");
    expect(formatted).toContain("GOOGLE_SERVICE_ACCOUNT");
    expect(formatted).toContain(
      "eas env:create production --name APPLE_ASC_API_KEY --type file --visibility secret",
    );
    expect(formatted).toContain(
      "eas env:create production --name GOOGLE_SERVICE_ACCOUNT --type file --visibility secret",
    );
    expect(formatted).not.toContain("eas secret:create");
    expect(formatted).not.toContain("PRIVATE KEY");
    expect(formatted).not.toContain("client_email");
  });

  it("passes when both production submit file secrets exist", () => {
    const report = buildEasSecretsReport([
      "APPLE_ASC_API_KEY",
      "GOOGLE_SERVICE_ACCOUNT",
    ]);

    expect(report).toEqual({
      ok: true,
      missing: [],
      present: ["APPLE_ASC_API_KEY", "GOOGLE_SERVICE_ACCOUNT"],
    });
    expect(formatEasSecretsReport(report)).toContain(
      "EAS production submit secrets are ready.",
    );
  });

  it("loads EXPO_TOKEN from mobile .env.local for local EAS checks without importing unrelated secrets", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-eas-env-"));

    try {
      writeFileSync(
        path.join(tempRoot, ".env.local"),
        [
          "EXPO_TOKEN=expo-token-from-file",
          "SUPABASE_SERVICE_ROLE_KEY=do-not-import-this",
        ].join("\n"),
      );

      const environment = buildEasCliEnvironment(tempRoot, {
        PATH: "/usr/bin",
      });

      expect(environment).toMatchObject({
        EAS_BUILD: "true",
        PATH: "/usr/bin",
        EXPO_TOKEN: "expo-token-from-file",
      });
      expect(environment).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
