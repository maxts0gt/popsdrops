import { describe, expect, it } from "vitest";

import {
  buildMobileReleaseStatus,
  formatMobileReleaseStatusJson,
  formatMobileReleaseStatusMarkdown,
  formatMobileStoreSubmitHandoff,
  formatMobileReleaseStatus,
  getReleaseStatusExitCode,
} from "./release-status.mjs";

const readyEasConfig = {
  build: {
    production: {
      autoIncrement: true,
      channel: "production",
      ios: {
        resourceClass: "m-medium",
      },
      android: {
        buildType: "app-bundle",
      },
    },
  },
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

describe("mobile release status", () => {
  it("includes release metadata as a first-class gate before store submission", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      releaseMetadataIssues: [
        "Privacy Policy URL must be https://popsdrops.com/privacy.",
      ],
      screenshotIssues: [],
      creatorProofIssues: [],
    });

    expect(status.ok).toBe(false);
    expect(status.gates[0]).toMatchObject({
      label: "Release metadata",
      ok: false,
      issues: ["Privacy Policy URL must be https://popsdrops.com/privacy."],
    });
    expect(status.nextMove).toBe(
      "Fix mobile release metadata, then rerun npm --prefix mobile run release:check.",
    );
  });

  it("includes production build configuration as a first-class release gate", () => {
    const status = buildMobileReleaseStatus({
      easConfig: {
        build: {
          production: {
            autoIncrement: false,
            channel: "preview",
            ios: {
              resourceClass: "m-medium",
            },
            android: {
              buildType: "apk",
            },
          },
        },
        submit: readyEasConfig.submit,
      },
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
    });

    expect(status.ok).toBe(false);
    expect(status.gates[0]).toMatchObject({
      label: "Release metadata",
      ok: true,
    });
    expect(status.gates[1]).toMatchObject({
      label: "Production build config",
      ok: false,
      issues: [
        "Production builds must autoIncrement native build numbers.",
        "Production builds must publish to the production update channel.",
        "Production Android builds must produce an app-bundle.",
      ],
    });
    expect(status.gates[2]).toMatchObject({
      label: "Store identity",
      ok: true,
    });
    expect(status.nextMove).toBe(
      "Fix the production build config, then rerun npm --prefix mobile run release:production-build:check.",
    );
  });

  it("summarizes external store identity blockers separately from code gates", () => {
    const status = buildMobileReleaseStatus({
      easConfig: {
        build: readyEasConfig.build,
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
      screenshotIssues: [],
      creatorProofIssues: [],
    });

    expect(status.ok).toBe(false);
    expect(status.gates).toMatchObject([
      {
        label: "Release metadata",
        ok: true,
      },
      {
        label: "Production build config",
        ok: true,
      },
      {
        label: "Store identity",
        ok: false,
      },
      {
        label: "EAS authentication",
        ok: true,
      },
      {
        label: "EAS submit secrets",
        ok: true,
      },
      {
        label: "Production build artifacts",
        ok: true,
      },
      {
        label: "Creator proof smoke",
        ok: true,
      },
      {
        label: "Store screenshots",
        ok: true,
      },
      {
        label: "Submit readiness",
        ok: false,
      },
    ]);
    expect(status.nextMove).toBe(
      "Add the real App Store Connect IDs and EAS file secrets, then rerun npm --prefix mobile run release:submit:check.",
    );
  });

  it("summarizes remote EAS submit secret blockers as their own gate", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easSecretsReport: {
        ok: false,
        issues: ["Missing EAS file secret: GOOGLE_SERVICE_ACCOUNT."],
        nextSteps: [
          "Create EAS production file secrets, then rerun npm --prefix mobile run release:eas-secrets:check.",
        ],
      },
    });

    expect(status.ok).toBe(false);
    expect(status.gates).toMatchObject([
      {
        label: "Release metadata",
        ok: true,
      },
      {
        label: "Production build config",
        ok: true,
      },
      {
        label: "Store identity",
        ok: true,
      },
      {
        label: "EAS authentication",
        ok: true,
      },
      {
        label: "EAS submit secrets",
        ok: false,
        issues: ["Missing EAS file secret: GOOGLE_SERVICE_ACCOUNT."],
      },
      {
        label: "Production build artifacts",
        ok: true,
      },
      {
        label: "Creator proof smoke",
        ok: true,
      },
      {
        label: "Store screenshots",
        ok: true,
      },
      {
        label: "Submit readiness",
        ok: false,
      },
    ]);
    expect(status.nextMove).toBe(
      "Create the EAS production file secrets, then rerun npm --prefix mobile run release:eas-secrets:check.",
    );
  });

  it("includes creator proof smoke as a first-class gate before store submission", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [
        "iOS: Creator proof screenshot is missing: output/ios/mobile-creator-performance-smoke.png.",
      ],
      easSecretsReport: {
        ok: true,
        issues: [],
        nextSteps: [],
      },
    });

    expect(status.ok).toBe(false);
    expect(status.gates).toMatchObject([
      {
        label: "Release metadata",
        ok: true,
      },
      {
        label: "Production build config",
        ok: true,
      },
      {
        label: "Store identity",
        ok: true,
      },
      {
        label: "EAS authentication",
        ok: true,
      },
      {
        label: "EAS submit secrets",
        ok: true,
      },
      {
        label: "Production build artifacts",
        ok: true,
      },
      {
        label: "Creator proof smoke",
        ok: false,
        issues: [
          "iOS: Creator proof screenshot is missing: output/ios/mobile-creator-performance-smoke.png.",
        ],
      },
      {
        label: "Store screenshots",
        ok: true,
      },
      {
        label: "Submit readiness",
        ok: false,
      },
    ]);
    expect(status.nextMove).toBe(
      "Run Android and iOS creator proof smoke, then rerun npm --prefix mobile run release:creator-proof:check.",
    );
  });

  it("includes production build artifacts before store submission", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easSecretsReport: {
        ok: true,
        issues: [],
        nextSteps: [],
      },
      productionBuildArtifactReport: {
        ok: false,
        issues: ["Android: No finished production store build artifact found."],
        nextSteps: [
          "Run npm --prefix mobile run build:production:ios and npm --prefix mobile run build:production:android, then rerun npm --prefix mobile run release:production-artifacts:check.",
        ],
        artifacts: [],
      },
    });

    expect(status.ok).toBe(false);
    expect(status.gates).toMatchObject([
      {
        label: "Release metadata",
        ok: true,
      },
      {
        label: "Production build config",
        ok: true,
      },
      {
        label: "Store identity",
        ok: true,
      },
      {
        label: "EAS authentication",
        ok: true,
      },
      {
        label: "EAS submit secrets",
        ok: true,
      },
      {
        label: "Production build artifacts",
        ok: false,
        issues: ["Android: No finished production store build artifact found."],
      },
      {
        label: "Creator proof smoke",
        ok: true,
      },
      {
        label: "Store screenshots",
        ok: true,
      },
      {
        label: "Submit readiness",
        ok: false,
      },
    ]);
    expect(status.nextMove).toBe(
      "Run production iOS and Android builds, then rerun npm --prefix mobile run release:production-artifacts:check.",
    );
  });

  it("summarizes EAS authentication blockers separately from remote submit secrets", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easAuthReport: {
        ok: false,
        issues: ["EAS authentication failed. EXPO_TOKEN is not set."],
        nextSteps: [
          "Run eas login locally or set EXPO_TOKEN, then rerun npm --prefix mobile run release:eas-auth:check.",
        ],
      },
      easSecretsReport: {
        ok: false,
        issues: [
          "EAS authentication must pass before production submit secrets can be read.",
        ],
        nextSteps: [
          "Authenticate EAS, then rerun npm --prefix mobile run release:eas-secrets:check.",
        ],
      },
    });

    expect(status.ok).toBe(false);
    expect(status.gates).toMatchObject([
      {
        label: "Release metadata",
        ok: true,
      },
      {
        label: "Production build config",
        ok: true,
      },
      {
        label: "Store identity",
        ok: true,
      },
      {
        label: "EAS authentication",
        ok: false,
        issues: ["EAS authentication failed. EXPO_TOKEN is not set."],
      },
      {
        label: "EAS submit secrets",
        ok: false,
        issues: [
          "EAS authentication must pass before production submit secrets can be read.",
        ],
      },
      {
        label: "Production build artifacts",
        ok: true,
      },
      {
        label: "Creator proof smoke",
        ok: true,
      },
      {
        label: "Store screenshots",
        ok: true,
      },
      {
        label: "Submit readiness",
        ok: false,
      },
    ]);
    expect(status.nextMove).toBe(
      "Authenticate EAS, then rerun npm --prefix mobile run release:eas-auth:check.",
    );
  });

  it("prioritizes real store identity before remote EAS secret checks when both are blocked", () => {
    const status = buildMobileReleaseStatus({
      easConfig: {
        build: readyEasConfig.build,
        submit: {
          production: {
            ios: {
              ascAppId: "your-app-store-connect-app-id",
              ascApiKeyPath: "@secret:APPLE_ASC_API_KEY",
              ascApiKeyId: "your-app-store-connect-api-key-id",
              ascApiKeyIssuerId: "your-app-store-connect-issuer-id",
            },
            android: readyEasConfig.submit.production.android,
          },
        },
      },
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easSecretsReport: {
        ok: false,
        issues: ["Could not read EAS production secrets."],
        nextSteps: [
          "Authenticate EAS, then rerun npm --prefix mobile run release:eas-secrets:check.",
        ],
      },
    });

    expect(status.ok).toBe(false);
    expect(status.nextMove).toBe(
      "Add the real App Store Connect IDs and EAS file secrets, then rerun npm --prefix mobile run release:submit:check.",
    );
  });

  it("marks the mobile release as submit-ready when identity, remote secrets, and screenshots are ready", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easSecretsReport: {
        ok: true,
        issues: [],
        nextSteps: [],
      },
    });

    expect(status).toMatchObject({
      ok: true,
      nextMove:
        "Run npm --prefix mobile run release:submit:check, then submit to TestFlight and Play internal testing.",
    });
  });

  it("surfaces post-submit store install evidence without blocking pre-submit readiness", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easSecretsReport: {
        ok: true,
        issues: [],
        nextSteps: [],
      },
      storeInstallEvidenceReport: {
        ok: false,
        summaries: [],
        issues: [
          "Store install evidence manifest is missing: mobile/store-install-evidence-manifest.local.json.",
        ],
        nextSteps: [
          "Install the iOS build from TestFlight on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
          "Install the Android build from Play internal testing on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
          "Rerun npm --prefix mobile run release:store-install-evidence:check.",
        ],
      },
    });

    expect(status).toMatchObject({
      ok: true,
      submitReady: true,
      postSubmitReady: false,
      nextMove:
        "Submit to TestFlight and Play internal testing, then capture real-device store install evidence.",
    });
    expect(status.gates).toMatchObject([
      {
        label: "Release metadata",
        ok: true,
      },
      {
        label: "Production build config",
        ok: true,
      },
      {
        label: "Store identity",
        ok: true,
      },
      {
        label: "EAS authentication",
        ok: true,
      },
      {
        label: "EAS submit secrets",
        ok: true,
      },
      {
        label: "Production build artifacts",
        ok: true,
      },
      {
        label: "Creator proof smoke",
        ok: true,
      },
      {
        label: "Store screenshots",
        ok: true,
      },
      {
        label: "Submit readiness",
        ok: true,
      },
      {
        label: "Store install evidence",
        ok: false,
        issues: [
          "Store install evidence manifest is missing: mobile/store-install-evidence-manifest.local.json.",
        ],
      },
    ]);
    expect(formatMobileReleaseStatus(status)).toContain("Post-submit: blocked.");
    expect(JSON.parse(formatMobileReleaseStatusJson(status))).toMatchObject({
      ok: true,
      submitReady: true,
      postSubmitReady: false,
      gates: [
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {
          label: "Submit readiness",
          ok: true,
        },
        {
          label: "Store install evidence",
          ok: false,
        },
      ],
    });
  });

  it("does not mark post-submit ready until store release visibility is proven", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easSecretsReport: {
        ok: true,
        issues: [],
        nextSteps: [],
      },
      storeReleaseVisibilityReport: {
        ok: false,
        summaries: [],
        issues: [
          "iOS: 1.0.0 (42) is not visible in App Store Connect.",
        ],
        nextSteps: [
          "Confirm the iOS upload completed, then rerun npm --prefix mobile run release:store-visibility:check.",
        ],
      },
      storeInstallEvidenceReport: {
        ok: true,
        summaries: [
          "iOS: TestFlight install evidence matches build 42.",
          "Android: Play internal install evidence matches build 42.",
        ],
        issues: [],
        nextSteps: [],
      },
    });

    expect(status).toMatchObject({
      ok: true,
      submitReady: true,
      postSubmitReady: false,
      nextMove:
        "Fix store release visibility, then rerun npm --prefix mobile run release:store-visibility:check.",
    });
    expect(status.gates).toMatchObject([
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {
        label: "Submit readiness",
        ok: true,
      },
      {
        label: "Store release visibility",
        ok: false,
        issues: [
          "iOS: 1.0.0 (42) is not visible in App Store Connect.",
        ],
      },
      {
        label: "Store install evidence",
        ok: true,
      },
    ]);
    expect(formatMobileReleaseStatus(status)).toContain("Post-submit: blocked.");
    expect(JSON.parse(formatMobileReleaseStatusJson(status))).toMatchObject({
      postSubmitReady: false,
      gates: [
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {
          label: "Store release visibility",
          ok: false,
        },
        {
          label: "Store install evidence",
          ok: true,
        },
      ],
    });
  });

  it("keeps normal status informational but lets strict mode fail blocked releases", () => {
    const blockedStatus = buildMobileReleaseStatus({
      easConfig: {
        build: readyEasConfig.build,
        submit: {
          production: {
            ios: {
              ascAppId: "your-app-store-connect-app-id",
              ascApiKeyPath: "@secret:APPLE_ASC_API_KEY",
              ascApiKeyId: "your-app-store-connect-api-key-id",
              ascApiKeyIssuerId: "your-app-store-connect-issuer-id",
            },
            android: readyEasConfig.submit.production.android,
          },
        },
      },
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
    });
    const readyStatus = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
    });

    expect(getReleaseStatusExitCode(blockedStatus, { strict: false })).toBe(0);
    expect(getReleaseStatusExitCode(blockedStatus, { strict: true })).toBe(1);
    expect(getReleaseStatusExitCode(readyStatus, { strict: true })).toBe(0);
  });

  it("documents strict mode in the formatted status output", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
    });
    const formatted = formatMobileReleaseStatus(status);

    expect(formatted).toContain(
      "Automation: npm --prefix mobile run release:status:strict",
    );
  });

  it("formats status without leaking secret material", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: ["iOS: Screen 01-login screenshot is missing: 01-login.png."],
      creatorProofIssues: [],
    });
    const formatted = formatMobileReleaseStatus(status);

    expect(formatted).toContain("Mobile release status");
    expect(formatted).toContain("Store screenshots: blocked");
    expect(formatted).not.toContain("PRIVATE KEY");
    expect(formatted).not.toContain("client_email");
  });

  it("formats machine-readable JSON for CI and release dashboards", () => {
    const status = buildMobileReleaseStatus({
      easConfig: readyEasConfig,
      mobileRoot: process.cwd(),
      screenshotIssues: ["Android: Screen 01-login screenshot is missing: 01-login.png."],
      creatorProofIssues: [],
    });
    const parsed = JSON.parse(formatMobileReleaseStatusJson(status));

    expect(parsed).toMatchObject({
      ok: false,
      nextMove:
        "Regenerate store screenshots, then rerun npm --prefix mobile run release:screenshot-artifacts:check.",
      gates: [
        {
          label: "Release metadata",
          ok: true,
        },
        {
          label: "Production build config",
          ok: true,
        },
        {
          label: "Store identity",
          ok: true,
        },
        {
          label: "EAS authentication",
          ok: true,
        },
        {
          label: "EAS submit secrets",
          ok: true,
        },
        {
          label: "Production build artifacts",
          ok: true,
        },
        {
          label: "Creator proof smoke",
          ok: true,
        },
        {
          label: "Store screenshots",
          ok: false,
          issues: [
            "Android: Screen 01-login screenshot is missing: 01-login.png.",
          ],
        },
        {
          label: "Submit readiness",
          ok: false,
        },
      ],
    });
    expect(JSON.stringify(parsed)).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(parsed)).not.toContain("client_email");
  });

  it("formats a GitHub step summary without leaking secret material", () => {
    const status = buildMobileReleaseStatus({
      easConfig: {
        build: readyEasConfig.build,
        submit: {
          production: {
            ios: {
              ascAppId: "your-app-store-connect-app-id",
              ascApiKeyPath: "@secret:APPLE_ASC_API_KEY",
              ascApiKeyId: "your-app-store-connect-api-key-id",
              ascApiKeyIssuerId: "your-app-store-connect-issuer-id",
            },
            android: readyEasConfig.submit.production.android,
          },
        },
      },
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
    });
    const markdown = formatMobileReleaseStatusMarkdown(status);

    expect(markdown).toContain("## Mobile release status");
    expect(markdown).toContain("**Overall:** Blocked");
    expect(markdown).toContain("| Gate | Status |");
    expect(markdown).toContain("| Release metadata | Ready |");
    expect(markdown).toContain("| Store identity | Blocked |");
    expect(markdown).toContain(
      "Add the real App Store Connect IDs and EAS file secrets",
    );
    expect(markdown).not.toContain("PRIVATE KEY");
    expect(markdown).not.toContain("client_email");
  });

  it("formats a store-submit handoff without leaking credential values", () => {
    const status = buildMobileReleaseStatus({
      easConfig: {
        build: readyEasConfig.build,
        submit: {
          production: {
            ios: {
              ascAppId: "your-app-store-connect-app-id",
              ascApiKeyPath: "@secret:APPLE_ASC_API_KEY",
              ascApiKeyId: "your-app-store-connect-api-key-id",
              ascApiKeyIssuerId: "your-app-store-connect-issuer-id",
            },
            android: readyEasConfig.submit.production.android,
          },
        },
      },
      mobileRoot: process.cwd(),
      screenshotIssues: [],
      creatorProofIssues: [],
      easSecretsReport: {
        ok: false,
        issues: ["Could not read EAS production secrets. Log in with eas login or set EXPO_TOKEN."],
        nextSteps: [
          "Authenticate EAS, then rerun npm --prefix mobile run release:eas-secrets:check.",
        ],
      },
    });
    const handoff = formatMobileStoreSubmitHandoff(status);

    expect(handoff).toContain("Mobile store-submit handoff");
    expect(handoff).toContain("Needed from Apple");
    expect(handoff).toContain("EXPO_ASC_APP_ID");
    expect(handoff).toContain("EXPO_ASC_API_KEY_ID");
    expect(handoff).toContain("EXPO_ASC_API_KEY_ISSUER_ID");
    expect(handoff).toContain("APPLE_ASC_API_KEY");
    expect(handoff).toContain("GOOGLE_SERVICE_ACCOUNT");
    expect(handoff).toContain("EXPO_TOKEN");
    expect(handoff).toContain(
      "eas env:create production --name APPLE_ASC_API_KEY --type file --visibility secret",
    );
    expect(handoff).toContain(
      "eas env:create production --name GOOGLE_SERVICE_ACCOUNT --type file --visibility secret",
    );
    expect(handoff).not.toContain("eas secret:create");
    expect(handoff).toContain("npm --prefix mobile run release:submit:check");
    expect(handoff).toContain(
      "npm --prefix mobile run release:store-install-evidence:check",
    );
    expect(handoff).toContain("npm --prefix mobile run release:post-submit:check");
    expect(handoff).not.toContain("PRIVATE KEY");
    expect(handoff).not.toContain("client_email");
    expect(handoff).not.toContain("cd22a581-5b93-432b-a9cf-fdd8ee6c5012");
  });
});
