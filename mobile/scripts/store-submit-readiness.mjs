import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  readLocalSubmitEnvironment,
  validateProductionSubmitProfile,
} from "./production-submit-check.mjs";

const APPLE_SECRET_NAME = "APPLE_ASC_API_KEY";
const GOOGLE_SECRET_NAME = "GOOGLE_SERVICE_ACCOUNT";

const issueStepMap = [
  {
    match: "submit.production.ios.ascAppId",
    step:
      "Replace submit.production.ios.ascAppId in mobile/eas.json, or set EXPO_ASC_APP_ID locally for a one-off submit.",
  },
  {
    match: "submit.production.ios.ascApiKeyPath",
    step:
      "Create the APPLE_ASC_API_KEY EAS file secret from the App Store Connect .p8 key.",
  },
  {
    match: "submit.production.ios.ascApiKeyId",
    step:
      "Replace submit.production.ios.ascApiKeyId in mobile/eas.json, or set EXPO_ASC_API_KEY_ID locally for a one-off submit.",
  },
  {
    match: "submit.production.ios.ascApiKeyIssuerId",
    step:
      "Replace submit.production.ios.ascApiKeyIssuerId in mobile/eas.json, or set EXPO_ASC_API_KEY_ISSUER_ID locally for a one-off submit.",
  },
  {
    match: "submit.production.android.serviceAccountKeyPath",
    step:
      "Place the Play Console service account JSON at mobile/play-console-service-account.local.json for local EAS submit.",
  },
];

function unique(values) {
  return [...new Set(values)];
}

function buildEasFileSecretCommand({ name, valueFile }) {
  return `eas env:create production --name ${name} --type file --visibility secret --value ${valueFile}`;
}

export function buildStoreSubmitReadinessReport({
  easConfig,
  mobileRoot,
  environment = process.env,
}) {
  const issues = validateProductionSubmitProfile(
    easConfig,
    mobileRoot,
    environment,
  );
  const issueSteps = issues.flatMap((issue) =>
    issueStepMap
      .filter(({ match }) => issue.includes(match))
      .map(({ step }) => step),
  );
  const nextSteps = unique([
    ...issueSteps,
    ...(issues.length > 0
      ? [
          `Create the ${APPLE_SECRET_NAME} EAS file secret from the App Store Connect .p8 key.`,
          `Create the ${GOOGLE_SECRET_NAME} EAS file secret from the Play Console service account JSON.`,
        ]
      : []),
    "Run npm --prefix mobile run release:submit:check before any store submission.",
  ]);

  return {
    ok: issues.length === 0,
    issues,
    nextSteps,
    secretCommands: [
      buildEasFileSecretCommand({
        name: APPLE_SECRET_NAME,
        valueFile: "AuthKey_XXXXXXXXXX.p8",
      }),
      buildEasFileSecretCommand({
        name: GOOGLE_SECRET_NAME,
        valueFile: "play-console-service-account.local.json",
      }),
    ],
  };
}

export function formatStoreSubmitReadinessReport(report) {
  const lines = [
    report.ok
      ? "Store submit identity is ready."
      : "Store submit identity check failed.",
  ];

  if (report.issues.length > 0) {
    lines.push("", "Missing or invalid values:");
    lines.push(...report.issues.map((issue) => `- ${issue}`));
  }

  lines.push("", "Next steps:");
  lines.push(...report.nextSteps.map((step) => `- ${step}`));
  lines.push("", "Safe EAS secret command templates:");
  lines.push(...report.secretCommands.map((command) => `- ${command}`));

  return lines.join("\n");
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const easConfig = JSON.parse(
    readFileSync(path.join(mobileRoot, "eas.json"), "utf8"),
  );
  const report = buildStoreSubmitReadinessReport({
    easConfig,
    mobileRoot,
    environment: readLocalSubmitEnvironment(mobileRoot),
  });
  const output = formatStoreSubmitReadinessReport(report);

  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
