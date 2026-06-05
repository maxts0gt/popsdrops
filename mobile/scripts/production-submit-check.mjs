import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLACEHOLDER_VALUES = new Set([
  "your-apple-id@example.com",
  "your-app-store-connect-app-id",
  "your-app-store-connect-api-key-id",
  "your-app-store-connect-issuer-id",
  "your-apple-team-id",
  "./google-service-account.json",
]);
const LOCAL_SUBMIT_ENV_KEYS = new Set([
  "EXPO_ASC_APP_ID",
  "EXPO_ASC_API_KEY_PATH",
  "EXPO_ASC_API_KEY_ID",
  "EXPO_ASC_API_KEY_ISSUER_ID",
  "EXPO_TOKEN",
]);

function isMissingOrPlaceholder(value) {
  return (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    PLACEHOLDER_VALUES.has(value.trim())
  );
}

function resolveCredentialValue(configValue, environmentValue) {
  return isMissingOrPlaceholder(configValue) ? environmentValue : configValue;
}

export function isEasSecretReference(value) {
  return /^@secret:[A-Z0-9_]+$/.test(String(value ?? "").trim());
}

export function readLocalSubmitEnvironment(mobileRoot, environment = process.env) {
  const localEnvPath = path.join(mobileRoot, ".env.local");
  const localSubmitEnvironment = {};

  if (existsSync(localEnvPath)) {
    for (const line of readFileSync(localEnvPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");

      if (LOCAL_SUBMIT_ENV_KEYS.has(key)) {
        localSubmitEnvironment[key] = valueParts.join("=").trim();
      }
    }
  }

  return {
    ...localSubmitEnvironment,
    ...Object.fromEntries(
      Object.entries(environment).filter(([key]) => LOCAL_SUBMIT_ENV_KEYS.has(key)),
    ),
  };
}

function validateLocalFile({
  mobileRoot,
  value,
  expectedExtension,
  missingMessage,
  invalidMessage,
  validateJson,
}) {
  if (isMissingOrPlaceholder(value)) {
    return [missingMessage];
  }

  if (isEasSecretReference(value)) {
    return [];
  }

  if (!String(value).endsWith(expectedExtension)) {
    return [invalidMessage];
  }

  const filePath = path.resolve(mobileRoot, value);

  if (!existsSync(filePath)) {
    return [`${invalidMessage.replace(/\.$/, "")}: ${value}`];
  }

  if (validateJson) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));

      if (
        typeof parsed.client_email !== "string" ||
        typeof parsed.private_key !== "string"
      ) {
        return [
          "Android service account JSON must include client_email and private_key.",
        ];
      }
    } catch {
      return ["Android service account file must be valid JSON."];
    }
  }

  return [];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value ?? ""),
  );
}

export function validateProductionSubmitProfile(
  easConfig,
  mobileRoot,
  environment = process.env,
) {
  const issues = [];
  const production = easConfig?.submit?.production;
  const ios = production?.ios;
  const android = production?.android;
  const iosCredentials = {
    ascAppId: resolveCredentialValue(ios?.ascAppId, environment.EXPO_ASC_APP_ID),
    ascApiKeyPath: resolveCredentialValue(
      ios?.ascApiKeyPath,
      environment.EXPO_ASC_API_KEY_PATH,
    ),
    ascApiKeyId: resolveCredentialValue(
      ios?.ascApiKeyId,
      environment.EXPO_ASC_API_KEY_ID,
    ),
    ascApiKeyIssuerId: resolveCredentialValue(
      ios?.ascApiKeyIssuerId,
      environment.EXPO_ASC_API_KEY_ISSUER_ID,
    ),
  };

  if (!production) {
    return ["EAS production submit profile is missing."];
  }

  if (ios?.appleId || ios?.appleTeamId) {
    issues.push(
      "submit.production.ios must use App Store Connect API key fields, not Apple ID submit credentials.",
    );
  }

  if (
    isMissingOrPlaceholder(iosCredentials.ascAppId) ||
    !/^\d+$/.test(String(iosCredentials.ascAppId ?? ""))
  ) {
    issues.push(
      "submit.production.ios.ascAppId must be the real numeric App Store Connect app ID.",
    );
  }

  issues.push(
    ...validateLocalFile({
      mobileRoot,
      value: iosCredentials.ascApiKeyPath,
      expectedExtension: ".p8",
      missingMessage:
        "submit.production.ios.ascApiKeyPath must be a local .p8 file path or an EAS file secret reference.",
      invalidMessage:
        "iOS App Store Connect API key file must be a local .p8 file or an EAS file secret reference.",
    }),
  );

  if (isMissingOrPlaceholder(iosCredentials.ascApiKeyId)) {
    issues.push(
      "submit.production.ios.ascApiKeyId must be the real App Store Connect API key ID.",
    );
  }

  if (
    isMissingOrPlaceholder(iosCredentials.ascApiKeyIssuerId) ||
    !isUuid(iosCredentials.ascApiKeyIssuerId)
  ) {
    issues.push(
      "submit.production.ios.ascApiKeyIssuerId must be the real App Store Connect issuer ID.",
    );
  }

  issues.push(
    ...validateLocalFile({
      mobileRoot,
      value: android?.serviceAccountKeyPath,
      expectedExtension: ".json",
      missingMessage:
        "submit.production.android.serviceAccountKeyPath must point to a real Play Console service account JSON file or EAS file secret reference.",
      invalidMessage: "Android service account file does not exist.",
      validateJson: true,
    }),
  );

  if (!["internal", "alpha", "beta", "production"].includes(android?.track)) {
    issues.push("submit.production.android.track must be internal, alpha, beta, or production.");
  }

  return issues;
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const easConfig = JSON.parse(readFileSync(path.join(mobileRoot, "eas.json"), "utf8"));
  const issues = validateProductionSubmitProfile(
    easConfig,
    mobileRoot,
    readLocalSubmitEnvironment(mobileRoot),
  );

  if (issues.length > 0) {
    console.error(
      [
        "Store submission check failed.",
        ...issues.map((issue) => `- ${issue}`),
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("Store submission check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
