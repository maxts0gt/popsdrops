#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureScreenshot,
  createAdminClient,
  isExistingDevServerReady,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";
import {
  createCdpPage,
  ensureDevServer,
  evaluate,
  findFreePort,
  launchChrome,
  loginForSmoke,
  navigate,
  stopDevServer,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";

export const DEFAULT_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID =
  "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010";

const EXTRA_READ_TASK_KEY = "extra:smoke-extra-read";
const EXTRA_READ_DUE_AT = "2026-05-16T12:00:00.000Z";
const EXTRA_READ_REPORTED_AT = "2026-05-17T12:00:00.000Z";
const DEFAULT_BRAND_SUBMITTED_SCREENSHOT_PATH =
  "output/playwright/content-report-extra-read-submitted-smoke.png";
const DEFAULT_BRAND_VERIFIED_SCREENSHOT_PATH =
  "output/playwright/content-report-extra-read-verified-smoke.png";
const DEFAULT_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-extra-read-report-smoke.png";

const EXTRA_READ_METRICS = {
  tiktok: [
    ["views", "Views", 35200],
    ["likes", "Likes", 3250],
    ["comments", "Comments", 410],
    ["shares", "Shares", 640],
    ["saves", "Saves", 800],
    ["avg_watch_time_seconds", "Average watch time", 9],
    ["completion_rate", "Completion rate", 71],
  ],
  instagram: [
    ["views", "Views", 19400],
    ["reach", "Reach", 17200],
    ["impressions", "Impressions", 23800],
    ["likes", "Likes", 1320],
    ["comments", "Comments", 185],
    ["shares", "Shares", 260],
    ["saves", "Saves", 410],
  ],
};

export function buildContentReportExtraReadSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000",
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandReportingUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}?tab=reporting`,
    brandReportUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}/report`,
  };
}

function normalize(text) {
  return text.toLowerCase();
}

function countText(text, needle) {
  return (text.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) ?? [])
    .length;
}

function requireIncludes(text, label, expected) {
  if (!normalize(text).includes(normalize(expected))) {
    throw new Error(`Missing extra read proof: ${label}`);
  }
}

function proofWindow(text, fileName) {
  const normalizedText = normalize(text);
  const normalizedFileName = normalize(fileName);
  const index = normalizedText.indexOf(normalizedFileName);
  if (index === -1) return "";

  return normalizedText.slice(
    Math.max(0, index - 100),
    index + normalizedFileName.length + 100,
  );
}

function requireProofRowState(text, fileName, state, errorLabel) {
  if (!proofWindow(text, fileName).includes(normalize(state))) {
    throw new Error(errorLabel);
  }
}

function rejectProofRowState(text, fileName, state, errorLabel) {
  if (proofWindow(text, fileName).includes(normalize(state))) {
    throw new Error(errorLabel);
  }
}

