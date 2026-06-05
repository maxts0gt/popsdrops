#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
  SMOKE_CAMPAIGN_TITLE,
} from "./smoke-application-flow.mjs";
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
  waitForFunction,
} from "./smoke-campaign-detail.mjs";
import {
  buildStripeLargeCampaignScopeUpdate,
  waitForCampaignServiceFeeStatus,
} from "./smoke-stripe-checkout-webhook.mjs";

export const DEFAULT_STRIPE_CANCELLED_CHECKOUT_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000426";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/stripe-cancelled-checkout-smoke.png";

export function buildStripeCancelledCheckoutSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_STRIPE_CANCELLED_CAMPAIGN_ID ||
    DEFAULT_STRIPE_CANCELLED_CHECKOUT_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const brandCampaignUrl = `${normalizedBaseUrl}/b/campaigns/${campaignId}`;

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminCampaignsUrl: `${normalizedBaseUrl}/admin/campaigns?status=all`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl,
    checkoutCancelledUrl: `${brandCampaignUrl}?tab=brief&checkout=cancelled`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    creatorDiscoverUrl: `${normalizedBaseUrl}/i/discover`,
    creatorDiscoverDetailUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
    publicApplyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    publicCampaignApiUrl: `${normalizedBaseUrl}/api/public/campaigns/${campaignId}`,
  };
}

export function validateStripeCancelledCheckoutSmoke({
  adminCampaignsShowsFinanceException,
  brandCancelledNoticeVisible,
  brandRetryVisible,
  checkoutCancelledUrl,
  checkoutUrl,
  consoleErrors,
  creatorDetailLocked,
  creatorDiscoverHidden,
  launchDisabled,
  paymentEventStatuses,
  publicApiLocked,
  publicApplyLocked,
  serviceFeeStatus,
  traceFields,
}) {
  if (!checkoutUrl.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Expected abandoned payment to start in Stripe-hosted Checkout.");
  }

  if (!checkoutCancelledUrl.includes("checkout=cancelled")) {
    throw new Error("Expected Stripe cancel URL to return with checkout=cancelled.");
  }

  if (serviceFeeStatus === "paid") {
    throw new Error("Expected cancelled checkout to stay unpaid.");
  }

  if (serviceFeeStatus !== "invoiced") {
    throw new Error(
      `Expected cancelled checkout to leave the campaign invoiced. Got: ${serviceFeeStatus || "missing"}`,
    );
  }

  if (!traceFields?.checkoutSessionId?.startsWith("cs_") || !traceFields?.lastEventId) {
    throw new Error("Expected checkout session trace to be stored after cancellation.");
  }

  if (
    traceFields.paymentIntentId &&
    !String(traceFields.paymentIntentId).startsWith("pi_")
  ) {
    throw new Error("Expected stored payment intent to be empty or a Stripe payment intent.");
  }

  if (paymentEventStatuses.join(",") !== "invoiced") {
    throw new Error(
      `Expected only the checkout-created invoiced event. Got: ${paymentEventStatuses.join(",")}`,
    );
  }

  if (!brandCancelledNoticeVisible) {
    throw new Error("Expected brand page to show payment not completed.");
  }

  if (!brandRetryVisible) {
    throw new Error("Expected brand page to show a retry payment action.");
  }

  if (!launchDisabled) {
    throw new Error("Expected launch to stay disabled after cancelled checkout.");
  }

  if (!creatorDiscoverHidden) {
    throw new Error("Expected creator discovery to hide the unpaid campaign.");
  }

  if (!creatorDetailLocked) {
    throw new Error("Expected creator detail to lock the unpaid campaign.");
  }

  if (!publicApiLocked) {
    throw new Error("Expected public campaign API to return 404 for unpaid campaign.");
  }

  if (!publicApplyLocked) {
    throw new Error("Expected public apply to lock the unpaid campaign.");
  }

  if (adminCampaignsShowsFinanceException) {
    throw new Error("Expected cancelled checkout to avoid an admin finance exception.");
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

async function stopChrome(chrome) {
  if (!chrome) return;

  const exited = new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      resolve();
      return;
    }
    chrome.once("exit", resolve);
  });

  chrome.kill();

  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function expectPublicApiLocked(url) {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 404) {
    throw new Error(
      `Expected public campaign API to return 404 after cancelled checkout. Got ${response.status}.`,
    );
  }
  return true;
}

async function getPaymentEventStatuses(admin, campaignId) {
  const rows = await checkedQuery(
    "Read cancelled-checkout payment events",
    admin
      .from("campaign_payment_events")
      .select("service_fee_status, received_at")
      .eq("campaign_id", campaignId)
      .order("received_at", { ascending: true }),
  );

  const seen = new Set();
  const statuses = [];
  for (const row of rows ?? []) {
    if (!row.service_fee_status || seen.has(row.service_fee_status)) continue;
    seen.add(row.service_fee_status);
    statuses.push(row.service_fee_status);
  }

  return statuses;
}

