#!/usr/bin/env node

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
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";

export const DEFAULT_COMPLETED_CAMPAIGN_INVITE_LOCK_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000112";
export const CLOSED_CREATOR_INVITES_MESSAGE =
  "Creator invites are closed for this campaign stage.";
export const CLOSED_INVITE_STRIP_MESSAGE =
  "Campaign is complete. Invite links stay closed for audit.";
export const PAYMENT_BLOCKED_INVITE_STRIP_MESSAGE =
  "Pay the PopsDrops fee to reveal the invite link.";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/completed-campaign-invite-lock-smoke.png";

export function buildCompletedCampaignInviteLockSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_COMPLETED_CAMPAIGN_INVITE_LOCK_ID ||
    DEFAULT_COMPLETED_CAMPAIGN_INVITE_LOCK_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandCampaignCreatorsUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}?tab=creators`,
  };
}

export function validateCompletedCampaignInviteLockSmoke({
  pageText,
  nextActionText,
  textareaDisabled,
  submitDisabled,
  inviteStripText,
  inviteStripHasActionButton,
  inviteStripUsesNeutralClosedStyle,
  visibleEnabledSendButtonCount,
  visibleRemoveButtonCount,
  consoleErrors,
}) {
  if (!pageText.includes(SMOKE_CAMPAIGN_TITLE)) {
    throw new Error("Expected the completed smoke campaign to render.");
  }

  if (!pageText.includes(CLOSED_CREATOR_INVITES_MESSAGE)) {
    throw new Error("Expected the completed campaign closed stage message.");
  }

  if (!nextActionText.includes("Campaign complete")) {
    throw new Error("Expected the completed campaign next action to read Campaign complete.");
  }

  if (nextActionText.includes("Invite creators")) {
    throw new Error("Expected completed campaign next action not to invite creators.");
  }

  if (!textareaDisabled) {
    throw new Error("Expected completed campaign invite textarea to be disabled.");
  }

  if (!submitDisabled) {
    throw new Error("Expected completed campaign invite submit button to be disabled.");
  }

  if (typeof inviteStripText !== "string" || inviteStripText.length === 0) {
    throw new Error("Expected completed campaign invite strip evidence to be present.");
  }

  if (!inviteStripText.includes(CLOSED_INVITE_STRIP_MESSAGE)) {
    throw new Error("Expected completed campaign invite strip to explain closed audit state.");
  }

  if (inviteStripText.includes(PAYMENT_BLOCKED_INVITE_STRIP_MESSAGE)) {
    throw new Error("Expected completed campaign invite strip not to ask for payment.");
  }

  if (inviteStripHasActionButton) {
    throw new Error("Expected completed campaign invite strip not to show setup/payment actions.");
  }

  if (!inviteStripUsesNeutralClosedStyle) {
    throw new Error("Expected completed campaign invite strip to use neutral closed styling.");
  }

  if (visibleEnabledSendButtonCount > 0) {
    throw new Error("Expected completed campaign saved invites to hide active Send buttons.");
  }

  if (visibleRemoveButtonCount > 0) {
    throw new Error("Expected completed campaign saved invites to hide Remove buttons.");
  }

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

export async function completeSmokeCampaignForInviteLock(admin, campaignId) {
  const completedAt = new Date().toISOString();
  await checkedQuery(
    "Complete smoke campaign for invite lock",
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

async function inspectCompletedCampaignInviteLock(client) {
  await waitForExpression(
    client,
    `(() => {
      const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
      return Boolean(
        tray &&
        document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
        tray.innerText.includes(${JSON.stringify(CLOSED_CREATOR_INVITES_MESSAGE)})
      );
    })()`,
    "completed campaign invite lock tray",
  );

  return evaluate(
    client,
    `(() => {
      const activeSendButtons = [...document.querySelectorAll('[data-testid="campaign-invite-send"]')]
        .filter((button) => button.offsetParent !== null && !button.disabled);
      const inviteStrip = document.querySelector('[data-testid="campaign-invite-strip"]');
      const inviteStripLocked = document.querySelector('[data-testid="campaign-invite-locked"]');
      const inviteStripAction = document.querySelector('[data-testid="campaign-invite-fix-setup"]');
      const inviteStripLockedClass = inviteStripLocked?.className || "";
      return {
        pageText: document.body.innerText,
        nextActionText:
          document.querySelector('[data-testid="campaign-next-action"]')?.innerText || "",
        inviteStripText: inviteStrip?.innerText || "",
        inviteStripHasActionButton:
          Boolean(inviteStripAction && inviteStripAction.offsetParent !== null),
        inviteStripUsesNeutralClosedStyle:
          inviteStripLockedClass.includes("border-slate-200") &&
          inviteStripLockedClass.includes("bg-slate-50") &&
          inviteStripLockedClass.includes("text-slate-700"),
        textareaDisabled:
          document.querySelector('[data-testid="campaign-invite-import-textarea"]')?.disabled === true,
        submitDisabled:
          document.querySelector('[data-testid="campaign-invite-import-submit"]')?.disabled === true,
        visibleEnabledSendButtonCount: activeSendButtons.length,
        visibleRemoveButtonCount:
          [...document.querySelectorAll('[data-testid="campaign-invite-remove"]')]
            .filter((button) => button.offsetParent !== null).length,
      };
    })()`,
  );
}

export async function runCompletedCampaignInviteLockSmoke() {
  await loadLocalEnv();

  process.env.POPSDROPS_SMOKE_QUEUE_ONLY ||= "1";

  const targets = buildCompletedCampaignInviteLockSmokeTargets();
  process.env.NEXT_PUBLIC_APP_URL = targets.baseUrl;

  const screenshotPath = path.resolve(
    process.env.SMOKE_COMPLETED_CAMPAIGN_INVITE_LOCK_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  await setupApplicationFlowSmokeData(admin, targets);
  await completeSmokeCampaignForInviteLock(admin, targets.campaignId);

  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-completed-invite-lock-smoke-"),
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

    await navigate(client, targets.brandCampaignCreatorsUrl);
    const lockState = await inspectCompletedCampaignInviteLock(client);
    validateCompletedCampaignInviteLockSmoke({
      ...lockState,
      consoleErrors,
    });

    await evaluate(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        if (!tray) throw new Error("Missing completed campaign invite tray");
        const top = tray.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        if (!tray) return false;
        const rect = tray.getBoundingClientRect();
        return rect.top >= 60 &&
          rect.top < window.innerHeight &&
          tray.innerText.includes(${JSON.stringify(CLOSED_CREATOR_INVITES_MESSAGE)});
      })()`,
      "visible completed campaign invite lock tray",
    );
    await captureScreenshot(client, screenshotPath);

    return {
      ok: true,
      campaignId: targets.campaignId,
      screenshotPath,
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
  runCompletedCampaignInviteLockSmoke()
    .then((result) => {
      process.stdout.write(
        `Completed campaign invite lock smoke passed: ${JSON.stringify(result)}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(
        `Completed campaign invite lock smoke failed: ${error.stack || error.message}\n`,
      );
      process.exitCode = 1;
    });
}
