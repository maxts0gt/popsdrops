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
  getCreatorReportSubmittedWaitExpression,
  openBrandReportingProofQueue,
  publishCreatorContent,
  setInputValue,
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  transitionSmokeCampaignToActiveWork,
} from "./smoke-content-report-workflow.mjs";

export const DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000105";

const REVISED_CONTENT_URL = "https://example.com/popsdrops-smoke-draft-v2";
const CONTENT_REVISION_FEEDBACK = "Please tighten the opening shot and show the product earlier.";
const REPORT_CORRECTION_NOTE = "Please upload the analytics export with corrected view count.";
const DEFAULT_CREATOR_RECOVERY_SCREENSHOT_PATH =
  "output/playwright/content-report-recovery-creator-smoke.png";
const DEFAULT_BRAND_RECOVERY_SCREENSHOT_PATH =
  "output/playwright/content-report-recovery-brand-smoke.png";
const DEFAULT_BRAND_RECOVERY_QUEUE_SCREENSHOT_PATH =
  "output/playwright/content-report-recovery-brand-queue-smoke.png";

export function buildContentReportRecoverySmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    brandReportUrl: `${targets.baseUrl}/b/campaigns/${campaignId}/report`,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
  };
}

export function validateContentReportRecoverySmoke({
  creatorRevisionText,
  brandRevisionText,
  creatorCorrectionText,
  brandCorrectionText,
  consoleErrors,
}) {
  const normalizedCreatorRevisionText = creatorRevisionText.toLowerCase();
  const normalizedBrandRevisionText = brandRevisionText.toLowerCase();
  const normalizedCreatorCorrectionText = creatorCorrectionText.toLowerCase();
  const normalizedBrandCorrectionText = brandCorrectionText.toLowerCase();

  const requiredCreatorRevisionText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["revision action", "Upload revised content"],
    ["brand feedback", CONTENT_REVISION_FEEDBACK],
    ["original submission", "v1"],
    ["revised submission", "v2"],
    ["revised submitted state", "Submitted"],
  ];
  const requiredBrandRevisionText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["content tab", "Content"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["revised version", "v2"],
    ["revised state", "Submitted"],
    ["approval action", "Approve"],
  ];
  const requiredCreatorCorrectionText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["report correction", "Performance correction"],
    ["correction note", REPORT_CORRECTION_NOTE],
    ["corrected submitted state", "Submitted"],
  ];
  const requiredBrandCorrectionText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["proof queue", "Proof queue"],
    ["evidence trail", "Evidence Trail"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["platform", "TikTok"],
    ["correction state", "Correction requested"],
    ["returned correction state", "Correction returned"],
    ["verified correction", "Verified"],
    ["report ready state", "Report status"],
    ["report ready state", "Ready"],
    ["verified reads", "Verified reads"],
    ["verified reads", "1/1"],
  ];

  for (const [label, text] of requiredCreatorRevisionText) {
    if (!normalizedCreatorRevisionText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator revised content proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandRevisionText) {
    if (!normalizedBrandRevisionText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand revised content proof: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorCorrectionText) {
    if (!normalizedCreatorCorrectionText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator corrected report proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandCorrectionText) {
    if (!normalizedBrandCorrectionText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand corrected report proof: ${label}`);
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function requestBrandContentRevision(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for content revision",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
    "brand campaign detail before revision request",
  );
  await clickTab(client, "Content");
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-content-table\\"]")?.innerText.includes("Submitted")`,
    "brand submitted content before revision request",
  );
  await clickButtonByText(client, "Request Revision", '[data-testid="campaign-content-table"]');
  await waitForExpression(
    client,
    'document.querySelector("textarea") != null && document.body.innerText.includes("Send Revision Request")',
    "content revision feedback dialog",
  );
  await setInputValue(client, "textarea", CONTENT_REVISION_FEEDBACK);
  await clickButtonByText(client, "Send Revision Request");
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-content-table\\"]")?.innerText.includes("Revision Requested") && document.body.innerText.includes(${JSON.stringify(CONTENT_REVISION_FEEDBACK)})`,
    "brand revision requested content row",
  );
}

async function submitCreatorRevision(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect for revised content",
  });
  await navigate(client, targets.creatorCampaignUrl);
  await waitForExpression(
    client,
    `(document.body?.innerText || "").includes("Upload revised content") && (document.body?.innerText || "").includes(${JSON.stringify(CONTENT_REVISION_FEEDBACK)})`,
    "creator revision request",
  );
  const revisionRequestText = await evaluate(client, "document.body.innerText");
  await clickTab(client, "Submit");
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"creator-submit-workspace\\"] input[type=url]") != null',
    "creator revised content URL input",
  );
  await setInputValue(
    client,
    '[data-testid="creator-submit-workspace"] input[type=url]',
    REVISED_CONTENT_URL,
  );
  await setInputValue(
    client,
    '[data-testid="creator-submit-workspace"] textarea',
    "Smoke revision with tighter opening shot.",
  );
  await clickButtonByText(client, "Submit draft", '[data-testid="creator-submit-workspace"]');
  await navigate(client, `${targets.creatorCampaignUrl}?tab=submit`);
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"creator-submit-workspace\\"]")?.innerText.includes("TikTok - v2") && document.querySelector("[data-testid=\\"creator-submit-workspace\\"]")?.innerText.includes("Submitted")`,
    "creator v2 submitted content row",
    60000,
  );

  const submittedRevisionText = await evaluate(client, "document.body.innerText");
  return `${revisionRequestText} ${submittedRevisionText}`;
}

export async function requestReportCorrection(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for report correction",
  });
  const reviewQueueText = await openBrandReportingProofQueue(
    client,
    targets,
    {
      description: "brand reporting proof queue before correction",
      expectedTexts: [getSmokeCreatorDisplayName(), "Needs review"],
      requireReviewControls: true,
    },
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-request-correction\\"]") != null',
    "brand proof queue correction action",
  );
  await clickButtonByText(client, "Request correction", '[data-testid="campaign-reporting-proof-queue"]');
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-correction-dialog\\"]") != null',
    "brand proof queue correction dialog",
  );
  await setInputValue(
    client,
    '[data-testid="campaign-reporting-correction-note"]',
    REPORT_CORRECTION_NOTE,
  );
  await clickButtonByText(
    client,
    "Send correction",
    '[data-testid="campaign-reporting-correction-dialog"]',
  );
  await waitForExpression(
    client,
    `(() => {
      const queue = document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]");
      const text = queue?.innerText ?? "";
      return text.includes("Correction") && text.includes(${JSON.stringify(REPORT_CORRECTION_NOTE)});
    })()`,
    "brand proof queue correction requested state",
    60000,
  );
  const requestedQueueText = await evaluate(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText ?? ""',
  );
  const reportCorrectionExpression =
    'document.querySelector("[data-testid=\\"report-evidence-trail\\"]")?.innerText.includes("Correction requested")';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await navigate(client, targets.brandReportUrl);
    try {
      await waitForExpression(
        client,
        reportCorrectionExpression,
        "brand report correction artifact state",
        attempt === 1 ? 15000 : 60000,
      );
      break;
    } catch (error) {
      const pageText = await evaluate(
        client,
        "document.body.innerText || document.title || ''",
      ).catch(() => "");
      const transientNotFound =
        attempt === 1 &&
        /404|not found|could not be found/i.test(pageText);
      if (!transientNotFound) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  const reportText = await evaluate(client, "document.body.innerText");

  return `${reviewQueueText} ${requestedQueueText} ${reportText}`;
}

