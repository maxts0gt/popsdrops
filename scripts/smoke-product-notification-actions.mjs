#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  clickTab,
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
  attachInviteToApplicationFlowSmokeTargets,
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
  publishCreatorContent,
  setInputValue,
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  transitionSmokeCampaignToActiveWork,
  verifyBrandReportEvidence,
} from "./smoke-content-report-workflow.mjs";
import {
  requestReportCorrection,
  submitCreatorCorrectedPerformance,
} from "./smoke-content-report-recovery.mjs";

export const DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000108";
export const DEFAULT_PRODUCT_NOTIFICATION_ACTION_REJECTION_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000109";

export const PRODUCT_NOTIFICATION_ACTION_TYPES = [
  "application_rejected",
  "campaign_update",
  "report_correction_requested",
  "campaign_completed",
];

const DEFAULT_CREATOR_NOTIFICATION_EMAIL =
  process.env.SMOKE_PRODUCT_NOTIFICATION_CREATOR_EMAIL ||
  "creator-product-notification-smoke@example.invalid";
const DEFAULT_BRAND_NOTIFICATION_EMAIL =
  process.env.SMOKE_PRODUCT_NOTIFICATION_BRAND_EMAIL ||
  "brand-product-notification-smoke@example.invalid";
const DEFAULT_REJECTION_SCREENSHOT_PATH =
  "output/playwright/product-notification-action-rejection-smoke.png";
const DEFAULT_COMPLETION_SCREENSHOT_PATH =
  "output/playwright/product-notification-action-completion-smoke.png";
const ANNOUNCEMENT_MESSAGE =
  "Product action smoke announcement for notification email delivery.";

export function buildProductNotificationActionSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID ||
    DEFAULT_PRODUCT_NOTIFICATION_ACTION_CAMPAIGN_ID,
  rejectionCampaignId =
    process.env.SMOKE_PRODUCT_NOTIFICATION_ACTION_REJECTION_CAMPAIGN_ID ||
    DEFAULT_PRODUCT_NOTIFICATION_ACTION_REJECTION_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });
  const rejectionTargets = buildApplicationFlowSmokeTargets({
    baseUrl: targets.baseUrl,
    campaignId: rejectionCampaignId,
  });

  return {
    ...targets,
    brandReportUrl: `${targets.baseUrl}/b/campaigns/${campaignId}/report`,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
    rejectionCampaignId,
    rejectionApplyUrl: rejectionTargets.applyUrl,
    rejectionDiscoverUrl: rejectionTargets.discoverUrl,
    rejectionBrandCampaignUrl: rejectionTargets.brandCampaignUrl,
  };
}

export function validateProductNotificationActionSmoke({
  notificationResults,
  consoleErrors,
}) {
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  for (const type of PRODUCT_NOTIFICATION_ACTION_TYPES) {
    const result = notificationResults.find((item) => item.type === type);
    if (!result) {
      throw new Error(`Missing product notification action result: ${type}`);
    }
    if (result.queueStatus !== "sent") {
      throw new Error(
        `Product notification ${type} did not send. Queue status: ${result.queueStatus}`,
      );
    }
  }

  return { ok: true };
}

