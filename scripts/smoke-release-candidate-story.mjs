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
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeDataDevUser,
  getSmokeCampaignTitle,
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
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  verifyBrandReportEvidence,
} from "./smoke-content-report-workflow.mjs";
import {
  fillStripeCheckoutTestPayment,
  trackRuntimeContexts,
  waitForCampaignServiceFeeStatus,
} from "./smoke-stripe-checkout-webhook.mjs";

export const DEFAULT_RELEASE_CANDIDATE_STORY_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000425";
export const RELEASE_CANDIDATE_STORY_CAMPAIGN_TITLE =
  "US Market Entry Proof Campaign";
export const RELEASE_CANDIDATE_STORY_CREATOR_NAME = "Mina Park";
export const RELEASE_CANDIDATE_STORY_BRAND_NAME = "Maison Lumiere";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_REPORT_SCREENSHOT_PATH =
  "output/playwright/release-candidate-story-report.png";
const DEFAULT_SHARED_REPORT_SCREENSHOT_PATH =
  "output/playwright/release-candidate-story-shared-report.png";
const DEFAULT_ADMIN_SCREENSHOT_PATH =
  "output/playwright/release-candidate-story-admin.png";
const EXPORT_FORMAT = "html";
const EXPORT_LABEL = "HTML report";
const EXPECTED_REPORT_EXPORT_TRUST_CONTEXT = [
  "Data source",
  "Brand-reviewed proof",
  "Creator evidence reviewed by brand",
];

export function buildReleaseCandidateStorySmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_RELEASE_CANDIDATE_STORY_CAMPAIGN_ID ||
    DEFAULT_RELEASE_CANDIDATE_STORY_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    adminCampaignsUrl: `${normalizedBaseUrl}/admin/campaigns`,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminRevenueUrl: `${normalizedBaseUrl}/admin/revenue`,
    applyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandReportUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}/report`,
    creatorCampaignUrl: `${normalizedBaseUrl}/i/campaigns/${campaignId}`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    discoverUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
  };
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function prepareReleaseCandidateCampaign(admin, targets) {
  await setupApplicationFlowSmokeData(admin, targets);
  await checkedQuery(
    "Prepare release candidate story campaign",
    admin
      .from("campaigns")
      .update({
        status: "draft",
        service_fee_status: "pending",
        recruitment_visibility: "open_applications",
        service_fee_checkout_session_id: null,
        service_fee_payment_intent_id: null,
        service_fee_last_event_id: null,
        service_fee_last_event_type: null,
        service_fee_last_event_at: null,
        service_fee_paid_at: null,
        service_fee_failed_at: null,
      })
      .eq("id", targets.campaignId),
  );
}

async function listExistingReportExportJobIds(admin, campaignId) {
  const rows = await checkedQuery(
    "List existing release candidate report export jobs",
    admin.from("report_export_jobs").select("id").eq("campaign_id", campaignId),
  );

  return new Set((rows ?? []).map((row) => row.id));
}

async function waitForCompletedReportExportJob({
  admin,
  campaignId,
  excludedJobIds,
  timeoutMs = 90000,
}) {
  const startedAt = Date.now();
  let lastRows = [];

  while (Date.now() - startedAt < timeoutMs) {
    const rows = await checkedQuery(
      "Find release candidate report export job",
      admin
        .from("report_export_jobs")
        .select(
          "id, campaign_id, format, status, storage_bucket, storage_path, file_name, mime_type, error_message, created_at",
        )
        .eq("campaign_id", campaignId)
        .eq("format", EXPORT_FORMAT)
        .order("created_at", { ascending: false })
        .limit(5),
    );
    lastRows = rows ?? [];

    const job = lastRows.find((row) => !excludedJobIds.has(row.id));
    if (job?.status === "completed") return job;
    if (job?.status === "failed") {
      throw new Error(job.error_message || "Release candidate report export job failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for release candidate report export job. Last rows: ${JSON.stringify(lastRows)}`,
  );
}

