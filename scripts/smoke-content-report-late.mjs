#!/usr/bin/env node

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
  loginForSmoke,
  navigate,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";
import {
  SMOKE_CAMPAIGN_TITLE,
  buildApplicationFlowSmokeTargets,
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeDataDevUser,
  ensureSmokeIdentityEnvDefaults,
  getSmokeCreatorDisplayName,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";
import { submitCreatorApplication } from "./smoke-application-acceptance.mjs";
import {
  acceptCreatorApplication,
  approveBrandContent,
  clickButtonByText,
  openBrandReportingProofQueue,
  publishCreatorContent,
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  transitionSmokeCampaignToActiveWork,
} from "./smoke-content-report-workflow.mjs";

export const DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000106";

const DEFAULT_CREATOR_LATE_SCREENSHOT_PATH =
  "output/playwright/content-report-late-creator-smoke.png";
const DEFAULT_BRAND_LATE_SCREENSHOT_PATH =
  "output/playwright/content-report-late-brand-smoke.png";
const DEFAULT_BRAND_LATE_MISSED_QUEUE_SCREENSHOT_PATH =
  "output/playwright/content-report-late-brand-missed-queue-smoke.png";

export function buildContentReportLateSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_LATE_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    brandReportUrl: `${targets.baseUrl}/b/campaigns/${campaignId}/report`,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
  };
}

export function validateContentReportLateSmoke({
  creatorOverdueText,
  creatorLateText,
  brandMissedText,
  brandLateText,
  brandVerifiedText,
  consoleErrors,
}) {
  const normalizedCreatorOverdueText = creatorOverdueText.toLowerCase();
  const normalizedCreatorLateText = creatorLateText.toLowerCase();
  const normalizedBrandMissedText = brandMissedText.toLowerCase();
  const normalizedBrandLateText = brandLateText.toLowerCase();
  const normalizedBrandVerifiedText = brandVerifiedText.toLowerCase();

  const requiredCreatorOverdueText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["overdue creator proof", "Performance overdue"],
    ["analytics proof", "Platform analytics proof"],
  ];
  const requiredCreatorLateText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["post-submit next action", "Proof sent for review"],
  ];
  const requiredBrandMissedText = [
    ["proof queue", "Proof queue"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["platform", "TikTok"],
    ["missed state", "Missed"],
    ["follow-up action", "Follow up"],
    ["excuse action", "Mark excused"],
    ["follow-up state", "Follow-up requested"],
  ];
  const requiredBrandLateText = [
    ["proof queue", "Proof queue"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["platform", "TikTok"],
    ["late state", "Submitted late"],
    ["verify action", "Verify"],
  ];
  const requiredBrandVerifiedText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["proof queue", "Proof queue"],
    ["evidence trail", "Evidence Trail"],
    ["verified late state", "Verified late"],
  ];

  for (const [label, text] of requiredCreatorOverdueText) {
    if (!normalizedCreatorOverdueText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator overdue proof: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorLateText) {
    if (!normalizedCreatorLateText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator late submission proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandMissedText) {
    if (!normalizedBrandMissedText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand missed report proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandLateText) {
    if (!normalizedBrandLateText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand late report proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandVerifiedText) {
    if (!normalizedBrandVerifiedText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand verified late proof: ${label}`);
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function markLatestReportTaskMissed(admin, campaignId) {
  const { data: task, error: taskError } = await admin
    .from("campaign_report_tasks")
    .select("id")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (taskError || !task) {
    throw new Error(taskError?.message || "Missing report task to mark missed");
  }

  const dueAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const missedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await admin
    .from("campaign_report_tasks")
    .update({
      due_at: dueAt,
      status: "missed",
      missed_at: missedAt,
      submitted_at: null,
      verified_at: null,
      review_note: null,
      updated_at: missedAt,
    })
    .eq("id", task.id);

  if (updateError) throw new Error(updateError.message);

  return task.id;
}

async function assertReportTaskStatus(admin, reportTaskId, status) {
  const { data: task, error } = await admin
    .from("campaign_report_tasks")
    .select("status")
    .eq("id", reportTaskId)
    .single();

  if (error || !task) throw new Error(error?.message || "Report task not found");
  if (task.status !== status) {
    throw new Error(`Expected report task ${reportTaskId} to be ${status}, got ${task.status}`);
  }
}

async function openCreatorOverdueReport(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect for late report",
  });
  await navigate(client, targets.creatorCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && document.body.innerText.includes("Performance overdue")`,
    "creator overdue report action",
    60000,
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"performance-evidence-block\\"] input[type=file]") != null',
    "creator overdue performance proof form",
    60000,
  );

  return evaluate(client, "document.body.innerText");
}

async function openBrandMissedProofQueue(
  client,
  targets,
  { missedQueueScreenshotPath } = {},
) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for missed report follow-up",
  });
  const missedQueueText = await openBrandReportingProofQueue(client, targets, {
    description: "brand missed proof queue",
    expectedTexts: [getSmokeCreatorDisplayName(), "Missed"],
    proofQueueScreenshotPath: missedQueueScreenshotPath,
  });
  await waitForExpression(
    client,
    `(() => {
      const queue = document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]");
      const text = queue?.innerText ?? "";
      return Boolean(queue) &&
        text.includes("Follow up") &&
        text.includes("Mark excused") &&
        document.querySelector("[data-testid=\\"campaign-reporting-follow-up-missed\\"]") != null &&
        document.querySelector("[data-testid=\\"campaign-reporting-mark-excused\\"]") != null;
    })()`,
    "brand missed proof queue actions",
    60000,
  );
  await clickButtonByText(client, "Follow up", '[data-testid="campaign-reporting-proof-queue"]');
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes("Follow-up requested")',
    "brand missed proof follow-up requested",
    60000,
  );
  const followedUpQueueText = await evaluate(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText ?? ""',
  );

  return `${missedQueueText} ${followedUpQueueText}`;
}