export function buildRejectionApplicationTargets(targets, inviteId) {
  return attachInviteToApplicationFlowSmokeTargets(
    {
      ...targets,
      campaignId: targets.rejectionCampaignId,
      applyUrl: targets.rejectionApplyUrl,
      discoverUrl: targets.rejectionDiscoverUrl,
      brandCampaignUrl: targets.rejectionBrandCampaignUrl,
    },
    inviteId,
  );
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function updateProfileEmail(admin, profileId, email) {
  await checkedQuery(
    `Route smoke email for ${profileId}`,
    admin.from("profiles").update({ email }).eq("id", profileId),
  );
}

async function readProfileEmails(admin, profileIds) {
  const rows = await checkedQuery(
    "Read smoke profile emails",
    admin.from("profiles").select("id, email").in("id", profileIds),
  );

  return Object.fromEntries((rows ?? []).map((row) => [row.id, row.email]));
}

async function restoreProfileEmails(admin, originalEmails) {
  for (const [profileId, email] of Object.entries(originalEmails)) {
    if (email) await updateProfileEmail(admin, profileId, email);
  }
}

async function routeSmokeRecipients(admin, { brandId, creatorId }) {
  await Promise.all([
    updateProfileEmail(admin, creatorId, DEFAULT_CREATOR_NOTIFICATION_EMAIL),
    updateProfileEmail(admin, brandId, DEFAULT_BRAND_NOTIFICATION_EMAIL),
  ]);
}

async function moveCampaignToMonitoring(admin, campaignId) {
  await checkedQuery(
    `Move campaign ${campaignId} to monitoring`,
    admin
      .from("campaigns")
      .update({ status: "monitoring" })
      .eq("id", campaignId)
      .select("id, status")
      .single(),
  );
}

async function waitForSentProductNotificationEmail({
  admin,
  campaignId,
  type,
  userId,
  timeoutMs = 60000,
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const notificationsById = new Map();

    for (const campaignKey of ["campaignId", "campaign_id"]) {
      const rows = await checkedQuery(
        `Find notification ${type}`,
        admin
          .from("notifications")
          .select("id, user_id, type, title, body, data, created_at")
          .eq("type", type)
          .eq("user_id", userId)
          .contains("data", { [campaignKey]: campaignId })
          .order("created_at", { ascending: false })
          .limit(1),
      );
      for (const row of rows ?? []) notificationsById.set(row.id, row);
    }

    const notifications = [...notificationsById.values()].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );
    const notification = notifications?.[0];

    if (notification?.id) {
      const queueItem = await checkedQuery(
        `Find queue item ${type}`,
        admin
          .from("notification_queue")
          .select(
            "id, notification_id, email, template, status, attempt_count, processed_at, processed_reason, delivered_at",
          )
          .eq("notification_id", notification.id)
          .maybeSingle(),
      );

      if (queueItem?.status === "sent") {
        if (queueItem.template !== type) {
          throw new Error(
            `Queue template mismatch for ${type}: ${queueItem.template}`,
          );
        }
        if (!queueItem.delivered_at || queueItem.processed_reason !== "email_sent") {
          throw new Error(`Queue sent state is incomplete for ${type}`);
        }

        return {
          notificationId: notification.id,
          queueId: queueItem.id,
          queueStatus: queueItem.status,
          recipient: queueItem.email,
          type,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for sent product notification: ${type}`);
}

async function rejectCreatorApplication(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for application rejection",
  });
  await navigate(client, targets.rejectionBrandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
    "brand campaign before rejection",
  );
  await clickTab(client, "Creators");
  const creatorDisplayName = getSmokeCreatorDisplayName();
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-creators-section-applicants\\"]")?.innerText.includes(${JSON.stringify(creatorDisplayName)})`,
    "brand pending applicant before rejection",
  );
  await clickButtonByText(
    client,
    "Decline",
    '[data-testid="campaign-creators-section-applicants"]',
  );
  await waitForExpression(
    client,
    `(() => {
      const section = document.querySelector('[data-testid="campaign-creators-section-applicants"]');
      const text = section?.innerText ?? "";
      return text.includes("No applications yet") || !text.includes(${JSON.stringify(creatorDisplayName)});
    })()`,
    "brand applicant rejected state",
  );

  return evaluate(client, "document.body.innerText");
}

async function sendBrandAnnouncement(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for announcement",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && document.querySelector("[data-testid=\\"campaign-controls\\"]") != null`,
    "brand campaign controls before announcement",
  );
  await clickButtonByText(
    client,
    "Send creator update",
    '[data-testid="campaign-controls"]',
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-controls\\"] textarea") != null',
    "announcement textarea",
  );
  await setInputValue(
    client,
    '[data-testid="campaign-controls"] textarea',
    ANNOUNCEMENT_MESSAGE,
  );
  await clickButtonByText(client, "Submit", '[data-testid="campaign-controls"]');
  await waitForExpression(
    client,
    `!document.body.innerText.includes(${JSON.stringify(ANNOUNCEMENT_MESSAGE)})`,
    "announcement dialog closed",
  );

  return evaluate(client, "document.body.innerText");
}

async function completeReadyCampaign(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for campaign completion",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && document.body.innerText.includes("Complete campaign")`,
    "ready to complete campaign action",
    60000,
  );
  await clickButtonByText(client, "Complete campaign");
  await waitForExpression(
    client,
    `document.body.innerText.includes("Completed")`,
    "campaign completed state",
    60000,
  );

  return evaluate(client, "document.body.innerText");
}

