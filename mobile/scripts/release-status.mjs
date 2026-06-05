import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildStoreSubmitReadinessReport } from "./store-submit-readiness.mjs";
import {
  readPngSize,
  validateStoreScreenshotArtifacts,
} from "./store-screenshot-artifact-check.mjs";
import { readLocalSubmitEnvironment } from "./production-submit-check.mjs";
import {
  buildEasCliEnvironment,
  buildEasSecretsReport,
  EAS_CLI_PACKAGE,
  parseEasSecretNames,
} from "./eas-secrets-check.mjs";
import { buildEasAuthEnvironment } from "./eas-auth-check.mjs";
import { readProductionBuildArtifactStatus } from "./production-build-artifact-check.mjs";
import { readStoreInstallEvidenceStatus } from "./store-install-evidence-check.mjs";
import { readStoreReleaseVisibilityStatus } from "./store-release-visibility-check.mjs";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const CREATOR_PROOF_SMOKE_ARTIFACTS = [
  {
    label: "Android",
    filePath: "output/android/mobile-creator-performance-smoke.png",
    minWidth: 1080,
    minHeight: 1920,
  },
  {
    label: "iOS",
    filePath: "output/ios/mobile-creator-performance-smoke.png",
    minWidth: 1170,
    minHeight: 2532,
  },
];

export function validateCreatorProofSmokeArtifacts({
  repoRoot = process.cwd(),
  artifacts = CREATOR_PROOF_SMOKE_ARTIFACTS,
  minFileBytes = 20000,
} = {}) {
  const issues = [];

  for (const artifact of artifacts) {
    const filePath = path.resolve(repoRoot, artifact.filePath);

    if (!existsSync(filePath)) {
      issues.push(
        `${artifact.label}: Creator proof screenshot is missing: ${artifact.filePath}.`,
      );
      continue;
    }

    let dimensions;

    try {
      dimensions = readPngSize(filePath);
    } catch {
      issues.push(`${artifact.label}: Creator proof screenshot must be a valid PNG.`);
      continue;
    }

    if (dimensions.height <= dimensions.width) {
      issues.push(`${artifact.label}: Creator proof screenshot must be portrait.`);
    }

    if (dimensions.width < artifact.minWidth || dimensions.height < artifact.minHeight) {
      issues.push(
        `${artifact.label}: Creator proof screenshot must be at least ${artifact.minWidth}x${artifact.minHeight}.`,
      );
    }

    if (statSync(filePath).size < minFileBytes) {
      issues.push(
        `${artifact.label}: Creator proof screenshot file is too small to prove a real native smoke run.`,
      );
    }
  }

  return issues;
}

function readCreatorProofIssues(repoRoot) {
  return validateCreatorProofSmokeArtifacts({ repoRoot });
}

function readScreenshotIssues(mobileRoot, repoRoot) {
  const checks = [
    {
      label: "Android",
      manifest: "store-screenshot-manifest.json",
      minWidth: 1080,
      minHeight: 1920,
    },
    {
      label: "iOS",
      manifest: "store-screenshot-manifest.ios.json",
      minWidth: 1170,
      minHeight: 2532,
    },
  ];

  return checks.flatMap((check) =>
    validateStoreScreenshotArtifacts(readJson(path.join(mobileRoot, check.manifest)), {
      repoRoot,
      minWidth: check.minWidth,
      minHeight: check.minHeight,
    }).map((issue) => `${check.label}: ${issue}`),
  );
}

function validateProductionBuildConfig(easConfig) {
  const issues = [];
  const production = easConfig?.build?.production;

  if (!production) {
    return ["EAS production build profile is missing."];
  }

  if (production.autoIncrement !== true) {
    issues.push("Production builds must autoIncrement native build numbers.");
  }

  if (production.channel !== "production") {
    issues.push("Production builds must publish to the production update channel.");
  }

  if (production.ios?.resourceClass !== "m-medium") {
    issues.push("Production iOS builds must use the m-medium resource class.");
  }

  if (production.android?.buildType !== "app-bundle") {
    issues.push("Production Android builds must produce an app-bundle.");
  }

  return issues;
}

