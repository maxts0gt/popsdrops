#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readPngSize } from "./store-screenshot-artifact-check.mjs";

const DEFAULT_OUTPUT_DIRECTORY = "output/mobile-store-install-evidence";
const DEFAULT_MANIFEST_PATH = "store-install-evidence-manifest.local.json";
const MIN_SCREENSHOT_BYTES = 20000;
const SCREENSHOT_REQUIREMENTS = [
  {
    pathKey: "iosScreenshot",
    buildKey: "iosBuildVersion",
    testerKey: "iosTester",
    label: "iOS TestFlight",
    minWidth: 1170,
    minHeight: 2532,
  },
  {
    pathKey: "androidScreenshot",
    buildKey: "androidBuildVersion",
    testerKey: "androidTester",
    label: "Android Play internal",
    minWidth: 1080,
    minHeight: 1920,
  },
];

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith("--")) {
      continue;
    }

    const key = item.slice(2);
    const value = argv[index + 1];

    if (value && !value.startsWith("--")) {
      args[key] = value;
      index += 1;
    } else {
      args[key] = "true";
    }
  }

  return args;
}

function resolvePath(baseDirectory, value) {
  return path.isAbsolute(value) ? value : path.resolve(baseDirectory, value);
}

function buildManifest({
  outputDirectory,
  capturedAt,
  iosBuildVersion,
  androidBuildVersion,
  iosTester,
  androidTester,
}) {
  return {
    outputDirectory,
    capturedAt,
    evidence: [
      {
        platform: "ios",
        source: "testflight",
        appBuildVersion: iosBuildVersion,
        file: "ios-testflight.png",
        tester: iosTester,
      },
      {
        platform: "android",
        source: "play-internal",
        appBuildVersion: androidBuildVersion,
        file: "android-play-internal.png",
        tester: androidTester,
      },
    ],
  };
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  const timestamp = Date.parse(value);

  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

export function createStoreInstallEvidenceManifest({
  iosScreenshot,
  androidScreenshot,
  outputDirectory,
  manifestPath,
  capturedAt = new Date().toISOString(),
  iosBuildVersion,
  androidBuildVersion,
  iosTester,
  androidTester,
}) {
  const issues = [];
  const screenshots = {
    iosScreenshot,
    androidScreenshot,
  };
  const buildVersions = {
    iosBuildVersion,
    androidBuildVersion,
  };
  const testers = {
    iosTester,
    androidTester,
  };

  if (!isIsoTimestamp(capturedAt)) {
    issues.push("Install evidence capturedAt must be an ISO timestamp.");
  }

  for (const requirement of SCREENSHOT_REQUIREMENTS) {
    const screenshotPath = screenshots[requirement.pathKey];
    const buildVersion = buildVersions[requirement.buildKey];
    const tester = testers[requirement.testerKey];

    if (typeof buildVersion !== "string" || buildVersion.trim().length === 0) {
      issues.push(`${requirement.label} build version is required.`);
    }

    if (typeof tester !== "string" || tester.trim().length === 0) {
      issues.push(`${requirement.label} tester label is required.`);
    }

    if (!existsSync(screenshotPath)) {
      issues.push(`${requirement.label} screenshot is missing: ${screenshotPath}.`);
      continue;
    }

    let dimensions;

    try {
      dimensions = readPngSize(screenshotPath);
    } catch {
      issues.push(`${requirement.label} screenshot must be a valid PNG.`);
      continue;
    }

    if (dimensions.height <= dimensions.width) {
      issues.push(`${requirement.label} screenshot must be portrait.`);
    }

    if (
      dimensions.width < requirement.minWidth ||
      dimensions.height < requirement.minHeight
    ) {
      issues.push(
        `${requirement.label} screenshot must be at least ${requirement.minWidth}x${requirement.minHeight}.`,
      );
    }

    if (statSync(screenshotPath).size < MIN_SCREENSHOT_BYTES) {
      issues.push(
        `${requirement.label} screenshot file is too small to prove a real device install.`,
      );
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  mkdirSync(outputDirectory, { recursive: true });

  const iosTarget = path.join(outputDirectory, "ios-testflight.png");
  const androidTarget = path.join(outputDirectory, "android-play-internal.png");

  copyFileSync(iosScreenshot, iosTarget);
  copyFileSync(androidScreenshot, androidTarget);
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      buildManifest({
        outputDirectory,
        capturedAt,
        iosBuildVersion,
        androidBuildVersion,
        iosTester,
        androidTester,
      }),
      null,
      2,
    )}\n`,
  );

  return {
    ok: true,
    manifestPath,
    outputDirectory,
    files: [iosTarget, androidTarget],
  };
}

function requiredArg(args, key) {
  const value = args[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required argument: --${key}`);
  }

  return value;
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const repoRoot = path.resolve(mobileRoot, "..");
  const args = parseArgs(process.argv.slice(2));
  const outputDirectory = resolvePath(
    repoRoot,
    args.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY,
  );
  const manifestPath = resolvePath(
    mobileRoot,
    args.manifestPath ?? DEFAULT_MANIFEST_PATH,
  );
  const result = createStoreInstallEvidenceManifest({
    iosScreenshot: resolvePath(process.cwd(), requiredArg(args, "ios")),
    androidScreenshot: resolvePath(process.cwd(), requiredArg(args, "android")),
    outputDirectory,
    manifestPath,
    capturedAt: args.capturedAt ?? new Date().toISOString(),
    iosBuildVersion: requiredArg(args, "ios-build"),
    androidBuildVersion: requiredArg(args, "android-build"),
    iosTester: requiredArg(args, "ios-tester"),
    androidTester: requiredArg(args, "android-tester"),
  });

  if (!result.ok) {
    console.error(
      [
        "Store install evidence manifest creation failed.",
        ...result.issues.map((issue) => `- ${issue}`),
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(
    [
      "Store install evidence manifest created.",
      `- Manifest: ${path.relative(mobileRoot, result.manifestPath)}`,
      `- Evidence directory: ${path.relative(repoRoot, result.outputDirectory)}`,
      ...result.files.map((file) => `- ${path.relative(repoRoot, file)}`),
    ].join("\n"),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
