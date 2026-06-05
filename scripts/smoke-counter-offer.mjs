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
  buildApplicationFlowSmokeTargets,
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";
import {
  createSmokeCampaignAgreement,
  openAcceptedCreatorRoom,
  submitCreatorApplication,
} from "./smoke-application-acceptance.mjs";

export const DEFAULT_COUNTER_OFFER_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000103";

const COUNTER_RATE = 320;
const DEFAULT_CREATOR_COUNTER_SCREENSHOT_PATH =
  "output/playwright/counter-offer-creator-action-smoke.png";
const DEFAULT_BRAND_MEMBER_SCREENSHOT_PATH =
  "output/playwright/counter-offer-brand-member-smoke.png";

export function buildCounterOfferSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_COUNTER_OFFER_CAMPAIGN_ID ||
    DEFAULT_COUNTER_OFFER_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
    creatorCampaignsUrl: `${targets.baseUrl}/i/campaigns`,
  };
}

export function validateCounterOfferSmoke({
  creatorCounterText,
  creatorRoomText,
  brandMemberText,
  consoleErrors,
}) {
  const normalizedCreatorCounterText = creatorCounterText.toLowerCase();
  const normalizedCreatorRoomText = creatorRoomText.toLowerCase();
  const normalizedBrandText = brandMemberText.toLowerCase();

  const requiredCreatorCounterText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["counter status", "Counter-Offer"],
    ["counter detail", "Brand offered $320 (you asked $275)"],
    ["accept action", "Accept offer"],
    ["decline action", "Decline offer"],
  ];
  const requiredCreatorRoomText = [
    ["creator room title", SMOKE_CAMPAIGN_TITLE],
    ["next action", "Next action"],
    ["brief tab", "Brief"],
    ["tasks tab", "Tasks"],
    ["submit tab", "Submit"],
  ];
  const requiredBrandText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["members section", "Members"],
    ["accepted member", "Dev Creator"],
    ["accepted platform", "TikTok"],
    ["counter rate", "$320"],
    ["empty applicants", "No applications yet"],
  ];

  for (const [label, text] of requiredCreatorCounterText) {
    if (!normalizedCreatorCounterText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator counter-offer proof: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorRoomText) {
    if (!normalizedCreatorRoomText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator room proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandText) {
    if (!normalizedBrandText.includes(text.toLowerCase())) {
      throw new Error(`Missing accepted member proof: ${label}`);
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function sendBrandCounterOffer(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
    "brand campaign detail",
  );
  await clickTab(client, "Creators");
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-creators-section-applicants\\"]")?.innerText.includes("Dev Creator")',
    "brand pending applicant for counter",
  );
  await evaluate(
    client,
    `(() => {
      const section = document.querySelector('[data-testid="campaign-creators-section-applicants"]');
      const button = [...(section?.querySelectorAll("button") ?? [])]
        .find((node) => node.textContent.trim() === "Counter-Offer");
      if (!button) throw new Error("Missing counter-offer button");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    'document.body.innerText.includes("Send Counter-Offer") && document.querySelector("input[type=number]") != null',
    "brand counter-offer dialog",
  );
  await evaluate(
    client,
    `(() => {
      const rate = document.querySelector("input[type=number]");
      const message = document.querySelector("textarea");
      const setInputValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      const setTextareaValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set;
      setInputValue.call(rate, ${JSON.stringify(String(COUNTER_RATE))});
      rate.dispatchEvent(new Event("input", { bubbles: true }));
      if (message) {
        setTextareaValue.call(message, "Counter smoke offer");
        message.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return true;
    })()`,
  );
  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((node) => node.textContent.trim() === "Send Counter-Offer");
      if (!button) throw new Error("Missing send counter-offer button");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-creators-section-applicants\\"]")?.innerText.includes("No applications yet.")',
    "brand counter-offer sent",
  );
}

async function acceptCreatorCounterOffer(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect",
  });
  await navigate(client, targets.creatorCampaignsUrl);
  await waitForExpression(
    client,
    'document.body.innerText.includes("Applications") && document.querySelectorAll("[role=tab]").length > 0',
    "creator campaign tabs",
  );
  await clickTab(client, "Applications");
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && document.body.innerText.includes("Counter-Offer") && document.body.innerText.includes("Accept offer")`,
    "creator counter-offer application",
  );
  const creatorCounterText = await evaluate(client, "document.body.innerText");
  await evaluate(
    client,
    `(() => {
      const card = [...document.querySelectorAll("div")]
        .find((node) => node.textContent.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && node.textContent.includes("Accept offer"));
      const button = [...(card?.querySelectorAll("button") ?? [])]
        .find((node) => node.textContent.trim() === "Accept offer");
      if (!button) throw new Error("Missing creator accept offer button");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && document.body.innerText.includes("Accepted")`,
    "creator accepted counter-offer state",
  );

  return creatorCounterText;
}

async function verifyBrandMember(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect after counter accept",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
    "brand campaign detail after counter accept",
  );
  await clickTab(client, "Creators");
  await waitForExpression(
    client,
    `(() => {
      const members = document.querySelector('[data-testid="campaign-creators-section-members"]')?.innerText ?? "";
      const applicants = document.querySelector('[data-testid="campaign-creators-section-applicants"]')?.innerText ?? "";
      return members.includes("Dev Creator") &&
        members.includes("TikTok") &&
        members.includes("$${COUNTER_RATE}") &&
        applicants.includes("No applications yet.");
    })()`,
    "brand member from counter-offer",
  );

  return evaluate(client, "document.body.innerText");
}

async function runCounterOfferSmoke() {
  await loadLocalEnv();

  const targets = buildCounterOfferSmokeTargets();
  const creatorCounterScreenshotPath = path.resolve(
    process.env.SMOKE_COUNTER_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_COUNTER_SCREENSHOT_PATH,
  );
  const brandMemberScreenshotPath = path.resolve(
    process.env.SMOKE_COUNTER_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_MEMBER_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-counter-offer-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    creatorCounterText: "",
    creatorRoomText: "",
    brandMemberText: "",
  };

  try {
    const { brandId } = await setupApplicationFlowSmokeData(admin, targets);
    await createSmokeCampaignAgreement(admin, targets, brandId);

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
    await sendBrandCounterOffer(client, targets);
    smokeEvidence.creatorCounterText = await acceptCreatorCounterOffer(
      client,
      targets,
    );
    await captureScreenshot(client, creatorCounterScreenshotPath);

    const creatorRoomEvidence = await openAcceptedCreatorRoom(client, targets);
    smokeEvidence.creatorRoomText = creatorRoomEvidence.signedCreatorRoomText;

    smokeEvidence.brandMemberText = await verifyBrandMember(client, targets);
    await captureScreenshot(client, brandMemberScreenshotPath);

    validateCounterOfferSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      applyUrl: targets.applyUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      creatorCounterScreenshotPath,
      brandMemberScreenshotPath,
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
  runCounterOfferSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