export function validateContentReportExtraReadSmoke({
  brandSubmittedText,
  brandAfterFirstVerifyText,
  brandVerifiedText,
  reportText,
  consoleErrors,
}) {
  const submittedProofRows =
    countText(brandSubmittedText, "extra-tiktok-read.csv") +
    countText(brandSubmittedText, "extra-instagram-read.csv");

  if (submittedProofRows < 2) {
    throw new Error("Missing separate extra proof rows");
  }

  for (const text of ["extra-tiktok-read.csv", "extra-instagram-read.csv"]) {
    requireIncludes(brandSubmittedText, text, text);
  }

  requireIncludes(brandSubmittedText, "late status", "Submitted late");
  requireIncludes(brandSubmittedText, "verify action", "Verify");
  requireProofRowState(
    brandAfterFirstVerifyText,
    "extra-tiktok-read.csv",
    "Verified",
    "Missing first verified extra proof",
  );
  requireIncludes(
    brandAfterFirstVerifyText,
    "remaining extra proof",
    "extra-instagram-read.csv",
  );
  requireProofRowState(
    brandAfterFirstVerifyText,
    "extra-instagram-read.csv",
    "Submitted late",
    "Missing remaining extra proof status",
  );
  requireIncludes(
    brandAfterFirstVerifyText,
    "remaining extra proof action",
    "Verify",
  );
  requireProofRowState(
    brandVerifiedText,
    "extra-tiktok-read.csv",
    "Verified",
    "Missing all extra proofs verified",
  );
  requireProofRowState(
    brandVerifiedText,
    "extra-instagram-read.csv",
    "Verified",
    "Missing all extra proofs verified",
  );
  rejectProofRowState(
    brandVerifiedText,
    "extra-tiktok-read.csv",
    "Submitted late",
    "Missing all extra proofs verified",
  );
  rejectProofRowState(
    brandVerifiedText,
    "extra-instagram-read.csv",
    "Submitted late",
    "Missing all extra proofs verified",
  );
  requireIncludes(reportText, "report title", "K-Beauty Retail Launch Report");
  requireIncludes(reportText, "evidence-backed reads", "Evidence-backed reads");
  requireIncludes(reportText, "verified reads", "Verified reads");
  requireIncludes(reportText, "accepted read count", "4/4");
  requireIncludes(reportText, "extra read date point", "05/17");
  requireIncludes(reportText, "TikTok report line", "TikTok");
  requireIncludes(reportText, "Instagram report line", "Instagram");

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function metricRowsForPerformance({ performanceId, reportTaskId, platform }) {
  return EXTRA_READ_METRICS[platform].map(
    ([metricKey, metricLabel, metricValue]) => ({
      performance_id: performanceId,
      report_task_id: reportTaskId,
      platform,
      metric_key: metricKey,
      metric_label: metricLabel,
      metric_value: metricValue,
      metric_text: null,
      source_type: "creator_manual",
      confirmed_by_creator: false,
      confirmed_at: null,
    }),
  );
}

function legacyColumnsFor(platform) {
  return Object.fromEntries(
    EXTRA_READ_METRICS[platform]
      .filter(([key]) =>
        [
          "views",
          "reach",
          "impressions",
          "likes",
          "comments",
          "shares",
          "saves",
          "avg_watch_time_seconds",
          "completion_rate",
        ].includes(key),
      )
      .map(([key, , value]) => [
        key === "avg_watch_time_seconds" ? "avg_watch_time_seconds" : key,
        value,
      ]),
  );
}

async function resetExistingExtraReadTasks(admin, campaignId) {
  const extraTasks = await checkedQuery(
    "Find extra read report tasks",
    admin
      .from("campaign_report_tasks")
      .select("id")
      .eq("campaign_id", campaignId)
      .like("task_key", "extra:%"),
  );
  const taskIds = (extraTasks ?? []).map((task) => task.id);
  if (taskIds.length === 0) return;

  const performanceRows = await checkedQuery(
    "Find extra read performance rows",
    admin
      .from("content_performance")
      .select("id")
      .in("report_task_id", taskIds),
  );
  const performanceIds = (performanceRows ?? []).map((row) => row.id);

  await checkedQuery(
    "Clean extra read evidence rows",
    admin.from("content_performance_evidence").delete().in("report_task_id", taskIds),
  );

  if (performanceIds.length > 0) {
    await checkedQuery(
      "Clean extra read metric values by performance",
      admin
        .from("content_performance_metric_values")
        .delete()
        .in("performance_id", performanceIds),
    );
    await checkedQuery(
      "Clean extra read performance rows",
      admin.from("content_performance").delete().in("id", performanceIds),
    );
  }

  await checkedQuery(
    "Clean extra read metric values by task",
    admin
      .from("content_performance_metric_values")
      .delete()
      .in("report_task_id", taskIds),
  );
  await checkedQuery(
    "Clean extra read tasks",
    admin.from("campaign_report_tasks").delete().in("id", taskIds),
  );
}

async function prepareContentReportExtraReadCampaign(admin, campaignId) {
  const [campaign] = await checkedQuery(
    "Find extra read smoke campaign",
    admin.from("campaigns").select("status").eq("id", campaignId).limit(1),
  );
  if (!campaign) throw new Error("Missing campaign for extra read smoke");

  await checkedQuery(
    "Prepare extra read smoke campaign",
    admin.from("campaigns").update({ status: "monitoring" }).eq("id", campaignId),
  );

  return campaign;
}

async function restoreContentReportExtraReadCampaign(admin, campaignId, campaign) {
  if (!campaign) return;

  await checkedQuery(
    "Restore extra read smoke campaign",
    admin
      .from("campaigns")
      .update({ status: campaign.status })
      .eq("id", campaignId),
  );
}

async function seedExtraReadProof(admin, { campaignId, member, creatorId, taskId, submission }) {
  const platform = submission.platform;
  const evidenceId = randomUUID();
  const performanceId = randomUUID();
  const fileName = `extra-${platform}-read.csv`;
  const csv = [
    "metric,value",
    ...EXTRA_READ_METRICS[platform].map(([metricKey, , metricValue]) =>
      `${metricKey},${metricValue}`,
    ),
    "",
  ].join("\n");
  const storagePath = `${campaignId}/${member.id}/${taskId}/${evidenceId}/${fileName}`;

  const { error: uploadError } = await admin.storage
    .from("campaign-evidence")
    .upload(storagePath, Buffer.from(csv), {
      contentType: "text/csv",
      upsert: true,
    });
  if (uploadError) throw new Error(`Upload extra read proof: ${uploadError.message}`);

  await checkedQuery(
    `Create ${platform} extra read evidence`,
    admin.from("content_performance_evidence").insert({
      id: evidenceId,
      campaign_id: campaignId,
      campaign_member_id: member.id,
      report_task_id: taskId,
      submission_id: submission.id,
      uploaded_by: creatorId,
      evidence_type: "analytics_export",
      bucket_id: "campaign-evidence",
      storage_path: storagePath,
      file_name: fileName,
      mime_type: "text/csv",
      size_bytes: Buffer.byteLength(csv),
      verification_status: "submitted",
    }),
  );

  await checkedQuery(
    `Create ${platform} extra read performance`,
    admin.from("content_performance").insert({
      id: performanceId,
      submission_id: submission.id,
      measurement_type: "final_7d",
      report_task_id: taskId,
      reported_at: EXTRA_READ_REPORTED_AT,
      screenshot_url: `campaign-evidence/${storagePath}`,
      verification_status: "submitted",
      ...legacyColumnsFor(platform),
    }),
  );

  await checkedQuery(
    `Link ${platform} extra read evidence`,
    admin
      .from("content_performance_evidence")
      .update({ performance_id: performanceId })
      .eq("id", evidenceId),
  );

  await checkedQuery(
    `Create ${platform} extra read metric values`,
    admin
      .from("content_performance_metric_values")
      .insert(metricRowsForPerformance({ performanceId, reportTaskId: taskId, platform })),
  );

  return { evidenceId, performanceId, platform, fileName };
}

export async function setupContentReportExtraReadSmokeData(admin, targets) {
  await resetExistingExtraReadTasks(admin, targets.campaignId);

  const [member] = await checkedQuery(
    "Find accepted campaign member",
    admin
      .from("campaign_members")
      .select("id, creator_id")
      .eq("campaign_id", targets.campaignId)
      .limit(1),
  );
  if (!member) throw new Error("Missing accepted campaign member for extra read smoke");

  const submissions = await checkedQuery(
    "Find published submissions",
    admin
      .from("content_submissions")
      .select("id, platform")
      .eq("campaign_member_id", member.id)
      .eq("status", "published")
      .in("platform", ["tiktok", "instagram"]),
  );
  const submissionsByPlatform = Object.fromEntries(
    (submissions ?? []).map((submission) => [submission.platform, submission]),
  );
  for (const platform of ["tiktok", "instagram"]) {
    if (!submissionsByPlatform[platform]) {
      throw new Error(`Missing published ${platform} submission for extra read smoke`);
    }
  }

  const [task] = await checkedQuery(
    "Create extra read task",
    admin
      .from("campaign_report_tasks")
      .insert({
        campaign_id: targets.campaignId,
        campaign_member_id: member.id,
        task_key: EXTRA_READ_TASK_KEY,
        due_at: EXTRA_READ_DUE_AT,
        status: "submitted_late",
        submitted_at: EXTRA_READ_REPORTED_AT,
      })
      .select("id"),
  );
  if (!task) throw new Error("Failed to create extra read report task");

  const seededEvidence = [];
  for (const platform of ["tiktok", "instagram"]) {
    seededEvidence.push(
      await seedExtraReadProof(admin, {
        campaignId: targets.campaignId,
        member,
        creatorId: member.creator_id,
        taskId: task.id,
        submission: submissionsByPlatform[platform],
      }),
    );
  }

  return {
    reportTaskId: task.id,
    evidenceIds: Object.fromEntries(
      seededEvidence.map((evidence) => [evidence.platform, evidence.evidenceId]),
    ),
  };
}

async function openBrandReportingWorkspace(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for extra read",
  });
  await navigate(client, targets.brandReportingUrl);
  await waitForExpression(
    client,
    'new URL(location.href).searchParams.get("tab") === "reporting" && document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]") != null',
    "brand reporting workspace",
    60000,
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes("extra-tiktok-read.csv") && document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes("extra-instagram-read.csv")',
    "brand extra read proof rows",
    60000,
  );

  return evaluate(client, "document.body.innerText");
}

