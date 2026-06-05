#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import {
  SMOKE_CAMPAIGN_TITLE,
  captureScreenshot,
  checkedQuery,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeIdentityEnvDefaults,
  getSmokeCreatorDisplayName,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";

export const DEFAULT_COMPLETED_CAMPAIGN_WORK_LOCK_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000114";
export const CLOSED_CONTENT_DECISIONS_MESSAGE =
  "Content review is closed for this campaign stage.";
export const CLOSED_PROOF_DECISIONS_MESSAGE =
  "Proof review is closed for this campaign stage.";
export const CLOSED_CREATOR_WORK_MESSAGE =
  "This campaign is read-only; completed work and proof stay visible.";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_CONTENT_SCREENSHOT_PATH =
  "output/playwright/completed-campaign-work-lock-content-smoke.png";
const DEFAULT_REPORTING_SCREENSHOT_PATH =
  "output/playwright/completed-campaign-work-lock-reporting-smoke.png";
const DEFAULT_CREATOR_SCREENSHOT_PATH =
  "output/playwright/completed-campaign-work-lock-creator-smoke.png";

export function buildCompletedCampaignWorkLockSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_COMPLETED_CAMPAIGN_WORK_LOCK_ID ||
    DEFAULT_COMPLETED_CAMPAIGN_WORK_LOCK_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    brandCampaignContentUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}?tab=content`,
    brandCampaignReportingUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}?tab=reporting`,
    creatorCampaignSubmitUrl: `${normalizedBaseUrl}/i/campaigns/${campaignId}?tab=submit`,
  };
}

