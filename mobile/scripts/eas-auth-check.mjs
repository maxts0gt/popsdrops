import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";

export const EAS_CLI_PACKAGE = "eas-cli@19.0.8";

export function buildEasAuthEnvironment(mobileRoot, environment = process.env) {
  return {
    ...environment,
    ...readLocalSubmitEnvironment(mobileRoot, environment),
  };
}

export function formatEasAuthFailure(result, environment = process.env) {
  const tokenHint = environment.EXPO_TOKEN
    ? "EXPO_TOKEN is set, but EAS CLI could not authenticate it."
    : "EXPO_TOKEN is not set.";
  const easOutput = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();

  return [
    "EAS authentication check failed.",
    "Not logged in to Expo.",
    tokenHint,
    "Run `eas login` locally or set `EXPO_TOKEN` before running preview builds.",
    easOutput ? `EAS output: ${easOutput}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const environment = buildEasAuthEnvironment(mobileRoot);
  const result = spawnSync("npx", ["--yes", EAS_CLI_PACKAGE, "whoami"], {
    cwd: mobileRoot,
    encoding: "utf8",
    env: environment,
  });

  if (result.status === 0) {
    console.log(`EAS authentication check passed: ${result.stdout.trim()}`);
    process.exit(0);
  }

  console.error(formatEasAuthFailure(result, environment));
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
