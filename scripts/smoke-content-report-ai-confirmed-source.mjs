#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCdpPage,
  ensureDevServer,
  stopDevServer,
  evaluate,
  findFreePort,
  launchChrome,
  navigate,
  waitForExpression,
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

export const DEFAULT_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000109";

const DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-ai-confirmed-source-creator-smoke.png";
const DEFAULT_BRAND_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-ai-confirmed-source-brand-smoke.png";
const AI_CONFIRMED_SOURCE_LABEL = "AI read, creator confirmed";
const AI_PENDING_SOURCE_LABEL = "AI read, waiting for creator";
const TRUSTED_CONFIRMED_VIEW_TOTAL_LABEL = "12.0K";
const LEAKED_UNCONFIRMED_VIEW_TOTAL_LABEL = "88.0K";

export function buildContentReportAiConfirmedSourceSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CAMPAIGN_ID,
} = {}) {
  return buildContentReportWorkflowSmokeTargets({ baseUrl, campaignId });
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function seedUnconfirmedAiMetricLeakProbe(admin, campaignId) {
  const members = await checkedQuery(
    "Find AI confirmed source smoke member",
    admin
      .from("campaign_members")
      .select("id, creator_id")
      .eq("campaign_id", campaignId)
      .limit(1),
  );
  const member = members?.[0];
  if (!member?.id || !member.creator_id) {
    throw new Error("Missing accepted member for AI source leak probe.");
  }

  const tasks = await checkedQuery(
    "Find AI confirmed source smoke report task",
    admin
      .from("campaign_report_tasks")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("campaign_member_id", member.id)
      .limit(1),
  );
  const task = tasks?.[0];
  if (!task?.id) {
    throw new Error("Missing report task for AI source leak probe.");
  }

  const now = new Date().toISOString();
  const submissionId = randomUUID();
  const performanceId = randomUUID();
  const evidenceId = randomUUID();
  const fileName = "pending-ai-smoke.csv";
  const evidenceCsv = [
    "metric,value",
    "views,88000",
    "likes,1000",
    "comments,100",
    "",
  ].join("\n");
  const evidencePath = [
    campaignId,
    member.id,
    task.id,
    evidenceId,
    fileName,
  ].join("/");

  await checkedQuery(
    "Create AI source leak probe submission",
    admin.from("content_submissions").insert({
      id: submissionId,
      campaign_member_id: member.id,
      content_url: "https://www.tiktok.com/@devcreator/video/pending-ai-smoke",
      caption: "Pending AI extraction leak probe.",
      platform: "tiktok",
      status: "published",
      version: 1,
      submitted_at: now,
      reviewed_at: now,
      published_at: now,
      published_url: "https://www.tiktok.com/@devcreator/video/pending-ai-smoke",
    }),
  );

  await checkedQuery(
    "Create AI source leak probe performance",
    admin.from("content_performance").insert({
      id: performanceId,
      submission_id: submissionId,
      report_task_id: task.id,
      measurement_type: "final_7d",
      views: 88000,
      likes: 1000,
      comments: 100,
      shares: 10,
      saves: 5,
      screenshot_url: `campaign-evidence/${evidencePath}`,
      verification_status: "screenshot_verified",
      verified_at: now,
      reported_at: now,
    }),
  );

  await checkedQuery(
    "Create AI source leak probe evidence",
    admin.from("content_performance_evidence").insert({
      id: evidenceId,
      campaign_id: campaignId,
      campaign_member_id: member.id,
      report_task_id: task.id,
      submission_id: submissionId,
      performance_id: performanceId,
      uploaded_by: member.creator_id,
      evidence_type: "analytics_export",
      bucket_id: "campaign-evidence",
      storage_path: evidencePath,
      file_name: fileName,
      mime_type: "text/csv",
      size_bytes: Buffer.byteLength(evidenceCsv),
      verification_status: "verified",
    }),
  );

  const { error: uploadError } = await admin.storage
    .from("campaign-evidence")
    .upload(evidencePath, Buffer.from(evidenceCsv), {
      contentType: "text/csv",
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Upload AI source leak probe evidence: ${uploadError.message}`);
  }

  await checkedQuery(
    "Create AI source leak probe metric values",
    admin.from("content_performance_metric_values").insert([
      {
        performance_id: performanceId,
        report_task_id: task.id,
        platform: "tiktok",
        metric_key: "views",
        metric_label: "Views",
        metric_value: 88000,
        source_type: "ai_extracted",
        confirmed_by_creator: false,
      },
      {
        performance_id: performanceId,
        report_task_id: task.id,
        platform: "tiktok",
        metric_key: "likes",
        metric_label: "Likes",
        metric_value: 1000,
        source_type: "ai_extracted",
        confirmed_by_creator: false,
      },
      {
        performance_id: performanceId,
        report_task_id: task.id,
        platform: "tiktok",
        metric_key: "comments",
        metric_label: "Comments",
        metric_value: 100,
        source_type: "ai_extracted",
        confirmed_by_creator: false,
      },
    ]),
  );

  await checkedQuery(
    "Create pending AI extraction leak probe",
    admin.from("content_performance_ai_extractions").insert({
      evidence_id: evidenceId,
      report_task_id: task.id,
      platform: "tiktok",
      model: "gemini-smoke",
      input_sha256: "0".repeat(64),
      extracted_metrics: {
        metrics: [
          { metricKey: "views", metricLabel: "Views", metricValue: 88000 },
          { metricKey: "likes", metricLabel: "Likes", metricValue: 1000 },
          { metricKey: "comments", metricLabel: "Comments", metricValue: 100 },
        ],
      },
      confidence_summary: { overall: 0.95 },
      status: "pending_confirmation",
    }),
  );

  return { evidenceId, performanceId, submissionId };
}

export async function getLatestAiExtractionStatus(admin, campaignId) {
  const reportTasks = await checkedQuery(
    "Find AI confirmed source smoke report tasks",
    admin.from("campaign_report_tasks").select("id").eq("campaign_id", campaignId),
  );
  const reportTaskIds = (reportTasks ?? []).map((task) => task.id);
  if (reportTaskIds.length === 0) return null;

  const extractions = await checkedQuery(
    "Find AI confirmed source smoke extraction",
    admin
      .from("content_performance_ai_extractions")
      .select("status")
      .in("report_task_id", reportTaskIds)
      .order("created_at", { ascending: false })
      .limit(1),
  );

  return extractions?.[0]?.status ?? null;
}

export async function readBrandReportEvidence(client, targets) {
  await navigate(client, targets.brandReportUrl);
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"report-evidence-trail\\"]") != null &&
      document.body.innerText.includes(${JSON.stringify(AI_CONFIRMED_SOURCE_LABEL)}) &&
      document.body.innerText.includes(${JSON.stringify(AI_PENDING_SOURCE_LABEL)})`,
    "brand report confirmed and pending evidence sources",
    60000,
  );

  return evaluate(client, "document.body.innerText");
}

export function validateContentReportAiConfirmedSourceSmoke({
  brandReportText,
  extractionStatus,
  consoleErrors,
}) {
  const normalizedBrandReportText = brandReportText.toLowerCase();

  if (
    !normalizedBrandReportText.includes(AI_CONFIRMED_SOURCE_LABEL.toLowerCase())
  ) {
    throw new Error("Missing AI confirmed source proof in brand report.");
  }

  if (normalizedBrandReportText.includes(LEAKED_UNCONFIRMED_VIEW_TOTAL_LABEL.toLowerCase())) {
    throw new Error("Unconfirmed AI values leaked into report totals.");
  }

  if (!normalizedBrandReportText.includes(AI_PENDING_SOURCE_LABEL.toLowerCase())) {
    throw new Error("Missing pending AI source proof in brand report.");
  }

  if (!normalizedBrandReportText.includes(TRUSTED_CONFIRMED_VIEW_TOTAL_LABEL.toLowerCase())) {
    throw new Error("Missing trusted confirmed AI total in brand report.");
  }

  if (!normalizedBrandReportText.includes("verified")) {
    throw new Error("Missing verified report proof after AI source review.");
  }

  if (extractionStatus !== "accepted_by_creator") {
    throw new Error(
      `Expected accepted_by_creator AI extraction status, received ${extractionStatus ?? "none"}.`,
    );
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function runContentReportAiConfirmedSourceSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildContentReportAiConfirmedSourceSmokeTargets();
  const creatorReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH,
  );
  const brandReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_AI_CONFIRMED_SOURCE_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_REPORT_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-ai-confirmed-source-smoke-"),
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
      editExtractedMetric: false,
    });
    await captureScreenshot(client, creatorReportScreenshotPath);
    extractionStatus = await getLatestAiExtractionStatus(admin, targets.campaignId);
    smokeEvidence.brandReportText = await verifyBrandReportEvidence(
      client,
      targets,
    );
    await seedUnconfirmedAiMetricLeakProbe(admin, targets.campaignId);
    smokeEvidence.brandReportText = await readBrandReportEvidence(
      client,
      targets,
    );
    await captureScreenshot(client, brandReportScreenshotPath);

    validateContentReportWorkflowSmoke({
      ...smokeEvidence,
      consoleErrors,
    });
    validateContentReportAiConfirmedSourceSmoke({
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
  runContentReportAiConfirmedSourceSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
