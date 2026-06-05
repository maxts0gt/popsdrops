#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProductionBuildArtifactStatus } from "./production-build-artifact-check.mjs";
import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";
import { readPngSize } from "./store-screenshot-artifact-check.mjs";

const MANIFEST_FILENAME = "store-install-evidence-manifest.local.json";
const INSTALL_REQUIREMENTS = [
  {
    platform: "ios",
    label: "iOS",
    source: "testflight",
    sourceLabel: "TestFlight",
    minWidth: 1170,
    minHeight: 2532,
  },
  {
    platform: "android",
    label: "Android",
    source: "play-internal",
    sourceLabel: "Play internal",
    minWidth: 1080,
    minHeight: 1920,
  },
];

function normalizePlatform(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "ios") {
    return "ios";
  }

  if (normalized === "android") {
    return "android";
  }

  return normalized;
}

function resolveOutputDirectory(outputDirectory, repoRoot) {
  if (typeof outputDirectory !== "string" || outputDirectory.trim().length === 0) {
    return null;
  }

  return path.isAbsolute(outputDirectory)
    ? outputDirectory
    : path.resolve(repoRoot, outputDirectory);
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  const timestamp = Date.parse(value);

  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function expectedBuildForPlatform(expectedArtifacts, platform) {
  const artifact = expectedArtifacts.find(
    (candidate) => normalizePlatform(candidate?.platform) === platform,
  );

  return artifact?.appBuildVersion;
}

function requiredNextSteps(platforms) {
  const nextSteps = [];

  if (platforms.has("ios")) {
    nextSteps.push(
      "Install the iOS build from TestFlight on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
    );
  }

  if (platforms.has("android")) {
    nextSteps.push(
      "Install the Android build from Play internal testing on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
    );
  }

  nextSteps.push(
    "Rerun npm --prefix mobile run release:store-install-evidence:check.",
  );

  return nextSteps;
}

export function buildStoreInstallEvidenceReport({
  manifest,
  repoRoot = process.cwd(),
  expectedArtifacts = [],
  minFileBytes = 20000,
} = {}) {
  const issues = [];
  const summaries = [];
  const blockedPlatforms = new Set();
  const outputDirectory = resolveOutputDirectory(
    manifest?.outputDirectory,
    repoRoot,
  );

  if (!outputDirectory) {
    issues.push("Store install evidence output directory is missing.");
    for (const requirement of INSTALL_REQUIREMENTS) {
      blockedPlatforms.add(requirement.platform);
    }
  }

  if (!isIsoTimestamp(manifest?.capturedAt)) {
    issues.push("Install evidence capturedAt must be an ISO timestamp.");
  }

  if (!Array.isArray(manifest?.evidence)) {
    issues.push("Store install evidence manifest must include evidence.");
    for (const requirement of INSTALL_REQUIREMENTS) {
      blockedPlatforms.add(requirement.platform);
    }
  }

  for (const requirement of INSTALL_REQUIREMENTS) {
    const evidence = (manifest?.evidence ?? []).find(
      (candidate) =>
        normalizePlatform(candidate?.platform) === requirement.platform,
    );

    if (!evidence) {
      issues.push(
        `${requirement.label}: Missing ${requirement.sourceLabel} install evidence.`,
      );
      blockedPlatforms.add(requirement.platform);
      continue;
    }

    if (evidence.source !== requirement.source) {
      issues.push(
        `${requirement.label}: Install evidence source must be ${requirement.source}.`,
      );
      blockedPlatforms.add(requirement.platform);
    }

    const expectedBuild = expectedBuildForPlatform(
      expectedArtifacts,
      requirement.platform,
    );

    if (
      expectedBuild &&
      String(evidence.appBuildVersion ?? "") !== String(expectedBuild)
    ) {
      issues.push(
        `${requirement.label}: Install evidence must match submitted build ${expectedBuild}.`,
      );
      blockedPlatforms.add(requirement.platform);
    }

    if (!outputDirectory) {
      continue;
    }

    const filename = evidence.file;

    if (typeof filename !== "string" || filename.trim().length === 0) {
      issues.push(`${requirement.label}: Store install screenshot file is missing.`);
      blockedPlatforms.add(requirement.platform);
      continue;
    }

    const filePath = path.resolve(outputDirectory, filename);

    if (!existsSync(filePath)) {
      issues.push(
        `${requirement.label}: Store install screenshot is missing: ${filename}.`,
      );
      blockedPlatforms.add(requirement.platform);
      continue;
    }

    let dimensions;

    try {
      dimensions = readPngSize(filePath);
    } catch {
      issues.push(
        `${requirement.label}: Store install screenshot must be a valid PNG.`,
      );
      blockedPlatforms.add(requirement.platform);
      continue;
    }

    if (dimensions.height <= dimensions.width) {
      issues.push(`${requirement.label}: Store install screenshot must be portrait.`);
      blockedPlatforms.add(requirement.platform);
    }

    if (
      dimensions.width < requirement.minWidth ||
      dimensions.height < requirement.minHeight
    ) {
      issues.push(
        `${requirement.label}: Store install screenshot must be at least ${requirement.minWidth}x${requirement.minHeight}.`,
      );
      blockedPlatforms.add(requirement.platform);
    }

    if (statSync(filePath).size < minFileBytes) {
      issues.push(
        `${requirement.label}: Store install screenshot file is too small to prove a real device install.`,
      );
      blockedPlatforms.add(requirement.platform);
    }

    if (typeof evidence.tester !== "string" || evidence.tester.trim().length === 0) {
      issues.push(`${requirement.label}: Store install tester label is required.`);
      blockedPlatforms.add(requirement.platform);
    }

    if (!blockedPlatforms.has(requirement.platform)) {
      summaries.push(
        `${requirement.label}: ${requirement.sourceLabel} install evidence matches build ${evidence.appBuildVersion}.`,
      );
    }
  }

  return {
    ok: issues.length === 0,
    summaries,
    issues,
    nextSteps: issues.length === 0 ? [] : requiredNextSteps(blockedPlatforms),
  };
}

export function formatStoreInstallEvidenceReport(report) {
  if (report.ok) {
    return [
      "Store install evidence check passed.",
      ...report.summaries.map((summary) => `- ${summary}`),
    ].join("\n");
  }

  return [
    "Store install evidence check failed.",
    ...report.issues.map((issue) => `- ${issue}`),
    "",
    "Next steps:",
    ...report.nextSteps.map((step) => `- ${step}`),
  ].join("\n");
}

export function readStoreInstallEvidenceStatus({
  mobileRoot,
  environment = process.env,
} = {}) {
  const repoRoot = path.resolve(mobileRoot, "..");
  const manifestPath = path.join(mobileRoot, MANIFEST_FILENAME);

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      summaries: [],
      issues: [
        "Store install evidence manifest is missing: mobile/store-install-evidence-manifest.local.json.",
      ],
      nextSteps: requiredNextSteps(new Set(["ios", "android"])),
    };
  }

  const localEnvironment = {
    ...process.env,
    ...readLocalSubmitEnvironment(mobileRoot, environment),
    ...environment,
  };
  const artifactReport = readProductionBuildArtifactStatus(
    mobileRoot,
    localEnvironment,
  );

  if (!artifactReport.ok) {
    return {
      ok: false,
      summaries: [],
      issues: artifactReport.issues,
      nextSteps: artifactReport.nextSteps,
    };
  }

  return buildStoreInstallEvidenceReport({
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
    repoRoot,
    expectedArtifacts: artifactReport.artifacts,
  });
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const report = readStoreInstallEvidenceStatus({ mobileRoot });
  const output = formatStoreInstallEvidenceReport(report);

  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
