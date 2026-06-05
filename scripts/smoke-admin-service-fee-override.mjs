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
import { buildStripeNegativeStateEvent } from "./smoke-stripe-negative-states.mjs";
import { waitForCampaignServiceFeeStatus } from "./smoke-stripe-checkout-webhook.mjs";

export const DEFAULT_ADMIN_SERVICE_FEE_OVERRIDE_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000428";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/admin-service-fee-override-smoke.png";
const MANUAL_OVERRIDE_NOTE =
  "Finance reviewed the dispute and marked the service fee paid for smoke.";

export function buildAdminServiceFeeOverrideSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_ADMIN_SERVICE_FEE_OVERRIDE_CAMPAIGN_ID ||
    DEFAULT_ADMIN_SERVICE_FEE_OVERRIDE_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    adminCampaignDetailUrl: `${normalizedBaseUrl}/admin/campaigns/${campaignId}?focus=finance#admin-finance-exception`,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminRevenueDisputedUrl: `${normalizedBaseUrl}/admin/revenue?status=disputed&campaign=${campaignId}#service-fees`,
    adminRevenuePaidUrl: `${normalizedBaseUrl}/admin/revenue?status=paid&campaign=${campaignId}#service-fees`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    creatorDiscoverDetailUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
    creatorDiscoverUrl: `${normalizedBaseUrl}/i/discover`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    publicApplyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    publicCampaignApiUrl: `${normalizedBaseUrl}/api/public/campaigns/${campaignId}`,
  };
}

