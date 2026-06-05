#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCdpPage,
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

export const DEFAULT_CONTENT_REPORT_AI_SOURCE_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000108";

const DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-ai-source-creator-smoke.png";
const DEFAULT_BRAND_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-ai-source-brand-smoke.png";
const AI_EDITED_SOURCE_LABEL = "AI read, creator edited";

export function buildContentReportAiSourceSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_AI_SOURCE_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_AI_SOURCE_CAMPAIGN_ID,
} = {}) {
  return buildContentReportWorkflowSmokeTargets({ baseUrl, campaignId });
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function getLatestAiExtractionStatus(admin, campaignId) {
  const reportTasks = await checkedQuery(
    "Find AI source smoke report tasks",
    admin.from("campaign_report_tasks").select("id").eq("campaign_id", campaignId),
  );
  const reportTaskIds = (reportTasks ?? []).map((task) => task.id);
  if (reportTaskIds.length === 0) return null;

  const extractions = await checkedQuery(
    "Find AI source smoke extraction",
    admin
      .from("content_performance_ai_extractions")
      .select("status")
      .in("report_task_id", reportTaskIds)
      .order("created_at", { ascending: false })
      .limit(1),
  );

  return extractions?.[0]?.status ?? null;
}

export function validateContentReportAiSourceSmoke({
  brandReportText,
  extractionStatus,
  consoleErrors,
}) {
  const normalizedBrandReportText = brandReportText.toLowerCase();

  if (!normalizedBrandReportText.includes(AI_EDITED_SOURCE_LABEL.toLowerCase())) {
    throw new Error("Missing AI edited source proof in brand report.");
  }

  if (!normalizedBrandReportText.includes("verified")) {
    throw new Error("Missing verified report proof after AI source review.");
  }

  if (extractionStatus !== "edited_by_creator") {
    throw new Error(
      `Expected edited_by_creator AI extraction status, received ${extractionStatus ?? "none"}.`,
    );
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function runContentReportAiSourceSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildContentReportAiSourceSmokeTargets();
  const creatorReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_AI_SOURCE_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH,
  );
  const brandReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_AI_SOURCE_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_REPORT_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-ai-source-smoke-"),
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
  let extractionStatus = null;

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
      consoleErrors.push(event.exceptionDetails?.text || "Runtime exception");
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    await acceptCreatorApplication(client, targets);
    await transitionSmokeCampaignToActiveWork(admin, targets.campaignId);
    smokeEvidence.creatorSubmissionText = await submitCreatorDraft(client, targets);
    smokeEvidence.brandContentText = await approveBrandContent(client, targets);
    await publishCreatorContent(client, targets);
    smokeEvidence.creatorReportText = await submitCreatorPerformanceProof(client, {
      requireAiSuggestions: true,
      editExtractedMetric: true,
    });
    await captureScreenshot(client, creatorReportScreenshotPath);
    extractionStatus = await getLatestAiExtractionStatus(admin, targets.campaignId);
    smokeEvidence.brandReportText = await verifyBrandReportEvidence(
      client,
      targets,
    );
    await captureScreenshot(client, brandReportScreenshotPath);

    validateContentReportWorkflowSmoke({
      ...smokeEvidence,
      consoleErrors,
    });
    validateContentReportAiSourceSmoke({
      brandReportText: smokeEvidence.brandReportText,
      extractionStatus,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignId: targets.campaignId,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      extractionStatus,
      creatorReportScreenshotPath,
      brandReportScreenshotPath,
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
  runContentReportAiSourceSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
