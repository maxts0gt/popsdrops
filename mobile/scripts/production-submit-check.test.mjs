import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isEasSecretReference,
  readLocalSubmitEnvironment,
  validateProductionSubmitProfile,
} from "./production-submit-check.mjs";

describe("production submit credential validation", () => {
  it("accepts App Store Connect API key credentials and EAS file secrets", () => {
    const easConfig = {
      submit: {
        production: {
          ios: {
            ascAppId: "1234567890",
            ascApiKeyPath: "@secret:APPLE_ASC_API_KEY",
            ascApiKeyId: "ABC123DEFG",
            ascApiKeyIssuerId: "00000000-0000-4000-8000-000000000001",
          },
          android: {
            serviceAccountKeyPath: "@secret:GOOGLE_SERVICE_ACCOUNT",
            track: "internal",
          },
        },
      },
    };

    expect(isEasSecretReference("@secret:GOOGLE_SERVICE_ACCOUNT")).toBe(true);
    expect(validateProductionSubmitProfile(easConfig, process.cwd())).toEqual([]);
  });

  it("accepts App Store Connect API key environment variables for local submit runs", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-submit-"));

    try {
      writeFileSync(path.join(tempRoot, "AuthKey_ENV1234567.p8"), "PRIVATE KEY");

      const easConfig = {
        submit: {
          production: {
            ios: {
              ascAppId: "1234567890",
            },
            android: {
              serviceAccountKeyPath: "@secret:GOOGLE_SERVICE_ACCOUNT",
              track: "internal",
            },
          },
        },
      };
      const environment = {
        EXPO_ASC_APP_ID: "1234567890",
        EXPO_ASC_API_KEY_PATH: "./AuthKey_ENV1234567.p8",
        EXPO_ASC_API_KEY_ID: "ENV1234567",
        EXPO_ASC_API_KEY_ISSUER_ID: "00000000-0000-4000-8000-000000000001",
      };

      expect(
        validateProductionSubmitProfile(
          {
            submit: {
              production: {
                ios: {},
                android: easConfig.submit.production.android,
              },
            },
          },
          tempRoot,
          environment,
        ),
      ).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("lets local App Store Connect environment values override placeholder submit fields", () => {
    const easConfig = {
      submit: {
        production: {
          ios: {
            ascAppId: "your-app-store-connect-app-id",
            ascApiKeyPath: "@secret:APPLE_ASC_API_KEY",
            ascApiKeyId: "your-app-store-connect-api-key-id",
            ascApiKeyIssuerId: "your-app-store-connect-issuer-id",
          },
          android: {
            serviceAccountKeyPath: "@secret:GOOGLE_SERVICE_ACCOUNT",
            track: "internal",
          },
        },
      },
    };
    const environment = {
      EXPO_ASC_APP_ID: "1234567890",
      EXPO_ASC_API_KEY_ID: "ENV1234567",
      EXPO_ASC_API_KEY_ISSUER_ID: "00000000-0000-4000-8000-000000000001",
    };

    expect(
      validateProductionSubmitProfile(easConfig, process.cwd(), environment),
    ).toEqual([]);
  });

  it("loads local App Store Connect submit values from .env.local without broad env parsing", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-submit-"));

    try {
      writeFileSync(
        path.join(tempRoot, ".env.local"),
        [
          "EXPO_ASC_APP_ID=1234567890",
          "EXPO_ASC_API_KEY_ID=ENV1234567",
          "EXPO_ASC_API_KEY_ISSUER_ID=00000000-0000-4000-8000-000000000001",
          "EXPO_TOKEN=expo-token-for-local-smoke",
          "SUPABASE_SERVICE_ROLE_KEY=do-not-read-this",
        ].join("\n"),
      );

      expect(readLocalSubmitEnvironment(tempRoot, {})).toEqual({
        EXPO_ASC_APP_ID: "1234567890",
        EXPO_ASC_API_KEY_ID: "ENV1234567",
        EXPO_ASC_API_KEY_ISSUER_ID: "00000000-0000-4000-8000-000000000001",
        EXPO_TOKEN: "expo-token-for-local-smoke",
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("accepts local credential files when they exist and stay outside source control", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "popsdrops-submit-"));

    try {
      writeFileSync(path.join(tempRoot, "AuthKey_ABC123DEFG.p8"), "PRIVATE KEY");
      writeFileSync(
        path.join(tempRoot, "play-console-service-account.local.json"),
        JSON.stringify({
          client_email: "play-submit@example.iam.gserviceaccount.com",
          private_key: "private-key",
        }),
      );

      const easConfig = {
        submit: {
          production: {
            ios: {
              ascAppId: "1234567890",
              ascApiKeyPath: "./AuthKey_ABC123DEFG.p8",
              ascApiKeyId: "ABC123DEFG",
              ascApiKeyIssuerId: "00000000-0000-4000-8000-000000000001",
            },
            android: {
              serviceAccountKeyPath: "./play-console-service-account.local.json",
              track: "internal",
            },
          },
        },
      };

      expect(validateProductionSubmitProfile(easConfig, tempRoot)).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects Apple ID fallback, placeholders, and missing local files", () => {
    const easConfig = {
      submit: {
        production: {
          ios: {
            appleId: "your-apple-id@example.com",
            ascAppId: "your-app-store-connect-app-id",
            appleTeamId: "your-apple-team-id",
          },
          android: {
            serviceAccountKeyPath: "./google-service-account.json",
            track: "internal",
          },
        },
      },
    };

    expect(validateProductionSubmitProfile(easConfig, process.cwd())).toEqual([
      "submit.production.ios must use App Store Connect API key fields, not Apple ID submit credentials.",
      "submit.production.ios.ascAppId must be the real numeric App Store Connect app ID.",
      "submit.production.ios.ascApiKeyPath must be a local .p8 file path or an EAS file secret reference.",
      "submit.production.ios.ascApiKeyId must be the real App Store Connect API key ID.",
      "submit.production.ios.ascApiKeyIssuerId must be the real App Store Connect issuer ID.",
      "submit.production.android.serviceAccountKeyPath must point to a real Play Console service account JSON file or EAS file secret reference.",
    ]);
  });
});
