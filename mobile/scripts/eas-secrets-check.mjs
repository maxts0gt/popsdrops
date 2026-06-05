import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";

export const EAS_CLI_PACKAGE = "eas-cli@19.0.8";
export const REQUIRED_SECRET_NAMES = [
  "APPLE_ASC_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT",
];

function buildEasFileSecretCommand({ name, valueFile }) {
  return `eas env:create production --name ${name} --type file --visibility secret --value ${valueFile}`;
}

export function parseEasSecretNames(output) {
  const trimmed = String(output ?? "").trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return parsed
        .map((secret) => secret?.name)
        .filter((name) => typeof name === "string");
    }
  } catch {
    // Fall through to table parsing for older or changed EAS CLI output.
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => {
      const normalized = line.trim();
      const longFormatMatch = normalized.match(/^Name\s+([A-Z0-9_]+)$/);

      return longFormatMatch?.[1] ?? normalized.split(/\s+/)[0];
    })
    .filter((name) => REQUIRED_SECRET_NAMES.includes(name));
}

export function buildEasSecretsReport(secretNames) {
  const present = REQUIRED_SECRET_NAMES.filter((name) =>
    secretNames.includes(name),
  );
  const missing = REQUIRED_SECRET_NAMES.filter(
    (name) => !secretNames.includes(name),
  );

  return {
    ok: missing.length === 0,
    missing,
    present,
  };
}

export function formatEasSecretsReport(report) {
  if (report.ok) {
    return "EAS production submit secrets are ready.";
  }

  return [
    "EAS production submit secrets check failed.",
    "Missing EAS file secrets:",
    ...report.missing.map((name) => `- ${name}`),
    "",
    "Create them before production submit:",
    `- ${buildEasFileSecretCommand({
      name: "APPLE_ASC_API_KEY",
      valueFile: "AuthKey_XXXXXXXXXX.p8",
    })}`,
    `- ${buildEasFileSecretCommand({
      name: "GOOGLE_SERVICE_ACCOUNT",
      valueFile: "play-console-service-account.local.json",
    })}`,
  ].join("\n");
}

export function buildEasCliEnvironment(mobileRoot, environment = process.env) {
  return {
    ...environment,
    EAS_BUILD: environment.EAS_BUILD ?? "true",
    EXPO_PUBLIC_ENABLE_EAS_UPDATES:
      environment.EXPO_PUBLIC_ENABLE_EAS_UPDATES ?? "1",
    ...readLocalSubmitEnvironment(mobileRoot, environment),
  };
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const result = spawnSync(
    "npx",
    [
      "--yes",
      EAS_CLI_PACKAGE,
      "env:list",
      "production",
      "--format",
      "long",
    ],
    {
      cwd: mobileRoot,
      encoding: "utf8",
      env: buildEasCliEnvironment(mobileRoot),
    },
  );

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();

    console.error(
      [
        "EAS production submit secrets check failed.",
        "Could not read EAS secrets.",
        "Run `eas login` locally or set `EXPO_TOKEN`, then rerun npm --prefix mobile run release:eas-secrets:check.",
        output ? `EAS output: ${output}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    process.exit(1);
  }

  const report = buildEasSecretsReport(parseEasSecretNames(result.stdout));
  const output = formatEasSecretsReport(report);

  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
