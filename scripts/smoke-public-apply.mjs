#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
  createAdminClient,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";

export const DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID =
  "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010";
const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH = "output/playwright/public-apply-smoke.png";
const DEFAULT_APPLY_SCREENSHOT_PATH =
  "output/playwright/public-apply-accepted-smoke.png";

export function buildPublicApplySmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_PUBLIC_APPLY_CAMPAIGN_ID ||
    DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    loginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    applyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    roomUrl: `${normalizedBaseUrl}/i/campaigns/${campaignId}`,
  };
}

export function validatePublicApplySmoke({
  applyText,
  roomText,
  finalUrl,
  consoleErrors,
}) {
  const normalizedApplyText = applyText.toLowerCase();
  const normalizedRoomText = roomText.toLowerCase();
  const requiredApplyText = [
    ["campaign title", "K-Beauty Retail Launch"],
    ["readiness section", "Before you apply"],
    ["campaign room action", "Open campaign room"],
  ];
  const requiredRoomText = [
    ["campaign room title", "K-Beauty Retail Launch"],
    ["brief tab", "Brief"],
    ["tasks tab", "Tasks"],
    ["submit tab", "Submit"],
  ];

  for (const [label, text] of requiredApplyText) {
    if (!normalizedApplyText.includes(text.toLowerCase())) {
      throw new Error(`Missing public apply proof: ${label}`);
    }
  }

  for (const [label, text] of requiredRoomText) {
    if (!normalizedRoomText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator room proof: ${label}`);
    }
  }

  if (
    !normalizedRoomText.includes("next action") &&
    !normalizedRoomText.includes("status")
  ) {
    throw new Error("Missing creator room proof: action strip label");
  }

  if (!finalUrl.includes("/i/campaigns/")) {
    throw new Error(`Expected final URL to be creator campaign room. Got: ${finalUrl}`);
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

async function preparePublicApplyCampaign(admin, campaignId) {
  const campaign = await checkedQuery(
    "Read public apply smoke campaign",
    admin
      .from("campaigns")
      .select("id, status, service_fee_status, recruitment_visibility")
      .eq("id", campaignId)
      .single(),
  );

  await checkedQuery(
    "Prepare paid public apply smoke campaign",
    admin
      .from("campaigns")
      .update({
        status: "recruiting",
        service_fee_status: "paid",
        recruitment_visibility: "open_applications",
      })
      .eq("id", campaignId),
  );

  return campaign;
}

async function restorePublicApplyCampaign(admin, campaignId, campaign) {
  if (!campaign) return;

  await checkedQuery(
    "Restore public apply smoke campaign",
    admin
      .from("campaigns")
      .update({
        status: campaign.status,
        service_fee_status: campaign.service_fee_status,
        recruitment_visibility: campaign.recruitment_visibility,
      })
      .eq("id", campaignId),
  );
}

async function runPublicApplySmoke() {
  await loadLocalEnv();

  const targets = buildPublicApplySmokeTargets();
  const admin = createAdminClient();
  const screenshotPath = path.resolve(
    process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
  );
  const applyScreenshotPath = path.resolve(
    process.env.SMOKE_APPLY_SCREENSHOT_PATH || DEFAULT_APPLY_SCREENSHOT_PATH,
  );
  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "popsdrops-apply-smoke-"));
  let chrome;
  let client;
  let previousCampaignState;
  const consoleErrors = [];

  try {
    previousCampaignState = await preparePublicApplyCampaign(
      admin,
      targets.campaignId,
    );

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

    await navigate(client, targets.applyUrl);
    await waitForExpression(
      client,
      'document.body.innerText.includes("K-Beauty Retail Launch") && document.body.innerText.includes("Before you apply")',
      "public invite page",
    );

    await loginForSmoke(client, {
      loginUrl: targets.loginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/i/home`,
      description: "creator dev login redirect",
    });

    await navigate(client, targets.applyUrl);
    await waitForExpression(
      client,
      'document.body.innerText.includes("Open campaign room") && document.querySelector(\'[data-testid="public-apply-campaign-image"]\') != null && document.querySelector(\'[data-testid="public-apply-open-room"]\') != null',
      "accepted creator invite room action",
    );
    const applyText = await evaluate(client, "document.body.innerText");
    const applyScreenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(applyScreenshotPath, Buffer.from(applyScreenshot.data, "base64"));

    await evaluate(
      client,
      `(() => {
        const link = document.querySelector('[data-testid="public-apply-open-room"]');
        if (!link) throw new Error("Missing campaign room link");
        link.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `location.href.startsWith(${JSON.stringify(targets.roomUrl)})`,
      "campaign room navigation",
    );
    await waitForExpression(
      client,
      'document.body.innerText.includes("K-Beauty Retail Launch") && document.body.innerText.includes("Submit")',
      "creator campaign room",
    );
    const roomText = await evaluate(client, "document.body.innerText");
    const finalUrl = await evaluate(client, "location.href");

    validatePublicApplySmoke({
      applyText,
      roomText,
      finalUrl,
      consoleErrors,
    });

    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      applyUrl: targets.applyUrl,
      finalUrl,
      applyScreenshotPath,
      screenshotPath,
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();
    await restorePublicApplyCampaign(
      admin,
      targets.campaignId,
      previousCampaignState,
    );
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
  runPublicApplySmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