export async function submitCreatorCorrectedPerformance(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect for corrected report",
  });
  await navigate(client, targets.creatorCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes("Performance correction") && document.body.innerText.includes(${JSON.stringify(REPORT_CORRECTION_NOTE)})`,
    "creator report correction request",
    60000,
  );
  const correctionRequestText = await evaluate(client, "document.body.innerText");
  await clickTab(client, "Submit");
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"performance-evidence-block\\"] input[type=file]") != null`,
    "creator corrected report proof form",
    60000,
  );
  await submitCreatorPerformanceProof(client);
  await waitForExpression(
    client,
    getCreatorReportSubmittedWaitExpression(),
    "creator corrected report submitted state",
    60000,
  );
  await clickTab(client, "Submit");
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"creator-report-status-row\\"]")?.innerText.includes("Submitted")`,
    "creator corrected report submitted row",
    60000,
  );

  const submittedCorrectionText = await evaluate(client, "document.body.innerText");
  return `${correctionRequestText} ${submittedCorrectionText}`;
}

export async function reviewReturnedReportCorrection(
  client,
  targets,
  { returnedQueueScreenshotPath } = {},
) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for returned correction review",
  });
  const returnedQueueText = await openBrandReportingProofQueue(
    client,
    targets,
    {
      description: "brand reporting proof queue after correction return",
      expectedTexts: [getSmokeCreatorDisplayName(), "Correction returned"],
      proofQueueScreenshotPath: returnedQueueScreenshotPath,
      requireReviewControls: true,
    },
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes("Correction returned")',
    "brand report correction returned state",
    60000,
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-verify-proof\\"]") != null',
    "brand returned correction verify action",
  );
  await clickButtonByText(client, "Verify", '[data-testid="campaign-reporting-proof-queue"]');
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText.includes("Verified")',
    "brand returned correction verified in proof queue",
    60000,
  );
  const verifiedQueueText = await evaluate(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText ?? ""',
  );
  await navigate(client, targets.brandReportUrl);
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"report-evidence-trail\\"]")?.innerText.includes("Verified")',
    "brand report verified correction artifact",
    60000,
  );
  await waitForExpression(
    client,
    `(() => {
      const stripText = document.querySelector("[data-testid=\\"report-trust-strip\\"]")?.innerText ?? "";
      return stripText.includes("Report status") &&
        stripText.includes("Ready") &&
        stripText.includes("Verified reads") &&
        stripText.includes("1/1");
    })()`,
    "brand report ready after correction",
    60000,
  );
  const reportText = await evaluate(client, "document.body.innerText");

  return `${returnedQueueText} ${verifiedQueueText} ${reportText}`;
}

