#!/usr/bin/env node

import { createHmac, randomUUID } from "node:crypto";
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
  findFreePort,
  launchChrome,
  loginForSmoke,
  navigate,
  waitForExpression,
  waitForFunction,
} from "./smoke-campaign-detail.mjs";
import { waitForCampaignServiceFeeStatus } from "./smoke-stripe-checkout-webhook.mjs";

export const DEFAULT_STRIPE_NEGATIVE_STATE_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000425";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/stripe-negative-states-smoke.png";
const NEGATIVE_STATUSES = ["failed", "refunded", "disputed"];

export function buildStripeNegativeStateSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_STRIPE_NEGATIVE_CAMPAIGN_ID ||
    DEFAULT_STRIPE_NEGATIVE_STATE_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    adminCampaignDetailUrl: `${normalizedBaseUrl}/admin/campaigns/${campaignId}?focus=finance#admin-finance-exception`,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminCampaignsUrl: `${normalizedBaseUrl}/admin/campaigns?status=all`,
    adminRevenueUrl: `${normalizedBaseUrl}/admin/revenue?status=disputed&campaign=${campaignId}#service-fees`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    creatorDiscoverUrl: `${normalizedBaseUrl}/i/discover`,
    creatorDiscoverDetailUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
    publicApplyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    publicCampaignApiUrl: `${normalizedBaseUrl}/api/public/campaigns/${campaignId}`,
  };
}

export function buildStripeNegativeStateEvent({
  campaignId,
  status,
  suffix = randomUUID().replaceAll("-", "").slice(0, 24),
}) {
  const metadata = {
    campaignId,
    kind: "campaign_service_fee",
  };

  if (status === "failed") {
    return {
      id: `evt_test_failed_${suffix}`,
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          amount_total: 14900,
          currency: "usd",
          id: `cs_test_failed_${suffix}`,
          metadata,
          mode: "payment",
          payment_intent: `pi_test_failed_${suffix}`,
          payment_status: "unpaid",
        },
      },
    };
  }

  if (status === "refunded") {
    return {
      id: `evt_test_refunded_${suffix}`,
      type: "charge.refunded",
      data: {
        object: {
          amount: 14900,
          currency: "usd",
          id: `ch_test_refunded_${suffix}`,
          metadata,
          payment_intent: `pi_test_refunded_${suffix}`,
        },
      },
    };
  }

  if (status === "disputed") {
    return {
      id: `evt_test_disputed_${suffix}`,
      type: "charge.dispute.created",
      data: {
        object: {
          amount: 14900,
          charge: `ch_test_disputed_${suffix}`,
          currency: "usd",
          id: `du_test_disputed_${suffix}`,
          metadata,
          payment_intent: `pi_test_disputed_${suffix}`,
        },
      },
    };
  }

  throw new Error(`Unsupported negative Stripe state: ${status}`);
}

