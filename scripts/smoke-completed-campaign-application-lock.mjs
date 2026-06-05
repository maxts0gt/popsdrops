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
  SMOKE_PITCH,
  captureScreenshot,
  checkedQuery,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeIdentityEnvDefaults,
  getSmokeCreatorDisplayName,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
  waitForCreatorCampaignHeroImage,
} from "./smoke-application-flow.mjs";

export const DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000113";
export const CLOSED_APPLICATION_DECISIONS_MESSAGE =
  "Applications are closed for this campaign stage.";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/completed-campaign-application-lock-smoke.png";
const DEFAULT_PUBLIC_PRIVATE_INVITE_SCREENSHOT_PATH =
  "output/playwright/completed-campaign-public-private-invite-lock-smoke.png";
const DEFAULT_CREATOR_PRIVATE_INVITE_SCREENSHOT_PATH =
  "output/playwright/completed-campaign-creator-private-invite-lock-smoke.png";

export function buildCompletedCampaignApplicationLockSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_COMPLETED_CAMPAIGN_APPLICATION_LOCK_ID ||
    DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandCampaignCreatorsUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}?tab=creators`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    publicApplyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    creatorDiscoverUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
  };
}

export function validateCompletedCampaignApplicationLockSmoke({
  pageText,
  visibleBulkToolbarCount,
  visibleApplicantActionCount,
  visibleApplicantSelectCount,
  closedActionCount,
  consoleErrors,
}) {
  if (!pageText.includes(SMOKE_CAMPAIGN_TITLE)) {
    throw new Error("Expected the completed smoke campaign to render.");
  }

  if (!pageText.includes(CLOSED_APPLICATION_DECISIONS_MESSAGE)) {
    throw new Error("Expected the completed campaign application lock message.");
  }

  if (!pageText.includes(getSmokeCreatorDisplayName())) {
    throw new Error("Expected the pending smoke applicant to render.");
  }

  if (
    visibleBulkToolbarCount > 0 ||
    visibleApplicantActionCount > 0 ||
    visibleApplicantSelectCount > 0
  ) {
    throw new Error("Expected completed campaign to hide active applicant controls.");
  }

  if (closedActionCount < 1 || !pageText.includes("Closed")) {
    throw new Error("Expected completed campaign applicant row to show Closed.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function completeSmokeCampaignForApplicationLock(admin, campaignId) {
  const completedAt = new Date().toISOString();
  await checkedQuery(
    "Complete smoke campaign for application lock",
    admin
      .from("campaigns")
      .update({
        status: "completed",
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", campaignId),
  );
}

export async function createPendingApplicationForCompletedCampaignSmoke({
  admin,
  campaignId,
  creatorId,
}) {
  await checkedQuery(
    "Clean existing smoke application rows",
    admin.from("campaign_applications").delete().eq("campaign_id", campaignId),
  );

  return checkedQuery(
    "Create completed campaign pending application",
    admin
      .from("campaign_applications")
      .insert({
        id: randomUUID(),
        campaign_id: campaignId,
        creator_id: creatorId,
        proposed_rate: 275,
        pitch: SMOKE_PITCH,
        status: "pending",
      })
      .select("id")
      .single(),
  );
}

export async function clearCompletedCampaignCreatorApplicationsForInviteSmoke({
  admin,
  campaignId,
  creatorId,
}) {
  await checkedQuery(
    "Clear completed campaign creator application before invite lock smoke",
    admin
      .from("campaign_applications")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("creator_id", creatorId),
  );
}

async function inspectCompletedCampaignApplicationLock(client) {
  await waitForExpression(
    client,
    `(() => {
      const applicants = document.querySelector('[data-testid="campaign-creators-section-applicants"]');
      return Boolean(
        applicants &&
        document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
        applicants.innerText.includes(${JSON.stringify(CLOSED_APPLICATION_DECISIONS_MESSAGE)}) &&
        applicants.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())})
      );
    })()`,
    "completed campaign application lock applicants table",
  );

  return evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      const applicantSection = document.querySelector('[data-testid="campaign-creators-section-applicants"]');
      return {
        pageText: document.body.innerText,
        visibleBulkToolbarCount: visible('[data-testid="campaign-applicant-bulk-toolbar"]').length,
        visibleApplicantActionCount: visible('[data-testid="campaign-applicant-action"]').length,
        visibleApplicantSelectCount: visible('[data-testid="campaign-applicant-select"], [data-testid="campaign-applicant-select-all"]').length,
        closedActionCount: applicantSection
          ? [...applicantSection.querySelectorAll("td, span")]
              .filter((node) => node.textContent?.trim() === "Closed").length
          : 0,
      };
    })()`,
  );
}

