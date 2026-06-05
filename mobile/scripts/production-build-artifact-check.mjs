import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildEasCliEnvironment,
  EAS_CLI_PACKAGE,
} from "./eas-secrets-check.mjs";

const REQUIRED_PRODUCTION_ARTIFACTS = [
  {
    label: "iOS",
    platform: "IOS",
    extension: ".ipa",
    extensionIssue: "iOS: Production artifact must be an .ipa archive for TestFlight.",
  },
  {
    label: "Android",
    platform: "ANDROID",
    extension: ".aab",
    extensionIssue:
      "Android: Production artifact must be an .aab archive for Play internal testing.",
  },
];

function normalizeBuildValue(value) {
  return String(value ?? "").trim().toUpperCase();
}

function artifactUrlForBuild(build) {
  return build?.artifacts?.buildUrl ?? build?.artifacts?.applicationArchiveUrl ?? "";
}

function urlPathname(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return String(value ?? "").split("?")[0];
  }
}

function isFinishedProductionStoreBuild(build, platform) {
  return (
    normalizeBuildValue(build?.platform) === platform &&
    normalizeBuildValue(build?.status) === "FINISHED" &&
    normalizeBuildValue(build?.distribution) === "STORE" &&
    build?.buildProfile === "production" &&
    build?.channel === "production"
  );
}

function newestFirst(left, right) {
  const leftTime = Date.parse(left?.completedAt ?? left?.createdAt ?? "");
  const rightTime = Date.parse(right?.completedAt ?? right?.createdAt ?? "");

  return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
}

export function parseEasBuildListOutput(output) {
  const trimmed = String(output ?? "").trim();

  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed);

  return Array.isArray(parsed) ? parsed : [];
}

export function buildProductionBuildArtifactReport(builds) {
  const issues = [];
  const artifacts = [];

  for (const requirement of REQUIRED_PRODUCTION_ARTIFACTS) {
    const build = builds
      .filter((candidate) =>
        isFinishedProductionStoreBuild(candidate, requirement.platform),
      )
      .sort(newestFirst)[0];

    if (!build) {
      issues.push(
        `${requirement.label}: No finished production store build artifact found.`,
      );
      continue;
    }

    if (requirement.platform === "IOS" && build.isForIosSimulator) {
      issues.push("iOS: Production store build must not be an iOS simulator build.");
      continue;
    }

    const artifactUrl = artifactUrlForBuild(build);

    if (!artifactUrl) {
      issues.push(
        `${requirement.label}: Finished production build is missing an artifact URL.`,
      );
      continue;
    }

    if (!urlPathname(artifactUrl).endsWith(requirement.extension)) {
      issues.push(requirement.extensionIssue);
      continue;
    }

    artifacts.push({
      platform: requirement.label,
      buildId: build.id,
      artifactUrl,
      appBuildVersion: build.appBuildVersion,
      completedAt: build.completedAt,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    artifacts,
    nextSteps:
      issues.length === 0
        ? []
        : [
            "Run npm --prefix mobile run build:production:ios and npm --prefix mobile run build:production:android, then rerun npm --prefix mobile run release:production-artifacts:check.",
          ],
  };
}

export function readProductionBuildArtifactStatus(
  mobileRoot,
  environment = process.env,
) {
  const result = spawnSync(
    "npx",
    [
      "--yes",
      EAS_CLI_PACKAGE,
      "build:list",
      "--platform",
      "all",
      "--status",
      "finished",
      "--distribution",
      "store",
      "--build-profile",
      "production",
      "--channel",
      "production",
      "--limit",
      "10",
      "--json",
      "--non-interactive",
    ],
    {
      cwd: mobileRoot,
      encoding: "utf8",
      env: buildEasCliEnvironment(mobileRoot, environment),
    },
  );

  if (result.status !== 0) {
    return {
      ok: false,
      issues: [
        "Could not read EAS production build artifacts. Log in with eas login or set EXPO_TOKEN.",
      ],
      artifacts: [],
      nextSteps: [
        "Authenticate EAS, then rerun npm --prefix mobile run release:production-artifacts:check.",
      ],
    };
  }

  try {
    return buildProductionBuildArtifactReport(
      parseEasBuildListOutput(result.stdout),
    );
  } catch {
    return {
      ok: false,
      issues: ["EAS production build artifact output was not valid JSON."],
      artifacts: [],
      nextSteps: [
        "Rerun npm --prefix mobile run release:production-artifacts:check.",
      ],
    };
  }
}

export function formatProductionBuildArtifactReport(report) {
  if (report.ok) {
    return [
      "EAS production build artifacts are ready.",
      ...report.artifacts.map(
        (artifact) =>
          `- ${artifact.platform}: ${artifact.buildId} (${artifact.appBuildVersion})`,
      ),
    ].join("\n");
  }

  return [
    "EAS production build artifact check failed.",
    ...report.issues.map((issue) => `- ${issue}`),
    "",
    "Next steps:",
    ...report.nextSteps.map((step) => `- ${step}`),
  ].join("\n");
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const report = readProductionBuildArtifactStatus(mobileRoot);
  const output = formatProductionBuildArtifactReport(report);

  if (!report.ok) {
    console.error(output);
    process.exit(1);
  }

  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
