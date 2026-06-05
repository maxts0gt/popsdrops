#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildEasCliEnvironment,
  EAS_CLI_PACKAGE,
} from "./eas-secrets-check.mjs";
import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";
import { readStoreReleaseVisibilityStatus } from "./store-release-visibility-check.mjs";

const VALID_PLATFORMS = new Set(["ios", "android"]);

export function parseSubmitPlatform(args) {
  const platformFlagIndex = args.indexOf("--platform");
  const platform =
    platformFlagIndex === -1
      ? args
          .find((arg) => arg.startsWith("--platform="))
          ?.slice("--platform=".length)
      : args[platformFlagIndex + 1];

  if (!VALID_PLATFORMS.has(platform)) {
    throw new Error("Pass --platform ios or --platform android.");
  }

  return platform;
}

export function buildEasSubmitArgs(platform) {
  return [
    "--yes",
    EAS_CLI_PACKAGE,
    "submit",
    "--platform",
    platform,
    "--profile",
    "production",
    "--latest",
    "--non-interactive",
    "--wait",
  ];
}

export function buildProductionSubmitOutcome({
  submitStatus,
  visibilityReport,
}) {
  if (visibilityReport.ok) {
    return {
      ok: true,
      message:
        submitStatus === 0
          ? "EAS submit passed and store visibility is proven."
          : "EAS submit exited nonzero, but store visibility passed for the production builds.",
      summaries: visibilityReport.summaries,
      issues: [],
      nextSteps: [],
    };
  }

  return {
    ok: false,
    message:
      submitStatus === 0
        ? "EAS submit passed, but store visibility is not proven yet."
        : "EAS submit failed and store visibility is not proven.",
    summaries: visibilityReport.summaries,
    issues: visibilityReport.issues,
    nextSteps: visibilityReport.nextSteps,
  };
}

export function formatProductionSubmitOutcome(outcome) {
  return [
    outcome.ok ? "Production store submit check passed." : "Production store submit check blocked.",
    outcome.message,
    ...outcome.summaries.map((summary) => `- ${summary}`),
    ...outcome.issues.map((issue) => `- ${issue}`),
    ...(outcome.nextSteps.length > 0
      ? ["", "Next steps:", ...outcome.nextSteps.map((step) => `- ${step}`)]
      : []),
  ].join("\n");
}

function runEasSubmit({ mobileRoot, platform, environment }) {
  return spawnSync("npx", buildEasSubmitArgs(platform), {
    cwd: mobileRoot,
    encoding: "utf8",
    env: {
      ...buildEasCliEnvironment(mobileRoot, environment),
      EXPO_PUBLIC_ENABLE_EAS_UPDATES: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const platform = parseSubmitPlatform(process.argv.slice(2));
  const environment = {
    ...process.env,
    ...readLocalSubmitEnvironment(mobileRoot),
  };
  const submit = runEasSubmit({ mobileRoot, platform, environment });

  if (submit.stdout) {
    process.stdout.write(submit.stdout);
  }

  if (submit.stderr) {
    process.stderr.write(submit.stderr);
  }

  const visibilityReport = await readStoreReleaseVisibilityStatus({
    mobileRoot,
    environment,
  });
  const outcome = buildProductionSubmitOutcome({
    platform,
    submitStatus: submit.status ?? 1,
    visibilityReport,
  });
  const output = formatProductionSubmitOutcome(outcome);

  if (!outcome.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
