#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCdpPage,
  evaluate,
  ensureDevServer,
  stopDevServer,
  findFreePort,
  launchChrome,
} from "./smoke-campaign-detail.mjs";
import {
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeDataDevUser,
  ensureSmokeIdentityEnvDefaults,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";
import { submitCreatorApplication } from "./smoke-application-acceptance.mjs";
import {
  acceptCreatorApplication,
  approveBrandContent,
  buildContentReportWorkflowSmokeTargets,
  publishCreatorContent,
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  transitionSmokeCampaignToActiveWork,
  validateContentReportWorkflowSmoke,
  verifyBrandReportEvidence,
} from "./smoke-content-report-workflow.mjs";

export const DEFAULT_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000110";

const DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-manual-source-creator-smoke.png";
const DEFAULT_BRAND_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-manual-source-brand-smoke.png";
const MANUAL_SOURCE_LABEL = "Brand-reviewed proof";

function formatRuntimeException(event) {
  const details = event.exceptionDetails;
  const description = details?.exception?.description;
  const text = details?.text;
  const location = [
    details?.url,
    Number.isFinite(details?.lineNumber) ? `line ${details.lineNumber}` : null,
    Number.isFinite(details?.columnNumber) ? `column ${details.columnNumber}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [description || text || "Runtime exception", location]
    .filter(Boolean)
    .join(" @ ");
}

export function buildContentReportManualSourceSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID,
} = {}) {
  return buildContentReportWorkflowSmokeTargets({ baseUrl, campaignId });
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function getLatestManualSourceProof(admin, campaignId) {
  const reportTasks = await checkedQuery(
    "Find manual source smoke report tasks",
    admin.from("campaign_report_tasks").select("id").eq("campaign_id", campaignId),
  );
  const reportTaskIds = (reportTasks ?? []).map((task) => task.id);
  if (reportTaskIds.length === 0) {
    return {
      latestAiExtractionStatus: null,
      latestMetricSourceType: null,
    };
  }

  const [extractions, metricValues] = await Promise.all([
    checkedQuery(
      "Find manual source smoke extraction",
      admin
        .from("content_performance_ai_extractions")
        .select("status")
        .in("report_task_id", reportTaskIds)
        .order("created_at", { ascending: false })
        .limit(1),
    ),
    checkedQuery(
      "Find manual source smoke metric values",
      admin
        .from("content_performance_metric_values")
        .select("source_type")
        .in("report_task_id", reportTaskIds)
        .order("created_at", { ascending: false })
        .limit(1),
    ),
  ]);

  return {
    latestAiExtractionStatus: extractions?.[0]?.status ?? null,
    latestMetricSourceType: metricValues?.[0]?.source_type ?? null,
  };
}

export function validateContentReportManualSourceSmoke({
  brandReportText,
  latestAiExtractionStatus,
  latestMetricSourceType,
  consoleErrors,
}) {
  const normalizedBrandReportText = brandReportText.toLowerCase();

  if (!normalizedBrandReportText.includes(MANUAL_SOURCE_LABEL.toLowerCase())) {
    throw new Error("Missing brand-reviewed manual source proof in brand report.");
  }

  if (normalizedBrandReportText.includes("ai read")) {
    throw new Error("Manual source proof should not show AI source copy.");
  }

  if (!normalizedBrandReportText.includes("verified")) {
    throw new Error("Missing verified report proof after manual source review.");
  }

  if (latestAiExtractionStatus !== null) {
    throw new Error(
      `Expected no AI extraction status for manual proof, received ${latestAiExtractionStatus}.`,
    );
  }

  if (latestMetricSourceType !== "creator_manual") {
    throw new Error(
      `Expected creator_manual metric source, received ${latestMetricSourceType ?? "none"}.`,
    );
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export async function runContentReportManualSourceSmoke({ skipBrandReview = false } = {}) {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildContentReportManualSourceSmokeTargets();
  const creatorReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH,
  );
  const brandReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_REPORT_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-manual-source-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    creatorSubmissionText: "",
    brandContentText: "",
    creatorReportText: "",
    brandReportText: "",
  };
  let manualSourceProof = {
    latestAiExtractionStatus: null,
    latestMetricSourceType: null,
  };

  try {
    await setupApplicationFlowSmokeData(admin, targets);

    chrome = await launchChrome({ debugPort, userDataDir });
    client = await createCdpPage(debugPort);
    client.on("Runtime.consoleAPICalled", (event) => {
      if (event.type === "error") {
        consoleErrors.push(
          event.args?.map((arg) => arg.value || arg.description || "").join(" ") ||
            "Console error",
        );
      }
    });
    client.on("Runtime.exceptionThrown", (event) => {
      consoleErrors.push(formatRuntimeException(event));
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    await acceptCreatorApplication(client, targets);
    await transitionSmokeCampaignToActiveWork(admin, targets.campaignId);
    smokeEvidence.creatorSubmissionText = await submitCreatorDraft(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    smokeEvidence.brandContentText = await approveBrandContent(client, targets);
    await publishCreatorContent(client, targets);
    smokeEvidence.creatorReportText = await submitCreatorPerformanceProof(client, {
      manualOnlyEvidence: true,
    });
    await ensureSmokeDataDevUser(admin, "creator");
    await captureScreenshot(client, creatorReportScreenshotPath);
    manualSourceProof = await getLatestManualSourceProof(
      admin,
      targets.campaignId,
    );
    if (!skipBrandReview) {
      smokeEvidence.brandReportText = await verifyBrandReportEvidence(
        client,
        targets,
      );
      await evaluate(
        client,
        `(() => {
          const trail = document.querySelector("[data-testid=\\"report-evidence-trail\\"]");
          if (!trail) return false;
          trail.scrollIntoView({ block: "start" });
          window.scrollBy(0, -16);
          return true;
        })()`,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
      await captureScreenshot(client, brandReportScreenshotPath);

      validateContentReportWorkflowSmoke({
        ...smokeEvidence,
        consoleErrors,
      });
      validateContentReportManualSourceSmoke({
        brandReportText: smokeEvidence.brandReportText,
        ...manualSourceProof,
        consoleErrors,
      });
    } else {
      if (!smokeEvidence.creatorReportText.toLowerCase().includes("proof sent for review")) {
        throw new Error("Manual proof smoke did not reach pending creator review state.");
      }
      if (manualSourceProof.latestAiExtractionStatus !== null) {
        throw new Error(
          `Expected no AI extraction status for pending manual proof, received ${manualSourceProof.latestAiExtractionStatus}.`,
        );
      }
      if (manualSourceProof.latestMetricSourceType !== "creator_manual") {
        throw new Error(
          `Expected creator_manual metric source, received ${manualSourceProof.latestMetricSourceType ?? "none"}.`,
        );
      }
      if (consoleErrors.length > 0) {
        throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
      }
    }

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignId: targets.campaignId,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      ...manualSourceProof,
      creatorReportScreenshotPath,
      brandReportScreenshotPath,
      skippedBrandReview: skipBrandReview,
      keptSmokeData: process.env.SMOKE_KEEP_DATA === "1",
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    }

    await stopDevServer(devServer);
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runContentReportManualSourceSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
