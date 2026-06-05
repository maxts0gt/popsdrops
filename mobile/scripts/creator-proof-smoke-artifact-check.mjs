#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateCreatorProofSmokeArtifacts } from "./release-status.mjs";

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDirectory, "..", "..");
  const issues = validateCreatorProofSmokeArtifacts({ repoRoot });

  if (issues.length > 0) {
    console.error(
      [
        "Creator proof smoke artifact check failed.",
        ...issues.map((issue) => `- ${issue}`),
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("Creator proof smoke artifact check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