async function downloadReportExportArtifact({ admin, job }) {
  if (!job.storage_path) {
    throw new Error("Release candidate report export job is missing a storage path.");
  }

  const { data, error } = await admin.storage
    .from("report-exports")
    .download(job.storage_path);
  if (error || !data) {
    throw new Error(
      `Download release candidate report export artifact: ${error?.message ?? "missing file"}`,
    );
  }

  return data.text();
}

async function payServiceFeeAndLaunch(client, contexts, admin, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login for release candidate payment",
  });
  await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
    "release candidate campaign detail title",
  );
  await clickTab(client, "Setup");
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="campaign-service-fee-action"]\'))',
    "release candidate service fee action",
  );
  await evaluate(
    client,
    'document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.click()',
  );
  await waitForExpression(
    client,
    'location.hostname.endsWith("stripe.com")',
    "release candidate Stripe Checkout navigation",
    90000,
  );
  const checkoutUrl = await evaluate(client, "location.href");

  await fillStripeCheckoutTestPayment(client, contexts);
  await waitForExpression(
    client,
    `location.href.startsWith(${JSON.stringify(targets.brandCampaignUrl)}) && location.search.includes("checkout=success")`,
    "release candidate checkout success redirect",
    120000,
  );

  const paidCampaign = await waitForCampaignServiceFeeStatus(
    admin,
    targets.campaignId,
    "paid",
  );
  const paymentEvents = await checkedQuery(
    "Read release candidate payment events",
    admin
      .from("campaign_payment_events")
      .select("id")
      .eq("campaign_id", targets.campaignId),
  );

  await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
  await clickTab(client, "Setup");
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="campaign-service-fee-receipt"]\')?.innerText.includes("Payment received")',
    "release candidate payment receipt",
    90000,
  );
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === false',
    "release candidate launch action",
    90000,
  );
  await evaluate(
    client,
    'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.click()',
  );
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value.includes("/apply/")',
    "release candidate invite link",
  );
  const inviteUrl = await evaluate(
    client,
    'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value || ""',
  );

  return {
    checkoutUrl,
    inviteUrl,
    paymentEventCount: paymentEvents?.length ?? 0,
    serviceFeeStatus: paidCampaign.service_fee_status,
    traceFields: {
      checkoutSessionId: paidCampaign.service_fee_checkout_session_id || "",
      lastEventId: paidCampaign.service_fee_last_event_id || "",
      paymentIntentId: paidCampaign.service_fee_payment_intent_id || "",
    },
  };
}

async function createAndOpenShareLink(client, targets) {
  await navigate(client, targets.brandReportUrl);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="report-share-button"]\'))',
    "release candidate report share button",
  );
  await evaluate(
    client,
    'document.querySelector(\'[data-testid="report-share-button"]\')?.click()',
  );
  await waitForExpression(
    client,
    'document.body.innerText.includes("Create link")',
    "release candidate share dialog",
  );
  await clickButtonByText(client, "Create link");
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="report-share-url"]\')?.value.includes("/reports/share/pd_rpt_")',
    "release candidate share URL",
    90000,
  );
  const shareUrl = await evaluate(
    client,
    'document.querySelector(\'[data-testid="report-share-url"]\')?.value || ""',
  );

  if (!shareUrl.startsWith(targets.baseUrl)) {
    throw new Error(`Expected share URL to use current app origin. Got: ${shareUrl}`);
  }

  await navigate(client, shareUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes("Shared campaign report") && document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
    "release candidate public shared report",
    90000,
  );

  return shareUrl;
}

async function startAcceptedCampaignWork(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login for release candidate work start",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
    "release candidate campaign detail before work start",
  );
  await clickTab(client, "Setup");
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="campaign-start-work-action"]\')?.disabled === false',
    "release candidate start work action",
    90000,
  );
  await evaluate(
    client,
    'document.querySelector(\'[data-testid="campaign-start-work-action"]\')?.click()',
  );
  await waitForExpression(
    client,
    'document.body.innerText.includes("In Progress")',
    "release candidate campaign work started",
    90000,
  );
}