async function verifyEvidenceById(client, evidenceId, expectedRemainingText) {
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="campaign-reporting-proof-row"][data-evidence-id="${evidenceId}"] [data-testid="campaign-reporting-verify-proof"]') != null`,
    `verify action for evidence ${evidenceId}`,
    60000,
  );
  await evaluate(
    client,
    `(() => {
      const row = document.querySelector('[data-testid="campaign-reporting-proof-row"][data-evidence-id="${evidenceId}"]');
      const button = row?.querySelector('[data-testid="campaign-reporting-verify-proof"]');
      if (!button || button.disabled) throw new Error("Missing enabled evidence verify action");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const row = document.querySelector('[data-testid="campaign-reporting-proof-row"][data-evidence-id="${evidenceId}"]');
      const rowText = row?.innerText.toLowerCase() ?? "";
      const verifyButton = row?.querySelector('[data-testid="campaign-reporting-verify-proof"]');
      return rowText.includes("verified") && !verifyButton &&
        document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes(${JSON.stringify(expectedRemainingText)});
    })()`,
    `post-verify proof queue state for ${evidenceId}`,
    60000,
  );

  return evaluate(client, "document.body.innerText");
}

async function openReportAfterExtraRead(client, targets) {
  await navigate(client, targets.brandReportUrl);
  await waitForExpression(
    client,
    'document.body.innerText.includes("K-Beauty Retail Launch Report") && document.body.innerText.includes("Evidence-backed reads") && document.body.innerText.includes("4/4") && document.body.innerText.includes("05/17")',
    "report with accepted extra read",
    60000,
  );

  return evaluate(client, "document.body.innerText");
}

