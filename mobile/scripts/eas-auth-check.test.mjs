import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEasAuthEnvironment,
  formatEasAuthFailure,
} from "./eas-auth-check.mjs";

const scriptPath = path.resolve(
  import.meta.dirname,
  "eas-auth-check.mjs",
);

describe("EAS auth readiness", () => {
  it("uses the shared local submit environment so EXPO_TOKEN can come from mobile .env.local", () => {
    const source = readFileSync(scriptPath, "utf8");

    expect(source).toContain("readLocalSubmitEnvironment");
    expect(source).toContain("buildEasAuthEnvironment");
    expect(source).toContain("pathToFileURL");
  });

  it("passes EXPO_TOKEN from mobile .env.local to the EAS CLI environment", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-eas-auth-"));

    try {
      writeFileSync(
        path.join(tempRoot, ".env.local"),
        [
          "EXPO_TOKEN=expo-token-from-local-file",
          "SUPABASE_SERVICE_ROLE_KEY=do-not-import-this",
        ].join("\n"),
      );

      const environment = buildEasAuthEnvironment(tempRoot, {
        PATH: "/usr/bin",
      });

      expect(environment).toMatchObject({
        PATH: "/usr/bin",
        EXPO_TOKEN: "expo-token-from-local-file",
      });
      expect(environment).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("explains when an EXPO_TOKEN exists but EAS rejects it", () => {
    const message = formatEasAuthFailure(
      {
        stdout: "",
        stderr: "Authentication failed.",
      },
      {
        EXPO_TOKEN: "invalid-token",
      },
    );

    expect(message).toContain(
      "EXPO_TOKEN is set, but EAS CLI could not authenticate it.",
    );
    expect(message).toContain("Authentication failed.");
  });
});