export function validateStripeNegativeStateSmoke({
  adminDetailShowsException,
  adminCampaignsShowsException,
  adminListLinksToFinancePanel,
  adminRevenueCompactLayout,
  adminRevenueFocusesExceptionRow,
  adminRevenueShowsNextAction,
  campaignStatuses,
  consoleErrors,
  creatorDetailLocked,
  creatorDiscoverHidden,
  paymentEventStatuses,
  publicApiLockedStatuses,
  publicApplyLocked,
}) {
  const expectedStatuses = NEGATIVE_STATUSES.join(",");

  if (campaignStatuses.join(",") !== expectedStatuses) {
    throw new Error(
      `Expected all webhook negative states to persist on campaign. Got: ${campaignStatuses.join(",")}`,
    );
  }

  if (paymentEventStatuses.join(",") !== expectedStatuses) {
    throw new Error(
      `Expected all webhook negative states to create payment events. Got: ${paymentEventStatuses.join(",")}`,
    );
  }

  if (publicApiLockedStatuses.join(",") !== expectedStatuses) {
    throw new Error(
      `Expected public API to lock all webhook negative states. Got: ${publicApiLockedStatuses.join(",")}`,
    );
  }

  if (!creatorDiscoverHidden) {
    throw new Error("Expected creator discovery to hide the unsafe campaign.");
  }

  if (!creatorDetailLocked) {
    throw new Error("Expected creator detail to lock the unsafe campaign.");
  }

  if (!publicApplyLocked) {
    throw new Error("Expected public apply to lock the unsafe campaign.");
  }

  if (!adminCampaignsShowsException) {
    throw new Error("Expected admin campaigns to show the payment exception.");
  }

  if (!adminDetailShowsException) {
    throw new Error("Expected admin detail to explain the payment exception.");
  }

  if (!adminListLinksToFinancePanel) {
    throw new Error("Expected admin campaigns payment exception link to open the campaign finance panel.");
  }

  if (!adminRevenueFocusesExceptionRow) {
    throw new Error("Expected admin revenue to focus the exception row.");
  }

  if (!adminRevenueShowsNextAction) {
    throw new Error("Expected admin revenue next action to explain the finance resolution path.");
  }

  if (!adminRevenueCompactLayout) {
    throw new Error("Expected compact revenue service-fee layout to stay readable in narrow admin windows.");
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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} for Stripe negative-state smoke.`);
  return value;
}

function optionalEnv(name) {
  return process.env[name] || null;
}

function getStripeWebhookUrl() {
  const explicitUrl =
    process.env.SUPABASE_STRIPE_WEBHOOK_URL ||
    process.env.STRIPE_WEBHOOK_URL ||
    null;
  if (explicitUrl) return explicitUrl;

  return `${requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "")}/functions/v1/stripe-webhook`;
}

function createStripeSignatureHeader({ payload, secret }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function postStripeWebhookEvent(event) {
  const secret = optionalEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) return { mode: "database-state" };

  const payload = JSON.stringify(event);
  const response = await fetch(getStripeWebhookUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": createStripeSignatureHeader({ payload, secret }),
    },
    body: payload,
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Stripe webhook ${event.type} failed with ${response.status}: ${body}`,
    );
  }

  return { body, mode: "remote-webhook" };
}

function getEventObject(event) {
  return event.data?.object ?? {};
}

function getEventIds(event) {
  const object = getEventObject(event);
  const objectId = object.id || null;
  const chargeId =
    object.charge ||
    (typeof objectId === "string" && objectId.startsWith("ch_") ? objectId : null);

  return {
    chargeId,
    checkoutSessionId:
      typeof objectId === "string" && objectId.startsWith("cs_") ? objectId : null,
    paymentIntentId: object.payment_intent || null,
  };
}

async function persistNegativeStateThroughAdmin(admin, event, status, campaignId) {
  const object = getEventObject(event);
  const { chargeId, checkoutSessionId, paymentIntentId } = getEventIds(event);
  const receivedAt = new Date().toISOString();
  const statusColumn =
    status === "failed"
      ? "service_fee_failed_at"
      : status === "refunded"
        ? "service_fee_refunded_at"
        : "service_fee_disputed_at";

  const campaignUpdate = {
    [statusColumn]: receivedAt,
    service_fee_last_event_at: receivedAt,
    service_fee_last_event_id: event.id,
    service_fee_last_event_type: event.type,
    service_fee_status: status,
    updated_at: receivedAt,
  };

  if (chargeId) campaignUpdate.service_fee_charge_id = chargeId;
  if (checkoutSessionId) {
    campaignUpdate.service_fee_checkout_session_id = checkoutSessionId;
  }
  if (paymentIntentId) {
    campaignUpdate.service_fee_payment_intent_id = paymentIntentId;
  }

  await checkedQuery(
    `Persist ${status} service-fee campaign state`,
    admin.from("campaigns").update(campaignUpdate).eq("id", campaignId),
  );
  await checkedQuery(
    `Persist ${status} service-fee payment event`,
    admin.from("campaign_payment_events").insert({
      amount_cents: object.amount_total ?? object.amount ?? null,
      campaign_id: campaignId,
      charge_id: chargeId,
      checkout_session_id: checkoutSessionId,
      currency: object.currency ?? "usd",
      event_id: event.id,
      event_summary: {
        objectId: object.id || null,
        paymentStatus: object.payment_status || null,
      },
      event_type: event.type,
      payment_intent_id: paymentIntentId,
      provider: "stripe",
      received_at: receivedAt,
      service_fee_status: status,
    }),
  );
}