export function validateAdminServiceFeeOverrideSmoke({
  adminAuditHasManualNote,
  adminDetailClearsExceptionAfterOverride,
  adminDetailShowsExceptionBeforeOverride,
  adminRevenueShowsManualPaidStamp,
  brandLaunchEnabledAfterOverride,
  consoleErrors,
  creatorDetailVisible,
  creatorDiscoverVisible,
  finalServiceFeeStatus,
  manualEventStamped,
  publicApiUnlocked,
  publicApplyVisible,
}) {
  if (!adminDetailShowsExceptionBeforeOverride) {
    throw new Error("Expected admin detail exception before manual override.");
  }

  if (!manualEventStamped) {
    throw new Error("Expected the campaign to store a manual finance event stamp.");
  }

  if (!adminAuditHasManualNote) {
    throw new Error("Expected admin audit note for the manual finance override.");
  }

  if (finalServiceFeeStatus !== "paid") {
    throw new Error(
      `Expected manual override to mark the service fee paid. Got: ${finalServiceFeeStatus || "missing"}`,
    );
  }

  if (!adminRevenueShowsManualPaidStamp) {
    throw new Error("Expected admin revenue to show the manual paid stamp.");
  }

  if (!adminDetailClearsExceptionAfterOverride) {
    throw new Error("Expected admin detail finance exception to clear after override.");
  }

  if (!brandLaunchEnabledAfterOverride) {
    throw new Error("Expected brand launch to unlock after manual paid override.");
  }

  if (!publicApiUnlocked) {
    throw new Error("Expected public campaign API to unlock after launch.");
  }

  if (!creatorDiscoverVisible) {
    throw new Error("Expected creator discovery to show the manually paid campaign.");
  }

  if (!creatorDetailVisible) {
    throw new Error("Expected creator detail to show the manually paid campaign.");
  }

  if (!publicApplyVisible) {
    throw new Error("Expected public apply to show the manually paid campaign.");
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

async function persistDisputedDraftState(admin, campaignId) {
  const event = buildStripeNegativeStateEvent({
    campaignId,
    status: "disputed",
  });
  const object = getEventObject(event);
  const receivedAt = new Date().toISOString();

  await checkedQuery(
    "Persist disputed manual-override smoke campaign state",
    admin
      .from("campaigns")
      .update({
        service_fee_charge_id: object.charge,
        service_fee_disputed_at: receivedAt,
        service_fee_last_event_at: receivedAt,
        service_fee_last_event_id: event.id,
        service_fee_last_event_type: event.type,
        service_fee_paid_at: null,
        service_fee_payment_intent_id: object.payment_intent,
        service_fee_status: "disputed",
        recruitment_visibility: "open_applications",
        status: "draft",
        updated_at: receivedAt,
      })
      .eq("id", campaignId),
  );

  await checkedQuery(
    "Persist disputed manual-override smoke payment event",
    admin.from("campaign_payment_events").insert({
      amount_cents: object.amount ?? null,
      campaign_id: campaignId,
      charge_id: object.charge,
      currency: object.currency ?? "usd",
      event_id: event.id,
      event_summary: {
        objectId: object.id || null,
        paymentStatus: object.payment_status || null,
      },
      event_type: event.type,
      payment_intent_id: object.payment_intent,
      provider: "stripe",
      received_at: receivedAt,
      service_fee_status: "disputed",
    }),
  );
}

async function readManualOverrideAudit(admin, campaignId) {
  const rows = await checkedQuery(
    "Read manual override audit",
    admin
      .from("admin_audit_log")
      .select("metadata, created_at")
      .eq("target_type", "campaign")
      .eq("target_id", campaignId)
      .eq("action", "update_campaign_service_fee_status")
      .order("created_at", { ascending: false })
      .limit(1),
  );

  return rows?.[0]?.metadata ?? null;
}

async function expectPublicApiUnlocked(url) {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 200) {
    throw new Error(
      `Expected public campaign API to return 200 after manual override. Got ${response.status}.`,
    );
  }
  return true;
}

async function runAdminServiceFeeOverrideSmoke() {
  await loadLocalEnv();

  const targets = buildAdminServiceFeeOverrideSmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_ADMIN_SERVICE_FEE_OVERRIDE_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();

  await setupApplicationFlowSmokeData(admin, targets);
  await persistDisputedDraftState(admin, targets.campaignId);

  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-admin-service-fee-override-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  let adminAuditHasManualNote = false;
  let adminDetailClearsExceptionAfterOverride = false;
  let adminDetailShowsExceptionBeforeOverride = false;
  let adminRevenueShowsManualPaidStamp = false;
  let brandLaunchEnabledAfterOverride = false;
  let creatorDetailVisible = false;
  let creatorDiscoverVisible = false;
  let finalCampaign = null;
  let publicApiUnlocked = false;
  let publicApplyVisible = false;

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
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(client, targets.adminCampaignDetailUrl);
    adminDetailShowsExceptionBeforeOverride = await waitForExpression(
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
      "admin detail disputed exception before manual override",
      90000,
    );

    await navigate(client, targets.adminRevenueDisputedUrl);
    await waitForExpression(
      client,
      `document.querySelector('#service-fee-${targets.campaignId}')?.getAttribute("data-service-fee-status") === "disputed"`,
      "admin revenue disputed row before manual override",
      90000,
    );
    await evaluate(
      client,
      `(() => {
        const row = document.querySelector('#service-fee-${targets.campaignId}');
        const select = row?.querySelector('[data-testid="admin-revenue-service-fee-status-select"]');
        const note = row?.querySelector('[data-testid="admin-revenue-service-fee-note-input"]');
        const action = row?.querySelector('[data-testid="admin-revenue-service-fee-update-action"]');
        if (!row || !select || !note || !action) return false;
        select.value = "paid";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        note.value = ${JSON.stringify(MANUAL_OVERRIDE_NOTE)};
        note.dispatchEvent(new Event("input", { bubbles: true }));
        action.click();
        return true;
      })()`,
    );
    finalCampaign = await waitForCampaignServiceFeeStatus(
      admin,
      targets.campaignId,
      "paid",
      90000,
    );
    const paidCampaign = await checkedQuery(
      "Read manual override paid campaign stamp",
      admin
        .from("campaigns")
        .select(
          "service_fee_status,service_fee_last_event_id,service_fee_last_event_type,service_fee_last_event_at,service_fee_paid_at",
        )
        .eq("id", targets.campaignId)
        .single(),
    );
    finalCampaign = { ...finalCampaign, ...paidCampaign };
    const auditMetadata = await readManualOverrideAudit(admin, targets.campaignId);
    adminAuditHasManualNote =
      auditMetadata?.note === MANUAL_OVERRIDE_NOTE &&
      auditMetadata?.previous_status === "disputed" &&
      auditMetadata?.new_status === "paid" &&
      typeof auditMetadata?.manual_event_id === "string" &&
      auditMetadata.manual_event_id.startsWith("admin_manual_");

    await navigate(client, targets.adminRevenuePaidUrl);
    adminRevenueShowsManualPaidStamp = await waitForExpression(
      client,
      `(() => {
        const focus = document.querySelector('[data-testid="admin-revenue-focused-campaign"]');
        const row = document.querySelector('#service-fee-${targets.campaignId}');
        return Boolean(
          focus?.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          row?.getAttribute("data-service-fee-status") === "paid" &&
          row?.innerText.includes("admin_manual")
        );
      })()`,
      "admin revenue paid row shows manual event stamp",
      90000,
    );
    await captureScreenshot(client, screenshotPath);

    await navigate(client, targets.adminCampaignDetailUrl);
    adminDetailClearsExceptionAfterOverride = await waitForExpression(
      client,
      `(() => {
        return Boolean(
          document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          document.body.innerText.includes("Fee paid") &&
          !document.querySelector('[data-testid="admin-campaign-finance-exception"]') &&
          !document.querySelector('[data-testid="admin-campaign-payment-lock-state"]')
        );
      })()`,
      "admin detail clears manual override exception",
      90000,
    );

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect",
    });
    await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
    brandLaunchEnabledAfterOverride = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === false',
      "brand launch action after manual paid override",
      90000,
    );
    await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.click()',
    );
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value.includes("/apply/")',
      "manual override launched invite URL",
      90000,
    );

    publicApiUnlocked = await expectPublicApiUnlocked(targets.publicCampaignApiUrl);

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
      "creator discovery shows manually paid campaign",
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
      "creator detail shows manually paid campaign",
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
      "public apply shows manually paid campaign",
      90000,
    );

    const manualEventStamped =
      finalCampaign?.service_fee_last_event_type ===
        "admin.manual_status_update" &&
      finalCampaign?.service_fee_last_event_id?.startsWith("admin_manual_") &&
      Boolean(finalCampaign?.service_fee_last_event_at) &&
      Boolean(finalCampaign?.service_fee_paid_at);

    validateAdminServiceFeeOverrideSmoke({
      adminAuditHasManualNote,
      adminDetailClearsExceptionAfterOverride,
      adminDetailShowsExceptionBeforeOverride,
      adminRevenueShowsManualPaidStamp,
      brandLaunchEnabledAfterOverride,
      consoleErrors,
      creatorDetailVisible,
      creatorDiscoverVisible,
      finalServiceFeeStatus: finalCampaign?.service_fee_status ?? "",
      manualEventStamped,
      publicApiUnlocked,
      publicApplyVisible,
    });

    return {
      ok: true,
      adminAuditHasManualNote,
      adminDetailClearsExceptionAfterOverride,
      adminDetailShowsExceptionBeforeOverride,
      adminRevenueShowsManualPaidStamp,
      baseUrl: targets.baseUrl,
      brandLaunchEnabledAfterOverride,
      creatorDetailVisible,
      creatorDiscoverVisible,
      finalServiceFeeStatus: finalCampaign?.service_fee_status ?? "",
      manualEventId: finalCampaign?.service_fee_last_event_id ?? "",
      publicApiUnlocked,
      publicApplyVisible,
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
  runAdminServiceFeeOverrideSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runAdminServiceFeeOverrideSmoke };