export async function runContentReportExtraReadSmoke() {
  await loadLocalEnv();

  const targets = buildContentReportExtraReadSmokeTargets();
  const brandSubmittedScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_EXTRA_READ_SUBMITTED_SCREENSHOT_PATH ||
      DEFAULT_BRAND_SUBMITTED_SCREENSHOT_PATH,
  );
  const brandVerifiedScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_EXTRA_READ_VERIFIED_SCREENSHOT_PATH ||
      DEFAULT_BRAND_VERIFIED_SCREENSHOT_PATH,
  );
  const reportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_EXTRA_READ_REPORT_SCREENSHOT_PATH ||
      DEFAULT_REPORT_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-extra-read-smoke-"),
  );
  let chrome;
  let client;
  let previousCampaignState;
  const consoleErrors = [];
  const smokeEvidence = {
    brandSubmittedText: "",
    brandAfterFirstVerifyText: "",
    brandVerifiedText: "",
    reportText: "",
  };

  try {
    previousCampaignState = await prepareContentReportExtraReadCampaign(
      admin,
      targets.campaignId,
    );
    const seeded = await setupContentReportExtraReadSmokeData(admin, targets);

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

    smokeEvidence.brandSubmittedText = await openBrandReportingWorkspace(
      client,
      targets,
    );
    await captureScreenshot(client, brandSubmittedScreenshotPath);
    smokeEvidence.brandAfterFirstVerifyText = await verifyEvidenceById(
      client,
      seeded.evidenceIds.tiktok,
      "extra-instagram-read.csv",
    );
    smokeEvidence.brandVerifiedText = await verifyEvidenceById(
      client,
      seeded.evidenceIds.instagram,
      "extra-instagram-read.csv",
    );
    await captureScreenshot(client, brandVerifiedScreenshotPath);
    smokeEvidence.reportText = await openReportAfterExtraRead(client, targets);
    await captureScreenshot(client, reportScreenshotPath);

    validateContentReportExtraReadSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandReportingUrl: targets.brandReportingUrl,
      brandReportUrl: targets.brandReportUrl,
      brandSubmittedScreenshotPath,
      brandVerifiedScreenshotPath,
      reportScreenshotPath,
      keptSmokeData: process.env.SMOKE_KEEP_DATA === "1",
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await resetExistingExtraReadTasks(admin, targets.campaignId);
      await restoreContentReportExtraReadCampaign(
        admin,
        targets.campaignId,
        previousCampaignState,
      );
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
  runContentReportExtraReadSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