async function inspectCompletedPublicPrivateInviteLock(client, publicInviteUrl) {
  await navigate(client, publicInviteUrl);
  await waitForExpression(
    client,
    `(() => {
      const invite = document.querySelector('[data-testid="public-apply-private-invite"]');
      return Boolean(
        invite &&
        document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
        document.body.innerText.includes("This campaign is no longer accepting applications.") &&
        invite.innerText.includes("This private invite is preserved for audit because the campaign is complete.") &&
        !invite.innerText.includes("Apply here; locked materials open after acceptance.")
      );
    })()`,
    "completed public private invite audit copy",
  );

  return evaluate(
    client,
    `(() => {
      const invite = document.querySelector('[data-testid="public-apply-private-invite"]');
      return {
        publicInviteText: invite?.innerText ?? "",
        activeInviteCopyVisible:
          invite?.innerText.includes("Apply here; locked materials open after acceptance.") ?? false,
        closedInviteCopyVisible:
          invite?.innerText.includes("This private invite is preserved for audit because the campaign is complete.") ?? false,
        mutedInviteIconVisible:
          Boolean(invite?.querySelector(".text-muted-foreground")),
      };
    })()`,
  );
}

async function waitForPublicApplyHeroImage(client) {
  await waitForExpression(
    client,
    `(() => {
      const hero = document.querySelector('[data-testid="public-apply-campaign-image"]');
      const image = hero?.querySelector('img[alt="Maison Lumiere New York launch still"]');
      return Boolean(image?.complete && image.naturalWidth > 0);
    })()`,
    "completed public private invite hero image",
  );
}

async function inspectCompletedCreatorPrivateInviteLock(client, creatorInviteUrl) {
  await navigate(client, creatorInviteUrl);
  await waitForExpression(
    client,
    `(() => {
      const invite = document.querySelector('[data-testid="creator-private-invite-context"]');
      const closed = document.querySelector('[data-testid="creator-application-closed"]');
      return Boolean(
        invite &&
        closed &&
        invite.innerText.includes("This invite is confirmed, but the campaign is complete and no longer accepting applications.") &&
        closed.innerText.includes("Applications are closed") &&
        !document.querySelector("#rate") &&
        !document.querySelector("#pitch")
      );
    })()`,
    "completed creator private invite audit copy",
  );

  return evaluate(
    client,
    `(() => {
      const invite = document.querySelector('[data-testid="creator-private-invite-context"]');
      const closed = document.querySelector('[data-testid="creator-application-closed"]');
      return {
        creatorInviteText: invite?.innerText ?? "",
        creatorClosedText: closed?.innerText ?? "",
        rateFieldVisible: Boolean(document.querySelector("#rate")),
        pitchFieldVisible: Boolean(document.querySelector("#pitch")),
        activeInviteCopyVisible:
          invite?.innerText.includes("Submit your rate and pitch") ?? false,
        mutedInviteIconVisible:
          Boolean(invite?.querySelector(".text-muted-foreground")),
      };
    })()`,
  );
}

export async function runCompletedCampaignApplicationLockSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  process.env.POPSDROPS_SMOKE_QUEUE_ONLY ||= "1";

  const targets = buildCompletedCampaignApplicationLockSmokeTargets();
  process.env.NEXT_PUBLIC_APP_URL = targets.baseUrl;

  const screenshotPath = path.resolve(
    process.env.SMOKE_COMPLETED_CAMPAIGN_APPLICATION_LOCK_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const publicPrivateInviteScreenshotPath = path.resolve(
    process.env.SMOKE_COMPLETED_CAMPAIGN_PUBLIC_INVITE_LOCK_SCREENSHOT_PATH ||
      DEFAULT_PUBLIC_PRIVATE_INVITE_SCREENSHOT_PATH,
  );
  const creatorPrivateInviteScreenshotPath = path.resolve(
    process.env.SMOKE_COMPLETED_CAMPAIGN_CREATOR_INVITE_LOCK_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_PRIVATE_INVITE_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  const { creatorId, inviteId } = await setupApplicationFlowSmokeData(
    admin,
    targets,
  );
  await createPendingApplicationForCompletedCampaignSmoke({
    admin,
    campaignId: targets.campaignId,
    creatorId,
  });
  await completeSmokeCampaignForApplicationLock(admin, targets.campaignId);

  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-completed-application-lock-smoke-"),
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

    const publicInviteUrl = `${targets.publicApplyUrl}?invite=${inviteId}`;
    await inspectCompletedPublicPrivateInviteLock(client, publicInviteUrl);
    await waitForPublicApplyHeroImage(client);
    await evaluate(
      client,
      `(() => {
        document
          .querySelector('[data-testid="public-apply-private-invite"]')
          ?.scrollIntoView({ block: "center" });
        return true;
      })()`,
    );
    await captureScreenshot(client, publicPrivateInviteScreenshotPath, {
      captureBeyondViewport: true,
    });

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect",
    });

    await navigate(client, targets.brandCampaignCreatorsUrl);
    const lockState = await inspectCompletedCampaignApplicationLock(client);
    validateCompletedCampaignApplicationLockSmoke({
      ...lockState,
      consoleErrors,
    });

    await evaluate(
      client,
      `(() => {
        const applicants = document.querySelector('[data-testid="campaign-creators-section-applicants"]');
        if (!applicants) throw new Error("Missing completed campaign applicants section");
        const top = applicants.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const applicants = document.querySelector('[data-testid="campaign-creators-section-applicants"]');
        if (!applicants) return false;
        const rect = applicants.getBoundingClientRect();
        return rect.top >= 60 &&
          rect.top < window.innerHeight &&
          applicants.innerText.includes(${JSON.stringify(CLOSED_APPLICATION_DECISIONS_MESSAGE)});
      })()`,
      "visible completed campaign application lock",
    );
    await captureScreenshot(client, screenshotPath);

    await clearCompletedCampaignCreatorApplicationsForInviteSmoke({
      admin,
      campaignId: targets.campaignId,
      creatorId,
    });

    await loginForSmoke(client, {
      loginUrl: targets.creatorLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/i/`,
      description: "creator dev login redirect for completed invite",
    });

    const creatorInviteUrl = `${targets.creatorDiscoverUrl}?invite=${inviteId}`;
    await inspectCompletedCreatorPrivateInviteLock(client, creatorInviteUrl);
    await waitForCreatorCampaignHeroImage(
      client,
      "completed creator private invite hero image",
    );
    await evaluate(
      client,
      `(() => {
        document
          .querySelector('[data-testid="creator-private-invite-context"]')
          ?.scrollIntoView({ block: "center" });
        return true;
      })()`,
    );
    await captureScreenshot(client, creatorPrivateInviteScreenshotPath, {
      captureBeyondViewport: true,
    });

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
    }

    return {
      ok: true,
      campaignId: targets.campaignId,
      screenshotPath,
      publicPrivateInviteScreenshotPath,
      creatorPrivateInviteScreenshotPath,
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
  runCompletedCampaignApplicationLockSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
