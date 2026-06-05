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
  waitForFunction,
} from "./smoke-campaign-detail.mjs";
import { buildStripeNegativeStateEvent } from "./smoke-stripe-negative-states.mjs";
import {
  buildStripeLargeCampaignScopeUpdate,
  fillStripeCheckoutTestPayment,
  trackRuntimeContexts,
  waitForCampaignServiceFeeStatus,
} from "./smoke-stripe-checkout-webhook.mjs";

export const DEFAULT_STRIPE_PAYMENT_RECOVERY_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000427";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/stripe-payment-recovery-smoke.png";

export function buildStripePaymentRecoverySmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_STRIPE_RECOVERY_CAMPAIGN_ID ||
    DEFAULT_STRIPE_PAYMENT_RECOVERY_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    adminCampaignDetailUrl: `${normalizedBaseUrl}/admin/campaigns/${campaignId}?focus=finance#admin-finance-exception`,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminCampaignsUrl: `${normalizedBaseUrl}/admin/campaigns?status=all`,
    adminRevenueUrl: `${normalizedBaseUrl}/admin/revenue?status=paid&campaign=${campaignId}#service-fees`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    creatorDiscoverUrl: `${normalizedBaseUrl}/i/discover`,
    creatorDiscoverDetailUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
    publicApplyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    publicCampaignApiUrl: `${normalizedBaseUrl}/api/public/campaigns/${campaignId}`,
  };
}

