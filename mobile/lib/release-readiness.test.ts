import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  REQUIRED_RELEASE_ENV_VARS,
  validateReleaseEnvironment,
} from "./release-readiness";

const mobileRoot = path.resolve(__dirname, "..");

function readMetadataSection(source: string, heading: string) {
  const pattern = new RegExp(
    `## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)(?=\\n## |$)`,
  );
  const match = source.match(pattern);

  return match?.[1].trim() ?? "";
}

describe("validateReleaseEnvironment", () => {
  it("returns missing public mobile env vars for incomplete release config", () => {
    const result = validateReleaseEnvironment({
      EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["EXPO_PUBLIC_SUPABASE_ANON_KEY"]);
    expect(result.required).toEqual(REQUIRED_RELEASE_ENV_VARS);
  });

  it("accepts release config when required public mobile env vars are present", () => {
    const result = validateReleaseEnvironment({
      EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe("mobile release contract", () => {
  it("exposes mobile-local quality and release scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.["eas-cli"]).toBeUndefined();
    expect(packageJson.overrides).toMatchObject({
      uuid: "11.1.1",
      ws: "8.21.0",
    });
    expect(packageJson.scripts).toMatchObject({
      lint: "npm --prefix .. run lint -- 'mobile/**/*.{ts,tsx}'",
      doctor: "npx expo-doctor",
      quality: "npm run lint && npm run typecheck && npm run test && npm run doctor && npm run release:check",
      "release:check": "node ./scripts/release-check.mjs",
      "release:preview:check": "node ./scripts/preview-build-check.mjs",
      "release:eas-auth:check": "node ./scripts/eas-auth-check.mjs",
      "release:eas-secrets:check": "node ./scripts/eas-secrets-check.mjs",
      "release:production-artifacts:check":
        "node ./scripts/production-build-artifact-check.mjs",
      "release:store-visibility:check":
        "node ./scripts/store-release-visibility-check.mjs",
      "release:store-identity:check":
        "node ./scripts/store-submit-readiness.mjs",
      "release:status": "node ./scripts/release-status.mjs",
      "release:status:json": "node ./scripts/release-status.mjs --json",
      "release:status:markdown": "node ./scripts/release-status.mjs --markdown",
      "release:handoff": "node ./scripts/release-status.mjs --handoff",
      "release:status:strict": "node ./scripts/release-status.mjs --strict",
      "release:submit:check": "npm run release:status:strict",
      "release:creator-proof:check":
        "node ./scripts/creator-proof-smoke-artifact-check.mjs",
      "release:screenshot-artifacts:check":
        "node ./scripts/store-screenshot-artifact-check.mjs",
      "release:production-build:check":
        "node ./scripts/production-build-check.mjs",
      "build:preview": "npm run build:preview:ios && npm run build:preview:android",
      "eas:build:preview:ios":
        "EXPO_PUBLIC_ENABLE_EAS_UPDATES=1 npx --yes eas-cli@19.0.8 build --platform ios --profile preview --non-interactive",
      "eas:build:preview:android":
        "EXPO_PUBLIC_ENABLE_EAS_UPDATES=1 npx --yes eas-cli@19.0.8 build --platform android --profile preview --non-interactive",
      "build:preview:ios":
        "npm run release:preview:check && npm run release:eas-auth:check && npm run eas:build:preview:ios",
      "build:preview:android":
        "npm run release:preview:check && npm run release:eas-auth:check && npm run eas:build:preview:android",
      "eas:build:production:ios":
        "EXPO_PUBLIC_ENABLE_EAS_UPDATES=1 npx --yes eas-cli@19.0.8 build --platform ios --profile production --non-interactive",
      "eas:build:production:android":
        "EXPO_PUBLIC_ENABLE_EAS_UPDATES=1 npx --yes eas-cli@19.0.8 build --platform android --profile production --non-interactive",
      "build:production:ios":
        "npm run release:production-build:check && npm run release:eas-auth:check && npm run eas:build:production:ios",
      "build:production:android":
        "npm run release:production-build:check && npm run release:eas-auth:check && npm run eas:build:production:android",
      "submit:production:ios":
        "npm run release:submit:check && node ./scripts/submit-production-build.mjs --platform ios",
      "submit:production:android":
        "npm run release:submit:check && node ./scripts/submit-production-build.mjs --platform android",
    });
  });

  it("keeps the native creator proof smoke as an explicit mobile release gate", () => {
    const mobilePackageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const rootPackageJson = JSON.parse(
      readFileSync(path.resolve(mobileRoot, "..", "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(rootPackageJson.scripts?.["smoke:mobile-creator-performance"]).toBe(
      "node scripts/smoke-mobile-creator-performance.mjs",
    );
    expect(mobilePackageJson.scripts).toMatchObject({
      "smoke:creator-performance":
        "npm --prefix .. run smoke:mobile-creator-performance",
      "release:smoke":
        "npm run smoke:creator-performance && npm run release:creator-proof:check",
      "release:creator-proof:check":
        "node ./scripts/creator-proof-smoke-artifact-check.mjs",
    });
    expect(mobilePackageJson.scripts?.["release:smoke"]).toContain(
      "release:creator-proof:check",
    );
    expect(mobilePackageJson.scripts?.quality).not.toContain(
      "smoke:creator-performance",
    );
  });

  it("documents native creator proof smoke in the release story map", () => {
    const storyMap = readFileSync(
      path.resolve(
        mobileRoot,
        "..",
        "docs/superpowers/plans/2026-05-16-release-story-map.md",
      ),
      "utf8",
    );

    expect(storyMap).toContain("npm --prefix mobile run release:smoke");
    expect(storyMap).toContain("npm --prefix mobile run release:creator-proof:check");
    expect(storyMap).toContain("npm --prefix mobile run release:store-visibility:check");
    expect(storyMap).toContain(
      "npm --prefix mobile run release:store-install-evidence:check",
    );
    expect(storyMap).toContain("npm --prefix mobile run release:post-submit:check");
    expect(storyMap).toContain("mobile creator performance proof");
  });

  it("documents the store submission identity handoff in the release story map", () => {
    const storyMap = readFileSync(
      path.resolve(
        mobileRoot,
        "..",
        "docs/superpowers/plans/2026-05-16-release-story-map.md",
      ),
      "utf8",
    );

    expect(storyMap).toContain(
      "npm --prefix mobile run release:store-identity:check",
    );
    expect(storyMap).toContain("APPLE_ASC_API_KEY");
    expect(storyMap).toContain("GOOGLE_SERVICE_ACCOUNT");
    expect(storyMap).toContain("App Store Connect app ID");
  });

  it("defines explicit expo application service build profiles", () => {
    const easPath = path.join(mobileRoot, "eas.json");

    expect(existsSync(easPath)).toBe(true);

    const easConfig = JSON.parse(readFileSync(easPath, "utf8")) as {
      build?: Record<string, Record<string, unknown>>;
      submit?: Record<string, Record<string, unknown>>;
    };

    expect(easConfig.build?.development).toMatchObject({
      developmentClient: true,
      distribution: "internal",
    });
    expect(easConfig.build?.preview).toMatchObject({
      distribution: "internal",
      channel: "preview",
      ios: {
        resourceClass: "m-medium",
      },
      android: {
        buildType: "apk",
      },
    });
    expect(easConfig.build?.production).toMatchObject({
      autoIncrement: true,
      channel: "production",
      ios: {
        resourceClass: "m-medium",
      },
      android: {
        buildType: "app-bundle",
      },
    });
    expect(easConfig.submit?.production).toMatchObject({
      ios: {
        ascAppId: "6773032021",
        ascApiKeyPath: "./AuthKey_7JTGSXY564.p8",
        ascApiKeyIssuerId: "9b408799-9687-4022-b4df-da13c10799a0",
        ascApiKeyId: "7JTGSXY564",
      },
      android: {
        serviceAccountKeyPath: "./play-console-service-account.local.json",
        track: "internal",
      },
    });
    expect(easConfig.submit?.production?.ios).not.toHaveProperty("appleId");
    expect(easConfig.submit?.production?.ios).not.toHaveProperty("appleTeamId");
  });

  it("gates production builds before cloud build execution", () => {
    const productionBuildCheckPath = path.join(
      mobileRoot,
      "scripts/production-build-check.mjs",
    );

    expect(existsSync(productionBuildCheckPath)).toBe(true);

    const productionBuildCheckSource = readFileSync(
      productionBuildCheckPath,
      "utf8",
    );

    expect(productionBuildCheckSource).toContain(
      "validateProductionBuildProfile",
    );
    expect(productionBuildCheckSource).toContain("autoIncrement");
    expect(productionBuildCheckSource).toContain("app-bundle");
    expect(productionBuildCheckSource).toContain("resourceClass");
    expect(productionBuildCheckSource).toContain(
      "Mobile production build check failed",
    );
  });

  it("requires EAS project identity before preview or production cloud builds", () => {
    const appConfig = JSON.parse(
      readFileSync(path.join(mobileRoot, "app.json"), "utf8"),
    ) as {
      expo?: {
        owner?: string;
        updates?: {
          url?: string;
        };
        runtimeVersion?: unknown;
        extra?: {
          eas?: {
            projectId?: string;
          };
        };
      };
    };
    const previewCheckSource = readFileSync(
      path.join(mobileRoot, "scripts/preview-build-check.mjs"),
      "utf8",
    );
    const productionBuildCheckSource = readFileSync(
      path.join(mobileRoot, "scripts/production-build-check.mjs"),
      "utf8",
    );
    const projectId = appConfig.expo?.extra?.eas?.projectId;

    expect(appConfig.expo?.owner).toBe("maxtsogt");
    expect(projectId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(appConfig.expo?.updates?.url).toBe(`https://u.expo.dev/${projectId}`);
    expect(appConfig.expo?.runtimeVersion).toEqual({
      policy: "appVersion",
    });
    expect(previewCheckSource).toContain("validateEasProjectIdentity");
    expect(previewCheckSource).toContain("https://u.expo.dev/");
    expect(previewCheckSource).toContain("runtimeVersion");
    expect(productionBuildCheckSource).toContain("validateEasProjectIdentity");
    expect(productionBuildCheckSource).toContain("https://u.expo.dev/");
    expect(productionBuildCheckSource).toContain("runtimeVersion");
  });

  it("gates production store submission away from placeholder credentials", () => {
    const submitCheckPath = path.join(
      mobileRoot,
      "scripts/production-submit-check.mjs",
    );

    expect(existsSync(submitCheckPath)).toBe(true);

    const submitCheckSource = readFileSync(submitCheckPath, "utf8");

    expect(submitCheckSource).toContain("validateProductionSubmitProfile");
    expect(submitCheckSource).toContain("ascApiKeyPath");
    expect(submitCheckSource).toContain("isEasSecretReference");
    expect(submitCheckSource).toContain("your-app-store-connect-app-id");
    expect(submitCheckSource).toContain("your-app-store-connect-api-key-id");
    expect(submitCheckSource).toContain("your-app-store-connect-issuer-id");
    expect(submitCheckSource).toContain("EAS file secret reference");
    expect(submitCheckSource).toContain("Store submission check failed");
  });

  it("explains the remaining store identity handoff without exposing secrets", () => {
    const storeIdentityPath = path.join(
      mobileRoot,
      "scripts/store-submit-readiness.mjs",
    );

    expect(existsSync(storeIdentityPath)).toBe(true);

    const mobilePackageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const storeIdentitySource = readFileSync(storeIdentityPath, "utf8");

    expect(mobilePackageJson.scripts).toMatchObject({
      "release:store-identity:check":
        "node ./scripts/store-submit-readiness.mjs",
    });
    expect(storeIdentitySource).toContain("buildStoreSubmitReadinessReport");
    expect(storeIdentitySource).toContain("APPLE_ASC_API_KEY");
    expect(storeIdentitySource).toContain("GOOGLE_SERVICE_ACCOUNT");
    expect(storeIdentitySource).toContain("Store submit identity check failed");
    expect(storeIdentitySource).not.toContain("PRIVATE KEY");
    expect(storeIdentitySource).not.toContain("client_email");
  });

  it("summarizes mobile release status without hiding external store blockers", () => {
    const releaseStatusPath = path.join(
      mobileRoot,
      "scripts/release-status.mjs",
    );

    expect(existsSync(releaseStatusPath)).toBe(true);

    const mobilePackageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const releaseStatusSource = readFileSync(releaseStatusPath, "utf8");

    expect(mobilePackageJson.scripts).toMatchObject({
      "release:status": "node ./scripts/release-status.mjs",
      "release:status:strict": "node ./scripts/release-status.mjs --strict",
    });
    expect(releaseStatusSource).toContain("buildMobileReleaseStatus");
    expect(releaseStatusSource).toContain("getReleaseStatusExitCode");
    expect(releaseStatusSource).toContain("--strict");
    expect(releaseStatusSource).toContain("Store identity");
    expect(releaseStatusSource).toContain("Production build artifacts");
    expect(releaseStatusSource).toContain("Store screenshots");
    expect(releaseStatusSource).toContain("Submit readiness");
  });

  it("keeps real-device store install evidence as a post-submit release gate", () => {
    const mobilePackageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const installEvidenceCheckPath = path.join(
      mobileRoot,
      "scripts/store-install-evidence-check.mjs",
    );
    const installDeviceReadinessPath = path.join(
      mobileRoot,
      "scripts/store-install-device-readiness-check.mjs",
    );
    const installHandoffPath = path.join(
      mobileRoot,
      "scripts/store-install-handoff.mjs",
    );
    const postSubmitCheckPath = path.join(
      mobileRoot,
      "scripts/store-post-submit-check.mjs",
    );
    const installEvidenceCreatePath = path.join(
      mobileRoot,
      "scripts/create-store-install-evidence-manifest.mjs",
    );
    const installEvidenceExamplePath = path.join(
      mobileRoot,
      "store-install-evidence-manifest.example.json",
    );

    expect(existsSync(installEvidenceCheckPath)).toBe(true);
    expect(existsSync(installDeviceReadinessPath)).toBe(true);
    expect(existsSync(installHandoffPath)).toBe(true);
    expect(existsSync(postSubmitCheckPath)).toBe(true);
    expect(existsSync(installEvidenceCreatePath)).toBe(true);
    expect(existsSync(installEvidenceExamplePath)).toBe(true);
    expect(mobilePackageJson.scripts).toMatchObject({
      "release:store-install-handoff":
        "node ./scripts/store-install-handoff.mjs",
      "release:store-install-devices:check":
        "node ./scripts/store-install-device-readiness-check.mjs",
      "release:store-install-evidence:create":
        "node ./scripts/create-store-install-evidence-manifest.mjs",
      "release:store-install-evidence:check":
        "node ./scripts/store-install-evidence-check.mjs",
      "release:post-submit:check":
        "node ./scripts/store-post-submit-check.mjs",
    });

    const installEvidenceCheckSource = readFileSync(
      installEvidenceCheckPath,
      "utf8",
    );
    const gitignore = readFileSync(
      path.resolve(mobileRoot, "..", ".gitignore"),
      "utf8",
    );

    expect(installEvidenceCheckSource).toContain(
      "buildStoreInstallEvidenceReport",
    );
    expect(installEvidenceCheckSource).toContain("testflight");
    expect(installEvidenceCheckSource).toContain("play-internal");
    expect(installEvidenceCheckSource).toContain(
      "store-install-evidence-manifest.local.json",
    );
    expect(installEvidenceCheckSource).toContain(
      "Store install evidence check failed",
    );
    expect(gitignore).toContain(
      "mobile/store-install-evidence-manifest.local.json",
    );
  });

  it("keeps local store credential files out of git", () => {
    const gitignore = readFileSync(
      path.resolve(mobileRoot, "..", ".gitignore"),
      "utf8",
    );

    expect(gitignore).toContain("mobile/AuthKey_*.p8");
    expect(gitignore).toContain("mobile/*.p8");
    expect(gitignore).toContain("mobile/google-service-account*.json");
    expect(gitignore).toContain("mobile/play-console-service-account*.json");
  });

  it("documents local App Store Connect submit environment variables without real secrets", () => {
    const envExample = readFileSync(
      path.join(mobileRoot, ".env.local.example"),
      "utf8",
    );

    expect(envExample).toContain("EXPO_ASC_APP_ID=1234567890");
    expect(envExample).toContain("EXPO_ASC_API_KEY_PATH=./AuthKey_XXXXXXXXXX.p8");
    expect(envExample).toContain("EXPO_ASC_API_KEY_ID=XXXXXXXXXX");
    expect(envExample).toContain(
      "EXPO_ASC_API_KEY_ISSUER_ID=00000000-0000-0000-0000-000000000000",
    );
    expect(envExample).toContain("EXPO_TOKEN=replace-with-local-expo-token");
    expect(envExample).not.toContain("PRIVATE KEY");
  });

  it("gates production store submission on real screenshot artifacts", () => {
    const mobilePackageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const screenshotArtifactCheckPath = path.join(
      mobileRoot,
      "scripts/store-screenshot-artifact-check.mjs",
    );

    expect(existsSync(screenshotArtifactCheckPath)).toBe(true);
    expect(mobilePackageJson.scripts).toMatchObject({
      "release:screenshot-artifacts:check":
        "node ./scripts/store-screenshot-artifact-check.mjs",
      "release:submit:check": "npm run release:status:strict",
    });

    const screenshotArtifactCheckSource = readFileSync(
      screenshotArtifactCheckPath,
      "utf8",
    );

    expect(screenshotArtifactCheckSource).toContain(
      "validateStoreScreenshotArtifacts",
    );
    expect(screenshotArtifactCheckSource).toContain("readPngSize");
    expect(screenshotArtifactCheckSource).toContain(
      "store-screenshot-manifest.json",
    );
    expect(screenshotArtifactCheckSource).toContain(
      "store-screenshot-manifest.ios.json",
    );
    expect(screenshotArtifactCheckSource).toContain(
      "Store screenshot artifact check failed",
    );
  });

  it("keeps preview build checks separate from production store submission", () => {
    const previewCheckPath = path.join(
      mobileRoot,
      "scripts/preview-build-check.mjs",
    );
    const easAuthCheckPath = path.join(
      mobileRoot,
      "scripts/eas-auth-check.mjs",
    );

    expect(existsSync(previewCheckPath)).toBe(true);
    expect(existsSync(easAuthCheckPath)).toBe(true);

    const previewCheckSource = readFileSync(previewCheckPath, "utf8");
    const easAuthCheckSource = readFileSync(easAuthCheckPath, "utf8");

    expect(previewCheckSource).toContain("validatePreviewBuildProfile");
    expect(previewCheckSource).toContain("usesNonExemptEncryption");
    expect(previewCheckSource).toContain("privacyManifests");
    expect(previewCheckSource).toContain("store-screenshot-manifest.ios.json");
    expect(previewCheckSource).not.toContain("appleId");
    expect(previewCheckSource).not.toContain("serviceAccountKeyPath");
    expect(easAuthCheckSource).toContain("eas-cli@19.0.8");
    expect(easAuthCheckSource).toContain("EXPO_TOKEN");
    expect(easAuthCheckSource).toContain("Not logged in");
  });

  it("documents the installable preview build lane in the release story map", () => {
    const storyMap = readFileSync(
      path.resolve(
        mobileRoot,
        "..",
        "docs/superpowers/plans/2026-05-16-release-story-map.md",
      ),
      "utf8",
    );

    expect(storyMap).toContain("npm --prefix mobile run release:preview:check");
    expect(storyMap).toContain("npm --prefix mobile run build:preview:ios");
    expect(storyMap).toContain("npm --prefix mobile run build:preview:android");
    expect(storyMap).toContain("installable internal build lane");
  });

  it("keeps mobile store metadata premium, creator-first, and legally clean", () => {
    const metadata = readFileSync(
      path.join(mobileRoot, "store-metadata.md"),
      "utf8",
    );
    const subtitle = readMetadataSection(metadata, "Subtitle (iOS, 30 chars max)");
    const shortDescription = readMetadataSection(
      metadata,
      "Short Description (Android, 80 chars max)",
    );
    const fullDescription = readMetadataSection(
      metadata,
      "Full Description (Both Stores)",
    );
    const keywords = readMetadataSection(metadata, "Keywords (iOS, 100 chars max)");
    const privacyPolicyUrl = readMetadataSection(metadata, "Privacy Policy URL");
    const termsUrl = readMetadataSection(metadata, "Terms of Service URL");
    const supportUrl = readMetadataSection(metadata, "Support URL");
    const marketingUrl = readMetadataSection(metadata, "Marketing URL");
    const bannedPublicClaims = [
      /\bMVP\b/i,
      /\bbeta\b/i,
      /\bAI-powered\b/i,
      /\bmarketplace\b/i,
      /\bMENA\b/i,
      /\bHermes\b/i,
      /\bChanel\b/i,
      /\bBLACKPINK\b/i,
      /\bBlackPink\b/i,
      /\bMessi\b/i,
      /\bRonaldo\b/i,
      /\bAnna Hathaway\b/i,
      /\bNatalie Portman\b/i,
      /\bDior\b/i,
    ];
    const requiredSignals = [
      /private campaign/i,
      /translated briefs/i,
      /performance proof/i,
      /payment status/i,
      /free for creators/i,
    ];

    expect(subtitle.length).toBeGreaterThan(0);
    expect(subtitle.length).toBeLessThanOrEqual(30);
    expect(shortDescription.length).toBeGreaterThan(0);
    expect(shortDescription.length).toBeLessThanOrEqual(80);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(100);
    expect(privacyPolicyUrl).toBe("https://popsdrops.com/privacy");
    expect(termsUrl).toBe("https://popsdrops.com/terms");
    expect(supportUrl).toBe("https://popsdrops.com/support");
    expect(supportUrl).not.toContain("/contact");
    expect(marketingUrl).toBe("https://popsdrops.com");

    for (const bannedClaim of bannedPublicClaims) {
      expect(metadata).not.toMatch(bannedClaim);
    }

    for (const signal of requiredSignals) {
      expect(fullDescription).toMatch(signal);
    }
  });

  it("wires release check to validate app-store metadata before builds", () => {
    const releaseCheck = readFileSync(
      path.join(mobileRoot, "scripts/release-check.mjs"),
      "utf8",
    );

    expect(releaseCheck).toContain("store-metadata.md");
    expect(releaseCheck).toContain("validateStoreMetadata");
    expect(releaseCheck).toContain("validateStoreUrls");
  });

  it("keeps the app-store screenshot plan tied to real creator app routes", () => {
    const manifestPath = path.join(mobileRoot, "store-screenshot-manifest.json");
    const iosManifestPath = path.join(
      mobileRoot,
      "store-screenshot-manifest.ios.json",
    );

    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(iosManifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      outputDirectory?: string;
      screens?: Array<{
        id?: string;
        file?: string;
        route?: string;
        routeFile?: string;
        requiredText?: string[];
      }>;
    };
    const iosManifest = JSON.parse(readFileSync(iosManifestPath, "utf8")) as {
      outputDirectory?: string;
      screens?: typeof manifest.screens;
    };

    expect(manifest.outputDirectory).toBe("output/android/store-screenshots");
    expect(iosManifest.outputDirectory).toBe("output/ios/store-screenshots");
    expect(manifest.screens).toHaveLength(5);
    expect(iosManifest.screens).toHaveLength(5);
    expect(manifest.screens?.map((screen) => screen.id)).toEqual([
      "01-login",
      "02-home",
      "03-invites",
      "04-campaign-detail",
      "05-profile",
    ]);
    expect(iosManifest.screens?.map((screen) => screen.id)).toEqual(
      manifest.screens?.map((screen) => screen.id),
    );

    for (const screen of [
      ...(manifest.screens ?? []),
      ...(iosManifest.screens ?? []),
    ]) {
      expect(screen.file).toMatch(/^\d{2}-[a-z-]+\.png$/);
      expect(screen.route).toMatch(/^\//);
      expect(screen.requiredText?.length).toBeGreaterThanOrEqual(2);
      expect(screen.routeFile).toBeTruthy();
      expect(existsSync(path.join(mobileRoot, screen.routeFile!))).toBe(true);
    }
  });

  it("keeps mobile login CTAs as one readable label for screenshot proof", () => {
    const loginScreen = readFileSync(
      path.join(mobileRoot, "app/(auth)/login.tsx"),
      "utf8",
    );
    const googleCtaStart = loginScreen.indexOf("onPress={signInWithGoogle}");
    const googleCtaEnd = loginScreen.indexOf(
      "<View className=\"my-5 flex-row items-center\">",
      googleCtaStart,
    );
    const googleCtaSource = loginScreen.slice(googleCtaStart, googleCtaEnd);

    expect(googleCtaSource).toContain('{t("auth.signInGoogle")}');
    expect(googleCtaSource).toContain("numberOfLines={1}");
    expect(googleCtaSource).toContain('width: "100%"');
    expect(googleCtaSource).not.toContain(">G</Text>");
    expect(googleCtaSource).not.toContain(">o</Text>");
  });

  it("wires store screenshot capture as an explicit release command", () => {
    const mobilePackageJson = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const rootPackageJson = JSON.parse(
      readFileSync(path.resolve(mobileRoot, "..", "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };
    const releaseCheck = readFileSync(
      path.join(mobileRoot, "scripts/release-check.mjs"),
      "utf8",
    );

    expect(rootPackageJson.scripts?.["smoke:mobile-store-screenshots"]).toBe(
      "node scripts/smoke-mobile-store-screenshots.mjs",
    );
    expect(rootPackageJson.scripts?.["smoke:mobile-store-screenshots:ios"]).toBe(
      "node scripts/smoke-mobile-store-screenshots-ios.mjs",
    );
    expect(mobilePackageJson.scripts?.["release:screenshots"]).toBe(
      "npm --prefix .. run smoke:mobile-store-screenshots",
    );
    expect(mobilePackageJson.scripts?.["release:screenshots:ios"]).toBe(
      "npm --prefix .. run smoke:mobile-store-screenshots:ios",
    );
    expect(releaseCheck).toContain("store-screenshot-manifest.json");
    expect(releaseCheck).toContain("store-screenshot-manifest.ios.json");
    expect(releaseCheck).toContain("validateStoreScreenshotManifest");
  });
});
