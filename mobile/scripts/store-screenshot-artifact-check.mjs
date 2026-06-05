#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function resolveOutputDirectory(outputDirectory, repoRoot) {
  if (typeof outputDirectory !== "string" || outputDirectory.trim().length === 0) {
    return null;
  }

  return path.isAbsolute(outputDirectory)
    ? outputDirectory
    : path.resolve(repoRoot, outputDirectory);
}

export function readPngSize(filePath) {
  const buffer = readFileSync(filePath);

  if (buffer.length < 24) {
    throw new Error("PNG file is too small to contain an IHDR header.");
  }

  const hasPngSignature = PNG_SIGNATURE.every(
    (byte, index) => buffer[index] === byte,
  );

  if (!hasPngSignature || buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("File is not a valid PNG image.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function validateStoreScreenshotArtifacts(
  manifest,
  {
    repoRoot = process.cwd(),
    minWidth = 1080,
    minHeight = 1920,
    minFileBytes = 20000,
  } = {},
) {
  const issues = [];
  const outputDirectory = resolveOutputDirectory(
    manifest?.outputDirectory,
    repoRoot,
  );

  if (!outputDirectory) {
    return ["Screenshot manifest output directory is missing."];
  }

  if (!Array.isArray(manifest?.screens) || manifest.screens.length === 0) {
    return ["Screenshot manifest must include screens to validate."];
  }

  for (const screen of manifest.screens) {
    const screenId = screen?.id ?? "(missing id)";
    const filename = screen?.file;

    if (typeof filename !== "string" || filename.trim().length === 0) {
      issues.push(`Screen ${screenId} screenshot file is missing from the manifest.`);
      continue;
    }

    const filePath = path.resolve(outputDirectory, filename);

    if (!existsSync(filePath)) {
      issues.push(`Screen ${screenId} screenshot is missing: ${filename}.`);
      continue;
    }

    let dimensions;

    try {
      dimensions = readPngSize(filePath);
    } catch {
      issues.push(`Screen ${screenId} screenshot must be a valid PNG.`);
      continue;
    }

    if (dimensions.height <= dimensions.width) {
      issues.push(`Screen ${screenId} screenshot must be portrait.`);
    }

    if (dimensions.width < minWidth || dimensions.height < minHeight) {
      issues.push(
        `Screen ${screenId} screenshot must be at least ${minWidth}x${minHeight}.`,
      );
    }

    if (statSync(filePath).size < minFileBytes) {
      issues.push(
        `Screen ${screenId} screenshot file is too small to be a real store image.`,
      );
    }
  }

  return issues;
}

function readManifest(mobileRoot, filename) {
  return JSON.parse(readFileSync(path.join(mobileRoot, filename), "utf8"));
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const repoRoot = path.resolve(mobileRoot, "..");
  const checks = [
    {
      label: "Android",
      manifestFilename: "store-screenshot-manifest.json",
      minWidth: 1080,
      minHeight: 1920,
    },
    {
      label: "iOS",
      manifestFilename: "store-screenshot-manifest.ios.json",
      minWidth: 1170,
      minHeight: 2532,
    },
  ];
  const issues = checks.flatMap((check) => {
    const manifest = readManifest(mobileRoot, check.manifestFilename);

    return validateStoreScreenshotArtifacts(manifest, {
      repoRoot,
      minWidth: check.minWidth,
      minHeight: check.minHeight,
    }).map((issue) => `${check.label}: ${issue}`);
  });

  if (issues.length > 0) {
    console.error(
      [
        "Store screenshot artifact check failed.",
        ...issues.map((issue) => `- ${issue}`),
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("Store screenshot artifact check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
