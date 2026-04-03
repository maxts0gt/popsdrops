import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredEnvVars = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      accumulator[key] = value;
      return accumulator;
    }, {});
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDirectory, "..");

const envFiles = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
];

const fileEnvironment = envFiles.reduce((accumulator, filename) => {
  const filePath = path.join(mobileRoot, filename);

  return {
    ...accumulator,
    ...parseEnvFile(filePath),
  };
}, {});

const resolvedEnvironment = {
  ...fileEnvironment,
  ...process.env,
};

const missing = requiredEnvVars.filter((key) => {
  const value = resolvedEnvironment[key];

  return typeof value !== "string" || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "Missing required environment variables:",
      ...missing.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}

const appConfigPath = path.join(mobileRoot, "app.json");
const appConfig = JSON.parse(readFileSync(appConfigPath, "utf8"));

const missingFields = [];

if (!appConfig?.expo?.scheme) {
  missingFields.push("expo.scheme");
}

if (!appConfig?.expo?.ios?.bundleIdentifier) {
  missingFields.push("expo.ios.bundleIdentifier");
}

if (!appConfig?.expo?.android?.package) {
  missingFields.push("expo.android.package");
}

if (missingFields.length > 0) {
  console.error(
    [
      "Mobile release check failed.",
      "Missing required app metadata:",
      ...missingFields.map((key) => `- ${key}`),
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Mobile release check passed.");