function readReleaseMetadataIssues(mobileRoot) {
  const result = spawnSync(process.execPath, ["./scripts/release-check.mjs"], {
    cwd: mobileRoot,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return [];
  }

  const output = `${result.stderr}\n${result.stdout}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return output
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function readEasSecretsStatus(mobileRoot, environment = process.env) {
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
      env: buildEasCliEnvironment(mobileRoot, environment),
    },
  );

  if (result.status !== 0) {
    return {
      ok: false,
      issues: [
        "Could not read EAS production secrets. Log in with eas login or set EXPO_TOKEN.",
      ],
      nextSteps: [
        "Authenticate EAS, then rerun npm --prefix mobile run release:eas-secrets:check.",
      ],
    };
  }

  const report = buildEasSecretsReport(parseEasSecretNames(result.stdout));

  return {
    ok: report.ok,
    issues: report.missing.map((name) => `Missing EAS file secret: ${name}.`),
    nextSteps: report.ok
      ? []
      : [
          "Create EAS production file secrets, then rerun npm --prefix mobile run release:eas-secrets:check.",
        ],
  };
}

function readEasAuthStatus(mobileRoot, environment = process.env) {
  const easEnvironment = buildEasAuthEnvironment(mobileRoot, environment);
  const result = spawnSync("npx", ["--yes", EAS_CLI_PACKAGE, "whoami"], {
    cwd: mobileRoot,
    encoding: "utf8",
    env: easEnvironment,
  });

  if (result.status === 0) {
    return {
      ok: true,
      issues: [],
      nextSteps: [],
    };
  }

  return {
    ok: false,
    issues: [
      easEnvironment.EXPO_TOKEN
        ? "EAS authentication failed. EXPO_TOKEN is set but EAS rejected it."
        : "EAS authentication failed. EXPO_TOKEN is not set.",
    ],
    nextSteps: [
      "Run eas login locally or set EXPO_TOKEN, then rerun npm --prefix mobile run release:eas-auth:check.",
    ],
  };
}

export function buildMobileReleaseStatus({
  easConfig,
  mobileRoot,
  repoRoot = path.resolve(mobileRoot, ".."),
  environment = process.env,
  releaseMetadataIssues,
  screenshotIssues,
  creatorProofIssues,
  productionBuildArtifactReport,
  easAuthReport,
  easSecretsReport,
  storeReleaseVisibilityReport,
  storeInstallEvidenceReport,
}) {
  const identity = buildStoreSubmitReadinessReport({
    easConfig,
    mobileRoot,
    environment,
  });
  const screenshotGateIssues =
    screenshotIssues ?? readScreenshotIssues(mobileRoot, repoRoot);
  const creatorProofGateIssues =
    creatorProofIssues ?? readCreatorProofIssues(repoRoot);
  const releaseGateIssues =
    releaseMetadataIssues ?? readReleaseMetadataIssues(mobileRoot);
  const releaseMetadataReady = releaseGateIssues.length === 0;
  const productionBuildIssues = validateProductionBuildConfig(easConfig);
  const productionBuildReady = productionBuildIssues.length === 0;
  const screenshotsReady = screenshotGateIssues.length === 0;
  const creatorProofReady = creatorProofGateIssues.length === 0;
  const easSecrets = easSecretsReport ?? {
    ok: true,
    issues: [],
    nextSteps: [],
  };
  const easAuth = easAuthReport ?? {
    ok: true,
    issues: [],
    nextSteps: [],
  };
  const productionBuildArtifacts = productionBuildArtifactReport ?? {
    ok: true,
    issues: [],
    nextSteps: [],
    artifacts: [],
  };
  const storeReleaseVisibility = storeReleaseVisibilityReport ?? null;
  const storeInstallEvidence = storeInstallEvidenceReport ?? null;
  const submitReady =
    releaseMetadataReady &&
    productionBuildReady &&
    identity.ok &&
    easAuth.ok &&
    easSecrets.ok &&
    productionBuildArtifacts.ok &&
    creatorProofReady &&
    screenshotsReady;
  const postSubmitReady =
    storeReleaseVisibility || storeInstallEvidence
      ? Boolean(storeReleaseVisibility?.ok && storeInstallEvidence?.ok)
      : null;
  const gates = [
    {
      label: "Release metadata",
      ok: releaseMetadataReady,
      issues: releaseGateIssues,
      nextSteps: releaseMetadataReady
        ? []
        : ["Fix mobile release metadata, then rerun npm --prefix mobile run release:check."],
    },
    {
      label: "Production build config",
      ok: productionBuildReady,
      issues: productionBuildIssues,
      nextSteps: productionBuildReady
        ? []
        : ["Fix the production build config, then rerun npm --prefix mobile run release:production-build:check."],
    },
    {
      label: "Store identity",
      ok: identity.ok,
      issues: identity.issues,
      nextSteps: identity.nextSteps,
    },
    {
      label: "EAS authentication",
      ok: easAuth.ok,
      issues: easAuth.issues,
      nextSteps: easAuth.nextSteps,
    },
    {
      label: "EAS submit secrets",
      ok: easSecrets.ok,
      issues: easSecrets.issues,
      nextSteps: easSecrets.nextSteps,
    },
    {
      label: "Production build artifacts",
      ok: productionBuildArtifacts.ok,
      issues: productionBuildArtifacts.issues,
      nextSteps: productionBuildArtifacts.nextSteps,
    },
    {
      label: "Creator proof smoke",
      ok: creatorProofReady,
      issues: creatorProofGateIssues,
      nextSteps: creatorProofReady
        ? []
        : [
            "Run Android and iOS creator proof smoke, then rerun npm --prefix mobile run release:creator-proof:check.",
          ],
    },
    {
      label: "Store screenshots",
      ok: screenshotsReady,
      issues: screenshotGateIssues,
      nextSteps: screenshotsReady
        ? []
        : ["Regenerate store screenshots, then rerun npm --prefix mobile run release:screenshot-artifacts:check."],
    },
    {
      label: "Submit readiness",
      ok: submitReady,
      issues: submitReady
        ? []
        : ["Store submission is blocked until release metadata, production build config, identity, EAS auth, EAS secrets, production build artifacts, creator proof, and screenshot gates are ready."],
      nextSteps: submitReady
        ? []
        : ["Rerun npm --prefix mobile run release:submit:check after the blocked gates are resolved."],
    },
    ...(storeReleaseVisibility
      ? [
          {
            label: "Store release visibility",
            ok: storeReleaseVisibility.ok,
            issues: storeReleaseVisibility.issues,
            nextSteps: storeReleaseVisibility.nextSteps,
          },
        ]
      : []),
    ...(storeInstallEvidence
      ? [
          {
            label: "Store install evidence",
            ok: storeInstallEvidence.ok,
            issues: storeInstallEvidence.issues,
            nextSteps: storeInstallEvidence.nextSteps,
          },
        ]
      : []),
  ];

  return {
    ok: submitReady,
    submitReady,
    postSubmitReady,
    gates,
    nextMove: !releaseMetadataReady
      ? "Fix mobile release metadata, then rerun npm --prefix mobile run release:check."
      : !productionBuildReady
      ? "Fix the production build config, then rerun npm --prefix mobile run release:production-build:check."
      : !identity.ok
      ? "Add the real App Store Connect IDs and EAS file secrets, then rerun npm --prefix mobile run release:submit:check."
      : !easAuth.ok
      ? "Authenticate EAS, then rerun npm --prefix mobile run release:eas-auth:check."
      : !easSecrets.ok
      ? "Create the EAS production file secrets, then rerun npm --prefix mobile run release:eas-secrets:check."
      : !productionBuildArtifacts.ok
      ? "Run production iOS and Android builds, then rerun npm --prefix mobile run release:production-artifacts:check."
      : !creatorProofReady
      ? "Run Android and iOS creator proof smoke, then rerun npm --prefix mobile run release:creator-proof:check."
      : !screenshotsReady
      ? "Regenerate store screenshots, then rerun npm --prefix mobile run release:screenshot-artifacts:check."
      : submitReady && storeReleaseVisibility && !storeReleaseVisibility.ok
        ? "Fix store release visibility, then rerun npm --prefix mobile run release:store-visibility:check."
      : submitReady && storeInstallEvidence && !storeInstallEvidence.ok
        ? "Submit to TestFlight and Play internal testing, then capture real-device store install evidence."
      : submitReady && storeReleaseVisibility?.ok && storeInstallEvidence?.ok
        ? "Run npm --prefix mobile run release:post-submit:check before public release."
      : submitReady
        ? "Run npm --prefix mobile run release:submit:check, then submit to TestFlight and Play internal testing."
        : "Add the real App Store Connect IDs and EAS file secrets, then rerun npm --prefix mobile run release:submit:check.",
  };
}

export function formatMobileReleaseStatus(status) {
  const lines = [
    "Mobile release status",
    status.ok ? "Overall: ready for store submit check." : "Overall: blocked.",
    `Post-submit: ${formatPostSubmitState(status)}.`,
    "",
    "Gates:",
  ];

  for (const gate of status.gates) {
    lines.push(`- ${gate.label}: ${gate.ok ? "ready" : "blocked"}`);

    for (const issue of gate.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  lines.push(
    "",
    `Next: ${status.nextMove}`,
    "Automation: npm --prefix mobile run release:status:strict",
  );

  return lines.join("\n");
}

export function formatMobileReleaseStatusJson(status) {
  return `${JSON.stringify(
    {
      ok: status.ok,
      submitReady: status.submitReady ?? status.ok,
      postSubmitReady: status.postSubmitReady ?? null,
      nextMove: status.nextMove,
      gates: status.gates.map((gate) => ({
        label: gate.label,
        ok: gate.ok,
        issues: gate.issues,
        nextSteps: gate.nextSteps,
      })),
    },
    null,
    2,
  )}\n`;
}

export function formatMobileReleaseStatusMarkdown(status) {
  const lines = [
    "## Mobile release status",
    "",
    `**Overall:** ${status.ok ? "Ready for store submit check" : "Blocked"}`,
    `**Post-submit:** ${formatPostSubmitState(status)}`,
    "",
    "| Gate | Status | Issues |",
    "| --- | --- | --- |",
  ];

  for (const gate of status.gates) {
    lines.push(
      `| ${gate.label} | ${gate.ok ? "Ready" : "Blocked"} | ${
        gate.issues.length > 0 ? gate.issues.join("<br>") : "-"
      } |`,
    );
  }

  lines.push("", `**Next:** ${status.nextMove}`, "");

  return lines.join("\n");
}

function formatPostSubmitState(status) {
  if (status.postSubmitReady === true) {
    return "ready";
  }

  if (status.postSubmitReady === false) {
    return "blocked";
  }

  return "not checked";
}

export function formatMobileStoreSubmitHandoff(status) {
  const blockedGates = status.gates
    .filter((gate) => !gate.ok && gate.label !== "Submit readiness")
    .map((gate) => gate.label);
  const lines = [
    "Mobile store-submit handoff",
    "",
    `Current state: ${status.ok ? "ready" : "blocked"}`,
    blockedGates.length > 0
      ? `Blocked gates: ${blockedGates.join(", ")}`
      : "Blocked gates: none",
    "",
    "Needed from Apple",
    "- EXPO_ASC_APP_ID: numeric App Store Connect app ID.",
    "- EXPO_ASC_API_KEY_ID: App Store Connect API key ID.",
    "- EXPO_ASC_API_KEY_ISSUER_ID: App Store Connect issuer ID.",
    "- APPLE_ASC_API_KEY: EAS file secret created from the App Store Connect .p8 key.",
    "",
    "Needed from Google Play",
    "- GOOGLE_SERVICE_ACCOUNT: EAS file secret created from the Play Console service account JSON.",
    "",
    "Needed from Expo",
    "- EXPO_TOKEN: local or CI token that can read EAS production environment and submit builds.",
    "",
    "Safe local handoff",
    "- Put one-off IDs and EXPO_TOKEN in mobile/.env.local, or export them in CI.",
    "- Keep .p8 and service-account JSON files local; create EAS file secrets before submit.",
    "",
    "EAS file secret command templates",
    "- eas env:create production --name APPLE_ASC_API_KEY --type file --visibility secret --value AuthKey_XXXXXXXXXX.p8",
    "- eas env:create production --name GOOGLE_SERVICE_ACCOUNT --type file --visibility secret --value play-console-service-account.local.json",
    "",
    "Verification",
    "- npm --prefix mobile run release:submit:check",
    "- npm --prefix mobile run release:status:strict",
    "- npm --prefix mobile run release:store-install-evidence:check",
    "- npm --prefix mobile run release:post-submit:check",
  ];

  return `${lines.join("\n")}\n`;
}

export function getReleaseStatusExitCode(status, { strict = false } = {}) {
  return strict && !status.ok ? 1 : 0;
}

async function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const mobileRoot = path.resolve(scriptDirectory, "..");
  const strict = process.argv.includes("--strict");
  const json = process.argv.includes("--json");
  const markdown = process.argv.includes("--markdown");
  const handoff = process.argv.includes("--handoff");
  const localEnvironment = readLocalSubmitEnvironment(mobileRoot);
  const easRuntimeEnvironment = {
    ...process.env,
    ...localEnvironment,
  };
  const easAuthReport = readEasAuthStatus(mobileRoot, easRuntimeEnvironment);
  const easSecretsReport = easAuthReport.ok
    ? readEasSecretsStatus(mobileRoot, easRuntimeEnvironment)
    : {
        ok: false,
        issues: [
          "EAS authentication must pass before production submit secrets can be read.",
        ],
        nextSteps: [
          "Authenticate EAS, then rerun npm --prefix mobile run release:eas-secrets:check.",
        ],
      };
  const productionBuildArtifactReport = easAuthReport.ok
    ? readProductionBuildArtifactStatus(mobileRoot, easRuntimeEnvironment)
    : {
        ok: false,
        issues: [
          "EAS authentication must pass before production build artifacts can be read.",
        ],
        nextSteps: [
          "Authenticate EAS, then rerun npm --prefix mobile run release:production-artifacts:check.",
        ],
        artifacts: [],
      };
  const canReadPostSubmitEvidence = submitEnvCanReadPostSubmitEvidence({
    easAuthReport,
    productionBuildArtifactReport,
  });
  const storeReleaseVisibilityReport = canReadPostSubmitEvidence
    ? await readStoreReleaseVisibilityStatus({
        mobileRoot,
        environment: easRuntimeEnvironment,
      })
    : {
        ok: false,
        summaries: [],
        issues: [
          "Store release visibility waits for EAS authentication and production build artifact checks.",
        ],
        nextSteps: [
          "Resolve EAS authentication and production build artifacts before checking store release visibility.",
        ],
      };
  const storeInstallEvidenceReport = canReadPostSubmitEvidence
    ? readStoreInstallEvidenceStatus({
        mobileRoot,
        environment: easRuntimeEnvironment,
      })
    : {
        ok: false,
        summaries: [],
        issues: [
          "Store install evidence waits for EAS authentication and production build artifact checks.",
        ],
        nextSteps: [
          "Resolve EAS authentication and production build artifacts before checking real-device store install evidence.",
        ],
      };
  const status = buildMobileReleaseStatus({
    easConfig: readJson(path.join(mobileRoot, "eas.json")),
    mobileRoot,
    environment: localEnvironment,
    easAuthReport,
    easSecretsReport,
    productionBuildArtifactReport,
    storeReleaseVisibilityReport,
    storeInstallEvidenceReport,
  });

  process.stdout.write(
    handoff
      ? formatMobileStoreSubmitHandoff(status)
      : json
      ? formatMobileReleaseStatusJson(status)
      : markdown
      ? formatMobileReleaseStatusMarkdown(status)
      : `${formatMobileReleaseStatus(status)}\n`,
  );
  process.exitCode = getReleaseStatusExitCode(status, { strict });
}

function submitEnvCanReadPostSubmitEvidence({
  easAuthReport,
  productionBuildArtifactReport,
}) {
  return easAuthReport.ok && productionBuildArtifactReport.ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
