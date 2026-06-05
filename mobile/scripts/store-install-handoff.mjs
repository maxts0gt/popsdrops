#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProductionBuildArtifactStatus } from "./production-build-artifact-check.mjs";
import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";
import { readStoreInstallDeviceReadinessStatus } from "./store-install-device-readiness-check.mjs";

const DEFAULT_IOS_SCREENSHOT = "$HOME/Downloads/popsdrops-ios-testflight.png";
const DEFAULT_ANDROID_SCREENSHOT = "$HOME/Downloads/popsdrops-android-play-internal.png";

function artifactVersion(artifactReport, platform) {
  return artifactReport.artifacts?.find((artifact) => artifact.platform === platform)
    ?.appBuildVersion;
}

export function buildStoreInstallHandoff({
  artifactReport,
  deviceReport,
  iosScreenshotPath = DEFAULT_IOS_SCREENSHOT,
  androidScreenshotPath = DEFAULT_ANDROID_SCREENSHOT,
}) {
  const lines = [
    "Mobile store install smoke handoff",
    "",
    `Build artifacts: ${artifactReport.ok ? "ready" : "blocked"}`,
  ];

  if (!artifactReport.ok) {
    lines.push(
      ...artifactReport.issues.map((issue) => `- ${issue}`),
      "",
      "Next steps:",
      ...artifactReport.nextSteps.map((step) => `- ${step}`),
    );

    return `${lines.join("\n")}\n`;
  }

  const iosBuild = artifactVersion(artifactReport, "iOS");
  const androidBuild = artifactVersion(artifactReport, "Android");

  lines.push(
    `- iOS build: ${iosBuild}`,
    `- Android version code: ${androidBuild}`,
    "",
    `Device readiness: ${deviceReport.ok ? "ready" : "blocked"}`,
    ...deviceReport.summaries.map((summary) => `- ${summary}`),
    ...deviceReport.issues.map((issue) => `- ${issue}`),
  );

  if (deviceReport.nextSteps.length > 0) {
    lines.push("", "Device next steps:", ...deviceReport.nextSteps.map((step) => `- ${step}`));
  }

  lines.push(
    "",
    "Real-device install proof:",
    "1. Install the iOS build from TestFlight on the tester iPhone.",
    "2. Install the Android build from Play internal testing on the tester Android device.",
    "3. Open PopsDrops to a creator screen that proves the store-installed app launches.",
    "   - Open a signed-in creator screen, such as Campaign Room or Home.",
    "   - Screenshots must be real-device portrait PNGs, not simulator, browser, or store-console screenshots.",
    "   - iOS minimum: 1170x2532. Android minimum: 1080x1920.",
    "4. Save the two screenshots, then run:",
    "",
    `npm --prefix mobile run release:store-install-evidence:create -- --ios ${iosScreenshotPath} --android ${androidScreenshotPath} --ios-build ${iosBuild} --android-build ${androidBuild} --ios-tester "redacted Apple tester" --android-tester "redacted Google tester"`,
    "",
    "5. Validate the evidence manifest:",
    "",
    "npm --prefix mobile run release:store-install-evidence:check",
    "",
    "6. Close the combined post-submit gate:",
    "",
    "npm --prefix mobile run release:post-submit:check",
  );

  return `${lines.join("\n")}\n`;
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const localEnvironment = readLocalSubmitEnvironment(mobileRoot);
  const artifactReport = readProductionBuildArtifactStatus(mobileRoot, {
    ...process.env,
    ...localEnvironment,
  });
  const deviceReport = readStoreInstallDeviceReadinessStatus();

  process.stdout.write(
    buildStoreInstallHandoff({
      artifactReport,
      deviceReport,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
