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
  waitForExpression,
} from "./smoke-campaign-detail.mjs";
import {
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
  transitionSmokeCampaignToActiveWork,
} from "./smoke-content-report-workflow.mjs";

export const DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000110";

const DEFAULT_BRAND_EXCUSED_SCREENSHOT_PATH =
  "output/playwright/content-report-excused-brand-smoke.png";

export function buildContentReportExcusedSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    brandReportUrl: `${targets.baseUrl}/b/campaigns/${campaignId}/report`,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
  };
}

export function validateContentReportExcusedSmoke({
  brandMissedText,
  brandExcusedText,
  consoleErrors,
}) {
  const normalizedBrandMissedText = brandMissedText.toLowerCase();
  const normalizedBrandExcusedText = brandExcusedText.toLowerCase();

  const requiredBrandMissedText = [
    ["proof queue", "Proof queue"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["platform", "TikTok"],
    ["missed state", "Missed"],
    ["follow-up action", "Follow up"],
    ["excuse action", "Mark excused"],
  ];
  const requiredBrandExcusedText = [
    ["proof queue", "Proof queue"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["platform", "TikTok"],
    ["excused state", "Excused"],
  ];

  for (const [label, text] of requiredBrandMissedText) {
    if (!normalizedBrandMissedText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand missed report proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandExcusedText) {
    if (!normalizedBrandExcusedText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand excused report proof: ${label}`);
    }
  }

  if (normalizedBrandExcusedText.includes("mark excused")) {
    throw new Error("Missing brand excused state: mark-excused action still visible");
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
      excused_at: null,
      review_note: null,
      updated_at: missedAt,
    })
    .eq("id", task.id);

  if (updateError) throw new Error(updateError.message);

  return task.id;
}

async function assertReportTaskExcused(admin, reportTaskId) {
  const { data: task, error } = await admin
    .from("campaign_report_tasks")
    .select("status, excused_at, missed_at")
    .eq("id", reportTaskId)
    .single();

  if (error || !task) throw new Error(error?.message || "Report task not found");
  if (task.status !== "excused") {
    throw new Error(
      `Expected report task ${reportTaskId} to be excused, got ${task.status}`,
    );
  }
  if (!task.excused_at) {
    throw new Error(`Expected report task ${reportTaskId} to record excused_at`);
  }
  if (task.missed_at) {
    throw new Error(`Expected report task ${reportTaskId} to clear missed_at`);
  }
}

async function openBrandMissedProofQueue(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for missed report excuse",
  });
  const missedQueueText = await openBrandReportingProofQueue(client, targets, {
    description: "brand missed proof queue before excuse",
    expectedTexts: [getSmokeCreatorDisplayName(), "Missed"],
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
    "brand missed proof queue excuse action",
    60000,
  );

  return missedQueueText;
}

async function markBrandReportTaskExcused(
  client,
  { brandExcusedScreenshotPath } = {},
) {
  await clickButtonByText(client, "Mark excused", '[data-testid="campaign-reporting-proof-queue"]');
  await waitForExpression(
    client,
    `(() => {
      const queue = document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]");
      const text = queue?.innerText ?? "";
      return text.includes("Excused") && !text.includes("Mark excused");
    })()`,
    "brand excused missed proof",
    60000,
  );

  if (brandExcusedScreenshotPath) {
    await captureScreenshot(client, brandExcusedScreenshotPath);
  }

  return evaluate(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText ?? ""',
  );
}

async function runContentReportExcusedSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildContentReportExcusedSmokeTargets();
  const brandExcusedScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_EXCUSED_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_EXCUSED_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-content-report-excused-smoke-"),
  );
  let chrome;
  let client;
  let reportTaskId = null;
  const consoleErrors = [];
  const smokeEvidence = {
    brandMissedText: "",
    brandExcusedText: "",
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
    smokeEvidence.brandMissedText = await openBrandMissedProofQueue(
      client,
      targets,
    );
    smokeEvidence.brandExcusedText = await markBrandReportTaskExcused(client, {
      brandExcusedScreenshotPath,
    });
    await assertReportTaskExcused(admin, reportTaskId);

    validateContentReportExcusedSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      brandExcusedScreenshotPath,
      reportTaskId,
      status: "excused",
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
  runContentReportExcusedSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