async function runProductNotificationActionSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildProductNotificationActionSmokeTargets();
  const rejectionScreenshotPath = path.resolve(
    process.env.SMOKE_PRODUCT_NOTIFICATION_REJECTION_SCREENSHOT_PATH ||
      DEFAULT_REJECTION_SCREENSHOT_PATH,
  );
  const completionScreenshotPath = path.resolve(
    process.env.SMOKE_PRODUCT_NOTIFICATION_COMPLETION_SCREENSHOT_PATH ||
      DEFAULT_COMPLETION_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-product-notification-smoke-"),
  );
  let chrome;
  let client;
  let originalEmails = {};
  const notificationResults = [];
  const consoleErrors = [];

  try {
    const rejectionSetup = await setupApplicationFlowSmokeData(admin, {
      ...targets,
      campaignId: targets.rejectionCampaignId,
      applyUrl: targets.rejectionApplyUrl,
      discoverUrl: targets.rejectionDiscoverUrl,
      brandCampaignUrl: targets.rejectionBrandCampaignUrl,
    });
    const workflowSetup = await setupApplicationFlowSmokeData(admin, targets);

    originalEmails = await readProfileEmails(admin, [
      rejectionSetup.brandId,
      rejectionSetup.creatorId,
      workflowSetup.brandId,
      workflowSetup.creatorId,
    ]);
    await routeSmokeRecipients(admin, rejectionSetup);
    await routeSmokeRecipients(admin, workflowSetup);

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

    await submitCreatorApplication(
      client,
      buildRejectionApplicationTargets(targets, rejectionSetup.inviteId),
    );
    await ensureSmokeDataDevUser(admin, "creator");
    await updateProfileEmail(
      admin,
      rejectionSetup.creatorId,
      DEFAULT_CREATOR_NOTIFICATION_EMAIL,
    );
    await rejectCreatorApplication(client, targets);
    await captureScreenshot(client, rejectionScreenshotPath);
    notificationResults.push(
      await waitForSentProductNotificationEmail({
        admin,
        campaignId: targets.rejectionCampaignId,
        type: "application_rejected",
        userId: rejectionSetup.creatorId,
      }),
    );

    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    await updateProfileEmail(
      admin,
      workflowSetup.creatorId,
      DEFAULT_CREATOR_NOTIFICATION_EMAIL,
    );
    await acceptCreatorApplication(client, targets);

    await updateProfileEmail(
      admin,
      workflowSetup.creatorId,
      DEFAULT_CREATOR_NOTIFICATION_EMAIL,
    );
    await sendBrandAnnouncement(client, targets);
    notificationResults.push(
      await waitForSentProductNotificationEmail({
        admin,
        campaignId: targets.campaignId,
        type: "campaign_update",
        userId: workflowSetup.creatorId,
      }),
    );

    await transitionSmokeCampaignToActiveWork(admin, targets.campaignId);
    await submitCreatorDraft(client, targets);
    await updateProfileEmail(
      admin,
      workflowSetup.creatorId,
      DEFAULT_CREATOR_NOTIFICATION_EMAIL,
    );
    await approveBrandContent(client, targets);
    await publishCreatorContent(client, targets);
    await submitCreatorPerformanceProof(client);

    await updateProfileEmail(
      admin,
      workflowSetup.creatorId,
      DEFAULT_CREATOR_NOTIFICATION_EMAIL,
    );
    await requestReportCorrection(client, targets);
    notificationResults.push(
      await waitForSentProductNotificationEmail({
        admin,
        campaignId: targets.campaignId,
        type: "report_correction_requested",
        userId: workflowSetup.creatorId,
      }),
    );

    await submitCreatorCorrectedPerformance(client, targets);
    await verifyBrandReportEvidence(client, targets);
    await moveCampaignToMonitoring(admin, targets.campaignId);

    await updateProfileEmail(
      admin,
      workflowSetup.creatorId,
      DEFAULT_CREATOR_NOTIFICATION_EMAIL,
    );
    await completeReadyCampaign(client, targets);
    await captureScreenshot(client, completionScreenshotPath);
    notificationResults.push(
      await waitForSentProductNotificationEmail({
        admin,
        campaignId: targets.campaignId,
        type: "campaign_completed",
        userId: workflowSetup.creatorId,
      }),
    );

    validateProductNotificationActionSmoke({
      notificationResults,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      completionScreenshotPath,
      creatorNotificationEmail: DEFAULT_CREATOR_NOTIFICATION_EMAIL,
      devServerStarted: Boolean(devServer),
      keptSmokeData: process.env.SMOKE_KEEP_DATA === "1",
      notificationResults,
      rejectionBrandCampaignUrl: targets.rejectionBrandCampaignUrl,
      rejectionScreenshotPath,
    };
  } finally {
    client?.close();
    chrome?.kill();
    await restoreProfileEmails(admin, originalEmails);

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await cleanupApplicationFlowSmokeData(admin, targets.rejectionCampaignId);
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
  runProductNotificationActionSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
