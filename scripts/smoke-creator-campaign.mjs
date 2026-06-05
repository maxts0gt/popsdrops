#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

export const DEFAULT_CREATOR_CAMPAIGN_ID = "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010";
const DEFAULT_BASE_URL = "http://localhost:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/creator-campaign-smoke.png";

export function buildCreatorSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId = process.env.SMOKE_CREATOR_CAMPAIGN_ID || DEFAULT_CREATOR_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    loginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    campaignUrl: `${normalizedBaseUrl}/i/campaigns/${campaignId}`,
  };
}

export function validateCreatorCampaignSmoke({ bodyText, consoleErrors }) {
  const normalizedBodyText = bodyText.toLowerCase();
  const requiredText = [
    ["campaign title", "K-Beauty Retail Launch"],
    ["brief tab", "Brief"],
    ["tasks tab", "Tasks"],
    ["submit tab", "Submit"],
    ["creative kit", "Creative Kit"],
  ];

  for (const [label, text] of requiredText) {
    if (!normalizedBodyText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator campaign proof: ${label}`);
    }
  }

  if (
    !normalizedBodyText.includes("next action") &&
    !normalizedBodyText.includes("status")
  ) {
    throw new Error("Missing creator campaign proof: action strip label");
  }

  if (!normalizedBodyText.includes("payment ")) {
    throw new Error("Missing creator campaign proof: payment status");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function runCreatorCampaignSmoke() {
  const targets = buildCreatorSmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
  );
  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "popsdrops-creator-smoke-"));
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = [];

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
      loginUrl: targets.loginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/i/home`,
      description: "creator dev login redirect",
    });

    await navigate(client, targets.campaignUrl);
    await waitForExpression(
      client,
      'document.body.innerText.includes("K-Beauty Retail Launch")',
      "creator campaign room title",
    );
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    await clickTab(client, "Brief");
    await waitForExpression(
      client,
      'document.body.innerText.includes("Brief") && document.body.innerText.toLowerCase().includes("deliverables")',
      "creator brief tab",
    );
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    await clickTab(client, "Tasks");
    await waitForExpression(
      client,
      'document.body.innerText.includes("Review brief") || document.body.innerText.includes("Submit content")',
      "creator task checklist",
    );
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    await clickTab(client, "Submit");
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="creator-submit-workspace"]\') != null',
      "creator submit workspace",
    );
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    validateCreatorCampaignSmoke({
      bodyText: smokeEvidence.join("\n"),
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
      campaignUrl: targets.campaignUrl,
      screenshotPath,
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();
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
  runCreatorCampaignSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