async function openBrandLateReport(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for late report",
  });
  const lateQueueText = await openBrandReportingProofQueue(client, targets, {
    description: "brand submitted late proof queue",
    expectedTexts: [getSmokeCreatorDisplayName(), "Submitted late"],
  });
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes("Submitted late") && document.querySelector("[data-testid=\\"campaign-reporting-verify-proof\\"]") != null',
    "brand submitted late state",
    60000,
  );

  return lateQueueText;
}

async function verifyBrandLateReportEvidence(client, targets) {
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-verify-proof\\"]") != null',
    "brand late evidence verify action",
    60000,
  );
  await clickButtonByText(client, "Verify", '[data-testid="campaign-reporting-proof-queue"]');
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes("Verified late")',
    "brand verified late report evidence in proof queue",
    60000,
  );
  const verifiedQueueText = await evaluate(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText ?? ""',
  );
  await navigate(client, targets.brandReportUrl);
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"report-evidence-trail\\"]")?.innerText.includes("Verified late")',
    "brand verified late report artifact",
    60000,
  );
  const reportText = await evaluate(client, "document.body.innerText");

  return `${verifiedQueueText} ${reportText}`;
}

async function runContentReportLateSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildContentReportLateSmokeTargets();
  const creatorLateScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_LATE_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_LATE_SCREENSHOT_PATH,
  );
  const brandLateScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_LATE_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_LATE_SCREENSHOT_PATH,
  );
  const brandMissedQueueScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_LATE_BRAND_MISSED_QUEUE_SCREENSHOT_PATH ||
      DEFAULT_BRAND_LATE_MISSED_QUEUE_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-content-report-late-smoke-"),
  );
  let chrome;
  let client;
  let reportTaskId = null;
  const consoleErrors = [];
  const smokeEvidence = {
    creatorOverdueText: "",
    creatorLateText: "",
    brandMissedText: "",
    brandLateText: "",
    brandVerifiedText: "",
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
      consoleErrors.push(event.exceptionDetails?.text || "Runtime exception");
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    await acceptCreatorApplication(client, targets);
    await transitionSmokeCampaignToActiveWork(admin, targets.campaignId);
    await submitCreatorDraft(client, targets);
    await approveBrandContent(client, targets);
    await publishCreatorContent(client, targets);
    reportTaskId = await markLatestReportTaskMissed(admin, targets.campaignId);
    smokeEvidence.brandMissedText = await openBrandMissedProofQueue(client, targets, {
      missedQueueScreenshotPath: brandMissedQueueScreenshotPath,
    });
    smokeEvidence.creatorOverdueText = await openCreatorOverdueReport(client, targets);
    smokeEvidence.creatorLateText = await submitCreatorPerformanceProof(client);
    await assertReportTaskStatus(admin, reportTaskId, "submitted_late");
    await captureScreenshot(client, creatorLateScreenshotPath);
    smokeEvidence.brandLateText = await openBrandLateReport(client, targets);
    smokeEvidence.brandVerifiedText = await verifyBrandLateReportEvidence(
      client,
      targets,
    );
    await assertReportTaskStatus(admin, reportTaskId, "verified");
    await captureScreenshot(client, brandLateScreenshotPath);

    validateContentReportLateSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      creatorLateScreenshotPath,
      brandMissedQueueScreenshotPath,
      brandLateScreenshotPath,
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
  runContentReportLateSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