export function validateCompletedCampaignWorkLockSmoke({
  contentText,
  reportingText,
  visibleContentDecisionCount,
  visibleProofDecisionCount,
  visibleMissedDecisionCount,
  creatorText,
  visibleCreatorWorkControlCount,
  consoleErrors,
}) {
  if (!contentText.includes(SMOKE_CAMPAIGN_TITLE)) {
    throw new Error("Expected the completed smoke campaign content tab to render.");
  }

  if (!contentText.includes(CLOSED_CONTENT_DECISIONS_MESSAGE)) {
    throw new Error("Expected the completed campaign content lock message.");
  }

  if (
    !contentText.includes(getSmokeCreatorDisplayName()) ||
    !contentText.includes("Submitted")
  ) {
    throw new Error("Expected submitted content to stay visible for review history.");
  }

  if (visibleContentDecisionCount > 0) {
    throw new Error("Expected completed campaign to hide active content decisions.");
  }

  if (!reportingText.includes(SMOKE_CAMPAIGN_TITLE)) {
    throw new Error("Expected the completed smoke campaign reporting tab to render.");
  }

  if (!reportingText.includes(CLOSED_PROOF_DECISIONS_MESSAGE)) {
    throw new Error("Expected the completed campaign proof lock message.");
  }

  if (
    !reportingText.includes(getSmokeCreatorDisplayName()) ||
    !reportingText.includes("Open proof")
  ) {
    throw new Error("Expected proof evidence to stay readable after completion.");
  }

  if (visibleProofDecisionCount > 0 || visibleMissedDecisionCount > 0) {
    throw new Error("Expected completed campaign to hide active proof decisions.");
  }

  if (!creatorText.includes(SMOKE_CAMPAIGN_TITLE)) {
    throw new Error("Expected the completed smoke campaign creator room to render.");
  }

  if (!creatorText.includes(CLOSED_CREATOR_WORK_MESSAGE)) {
    throw new Error("Expected the completed creator room work lock message.");
  }

  if (!creatorText.includes("Submission handoff")) {
    throw new Error("Expected completed creator work history to stay visible.");
  }

  if (visibleCreatorWorkControlCount > 0) {
    throw new Error("Expected completed creator room to hide active work controls.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function seedCompletedCampaignWorkLockRows(admin, targets, creatorId) {
  const now = new Date().toISOString();
  const memberId = randomUUID();
  const submissionId = randomUUID();
  const approvedSubmissionId = randomUUID();
  const publishedSubmissionId = randomUUID();
  const reportTaskId = randomUUID();
  const pendingReportTaskId = randomUUID();

  await checkedQuery(
    "Create completed campaign work lock member",
    admin.from("campaign_members").insert({
      id: memberId,
      campaign_id: targets.campaignId,
      creator_id: creatorId,
      accepted_rate: 100,
      payment_status: "pending",
      joined_at: now,
    }),
  );

  await checkedQuery(
    "Create completed campaign submitted content",
    admin.from("content_submissions").insert({
      id: submissionId,
      campaign_member_id: memberId,
      content_url: "https://www.tiktok.com/@popsdrops-smoke/video/114",
      caption: "Completed campaign work lock smoke draft.",
      platform: "tiktok",
      status: "submitted",
      version: 1,
      revision_count: 0,
      submitted_at: now,
    }),
  );

  await checkedQuery(
    "Create completed campaign approved unpublished content",
    admin.from("content_submissions").insert({
      id: approvedSubmissionId,
      campaign_member_id: memberId,
      content_url: "https://drive.google.com/file/d/popsdrops-approved-smoke",
      caption: "Approved content should not expose live URL work after completion.",
      platform: "tiktok",
      status: "approved",
      version: 1,
      revision_count: 0,
      submitted_at: now,
      reviewed_at: now,
    }),
  );

  await checkedQuery(
    "Create completed campaign published content with open proof task",
    admin.from("content_submissions").insert({
      id: publishedSubmissionId,
      campaign_member_id: memberId,
      content_url: "https://drive.google.com/file/d/popsdrops-published-smoke",
      caption: "Published content should not expose proof work after completion.",
      platform: "tiktok",
      status: "published",
      version: 1,
      revision_count: 0,
      submitted_at: now,
      reviewed_at: now,
      published_url: "https://www.tiktok.com/@popsdrops-smoke/video/114-live",
      published_at: now,
    }),
  );

  await checkedQuery(
    "Create completed campaign submitted report task",
    admin.from("campaign_report_tasks").insert({
      id: reportTaskId,
      campaign_id: targets.campaignId,
      campaign_member_id: memberId,
      task_key: "final_report",
      due_at: now,
      status: "submitted",
      submitted_at: now,
    }),
  );

  await checkedQuery(
    "Create completed campaign pending proof task",
    admin.from("campaign_report_tasks").insert({
      id: pendingReportTaskId,
      campaign_id: targets.campaignId,
      campaign_member_id: memberId,
      task_key: "extra:completed-work-lock",
      due_at: now,
      status: "pending",
    }),
  );

  await checkedQuery(
    "Create completed campaign submitted proof link",
    admin.from("content_performance").insert({
      submission_id: publishedSubmissionId,
      report_task_id: reportTaskId,
      measurement_type: "final_7d",
      views: 1240,
      likes: 110,
      comments: 7,
      shares: 12,
      screenshot_url: "https://example.com/popsdrops-completed-proof.png",
      verification_status: "submitted",
      reported_at: now,
    }),
  );

  await checkedQuery(
    "Complete smoke campaign for work lock",
    admin
      .from("campaigns")
      .update({
        status: "completed",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", targets.campaignId),
  );

  return {
    memberId,
    submissionId,
    approvedSubmissionId,
    publishedSubmissionId,
    reportTaskId,
    pendingReportTaskId,
  };
}

async function inspectCompletedCampaignWorkLockContent(client) {
  await waitForExpression(
    client,
    `(() => {
      const table = document.querySelector('[data-testid="campaign-content-table"]');
      return Boolean(
        table &&
        document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
        table.innerText.includes(${JSON.stringify(CLOSED_CONTENT_DECISIONS_MESSAGE)}) &&
        table.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())}) &&
        table.innerText.includes("Submitted")
      );
    })()`,
    "completed campaign content lock table",
  );

  return evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      return {
        contentText: document.body.innerText,
        visibleContentDecisionCount: visible(
          '[data-testid="campaign-content-request-revision"], [data-testid="campaign-content-approve"]'
        ).length,
      };
    })()`,
  );
}

async function inspectCompletedCampaignWorkLockReporting(client) {
  await waitForExpression(
    client,
    `(() => {
      const queue = document.querySelector('[data-testid="campaign-reporting-proof-queue"]');
      return Boolean(
        queue &&
        document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
        queue.innerText.includes(${JSON.stringify(CLOSED_PROOF_DECISIONS_MESSAGE)}) &&
        queue.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())}) &&
        queue.innerText.includes("Open proof")
      );
    })()`,
    "completed campaign reporting proof lock queue",
  );

  return evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      return {
        reportingText: document.body.innerText,
        visibleProofDecisionCount: visible(
          '[data-testid="campaign-reporting-verify-proof"], [data-testid="campaign-reporting-request-correction"]'
        ).length,
        visibleMissedDecisionCount: visible(
          '[data-testid="campaign-reporting-follow-up-missed"], [data-testid="campaign-reporting-mark-excused"]'
        ).length,
      };
    })()`,
  );
}