async function runContentReportRecoverySmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildContentReportRecoverySmokeTargets();
  const creatorRecoveryScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_RECOVERY_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_RECOVERY_SCREENSHOT_PATH,
  );
  const brandRecoveryScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_RECOVERY_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_RECOVERY_SCREENSHOT_PATH,
  );
  const brandReturnedQueueScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_RECOVERY_BRAND_QUEUE_SCREENSHOT_PATH ||
      DEFAULT_BRAND_RECOVERY_QUEUE_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-content-recovery-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    creatorRevisionText: "",
    brandRevisionText: "",
    creatorCorrectionText: "",
    brandCorrectionText: "",
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
    await requestBrandContentRevision(client, targets);
    smokeEvidence.creatorRevisionText = await submitCreatorRevision(client, targets);
    smokeEvidence.brandRevisionText = await approveBrandContent(client, targets);
    await publishCreatorContent(client, targets);
    await submitCreatorPerformanceProof(client);
    smokeEvidence.brandCorrectionText = await requestReportCorrection(client, targets);
    smokeEvidence.creatorCorrectionText = await submitCreatorCorrectedPerformance(
      client,
      targets,
    );
    await captureScreenshot(client, creatorRecoveryScreenshotPath);
    smokeEvidence.brandCorrectionText += ` ${await reviewReturnedReportCorrection(
      client,
      targets,
      { returnedQueueScreenshotPath: brandReturnedQueueScreenshotPath },
    )}`;
    await captureScreenshot(client, brandRecoveryScreenshotPath);

    validateContentReportRecoverySmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      creatorRecoveryScreenshotPath,
      brandReturnedQueueScreenshotPath,
      brandRecoveryScreenshotPath,
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
  runContentReportRecoverySmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