async function runStripeCancelledCheckoutSmoke() {
  await loadLocalEnv();

  const targets = buildStripeCancelledCheckoutSmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_STRIPE_CANCELLED_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();

  await setupApplicationFlowSmokeData(admin, targets);
  await checkedQuery(
    "Prepare cancelled checkout smoke campaign",
    admin
      .from("campaigns")
      .update({
        ...buildStripeLargeCampaignScopeUpdate(),
        service_fee_checkout_session_id: null,
        service_fee_failed_at: null,
        service_fee_last_event_at: null,
        service_fee_last_event_id: null,
        service_fee_last_event_type: null,
        service_fee_paid_at: null,
        service_fee_payment_intent_id: null,
        service_fee_refunded_at: null,
        service_fee_disputed_at: null,
        service_fee_status: "pending",
        status: "draft",
      })
      .eq("id", targets.campaignId),
  );

  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-stripe-cancelled-smoke-"),
  );
  let chrome;
  let client;
  let adminCampaignsShowsFinanceException = false;
  let brandCancelledNoticeVisible = false;
  let brandRetryVisible = false;
  let checkoutUrl = "";
  let creatorDetailLocked = false;
  let creatorDiscoverHidden = false;
  let launchDisabled = false;
  let paymentEventStatuses = [];
  let publicApiLocked = false;
  let publicApplyLocked = false;
  let serviceFeeStatus = "";
  let traceFields = {
    checkoutSessionId: "",
    lastEventId: "",
    paymentIntentId: null,
  };
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
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect",
    });

    await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
      "campaign detail title",
    );
    await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-service-fee-action"]\'))',
      "campaign service fee action",
    );
    await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.click()',
    );
    await waitForExpression(
      client,
      'location.hostname.endsWith("stripe.com")',
      "Stripe Checkout navigation",
      90000,
    );
    checkoutUrl = await evaluate(client, "location.href");

    const invoicedCampaign = await waitForCampaignServiceFeeStatus(
      admin,
      targets.campaignId,
      "invoiced",
      60000,
    );
    serviceFeeStatus = invoicedCampaign.service_fee_status;
    traceFields = {
      checkoutSessionId: invoicedCampaign.service_fee_checkout_session_id || "",
      lastEventId: invoicedCampaign.service_fee_last_event_id || "",
      paymentIntentId: invoicedCampaign.service_fee_payment_intent_id || null,
    };
    paymentEventStatuses = await getPaymentEventStatuses(admin, targets.campaignId);
    publicApiLocked = await expectPublicApiLocked(targets.publicCampaignApiUrl);

    await navigate(client, targets.checkoutCancelledUrl);
    brandCancelledNoticeVisible = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-cancelled"]\')?.innerText.includes("Payment not completed")',
      "brand cancelled checkout notice",
      90000,
    );
    brandRetryVisible = await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-service-fee-action"]:not(:disabled)\'))',
      "brand retry payment action",
      90000,
    );
    launchDisabled = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === true',
      "cancelled checkout keeps launch disabled",
      90000,
    );
    await captureScreenshot(client, screenshotPath);

    await loginForSmoke(client, {
      loginUrl: targets.creatorLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/i`,
      description: "creator dev login redirect",
    });
    await navigate(client, targets.creatorDiscoverUrl);
    await waitForExpression(
      client,
      'document.querySelectorAll(".animate-pulse").length === 0',
      "creator discovery skeletons",
    );
    creatorDiscoverHidden = await waitForFunction(
      client,
      `function (campaignId) {
        return ![...document.querySelectorAll('[data-testid="creator-discover-card"]')]
          .some((node) => (node.getAttribute("href") || "").includes(campaignId));
      }`,
      [targets.campaignId],
      "creator discovery hides unpaid campaign",
      90000,
    );
    await navigate(client, targets.creatorDiscoverDetailUrl);
    await waitForExpression(
      client,
      'document.querySelectorAll(".animate-pulse").length === 0',
      "creator detail skeletons",
    );
    creatorDetailLocked = await waitForExpression(
      client,
      'document.body.innerText.includes("Campaign not found") || document.body.innerText.includes("Not found")',
      "creator detail unpaid lock",
      90000,
    );
    await navigate(client, targets.publicApplyUrl);
    await waitForExpression(
      client,
      'document.querySelectorAll(".animate-pulse").length === 0',
      "public apply skeletons",
    );
    publicApplyLocked = await waitForExpression(
      client,
      'document.body.innerText.includes("Campaign not found") || document.body.innerText.includes("Not found")',
      "public apply unpaid lock",
      90000,
    );

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(client, targets.adminCampaignsUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
      "admin campaigns cancelled checkout campaign",
      90000,
    );
    adminCampaignsShowsFinanceException = await evaluate(
      client,
      `(() => {
        const links = [...document.querySelectorAll("a")]
          .filter((node) => (node.getAttribute("href") || "").includes(${JSON.stringify(targets.campaignId)}));
        const attentionRows = links
          .map((node) => node.closest('[data-testid="admin-campaign-attention-row"]'))
          .filter(Boolean);
        return attentionRows.some((row) => (row.innerText || "").includes("Payment exception"));
      })()`,
    );

    validateStripeCancelledCheckoutSmoke({
      adminCampaignsShowsFinanceException,
      brandCancelledNoticeVisible,
      brandRetryVisible,
      checkoutCancelledUrl: targets.checkoutCancelledUrl,
      checkoutUrl,
      consoleErrors,
      creatorDetailLocked,
      creatorDiscoverHidden,
      launchDisabled,
      paymentEventStatuses,
      publicApiLocked,
      publicApplyLocked,
      serviceFeeStatus,
      traceFields,
    });

    return {
      ok: true,
      adminCampaignsShowsFinanceException,
      baseUrl: targets.baseUrl,
      brandCancelledNoticeVisible,
      brandRetryVisible,
      checkoutHost: new URL(checkoutUrl).host,
      creatorDetailLocked,
      creatorDiscoverHidden,
      launchDisabled,
      paymentEventStatuses,
      publicApiLocked,
      publicApplyLocked,
      serviceFeeStatus,
      traceFields,
      screenshotPath,
      devServerStarted: Boolean(devServer),
    };
  } finally {
    if (client) client.close();
    await stopChrome(chrome);
    await rm(userDataDir, { recursive: true, force: true });
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    await stopDevServer(devServer);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runStripeCancelledCheckoutSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