async function inspectCompletedCampaignCreatorWorkLock(client) {
  await waitForExpression(
    client,
    `(() => {
      const workspace = document.querySelector('[data-testid="creator-submit-workspace"]');
       return Boolean(
         workspace &&
         workspace.querySelector('[data-testid="creator-work-read-only-stage"]') &&
         document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
         workspace.innerText.includes(${JSON.stringify(CLOSED_CREATOR_WORK_MESSAGE)}) &&
         workspace.innerText.includes("Submission handoff")
       );
    })()`,
    "completed campaign creator work lock workspace",
  );

  return evaluate(
    client,
    `(() => {
      const visible = (node) => node.offsetParent !== null;
      const workButtonPattern = /Submit draft|Save live URL|Send .* proof|Resubmit proof|Add read/;
      const workButtons = [...document.querySelectorAll('button')]
        .filter(visible)
        .filter((button) => workButtonPattern.test(button.innerText || ""));
      const workPanels = [...document.querySelectorAll(
        '[data-testid="performance-evidence-block"], [data-testid="performance-metric-grid"]'
      )].filter(visible);
      const contentFormHints = [...document.querySelectorAll('input, textarea')]
        .filter(visible)
        .filter((node) => {
          const aria = node.getAttribute("aria-label") || "";
          const placeholder = node.getAttribute("placeholder") || "";
          return /Draft content link|Notes for brand|Drive, Dropbox|Frame\\.io/.test(
            aria + " " + placeholder,
          );
        });

      return {
        creatorText: document.body.innerText,
        visibleCreatorWorkControlCount:
          workButtons.length + workPanels.length + contentFormHints.length,
      };
    })()`,
  );
}

export async function runCompletedCampaignWorkLockSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  process.env.POPSDROPS_SMOKE_QUEUE_ONLY ||= "1";

  const targets = buildCompletedCampaignWorkLockSmokeTargets();
  process.env.NEXT_PUBLIC_APP_URL = targets.baseUrl;

  const contentScreenshotPath = path.resolve(
    process.env.SMOKE_COMPLETED_CAMPAIGN_WORK_LOCK_CONTENT_SCREENSHOT_PATH ||
      DEFAULT_CONTENT_SCREENSHOT_PATH,
  );
  const reportingScreenshotPath = path.resolve(
    process.env.SMOKE_COMPLETED_CAMPAIGN_WORK_LOCK_REPORTING_SCREENSHOT_PATH ||
      DEFAULT_REPORTING_SCREENSHOT_PATH,
  );
  const creatorScreenshotPath = path.resolve(
    process.env.SMOKE_COMPLETED_CAMPAIGN_WORK_LOCK_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  const { creatorId } = await setupApplicationFlowSmokeData(admin, targets);
  await seedCompletedCampaignWorkLockRows(admin, targets, creatorId);

  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-completed-work-lock-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];

  try {
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

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect",
    });

    await navigate(client, targets.brandCampaignContentUrl);
    const contentState = await inspectCompletedCampaignWorkLockContent(client);
    await evaluate(
      client,
      `(() => {
        const table = document.querySelector('[data-testid="campaign-content-table"]');
        if (!table) throw new Error("Missing completed campaign content table");
        const top = table.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await captureScreenshot(client, contentScreenshotPath);

    await navigate(client, targets.brandCampaignReportingUrl);
    const reportingState = await inspectCompletedCampaignWorkLockReporting(client);
    await evaluate(
      client,
      `(() => {
        const queue = document.querySelector('[data-testid="campaign-reporting-proof-queue"]');
        if (!queue) throw new Error("Missing completed campaign proof queue");
        const top = queue.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await captureScreenshot(client, reportingScreenshotPath);

    await loginForSmoke(client, {
      loginUrl: targets.creatorLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/i/`,
      description: "creator dev login redirect",
    });

    await navigate(client, targets.creatorCampaignSubmitUrl);
    const creatorState = await inspectCompletedCampaignCreatorWorkLock(client);
    await evaluate(
      client,
      `(() => {
        const workspace = document.querySelector('[data-testid="creator-submit-workspace"]');
        if (!workspace) throw new Error("Missing completed campaign creator workspace");
        const top = workspace.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await captureScreenshot(client, creatorScreenshotPath);

    validateCompletedCampaignWorkLockSmoke({
      ...contentState,
      ...reportingState,
      ...creatorState,
      consoleErrors,
    });

    return {
      ok: true,
      campaignId: targets.campaignId,
      contentScreenshotPath,
      reportingScreenshotPath,
      creatorScreenshotPath,
    };
  } finally {
    client?.close();
    chrome?.kill();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId).catch(
      (error) => {
        process.stderr.write(`[smoke] Cleanup failed: ${error.message}\n`);
      },
    );
    await stopDevServer(devServer);
  }
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  runCompletedCampaignWorkLockSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