async function resetCampaignForNegativeStatus(admin, campaignId, status) {
  const baselineStatus = status === "failed" ? "pending" : "paid";
  await checkedQuery(
    `Prepare ${status} service-fee status`,
    admin
      .from("campaigns")
      .update({
        service_fee_status: baselineStatus,
        status: "recruiting",
      })
      .eq("id", campaignId),
  );
}

async function expectPublicApiLocked(url, status) {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 404) {
    throw new Error(
      `Expected ${status} public campaign API to return 404. Got ${response.status}.`,
    );
  }
  return status;
}

async function getPaymentEventStatuses(admin, campaignId) {
  const rows = await checkedQuery(
    "Read negative-state payment events",
    admin
      .from("campaign_payment_events")
      .select("service_fee_status, received_at")
      .eq("campaign_id", campaignId)
      .in("service_fee_status", NEGATIVE_STATUSES)
      .order("received_at", { ascending: true }),
  );

  const seen = new Set();
  const statuses = [];
  for (const row of rows ?? []) {
    if (seen.has(row.service_fee_status)) continue;
    seen.add(row.service_fee_status);
    statuses.push(row.service_fee_status);
  }

  return statuses;
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

async function runStripeNegativeStateSmoke() {
  await loadLocalEnv();

  const targets = buildStripeNegativeStateSmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_STRIPE_NEGATIVE_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();

  await setupApplicationFlowSmokeData(admin, targets);
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-stripe-negative-smoke-"),
  );
  let chrome;
  let client;
  const campaignStatuses = [];
  const publicApiLockedStatuses = [];
  const consoleErrors = [];
  let adminDetailShowsException = false;
  let adminCampaignsShowsException = false;
  let adminListLinksToFinancePanel = false;
  let adminRevenueCompactLayout = false;
  let adminRevenueFocusesExceptionRow = false;
  let adminRevenueShowsNextAction = false;
  let creatorDetailLocked = false;
  let creatorDiscoverHidden = false;
  let paymentEventStatuses = [];
  let publicApplyLocked = false;
  const webhookDispatchModes = new Set();

  try {
    for (const status of NEGATIVE_STATUSES) {
      await resetCampaignForNegativeStatus(admin, targets.campaignId, status);
      const event = buildStripeNegativeStateEvent({
        campaignId: targets.campaignId,
        status,
      });
      const dispatch = await postStripeWebhookEvent(event);
      webhookDispatchModes.add(dispatch.mode);
      if (dispatch.mode === "database-state") {
        await persistNegativeStateThroughAdmin(
          admin,
          event,
          status,
          targets.campaignId,
        );
      }
      const campaign = await waitForCampaignServiceFeeStatus(
        admin,
        targets.campaignId,
        status,
        60000,
      );
      campaignStatuses.push(campaign.service_fee_status);
      publicApiLockedStatuses.push(
        await expectPublicApiLocked(targets.publicCampaignApiUrl, status),
      );
    }

    paymentEventStatuses = await getPaymentEventStatuses(
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
      "creator discovery hides unsafe campaign",
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
      "creator detail payment lock",
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
      "public apply payment lock",
      90000,
    );

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(client, targets.adminCampaignsUrl);
    adminCampaignsShowsException = await waitForExpression(
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
          tableRow?.innerText.includes("Disputed") &&
          attentionRow?.innerText.includes("Payment exception")
        );
      })()`,
      "admin campaigns disputed service-fee exception",
      90000,
    );
    adminListLinksToFinancePanel = await waitForExpression(
      client,
      `(() => {
        const links = [...document.querySelectorAll('[data-testid="admin-campaign-attention-row"] a')]
          .filter((node) => (node.getAttribute("href") || "").includes(${JSON.stringify(targets.campaignId)}));
        return links.some((node) => {
          const href = node.getAttribute("href") || "";
          return href.includes("/admin/campaigns/") &&
            href.includes("focus=finance") &&
            href.includes("admin-finance-exception");
        });
      })()`,
      "admin campaigns exception opens finance panel",
      90000,
    );
    await navigate(client, targets.adminCampaignDetailUrl);
    adminDetailShowsException = await waitForExpression(
      client,
      `(() => {
        const panel = document.querySelector('[data-testid="admin-campaign-finance-exception"]');
        const lock = document.querySelector('[data-testid="admin-campaign-payment-lock-state"]');
        const action = document.querySelector('[data-testid="admin-campaign-payment-next-action"]');
        const trace = document.querySelector('[data-testid="admin-campaign-payment-trace"]');
        return Boolean(
          document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          panel?.innerText.includes("Payment exception") &&
          lock?.innerText.includes("Creator and public access locked") &&
          action?.innerText.includes("Review Stripe dispute") &&
          trace?.innerText.includes("pi_test_disputed")
        );
      })()`,
      "admin campaign detail payment exception drill-in",
      90000,
    );
    await navigate(client, targets.adminRevenueUrl);
    adminRevenueFocusesExceptionRow = await waitForExpression(
      client,
      `(() => {
        const focus = document.querySelector('[data-testid="admin-revenue-focused-campaign"]');
        const row = document.querySelector('#service-fee-${targets.campaignId}');
        return Boolean(
          focus?.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          row?.getAttribute("data-testid") === "admin-revenue-service-fee-row" &&
          row?.getAttribute("data-service-fee-status") === "disputed" &&
          (row?.getAttribute("data-stripe-reference") || "").includes("pi_test_disputed")
        );
      })()`,
      "admin revenue focused disputed service-fee row",
      90000,
    );
    adminRevenueShowsNextAction = await waitForExpression(
      client,
      `(() => {
        const row = document.querySelector('#service-fee-${targets.campaignId}');
        const nextAction = row?.querySelector('[data-testid="admin-revenue-service-fee-next-action"]');
        return Boolean(
          nextAction?.getAttribute("data-service-fee-next-action") === "Review Stripe dispute" &&
          nextAction?.innerText.includes("Resolve the Stripe case before unlocking the campaign.")
        );
      })()`,
      "admin revenue disputed next action",
      90000,
    );
    await client.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 720,
      mobile: false,
      width: 520,
    });
    await navigate(client, targets.adminRevenueUrl);
    adminRevenueCompactLayout = await waitForExpression(
      client,
      `(() => {
        const card = document.querySelector(
          '[data-testid="admin-revenue-service-fee-card"][data-campaign-id="${targets.campaignId}"]'
        );
        const cards = document.querySelector('[data-testid="admin-revenue-service-fee-cards"]');
        return Boolean(
          window.innerWidth === 520 &&
          document.documentElement.scrollWidth <= window.innerWidth + 1 &&
          card?.innerText.includes("Review Stripe dispute") &&
          card?.innerText.includes("Resolve the Stripe case before unlocking the campaign.") &&
          getComputedStyle(cards).display !== "none"
        );
      })()`,
      "compact admin revenue service-fee card layout",
      90000,
    );

    validateStripeNegativeStateSmoke({
      adminDetailShowsException,
      adminCampaignsShowsException,
      adminListLinksToFinancePanel,
      adminRevenueCompactLayout,
      adminRevenueFocusesExceptionRow,
      adminRevenueShowsNextAction,
      campaignStatuses,
      consoleErrors,
      creatorDetailLocked,
      creatorDiscoverHidden,
      paymentEventStatuses,
      publicApiLockedStatuses,
      publicApplyLocked,
    });

    await captureScreenshot(client, screenshotPath);

    return {
      ok: true,
      adminDetailShowsException,
      adminCampaignsShowsException,
      adminListLinksToFinancePanel,
      adminRevenueCompactLayout,
      adminRevenueFocusesExceptionRow,
      adminRevenueShowsNextAction,
      baseUrl: targets.baseUrl,
      campaignStatuses,
      creatorDetailLocked,
      creatorDiscoverHidden,
      paymentEventStatuses,
      publicApiLockedStatuses,
      publicApplyLocked,
      screenshotPath,
      webhookDispatchModes: Array.from(webhookDispatchModes),
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
  runStripeNegativeStateSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runStripeNegativeStateSmoke };
