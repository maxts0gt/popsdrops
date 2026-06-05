import { describe, expect, it } from "vitest";

import {
  buildStoreSubmitReadinessReport,
  formatStoreSubmitReadinessReport,
} from "./store-submit-readiness.mjs";

const validSubmitConfig = {
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

describe("store submit readiness report", () => {
  it("turns missing store credentials into a safe handoff checklist", () => {
    const report = buildStoreSubmitReadinessReport({
      easConfig: {
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
      },
      mobileRoot: process.cwd(),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      "submit.production.ios.ascAppId must be the real numeric App Store Connect app ID.",
      "submit.production.ios.ascApiKeyId must be the real App Store Connect API key ID.",
      "submit.production.ios.ascApiKeyIssuerId must be the real App Store Connect issuer ID.",
    ]);
    expect(report.nextSteps).toEqual([
      "Replace submit.production.ios.ascAppId in mobile/eas.json, or set EXPO_ASC_APP_ID locally for a one-off submit.",
      "Replace submit.production.ios.ascApiKeyId in mobile/eas.json, or set EXPO_ASC_API_KEY_ID locally for a one-off submit.",
      "Replace submit.production.ios.ascApiKeyIssuerId in mobile/eas.json, or set EXPO_ASC_API_KEY_ISSUER_ID locally for a one-off submit.",
      "Create the APPLE_ASC_API_KEY EAS file secret from the App Store Connect .p8 key.",
      "Create the GOOGLE_SERVICE_ACCOUNT EAS file secret from the Play Console service account JSON.",
      "Run npm --prefix mobile run release:submit:check before any store submission.",
    ]);
  });

  it("marks the store submit identity as ready when production submit config is real", () => {
    const report = buildStoreSubmitReadinessReport({
      easConfig: validSubmitConfig,
      mobileRoot: process.cwd(),
    });

    expect(report).toMatchObject({
      ok: true,
      issues: [],
      nextSteps: [
        "Run npm --prefix mobile run release:submit:check before any store submission.",
      ],
    });
  });

  it("accepts local App Store Connect submit values from the supplied environment", () => {
    const report = buildStoreSubmitReadinessReport({
      easConfig: {
        submit: {
          production: {
            ios: {},
            android: validSubmitConfig.submit.production.android,
          },
        },
      },
      mobileRoot: process.cwd(),
      environment: {
        EXPO_ASC_APP_ID: "1234567890",
        EXPO_ASC_API_KEY_PATH: "@secret:APPLE_ASC_API_KEY",
        EXPO_ASC_API_KEY_ID: "ABC123DEFG",
        EXPO_ASC_API_KEY_ISSUER_ID: "00000000-0000-4000-8000-000000000001",
      },
    });

    expect(report).toMatchObject({
      ok: true,
      issues: [],
    });
  });

  it("formats the checklist without leaking private credential material", () => {
    const report = buildStoreSubmitReadinessReport({
      easConfig: validSubmitConfig,
      mobileRoot: process.cwd(),
    });
    const formatted = formatStoreSubmitReadinessReport(report);

    expect(formatted).toContain("Store submit identity is ready.");
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
});