export function validateStripePaymentRecoverySmoke({
  adminDetailClearsExceptionAfterRecovery,
  adminDetailShowsExceptionBeforeRecovery,
  adminCampaignsShowsExceptionBeforeRecovery,
  adminCampaignsShowsPaidState,
  adminRevenueShowsRecoveredTrace,
  brandReceiptVisible,
  brandRecoveryVisible,
  checkoutUrl,
  consoleErrors,
  creatorDetailVisible,
  creatorDiscoverVisible,
  finalServiceFeeStatus,
  initialCheckoutSessionId,
  initialServiceFeeStatus,
  inviteUrl,
  launchEnabled,
  paymentEventStatuses,
  publicApiUnlocked,
  publicApplyVisible,
  recoveredCheckoutSessionId,
  traceFields,
}) {
  if (initialServiceFeeStatus !== "failed") {
    throw new Error(
      `Expected recovery smoke to begin from failed payment. Got: ${initialServiceFeeStatus || "missing"}`,
    );
  }

  if (!adminCampaignsShowsExceptionBeforeRecovery) {
    throw new Error("Expected admin exception before payment recovery.");
  }

  if (!adminDetailShowsExceptionBeforeRecovery) {
    throw new Error("Expected admin detail exception before payment recovery.");
  }

  if (!brandRecoveryVisible) {
    throw new Error("Expected brand page to show payment recovery.");
  }

  if (!checkoutUrl.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Expected recovery to use Stripe-hosted Checkout.");
  }

  if (finalServiceFeeStatus !== "paid") {
    throw new Error(
      `Expected recovered service fee to be paid. Got: ${finalServiceFeeStatus || "missing"}`,
    );
  }

  if (
    !recoveredCheckoutSessionId?.startsWith("cs_") ||
    recoveredCheckoutSessionId === initialCheckoutSessionId
  ) {
    throw new Error("Expected recovery to store a fresh checkout session.");
  }

  for (const status of ["failed", "invoiced", "paid"]) {
    if (!paymentEventStatuses.includes(status)) {
      throw new Error(
        `Expected payment events to include failed, invoiced, and paid. Got: ${paymentEventStatuses.join(",")}`,
      );
    }
  }

  if (
    traceFields.checkoutSessionId !== recoveredCheckoutSessionId ||
    !traceFields.paymentIntentId?.startsWith("pi_") ||
    !traceFields.lastEventId
  ) {
    throw new Error("Expected recovered Stripe trace fields to point at the paid checkout.");
  }

  if (!launchEnabled) {
    throw new Error("Expected launch to unlock after payment recovery.");
  }

  if (!inviteUrl.includes("/apply/")) {
    throw new Error("Expected recovered launched campaign to reveal invite URL.");
  }

  if (!brandReceiptVisible) {
    throw new Error("Expected brand billing scope to show recovered payment receipt.");
  }

  if (!publicApiUnlocked) {
    throw new Error("Expected public campaign API to unlock after recovered launch.");
  }

  if (!creatorDiscoverVisible) {
    throw new Error("Expected creator discovery to show recovered launched campaign.");
  }

  if (!creatorDetailVisible) {
    throw new Error("Expected creator detail to show recovered launched campaign.");
  }

  if (!publicApplyVisible) {
    throw new Error("Expected public apply to show recovered launched campaign.");
  }

  if (!adminCampaignsShowsPaidState) {
    throw new Error("Expected admin campaigns to show paid state after recovery.");
  }

  if (!adminDetailClearsExceptionAfterRecovery) {
    throw new Error("Expected admin detail finance panel to clear after recovery.");
  }

  if (!adminRevenueShowsRecoveredTrace) {
    throw new Error("Expected admin revenue to show recovered Stripe trace.");
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

function getEventObject(event) {
  return event.data?.object ?? {};
}

async function persistFailedPaymentState(admin, campaignId) {
  const event = buildStripeNegativeStateEvent({
    campaignId,
    status: "failed",
  });
  const object = getEventObject(event);
  const receivedAt = new Date().toISOString();

  await checkedQuery(
    "Persist failed service fee state for recovery smoke",
    admin
      .from("campaigns")
      .update({
        service_fee_checkout_session_id: object.id,
        service_fee_failed_at: receivedAt,
        service_fee_last_event_at: receivedAt,
        service_fee_last_event_id: event.id,
        service_fee_last_event_type: event.type,
        service_fee_paid_at: null,
        service_fee_payment_intent_id: object.payment_intent,
        service_fee_refunded_at: null,
        service_fee_disputed_at: null,
        service_fee_status: "failed",
        status: "draft",
        updated_at: receivedAt,
      })
      .eq("id", campaignId),
  );

  await checkedQuery(
    "Persist failed service fee event for recovery smoke",
    admin.from("campaign_payment_events").insert({
      amount_cents: object.amount_total ?? null,
      campaign_id: campaignId,
      checkout_session_id: object.id,
      currency: object.currency ?? "usd",
      event_id: event.id,
      event_summary: {
        objectId: object.id,
        paymentStatus: object.payment_status,
      },
      event_type: event.type,
      payment_intent_id: object.payment_intent,
      provider: "stripe",
      received_at: receivedAt,
      service_fee_status: "failed",
    }),
  );

  return {
    checkoutSessionId: object.id,
    serviceFeeStatus: "failed",
  };
}

async function getPaymentEventStatuses(admin, campaignId) {
  const rows = await checkedQuery(
    "Read payment recovery events",
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

async function expectPublicApiUnlocked(url) {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 200) {
    throw new Error(
      `Expected public campaign API to return 200 after recovery. Got ${response.status}.`,
    );
  }
  return true;
}

async function runStripePaymentRecoverySmoke() {
  await loadLocalEnv();

  const targets = buildStripePaymentRecoverySmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_STRIPE_RECOVERY_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();

  await setupApplicationFlowSmokeData(admin, targets);
  await checkedQuery(
    "Prepare payment recovery smoke campaign scope",
    admin
      .from("campaigns")
      .update(buildStripeLargeCampaignScopeUpdate())
      .eq("id", targets.campaignId),
  );
  const initialFailedState = await persistFailedPaymentState(
    admin,
    targets.campaignId,
  );

  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-stripe-recovery-smoke-"),
  );
  let chrome;
  let client;
  let adminDetailClearsExceptionAfterRecovery = false;
  let adminDetailShowsExceptionBeforeRecovery = false;
  let adminCampaignsShowsExceptionBeforeRecovery = false;
  let adminCampaignsShowsPaidState = false;
  let adminRevenueShowsRecoveredTrace = false;
  let brandReceiptVisible = false;
  let brandRecoveryVisible = false;
  let checkoutUrl = "";
  let creatorDetailVisible = false;
  let creatorDiscoverVisible = false;
  let finalServiceFeeStatus = "";
  let inviteUrl = "";
  let launchEnabled = false;
  let paymentEventStatuses = [];
  let publicApiUnlocked = false;
  let publicApplyVisible = false;
  let recoveredCheckoutSessionId = "";
  let traceFields = {
    checkoutSessionId: "",
    lastEventId: "",
    paymentIntentId: "",
  };
  const consoleErrors = [];

  try {
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

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(client, targets.adminCampaignsUrl);
    adminCampaignsShowsExceptionBeforeRecovery = await waitForExpression(
      client,
      `(() => {
        const links = [...document.querySelectorAll("a")]
          .filter((node) => (node.getAttribute("href") || "").includes(${JSON.stringify(targets.campaignId)}));
        const tableRow = links.map((node) => node.closest("tr")).find(Boolean);
        const attentionRow = links
          .map((node) => node.closest('[data-testid="admin-campaign-attention-row"]'))
          .find(Boolean);
        return Boolean(
          tableRow?.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          tableRow?.innerText.includes("Failed") &&
          attentionRow?.innerText.includes("Payment exception")
        );
      })()`,
      "admin campaigns failed service-fee exception",
      90000,
    );
    await navigate(client, targets.adminCampaignDetailUrl);
    adminDetailShowsExceptionBeforeRecovery = await waitForExpression(
      client,
      `(() => {
        const panel = document.querySelector('[data-testid="admin-campaign-finance-exception"]');
        const lock = document.querySelector('[data-testid="admin-campaign-payment-lock-state"]');
        return Boolean(
          document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          panel?.innerText.includes("Payment exception") &&
          lock?.innerText.includes("Creator and public access locked")
        );
      })()`,
      "admin campaign detail failed finance exception before recovery",
      90000,
    );

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
    await clickTab(client, "Setup");
    brandRecoveryVisible = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-recovery"]\')?.innerText.includes("Payment needs attention") && Boolean(document.querySelector(\'[data-testid="campaign-service-fee-action"]:not(:disabled)\'))',
      "brand payment recovery action",
      90000,
    );
    await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.click()',
    );
    await waitForExpression(
      client,
      'location.hostname.endsWith("stripe.com")',
      "Stripe Checkout recovery navigation",
      90000,
    );
    checkoutUrl = await evaluate(client, "location.href");

    await fillStripeCheckoutTestPayment(client, contexts);
    await waitForExpression(
      client,
      `location.href.startsWith(${JSON.stringify(targets.brandCampaignUrl)}) && location.search.includes("checkout=success")`,
      "checkout recovery success redirect",
      120000,
    );

    const paidCampaign = await waitForCampaignServiceFeeStatus(
      admin,
      targets.campaignId,
      "paid",
    );
    finalServiceFeeStatus = paidCampaign.service_fee_status;
    recoveredCheckoutSessionId =
      paidCampaign.service_fee_checkout_session_id || "";
    traceFields = {
      checkoutSessionId: recoveredCheckoutSessionId,
      lastEventId: paidCampaign.service_fee_last_event_id || "",
      paymentIntentId: paidCampaign.service_fee_payment_intent_id || "",
    };
    paymentEventStatuses = await getPaymentEventStatuses(admin, targets.campaignId);

    await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
    await clickTab(client, "Setup");
    brandReceiptVisible = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-receipt"]\')?.innerText.includes("Payment received") && document.querySelector(\'[data-testid="campaign-service-fee-reference"]\')?.innerText.includes("Payment intent")',
      "brand recovered payment receipt",
      90000,
    );
    launchEnabled = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === false',
      "recovered campaign launch action",
      90000,
    );
    await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.click()',
    );
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value.includes("/apply/")',
      "recovered launched invite URL",
      90000,
    );
    inviteUrl = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value || ""',
    );
    publicApiUnlocked = await expectPublicApiUnlocked(targets.publicCampaignApiUrl);
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
    creatorDiscoverVisible = await waitForFunction(
      client,
      `function (title, campaignId) {
        return document.body.innerText.includes(title) &&
          [...document.querySelectorAll('[data-testid="creator-discover-card"]')]
            .some((node) => (node.getAttribute("href") || "").includes(campaignId));
      }`,
      [SMOKE_CAMPAIGN_TITLE, targets.campaignId],
      "creator discovery recovered campaign",
      90000,
    );
    await navigate(client, targets.creatorDiscoverDetailUrl);
    await waitForExpression(
      client,
      'document.querySelectorAll(".animate-pulse").length === 0',
      "creator detail skeletons",
    );
    creatorDetailVisible = await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && !document.body.innerText.includes("Campaign not found") && !document.body.innerText.includes("Not found")`,
      "creator detail recovered campaign",
      90000,
    );
    await navigate(client, targets.publicApplyUrl);
    await waitForExpression(
      client,
      'document.querySelectorAll(".animate-pulse").length === 0',
      "public apply skeletons",
    );
    publicApplyVisible = await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && !document.body.innerText.includes("Campaign not found") && !document.body.innerText.includes("Not found")`,
      "public apply recovered campaign",
      90000,
    );

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(client, targets.adminCampaignDetailUrl);
    adminDetailClearsExceptionAfterRecovery = await waitForExpression(
      client,
      `(() => {
        return Boolean(
          document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          document.body.innerText.includes("Fee paid") &&
          !document.querySelector('[data-testid="admin-campaign-finance-exception"]') &&
          !document.querySelector('[data-testid="admin-campaign-payment-lock-state"]')
        );
      })()`,
      "admin campaign detail clears finance exception after recovery",
      90000,
    );
    await navigate(client, targets.adminRevenueUrl);
    adminRevenueShowsRecoveredTrace = await waitForExpression(
      client,
      `(() => {
        const focus = document.querySelector('[data-testid="admin-revenue-focused-campaign"]');
        const row = document.querySelector('#service-fee-${targets.campaignId}');
        return Boolean(
          focus?.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          row?.getAttribute("data-testid") === "admin-revenue-service-fee-row" &&
          row?.getAttribute("data-service-fee-status") === "paid" &&
          (row?.getAttribute("data-stripe-reference") || "").includes(${JSON.stringify(traceFields.paymentIntentId)}) &&
          document.querySelector('[data-testid="admin-revenue-payment-event"]')?.innerText.includes("checkout.session.completed")
        );
      })()`,
      "admin revenue recovered Stripe trace",
      90000,
    );
    await captureScreenshot(client, screenshotPath);
    await navigate(client, targets.adminCampaignsUrl);
    adminCampaignsShowsPaidState = await waitForExpression(
      client,
      `(() => {
        const links = [...document.querySelectorAll("a")]
          .filter((node) => (node.getAttribute("href") || "").includes(${JSON.stringify(targets.campaignId)}));
        const tableRow = links.map((node) => node.closest("tr")).find(Boolean);
        const attentionRows = links
          .map((node) => node.closest('[data-testid="admin-campaign-attention-row"]'))
          .filter(Boolean);
        return Boolean(
          tableRow?.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          tableRow?.innerText.includes("Paid") &&
          !attentionRows.some((row) => (row.innerText || "").includes("Payment exception"))
        );
      })()`,
      "admin campaigns recovered paid state",
      90000,
    );

    validateStripePaymentRecoverySmoke({
      adminDetailClearsExceptionAfterRecovery,
      adminDetailShowsExceptionBeforeRecovery,
      adminCampaignsShowsExceptionBeforeRecovery,
      adminCampaignsShowsPaidState,
      adminRevenueShowsRecoveredTrace,
      brandReceiptVisible,
      brandRecoveryVisible,
      checkoutUrl,
      consoleErrors,
      creatorDetailVisible,
      creatorDiscoverVisible,
      finalServiceFeeStatus,
      initialCheckoutSessionId: initialFailedState.checkoutSessionId,
      initialServiceFeeStatus: initialFailedState.serviceFeeStatus,
      inviteUrl,
      launchEnabled,
      paymentEventStatuses,
      publicApiUnlocked,
      publicApplyVisible,
      recoveredCheckoutSessionId,
      traceFields,
    });

    return {
      ok: true,
      adminDetailClearsExceptionAfterRecovery,
      adminDetailShowsExceptionBeforeRecovery,
      adminCampaignsShowsExceptionBeforeRecovery,
      adminCampaignsShowsPaidState,
      adminRevenueShowsRecoveredTrace,
      baseUrl: targets.baseUrl,
      brandRecoveryVisible,
      checkoutHost: new URL(checkoutUrl).host,
      creatorDetailVisible,
      creatorDiscoverVisible,
      finalServiceFeeStatus,
      launchEnabled,
      paymentEventStatuses,
      publicApiUnlocked,
      publicApplyVisible,
      recoveredCheckoutChanged:
        recoveredCheckoutSessionId !== initialFailedState.checkoutSessionId,
      screenshotPath,
      traceFields,
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
  runStripePaymentRecoverySmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runStripePaymentRecoverySmoke };