async function exportHtmlReport(client, admin, targets) {
  const existingJobIds = await listExistingReportExportJobIds(
    admin,
    targets.campaignId,
  );

  await navigate(client, targets.brandReportUrl);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="report-export-menu"]\'))',
    "release candidate report export menu",
  );
  await evaluate(
    client,
    'document.querySelector(\'[data-testid="report-export-menu"]\')?.click()',
  );
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[role="menuitem"]')]
      .some((node) => node.textContent?.includes(${JSON.stringify(EXPORT_LABEL)})))`,
    "release candidate HTML report export item",
  );
  await evaluate(
    client,
    `(() => {
      const item = [...document.querySelectorAll('[role="menuitem"]')]
        .find((node) => node.textContent?.includes(${JSON.stringify(EXPORT_LABEL)}));
      if (!item) throw new Error("Missing ${EXPORT_LABEL}");
      item.click();
      return true;
    })()`,
  );

  const job = await waitForCompletedReportExportJob({
    admin,
    campaignId: targets.campaignId,
    excludedJobIds: existingJobIds,
  });
  const artifactText = await downloadReportExportArtifact({ admin, job });

  const missingTrustContext = EXPECTED_REPORT_EXPORT_TRUST_CONTEXT.filter(
    (expectedText) => !artifactText.includes(expectedText),
  );
  if (missingTrustContext.length > 0) {
    throw new Error("Release candidate report export is missing trust context.");
  }

  return {
    artifactBytes: artifactText.length,
    fileName: job.file_name,
    jobId: job.id,
    storagePath: job.storage_path,
  };
}

async function validateAdminVisibility(client, targets, traceFields) {
  await loginForSmoke(client, {
    loginUrl: targets.adminLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/admin`,
    description: "admin dev login for release candidate story",
  });
  await navigate(client, targets.adminRevenueUrl);
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="admin-revenue-payment-event"]')?.innerText.includes("checkout.session.completed") && document.querySelector('[data-testid="admin-revenue-stripe-reference"]')?.innerText.includes(${JSON.stringify(traceFields.paymentIntentId.slice(0, 12))})`,
    "release candidate admin revenue Stripe trace",
    90000,
  );

  await navigate(client, targets.adminCampaignsUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && [...document.querySelectorAll('[data-testid="admin-campaigns-service-fee-status"]')].some((node) => (node.textContent || "").toLowerCase().includes("paid"))`,
    "release candidate admin campaign visibility",
    90000,
  );

  return evaluate(client, "document.body.innerText");
}

function validateReleaseCandidateStorySmoke({
  checkoutUrl,
  consoleErrors,
  exportResult,
  inviteUrl,
  paymentEventCount,
  serviceFeeStatus,
  shareUrl,
  traceFields,
}) {
  if (!checkoutUrl.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Expected release candidate payment to use Stripe Checkout.");
  }
  if (serviceFeeStatus !== "paid") {
    throw new Error(`Expected paid service fee. Got: ${serviceFeeStatus || "missing"}`);
  }
  if (paymentEventCount < 2) {
    throw new Error(`Expected checkout and webhook payment events. Got: ${paymentEventCount}`);
  }
  if (
    !traceFields.checkoutSessionId.startsWith("cs_") ||
    !traceFields.paymentIntentId.startsWith("pi_") ||
    !traceFields.lastEventId
  ) {
    throw new Error("Expected release candidate Stripe trace fields.");
  }
  if (!inviteUrl.includes(`/apply/`)) {
    throw new Error(`Expected invite link to unlock after payment. Got: ${inviteUrl}`);
  }
  if (!shareUrl.includes("/reports/share/pd_rpt_")) {
    throw new Error(`Expected secure report share link. Got: ${shareUrl}`);
  }
  if (!exportResult?.storagePath || exportResult.artifactBytes < 1000) {
    throw new Error("Expected durable HTML report export artifact.");
  }
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export async function runReleaseCandidateStorySmoke() {
  await loadLocalEnv();

  const previousCampaignTitle = process.env.SMOKE_CAMPAIGN_TITLE;
  const previousCreatorDisplayName = process.env.SMOKE_CREATOR_DISPLAY_NAME;
  const previousBrandCompanyName = process.env.SMOKE_BRAND_COMPANY_NAME;
  process.env.SMOKE_CAMPAIGN_TITLE = RELEASE_CANDIDATE_STORY_CAMPAIGN_TITLE;
  process.env.SMOKE_CREATOR_DISPLAY_NAME = RELEASE_CANDIDATE_STORY_CREATOR_NAME;
  process.env.SMOKE_BRAND_COMPANY_NAME = RELEASE_CANDIDATE_STORY_BRAND_NAME;

  const targets = buildReleaseCandidateStorySmokeTargets();
  const admin = createAdminClient();
  const reportScreenshotPath = path.resolve(
    process.env.SMOKE_RELEASE_CANDIDATE_REPORT_SCREENSHOT_PATH ||
      DEFAULT_REPORT_SCREENSHOT_PATH,
  );
  const sharedReportScreenshotPath = path.resolve(
    process.env.SMOKE_RELEASE_CANDIDATE_SHARED_REPORT_SCREENSHOT_PATH ||
      DEFAULT_SHARED_REPORT_SCREENSHOT_PATH,
  );
  const adminScreenshotPath = path.resolve(
    process.env.SMOKE_RELEASE_CANDIDATE_ADMIN_SCREENSHOT_PATH ||
      DEFAULT_ADMIN_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-release-candidate-story-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];

  try {
    await prepareReleaseCandidateCampaign(admin, targets);

    chrome = await launchChrome({ debugPort, userDataDir });
    client = await createCdpPage(debugPort);
    const contexts = trackRuntimeContexts(client);
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

    const payment = await payServiceFeeAndLaunch(client, contexts, admin, targets);
    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    await acceptCreatorApplication(client, targets);
    await startAcceptedCampaignWork(client, targets);
    await submitCreatorDraft(client, targets);
    await approveBrandContent(client, targets);
    await publishCreatorContent(client, targets);
    await submitCreatorPerformanceProof(client);
    await verifyBrandReportEvidence(client, targets);
    await captureScreenshot(client, reportScreenshotPath);
    const shareUrl = await createAndOpenShareLink(client, targets);
    await captureScreenshot(client, sharedReportScreenshotPath);
    const exportResult = await exportHtmlReport(client, admin, targets);
    await validateAdminVisibility(client, targets, payment.traceFields);
    await captureScreenshot(client, adminScreenshotPath);

    validateReleaseCandidateStorySmoke({
      ...payment,
      consoleErrors,
      exportResult,
      shareUrl,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignId: targets.campaignId,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      checkoutHost: new URL(payment.checkoutUrl).host,
      exportResult,
      inviteUrl: payment.inviteUrl,
      paymentEventCount: payment.paymentEventCount,
      serviceFeeStatus: payment.serviceFeeStatus,
      shareUrl,
      traceFields: payment.traceFields,
      screenshots: {
        admin: adminScreenshotPath,
        report: reportScreenshotPath,
        sharedReport: sharedReportScreenshotPath,
      },
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
    if (previousCampaignTitle === undefined) {
      delete process.env.SMOKE_CAMPAIGN_TITLE;
    } else {
      process.env.SMOKE_CAMPAIGN_TITLE = previousCampaignTitle;
    }
    if (previousCreatorDisplayName === undefined) {
      delete process.env.SMOKE_CREATOR_DISPLAY_NAME;
    } else {
      process.env.SMOKE_CREATOR_DISPLAY_NAME = previousCreatorDisplayName;
    }
    if (previousBrandCompanyName === undefined) {
      delete process.env.SMOKE_BRAND_COMPANY_NAME;
    } else {
      process.env.SMOKE_BRAND_COMPANY_NAME = previousBrandCompanyName;
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runReleaseCandidateStorySmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
