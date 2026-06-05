#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";
import { readStoreInstallDeviceReadinessStatus } from "./store-install-device-readiness-check.mjs";
import { readStoreInstallEvidenceStatus } from "./store-install-evidence-check.mjs";
import { readStoreReleaseVisibilityStatus } from "./store-release-visibility-check.mjs";

export function buildStorePostSubmitReport({
  visibilityReport,
  evidenceReport,
  deviceReport,
}) {
  if (!visibilityReport.ok) {
    return {
      ok: false,
      summaries: visibilityReport.summaries,
      issues: visibilityReport.issues,
      nextSteps: visibilityReport.nextSteps,
    };
  }

  if (evidenceReport.ok) {
    return {
      ok: true,
      summaries: [...visibilityReport.summaries, ...evidenceReport.summaries],
      issues: [],
      nextSteps: [],
    };
  }

  return {
    ok: false,
    summaries: [...visibilityReport.summaries, ...evidenceReport.summaries],
    issues: [...evidenceReport.issues, ...deviceReport.issues],
    nextSteps: [...evidenceReport.nextSteps, ...deviceReport.nextSteps],
  };
}

export function formatStorePostSubmitReport(report) {
  if (report.ok) {
    return [
      "Store post-submit check passed.",
      ...report.summaries.map((summary) => `- ${summary}`),
    ].join("\n");
  }

  return [
    "Store post-submit check blocked.",
    ...report.summaries.map((summary) => `- ${summary}`),
    ...report.issues.map((issue) => `- ${issue}`),
    "",
    "Next steps:",
    ...report.nextSteps.map((step) => `- ${step}`),
  ].join("\n");
}

async function readStorePostSubmitStatus(mobileRoot) {
  const localEnvironment = readLocalSubmitEnvironment(mobileRoot);
  const visibilityReport = await readStoreReleaseVisibilityStatus({
    mobileRoot,
    environment: {
      ...process.env,
      ...localEnvironment,
    },
  });

  if (!visibilityReport.ok) {
    return buildStorePostSubmitReport({
      visibilityReport,
      evidenceReport: {
        ok: false,
        summaries: [],
        issues: [],
        nextSteps: [],
      },
      deviceReport: {
        ok: false,
        summaries: [],
        issues: [],
        nextSteps: [],
      },
    });
  }

  const evidenceReport = readStoreInstallEvidenceStatus({
    mobileRoot,
    environment: {
      ...process.env,
      ...localEnvironment,
    },
  });
  const deviceReport = evidenceReport.ok
    ? {
        ok: true,
        summaries: [],
        issues: [],
        nextSteps: [],
      }
    : readStoreInstallDeviceReadinessStatus();

  return buildStorePostSubmitReport({
    visibilityReport,
    evidenceReport,
    deviceReport,
  });
}

async function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const report = await readStorePostSubmitStatus(mobileRoot);
  const output = formatStorePostSubmitReport(report);

  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
