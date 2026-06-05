import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredEnvVars = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((environment, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return environment;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return environment;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      environment[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return environment;
    }, {});
}

function validatePreviewBuildProfile(easConfig) {
  const issues = [];
  const preview = easConfig?.build?.preview;

  if (!preview) {
    return ["EAS preview build profile is missing."];
  }

  if (preview.distribution !== "internal") {
    issues.push("Preview builds must use internal distribution.");
  }

  if (preview.channel !== "preview") {
    issues.push("Preview builds must publish to the preview update channel.");
  }

  if (preview.ios?.resourceClass !== "m-medium") {
    issues.push("Preview iOS builds must use the m-medium resource class.");
  }

  if (preview.android?.buildType !== "apk") {
    issues.push("Preview Android builds must produce an APK for internal install.");
  }

  return issues;
}

function validateAppPrivacy(appConfig) {
  const issues = [];
  const ios = appConfig?.expo?.ios;
  const android = appConfig?.expo?.android;

  if (!appConfig?.expo?.scheme) {
    issues.push("expo.scheme is required for auth redirects.");
  }

  if (!ios?.bundleIdentifier) {
    issues.push("expo.ios.bundleIdentifier is required.");
  }

  if (!android?.package) {
    issues.push("expo.android.package is required.");
  }

  if (ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
    issues.push("iOS export compliance must declare no non-exempt encryption.");
  }

  if (ios?.config?.usesNonExemptEncryption !== false) {
    issues.push("iOS config.usesNonExemptEncryption must be false.");
  }

  if (!Array.isArray(ios?.privacyManifests?.NSPrivacyAccessedAPITypes)) {
    issues.push("iOS privacyManifests.NSPrivacyAccessedAPITypes is required.");
  }

  return issues;
}

function validateEasProjectIdentity(appConfig) {
  const issues = [];
  const expo = appConfig?.expo;
  const projectId = expo?.extra?.eas?.projectId;

  if (expo?.owner !== "maxtsogt") {
    issues.push("expo.owner must match the PopsDrops Expo account before builds.");
  }

  if (
    typeof projectId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      projectId,
    )
  ) {
    issues.push("expo.extra.eas.projectId must be a real EAS project id.");
  }

  if (expo?.updates?.url !== `https://u.expo.dev/${projectId}`) {
    issues.push("expo.updates.url must match the EAS project id.");
  }

  if (expo?.runtimeVersion?.policy !== "appVersion") {
    issues.push("expo.runtimeVersion.policy must use appVersion for release builds.");
  }

  return issues;
}

function validateRequiredFiles(mobileRoot) {
  const issues = [];
  const requiredFiles = [
    "store-metadata.md",
    "store-screenshot-manifest.json",
    "store-screenshot-manifest.ios.json",
  ];

  for (const filename of requiredFiles) {
    if (!existsSync(path.join(mobileRoot, filename))) {
      issues.push(`${filename} is required before preview builds.`);
    }
  }

  return issues;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDirectory, "..");
const envFiles = [".env", ".env.local", ".env.production", ".env.production.local"];
const fileEnvironment = envFiles.reduce((environment, filename) => {
  return {
    ...environment,
    ...parseEnvFile(path.join(mobileRoot, filename)),
  };
}, {});
const resolvedEnvironment = {
  ...fileEnvironment,
  ...process.env,
};
const missingEnv = requiredEnvVars.filter((key) => {
  const value = resolvedEnvironment[key];
  return typeof value !== "string" || value.trim().length === 0;
});
const appConfig = JSON.parse(readFileSync(path.join(mobileRoot, "app.json"), "utf8"));
const easConfig = JSON.parse(readFileSync(path.join(mobileRoot, "eas.json"), "utf8"));
const issues = [
  ...missingEnv.map((key) => `${key} is required for preview builds.`),
  ...validatePreviewBuildProfile(easConfig),
  ...validateEasProjectIdentity(appConfig),
  ...validateAppPrivacy(appConfig),
  ...validateRequiredFiles(mobileRoot),
];

if (issues.length > 0) {
  console.error(
    [
      "Mobile preview build check failed.",
      ...issues.map((issue) => `- ${issue}`),
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Mobile preview build check passed.");
