#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  getSmokeCampaignTitle,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
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
} from "./smoke-campaign-detail.mjs";
import {
  fillStripeCheckoutTestPayment,
  trackRuntimeContexts,
  waitForCampaignServiceFeeStatus,
} from "./smoke-stripe-checkout-webhook.mjs";

export const DEFAULT_LARGE_CAMPAIGN_CAPACITY_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000590";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-smoke.png";
const DEFAULT_FIFTY_CREATOR_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-50-paid-smoke.png";
const DEFAULT_CREATOR_OPERATIONS_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-creators-smoke.png";
const DEFAULT_CREATOR_INVITE_CAPACITY_WARNING_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-invite-capacity-warning-smoke.png";
const DEFAULT_CREATOR_INVITE_IMPORT_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-invite-import-smoke.png";
const DEFAULT_CREATOR_INVITE_SEND_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-invite-send-smoke.png";
const DEFAULT_BRAND_LIST_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-list-smoke.png";
const DEFAULT_ADMIN_REVENUE_SCREENSHOT_PATH =
  "output/playwright/large-campaign-capacity-admin-revenue-smoke.png";
const LARGE_CAMPAIGN_CAPACITY_TITLE = "US Market Entry Proof Campaign";

export function buildLargeCampaignCapacitySmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_ID ||
    DEFAULT_LARGE_CAMPAIGN_CAPACITY_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandCampaignsUrl: `${normalizedBaseUrl}/b/campaigns`,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminRevenueUrl: `${normalizedBaseUrl}/admin/revenue?campaign=${campaignId}#service-fees`,
  };
}

function buildTenCreatorPaidSnapshot() {
  return {
    mode: "private",
    feeCents: 14_900,
    currency: "usd",
    creatorSourcingRequired: false,
    requiresCustomPricing: false,
    tierKey: "workspace",
    includedCreatorCount: 10,
    includedActiveDays: 45,
    includedReportingDays: 14,
    estimatedMaxCreators: 10,
    estimatedMarketCount: 1,
    estimatedActiveDays: 4,
    estimatedReportingDays: 1,
    creatorOverageBlocks: 0,
    activeDayOverageBlocks: 0,
    reportingDayOverageBlocks: 0,
    overageFeeCents: 0,
    balanceDueCents: 0,
    paidCents: 14_900,
    scopeKeys: [
      "mode.private.scope.workspace",
      "mode.private.scope.invite",
      "mode.private.scope.report",
    ],
  };
}

export function validateLargeCampaignCapacitySmoke({
  bodyText,
  creatorScaleReadinessText,
  creatorOperationsText,
  fiftyBodyText,
  fiftyCreatorScaleReadinessText,
  fiftyCreatorOperationsText,
  pendingCreatorScaleReadinessText = "",
  pendingCreatorOperationsText = "",
  payButtonText,
  paymentEventsShowIncrementalFees = false,
  stripeCheckoutUrls = [],
  consoleErrors,
}) {
  const assertScaleReadinessText = (text, scope, openSeats) => {
    if (
      !text.includes("Scale readiness") ||
      !text.includes(`${scope}-creator operating scope`) ||
      !text.includes("Creator payments need review") ||
      !text.includes("Mark open creator payments before inviting more creators.") ||
      !text.includes("Paid capacity") ||
      !text.includes(`1 / ${scope}`) ||
      !text.includes("Invite pipeline") ||
      !text.includes("Payment exposure") ||
      !text.includes("Proof pressure") ||
      !text.includes(`${openSeats} open seats`)
    ) {
      throw new Error(
        `Expected creator scale readiness to summarize ${scope}-creator operations and name the payment blocker before scaling.`,
      );
    }
  };
  const fiftyText = fiftyBodyText ?? bodyText;
  if (!fiftyText.includes(getSmokeCampaignTitle())) {
    throw new Error("Expected the disposable large campaign to render.");
  }

  if (!fiftyText.includes("Creator capacity")) {
    throw new Error("Expected billing scope to name creator capacity.");
  }

  if (!fiftyText.includes("50")) {
    throw new Error("Expected billing scope to show capacity for 50 creators.");
  }

  if (!fiftyText.includes("$345")) {
    throw new Error("Expected the 50-creator private workspace fee to be $345.");
  }

  if (!fiftyText.includes("Balance due") || !fiftyText.includes("$196")) {
    throw new Error("Expected the 50-creator upgrade balance due to be $196.");
  }

  if (fiftyCreatorOperationsText) {
    if (
      !fiftyCreatorOperationsText.includes("Creator operations") ||
      !fiftyCreatorOperationsText.includes("1 / 50") ||
      !fiftyCreatorOperationsText.includes("Open seats") ||
      !fiftyCreatorOperationsText.includes("49")
    ) {
      throw new Error(
        "Expected creator operations to show 1 accepted creator and 49 open seats after the 50-seat payment.",
      );
    }
  }
  if (fiftyCreatorScaleReadinessText) {
    assertScaleReadinessText(fiftyCreatorScaleReadinessText, 50, 49);
  }

  if (!bodyText.includes(getSmokeCampaignTitle())) {
    throw new Error("Expected the disposable large campaign to render after the 100-seat upgrade.");
  }

  if (!bodyText.includes("Creator capacity")) {
    throw new Error("Expected billing scope to name creator capacity after the 100-seat upgrade.");
  }

  if (!bodyText.includes("100")) {
    throw new Error("Expected billing scope to show capacity for 100 creators.");
  }

  if (!bodyText.includes("$668")) {
    throw new Error("Expected the 100-creator longer-window fee to be $668.");
  }

  if (!bodyText.includes("Balance due") || !bodyText.includes("$323")) {
    throw new Error("Expected the upgraded 100-creator longer-window balance due to be $323 after the paid 50-seat step.");
  }

  if (!payButtonText.includes("$323")) {
    throw new Error("Expected the payment action to charge the $323 remaining balance.");
  }

  if (
    !pendingCreatorOperationsText.includes("Creator operations") ||
    !pendingCreatorOperationsText.includes("1 / 50") ||
    !pendingCreatorOperationsText.includes("Open seats") ||
    !pendingCreatorOperationsText.includes("49")
  ) {
    throw new Error(
      "Expected pending 100 creator balance to keep creator operations at the paid 50-seat limit.",
    );
  }

  if (
    pendingCreatorOperationsText.includes("1 / 100") ||
    pendingCreatorOperationsText.includes("99")
  ) {
    throw new Error(
      "Expected pending 100 creator balance not to expose unpaid 100-seat operations.",
    );
  }
  assertScaleReadinessText(pendingCreatorScaleReadinessText, 50, 49);

  if (
    !bodyText.includes("Active days") ||
    !bodyText.includes("75") ||
    !bodyText.includes("Reporting days") ||
    !bodyText.includes("44")
  ) {
    throw new Error("Expected the paid scope to show the extended campaign and proof windows.");
  }

  if (
    !creatorOperationsText.includes("Creator operations") ||
    !creatorOperationsText.includes("1 / 100") ||
    !creatorOperationsText.includes("Open seats") ||
    !creatorOperationsText.includes("99")
  ) {
    throw new Error(
      "Expected creator operations to show 1 accepted creator and 99 open seats.",
    );
  }
  assertScaleReadinessText(creatorScaleReadinessText, 100, 99);

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  if (!paymentEventsShowIncrementalFees) {
    throw new Error(
      "Expected payment events to show $149 paid, $196 50-seat payment, and $323 100-seat longer-window payment.",
    );
  }

  if (
    stripeCheckoutUrls.length < 2 ||
    stripeCheckoutUrls.some((url) => !url.startsWith("https://checkout.stripe.com/"))
  ) {
    throw new Error("Expected both capacity upgrades to happen through Stripe Checkout.");
  }

  return { ok: true };
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function verifyUnpaidCapacityUpgradeBlocksExtraMember(
  admin,
  targets,
) {
  await checkedQuery(
    "Verify unpaid capacity upgrade blocks extra accepted creator",
    admin
      .from("campaigns")
      .update({
        max_creators: 100,
        service_fee_cents: 59_000,
        service_fee_currency: "usd",
        service_fee_status: "pending",
        service_package_snapshot: {
          ...buildTenCreatorPaidSnapshot(),
          balanceDueCents: 44_100,
          estimatedMaxCreators: 100,
          feeCents: 59_000,
          paidCreatorCapacity: 1,
        },
      })
      .eq("id", targets.campaignId),
  );

  const { error } = await admin.from("campaign_members").insert({
    accepted_rate: 100,
    campaign_id: targets.campaignId,
    creator_id: randomUUID(),
    payment_status: "pending",
  });

  if (!error || !error.message.includes("Campaign creator capacity is full")) {
    throw new Error(
      `Expected unpaid upgraded capacity to block extra accepted creator, got ${error?.message ?? "success"}.`,
    );
  }
}

function addSmokeUtcDaysDateKey(value, days) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw new Error("Expected campaign date to be stored.");
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function selectAndSaveCreatorCapacity(client, {
  activeDays,
  balanceDisplay,
  count,
  currentPaidDisplay,
  description,
  reportingDays,
  totalDisplay,
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="campaign-capacity-option-${count}"]'))`,
    `${count} creator capacity option`,
  );
  await evaluate(
    client,
    `(() => {
      const option = document.querySelector('[data-testid="campaign-capacity-option-${count}"]');
      if (!option) throw new Error("Missing ${count} creator capacity option");
      option.click();
      return true;
    })()`,
  );
  if (activeDays) {
    await evaluate(
      client,
      `(() => {
        const option = document.querySelector('[data-testid="campaign-active-days-option-${activeDays}"]');
        if (!option) throw new Error("Missing ${activeDays} campaign day option");
        option.click();
        return true;
      })()`,
    );
  }
  if (reportingDays !== undefined) {
    await evaluate(
      client,
      `(() => {
        const option = document.querySelector('[data-testid="campaign-reporting-days-option-${reportingDays}"]');
        if (!option) throw new Error("Missing ${reportingDays} proof day option");
        option.click();
        return true;
      })()`,
    );
  }
  await waitForExpression(
    client,
    `(() => {
      const preview = document.querySelector('[data-testid="campaign-capacity-price-preview"]');
      return Boolean(
        preview &&
        preview.innerText.includes("Total fee") &&
        preview.innerText.includes(${JSON.stringify(totalDisplay)}) &&
        preview.innerText.includes("Paid credit") &&
        preview.innerText.includes(${JSON.stringify(currentPaidDisplay)}) &&
        preview.innerText.includes("Balance after update") &&
        preview.innerText.includes(${JSON.stringify(balanceDisplay)}) &&
        document.body.innerText.includes(${JSON.stringify(balanceDisplay)})
      );
    })()`,
    `pre-save ${count} creator capacity price preview`,
  );
  await waitForExpression(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="campaign-capacity-save"]');
      return Boolean(button && !button.disabled);
    })()`,
    "capacity save enabled",
  );
  await evaluate(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="campaign-capacity-save"]');
      if (!button) throw new Error("Missing capacity save button");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `document.body.innerText.includes("Creator capacity") &&
      document.body.innerText.includes("${count}") &&
      document.body.innerText.includes(${JSON.stringify(totalDisplay)}) &&
      document.body.innerText.includes("Balance due") &&
      document.body.innerText.includes(${JSON.stringify(balanceDisplay)})`,
    `upgraded ${count} creator capacity balance`,
  );
  await waitForExpression(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="campaign-capacity-save"]');
      return Boolean(button && button.innerText.includes("Update scope") && !button.innerText.includes("Saving"));
    })()`,
    "capacity save settled",
  );
  await waitForExpression(
    client,
    `(() => {
      const target = [...document.querySelectorAll('[data-testid="campaign-billing-scope"]')]
        .find((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.display !== "none";
        });
      return Boolean(
        target &&
        target.innerText.includes("Creator capacity") &&
        target.innerText.includes("${count}") &&
        target.innerText.includes(${JSON.stringify(totalDisplay)}) &&
        target.innerText.includes("Balance due") &&
        target.innerText.includes(${JSON.stringify(balanceDisplay)})
      );
    })()`,
    `visible ${description} creator capacity proof`,
  );
}

async function payVisibleServiceFeeBalance(client, contexts, admin, targets, {
  balanceCents,
  balanceDisplay,
  checkoutDescription,
}) {
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="campaign-service-fee-action"]')?.innerText.includes(${JSON.stringify(balanceDisplay)})`,
    `${checkoutDescription} payment action`,
  );
  await evaluate(
    client,
    'document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.click()',
  );
  await waitForExpression(
    client,
    'location.hostname.endsWith("stripe.com")',
    `${checkoutDescription} Stripe Checkout navigation`,
    90000,
  );
  const checkoutUrl = await evaluate(client, "location.href");
  try {
    await waitForExpression(
      client,
      `document.body.innerText.includes("PopsDrops") && document.body.innerText.includes(${JSON.stringify(balanceDisplay)})`,
      `Stripe Checkout ${balanceDisplay} ${checkoutDescription} balance`,
      90000,
    );
  } catch (error) {
    const stripeText = await evaluate(client, "document.body.innerText").catch(
      (textError) => `Unable to read Stripe page text: ${textError.message}`,
    );
    console.error(
      `Stripe Checkout page text before failure:\n${stripeText.slice(0, 1600)}`,
    );
    throw error;
  }

  await fillStripeCheckoutTestPayment(client, contexts);
  await waitForExpression(
    client,
    `location.href.startsWith(${JSON.stringify(targets.brandCampaignUrl)}) && location.search.includes("checkout=success")`,
    `${checkoutDescription} checkout success redirect`,
    120000,
  );
  await waitForExpression(
    client,
    `(() => {
      return Boolean(
        document.readyState === "complete" &&
        location.href.startsWith(${JSON.stringify(targets.brandCampaignUrl)}) &&
        location.search.includes("checkout=success") &&
        document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})
      );
    })()`,
    "checkout success campaign page settled before next navigation",
    90000,
  );

  const paidCampaign = await waitForCampaignServiceFeeStatus(
    admin,
    targets.campaignId,
    "paid",
  );
  if (paidCampaign.service_fee_status !== "paid") {
    throw new Error(`Expected paid campaign after ${checkoutDescription}.`);
  }

  const paymentEvents = await checkedQuery(
    `Read ${checkoutDescription} payment events`,
    admin
      .from("campaign_payment_events")
      .select("amount_cents, event_type, service_fee_status")
      .eq("campaign_id", targets.campaignId),
  );
  const hasPaidBalance = (paymentEvents ?? []).some(
    (event) =>
      event.event_type === "checkout.session.completed" &&
      event.service_fee_status === "paid" &&
      Number(event.amount_cents) === balanceCents,
  );
  if (!hasPaidBalance) {
    throw new Error(
      `Expected Stripe webhook payment event for ${balanceDisplay} ${checkoutDescription}.`,
    );
  }

  return { checkoutUrl, paymentEvents };
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

export async function runLargeCampaignCapacitySmoke() {
  await loadLocalEnv();

  const previousCampaignTitle = process.env.SMOKE_CAMPAIGN_TITLE;
  process.env.SMOKE_CAMPAIGN_TITLE = LARGE_CAMPAIGN_CAPACITY_TITLE;
  process.env.POPSDROPS_SMOKE_QUEUE_ONLY ||= "1";

  const targets = buildLargeCampaignCapacitySmokeTargets();
  process.env.NEXT_PUBLIC_APP_URL = targets.baseUrl;
  const screenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const creatorOperationsScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_CREATORS_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_OPERATIONS_SCREENSHOT_PATH,
  );
  const creatorInviteCapacityWarningScreenshotPath = path.resolve(
    process.env
      .SMOKE_LARGE_CAMPAIGN_CAPACITY_INVITE_WARNING_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_INVITE_CAPACITY_WARNING_SCREENSHOT_PATH,
  );
  const creatorInviteImportScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_INVITE_IMPORT_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_INVITE_IMPORT_SCREENSHOT_PATH,
  );
  const creatorInviteSendScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_INVITE_SEND_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_INVITE_SEND_SCREENSHOT_PATH,
  );
  const brandListScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_LIST_SCREENSHOT_PATH ||
      DEFAULT_BRAND_LIST_SCREENSHOT_PATH,
  );
  const adminRevenueScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_ADMIN_REVENUE_SCREENSHOT_PATH ||
      DEFAULT_ADMIN_REVENUE_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();

  const { creatorId } = await setupApplicationFlowSmokeData(admin, targets);
  await checkedQuery(
    "Create accepted creator for capacity operations",
    admin.from("campaign_members").insert({
      accepted_rate: 300,
      campaign_id: targets.campaignId,
      creator_id: creatorId,
      payment_status: "pending",
    }),
  );
  await verifyUnpaidCapacityUpgradeBlocksExtraMember(admin, targets);
  await checkedQuery(
    "Prepare paid 10-creator private campaign",
    admin
      .from("campaigns")
      .update({
        status: "draft",
        max_creators: 10,
        service_fee_cents: 14_900,
        service_fee_currency: "usd",
        service_fee_status: "paid",
        service_fee_paid_at: new Date().toISOString(),
        service_package_snapshot: buildTenCreatorPaidSnapshot(),
      })
      .eq("id", targets.campaignId),
  );
  await checkedQuery(
    "Persist paid 10-creator service fee event",
    admin.from("campaign_payment_events").insert({
      amount_cents: 14_900,
      campaign_id: targets.campaignId,
      currency: "usd",
      event_id: `evt_large_capacity_paid_${targets.campaignId}`,
      event_summary: {
        smoke: "large-campaign-capacity",
        startingCapacity: 10,
      },
      event_type: "checkout.session.completed",
      provider: "stripe",
      service_fee_status: "paid",
    }),
  );

  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-large-campaign-capacity-smoke-"),
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
    const contexts = trackRuntimeContexts(client);

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect",
    });

    await navigate(client, targets.brandCampaignUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "large campaign detail title",
    );
    await clickTab(client, "Setup");
    await waitForExpression(
      client,
      'document.body.innerText.includes("Creator capacity") && document.body.innerText.includes("$149")',
      "paid 10 creator capacity billing scope",
    );
    await selectAndSaveCreatorCapacity(client, {
      balanceDisplay: "$196",
      count: 50,
      currentPaidDisplay: "$149",
      description: "50 paid",
      totalDisplay: "$345",
    });
    const fiftyBodyText = await evaluate(client, "document.body.innerText");
    const fiftyPayment = await payVisibleServiceFeeBalance(
      client,
      contexts,
      admin,
      targets,
      {
        balanceCents: 19_600,
        balanceDisplay: "$196",
        checkoutDescription: "50 creator upgrade",
      },
    );
    await navigate(client, targets.brandCampaignUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "50-creator paid campaign detail title",
    );
    await clickTab(client, "Setup");
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-receipt"]\')?.innerText.includes("Payment received")',
      "50-creator payment receipt",
    );
    await clickTab(client, "Creators");
    try {
      await waitForExpression(
        client,
        `(() => {
          const board = document.querySelector('[data-testid="campaign-creator-operations-board"]');
          const readiness = document.querySelector('[data-testid="campaign-creator-scale-readiness"]');
          const scaleRail = document.querySelector('[data-testid="campaign-creator-scale-rail"]');
          const scaleCapacity = document.querySelector('[data-testid="campaign-creator-scale-rail-capacity"]');
          const scaleInvitePipeline = document.querySelector('[data-testid="campaign-creator-scale-rail-invitePipeline"]');
          const scalePaymentExposure = document.querySelector('[data-testid="campaign-creator-scale-rail-paymentExposure"]');
          const scaleProofPressure = document.querySelector('[data-testid="campaign-creator-scale-rail-proofPressure"]');
          const capacityTrack = document.querySelector('[data-testid="campaign-creator-scale-capacity-track"]');
          const invitePipeline = document.querySelector('[data-testid="campaign-creator-scale-readiness-invitePipeline"]');
          const paymentExposure = document.querySelector('[data-testid="campaign-creator-scale-readiness-paymentExposure"]');
          const proofPressure = document.querySelector('[data-testid="campaign-creator-scale-readiness-proofPressure"]');
          const openSeats = document.querySelector('[data-testid="campaign-creator-open-seats"]');
          const scaleRailText = scaleRail?.innerText.toLowerCase() || "";
          return Boolean(
            board &&
            readiness &&
            scaleRail &&
            scaleCapacity &&
            scaleInvitePipeline &&
            scalePaymentExposure &&
            scaleProofPressure &&
            capacityTrack &&
            invitePipeline &&
            paymentExposure &&
            proofPressure &&
            openSeats &&
            readiness.innerText.includes("Scale readiness") &&
            readiness.innerText.includes("50-creator operating scope") &&
            readiness.innerText.includes("Invite pipeline") &&
            readiness.innerText.includes("Payment exposure") &&
            readiness.innerText.includes("Proof pressure") &&
            scaleRailText.includes("paid capacity") &&
            scaleRailText.includes("invite pipeline") &&
            scaleRailText.includes("payment exposure") &&
            scaleRailText.includes("proof pressure") &&
            board.innerText.includes("Creator operations") &&
            board.innerText.includes("1 / 50") &&
            board.innerText.includes("Open seats") &&
            openSeats.innerText.trim() === "49"
          );
        })()`,
        "50 creator operations accepted capacity and open seats",
      );
    } catch (error) {
      const diagnostics = await evaluate(
        client,
        `(() => ({
          body: document.body.innerText,
          board: document.querySelector('[data-testid="campaign-creator-operations-board"]')?.innerText || "",
          readiness: document.querySelector('[data-testid="campaign-creator-scale-readiness"]')?.innerText || "",
          scaleRail: document.querySelector('[data-testid="campaign-creator-scale-rail"]')?.innerText || "",
          invitePipeline: document.querySelector('[data-testid="campaign-creator-scale-readiness-invitePipeline"]')?.innerText || "",
          paymentExposure: document.querySelector('[data-testid="campaign-creator-scale-readiness-paymentExposure"]')?.innerText || "",
          proofPressure: document.querySelector('[data-testid="campaign-creator-scale-readiness-proofPressure"]')?.innerText || "",
          openSeats: document.querySelector('[data-testid="campaign-creator-open-seats"]')?.innerText || ""
        }))()`,
      ).catch((diagnosticError) => ({
        body: "",
        board: `Unable to read creator operations board: ${diagnosticError.message}`,
        readiness: "",
        scaleRail: "",
        invitePipeline: "",
        paymentExposure: "",
        proofPressure: "",
        openSeats: "",
      }));
      console.error(
        `50 creator capacity diagnostics:\\n${JSON.stringify(
          diagnostics,
          null,
          2,
        ).slice(0, 5000)}`,
      );
      throw error;
    }
    const fiftyCreatorOperationsText = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-creator-operations-board"]\')?.innerText || ""',
    );
    const fiftyCreatorScaleReadinessText = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-creator-scale-readiness"]\')?.innerText || ""',
    );
    await captureScreenshot(
      client,
      path.resolve(
        process.env.SMOKE_LARGE_CAMPAIGN_CAPACITY_50_SCREENSHOT_PATH ||
          DEFAULT_FIFTY_CREATOR_SCREENSHOT_PATH,
      ),
    );
    await evaluate(
      client,
      `(() => {
        const textarea = document.querySelector('[data-testid="campaign-invite-import-textarea"]');
        if (!textarea) throw new Error("Missing invite import textarea for capacity review");
        const setTextareaValue = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        ).set;
        setTextareaValue.call(
          textarea,
          Array.from(
            { length: 55 },
            (_, index) => \`bulk-invite-\${index + 1}@example.com\`,
          ).join("\\n"),
        );
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const warning = document.querySelector('[data-testid="campaign-invite-import-capacity-warning"]');
        const button = document.querySelector('[data-testid="campaign-invite-import-review-capacity"]');
        const textarea = document.querySelector('[data-testid="campaign-invite-import-textarea"]');
        return Boolean(
          warning &&
          button &&
          textarea &&
          warning.innerText.includes("Extra contacts: 7") &&
          warning.innerText.includes("100") &&
          button.innerText.includes("Review capacity") &&
          textarea.value.includes("bulk-invite-55@example.com")
        );
      })()`,
      "review capacity from over-capacity invite list",
    );
    await evaluate(
      client,
      `(() => {
        const warning = document.querySelector('[data-testid="campaign-invite-import-capacity-warning"]');
        if (!warning) throw new Error("Missing invite import capacity warning");
        const top = warning.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return top;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const warning = document.querySelector('[data-testid="campaign-invite-import-capacity-warning"]');
        if (!warning) return false;
        const rect = warning.getBoundingClientRect();
        return rect.top >= 80 &&
          rect.top < window.innerHeight &&
          warning.innerText.includes("Extra contacts") &&
          warning.innerText.includes("Review 100-creator capacity");
      })()`,
      "visible over-capacity invite warning",
    );
    await captureScreenshot(client, creatorInviteCapacityWarningScreenshotPath);
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-invite-import-review-capacity"]');
        if (!button) throw new Error("Missing invite import review capacity button");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const billing = document.querySelector('[data-testid="campaign-billing-scope"]');
        const preview = document.querySelector('[data-testid="campaign-capacity-price-preview"]');
        return Boolean(
          location.search.includes("tab=brief") &&
          billing &&
          preview &&
          billing.innerText.includes("Creator capacity") &&
          preview.innerText.includes("Total fee") &&
          preview.innerText.includes("$590") &&
          preview.innerText.includes("Balance after update") &&
          preview.innerText.includes("$245")
        );
      })()`,
      "100 creator capacity preselected from invite list",
    );

    await clickTab(client, "Setup");
    await selectAndSaveCreatorCapacity(client, {
      activeDays: 75,
      balanceDisplay: "$323",
      count: 100,
      currentPaidDisplay: "$345",
      description: "100 paid with longer windows",
      reportingDays: 44,
      totalDisplay: "$668",
    });

    const bodyText = await evaluate(client, "document.body.innerText");
    const payButtonText = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.innerText || ""',
    );
    const upgradedScopeRows = await checkedQuery(
      "Verify 100 creator longer paid scope",
      admin
        .from("campaigns")
        .select(
          "max_creators, posting_window_start, posting_window_end, performance_due_date, monitoring_end_date, service_fee_cents, service_fee_status, service_package_snapshot",
        )
        .eq("id", targets.campaignId),
    );
    const upgradedScope = upgradedScopeRows[0];
    const expectedPostingEnd = addSmokeUtcDaysDateKey(
      upgradedScope?.posting_window_start,
      74,
    );
    const expectedPerformanceDue = addSmokeUtcDaysDateKey(expectedPostingEnd, 44);
    if (
      !upgradedScope ||
      Number(upgradedScope.max_creators) !== 100 ||
      Number(upgradedScope.service_fee_cents) !== 66_800 ||
      upgradedScope.service_fee_status !== "pending" ||
      upgradedScope.posting_window_end?.slice(0, 10) !== expectedPostingEnd ||
      upgradedScope.performance_due_date?.slice(0, 10) !== expectedPerformanceDue ||
      upgradedScope.monitoring_end_date?.slice(0, 10) !== expectedPerformanceDue ||
      upgradedScope.service_package_snapshot?.estimatedMaxCreators !== 100 ||
      upgradedScope.service_package_snapshot?.estimatedActiveDays !== 75 ||
      upgradedScope.service_package_snapshot?.estimatedReportingDays !== 44 ||
      upgradedScope.service_package_snapshot?.balanceDueCents !== 32_300
    ) {
      throw new Error("Expected 100 creator longer paid scope to persist before checkout.");
    }
    await waitForExpression(
      client,
      `!document.body.innerText.includes("Scope updated. Pay the remaining fee before launch.")`,
      "capacity update toast cleared before billing screenshot",
      15000,
    );
    await captureScreenshot(client, screenshotPath);
    await clickTab(client, "Creators");
    try {
      await waitForExpression(
        client,
        `(() => {
          const board = document.querySelector('[data-testid="campaign-creator-operations-board"]');
          const readiness = document.querySelector('[data-testid="campaign-creator-scale-readiness"]');
          const scaleRail = document.querySelector('[data-testid="campaign-creator-scale-rail"]');
          const scaleCapacity = document.querySelector('[data-testid="campaign-creator-scale-rail-capacity"]');
          const scaleInvitePipeline = document.querySelector('[data-testid="campaign-creator-scale-rail-invitePipeline"]');
          const scalePaymentExposure = document.querySelector('[data-testid="campaign-creator-scale-rail-paymentExposure"]');
          const scaleProofPressure = document.querySelector('[data-testid="campaign-creator-scale-rail-proofPressure"]');
          const capacityTrack = document.querySelector('[data-testid="campaign-creator-scale-capacity-track"]');
          const invitePipeline = document.querySelector('[data-testid="campaign-creator-scale-readiness-invitePipeline"]');
          const paymentExposure = document.querySelector('[data-testid="campaign-creator-scale-readiness-paymentExposure"]');
          const proofPressure = document.querySelector('[data-testid="campaign-creator-scale-readiness-proofPressure"]');
          const openSeats = document.querySelector('[data-testid="campaign-creator-open-seats"]');
          const scaleRailText = scaleRail?.innerText.toLowerCase() || "";
          return Boolean(
            board &&
            readiness &&
            scaleRail &&
            scaleCapacity &&
            scaleInvitePipeline &&
            scalePaymentExposure &&
            scaleProofPressure &&
            capacityTrack &&
            invitePipeline &&
            paymentExposure &&
            proofPressure &&
            openSeats &&
            readiness.innerText.includes("Scale readiness") &&
            readiness.innerText.includes("50-creator operating scope") &&
            readiness.innerText.includes("Invite pipeline") &&
            readiness.innerText.includes("Payment exposure") &&
            readiness.innerText.includes("Proof pressure") &&
            scaleRailText.includes("paid capacity") &&
            scaleRailText.includes("invite pipeline") &&
            scaleRailText.includes("payment exposure") &&
            scaleRailText.includes("proof pressure") &&
            !readiness.innerText.includes("100-creator operating scope") &&
            board.innerText.includes("Creator operations") &&
            board.innerText.includes("1 / 50") &&
            board.innerText.includes("Open seats") &&
            openSeats.innerText.trim() === "49"
          );
        })()`,
        "pending 100 creator balance keeps 50 paid creator operations",
      );
    } catch (error) {
      const [campaignDiagnostics, paymentEventDiagnostics] = await Promise.all([
        checkedQuery(
          "Read pending 100 creator capacity campaign diagnostics",
          admin
            .from("campaigns")
            .select("max_creators, service_fee_cents, service_fee_status, service_package_snapshot")
            .eq("id", targets.campaignId),
        ).catch((diagnosticError) => ({
          error: diagnosticError.message,
        })),
        checkedQuery(
          "Read pending 100 creator capacity payment event diagnostics",
          admin
            .from("campaign_payment_events")
            .select("amount_cents, checkout_session_id, event_type, service_fee_status, event_summary")
            .eq("campaign_id", targets.campaignId),
        ).catch((diagnosticError) => ({
          error: diagnosticError.message,
        })),
      ]);
      const diagnostics = await evaluate(
        client,
        `(() => ({
          body: document.body.innerText,
          board: document.querySelector('[data-testid="campaign-creator-operations-board"]')?.innerText || "",
          readiness: document.querySelector('[data-testid="campaign-creator-scale-readiness"]')?.innerText || "",
          scaleRail: document.querySelector('[data-testid="campaign-creator-scale-rail"]')?.innerText || "",
          openSeats: document.querySelector('[data-testid="campaign-creator-open-seats"]')?.innerText || ""
        }))()`,
      ).catch((diagnosticError) => ({
        body: "",
        board: `Unable to read creator operations board: ${diagnosticError.message}`,
        readiness: "",
        scaleRail: "",
        openSeats: "",
      }));
      console.error(
        `Pending 100 creator capacity diagnostics:\\n${JSON.stringify(
          {
            campaign: campaignDiagnostics,
            paymentEvents: paymentEventDiagnostics,
            page: diagnostics,
          },
          null,
          2,
        ).slice(0, 5000)}`,
      );
      throw error;
    }
    const pendingCreatorOperationsText = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-creator-operations-board"]\')?.innerText || ""',
    );
    const pendingCreatorScaleReadinessText = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-creator-scale-readiness"]\')?.innerText || ""',
    );
    await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-creator-invite-import"]\'))',
      "creator invite import tray",
    );
    await evaluate(
      client,
      `(() => {
        const textarea = document.querySelector('[data-testid="campaign-invite-import-textarea"]');
        if (!textarea) throw new Error("Missing invite import textarea");
        const setTextareaValue = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        ).set;
        setTextareaValue.call(textarea, [
          "large-invite-one@example.com, @lisa.global",
          "large-invite-one@example.com; invalid contact; large-invite-two@example.com",
        ].join("\\n"));
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        const summary = document.querySelector('[data-testid="campaign-invite-import-summary"]');
        const button = document.querySelector('[data-testid="campaign-invite-import-submit"]');
        return Boolean(
          tray &&
          summary &&
          button &&
          tray.innerText.includes("Invite list") &&
          tray.innerText.includes("48 open seats") &&
          tray.innerText.includes("The list can be saved now") &&
          summary.innerText.includes("Ready to invite") &&
          summary.innerText.includes("3") &&
          summary.innerText.includes("Duplicates") &&
          summary.innerText.includes("1") &&
          tray.innerText.includes("1 lines need a valid email or @handle") &&
          button.innerText.includes("Save list") &&
          !button.disabled
        );
      })()`,
      "creator invite import preview",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-invite-import-submit"]');
        if (!button) throw new Error("Missing invite import submit button");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        return Boolean(
          tray &&
          tray.innerText.includes("Saved outreach") &&
          tray.innerText.includes("large-invite-one@example.com") &&
          tray.innerText.includes("@lisa.global") &&
          tray.innerText.includes("large-invite-two@example.com") &&
          tray.innerText.includes("Manual")
        );
      })()`,
      "creator invite import saved manual outreach",
    );
    const expectedContacts = new Set([
      "@lisa.global",
      "large-invite-one@example.com",
      "large-invite-two@example.com",
    ]);
    const importedInvites = await checkedQuery(
      "Find large campaign invite import rows",
      admin
        .from("campaign_creator_invites")
        .select("contact_type, contact_value, normalized_contact, status, queued_email_id")
        .eq("campaign_id", targets.campaignId)
        .in("normalized_contact", [...expectedContacts])
        .order("contact_value", { ascending: true }),
    );
    if (
      importedInvites.length !== expectedContacts.size ||
      importedInvites.some(
        (invite) =>
          !expectedContacts.has(invite.normalized_contact) ||
          invite.status !== "manual" ||
          invite.queued_email_id !== null,
      )
    ) {
      throw new Error("Expected large campaign invite import stored manual outreach.");
    }
    await waitForExpression(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-invite-import-submit"]');
        return Boolean(
          button &&
          button.innerText.includes("Save list") &&
          !button.innerText.includes("Saving")
        );
      })()`,
      "creator invite import save settled",
    );
    await evaluate(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        if (!tray) throw new Error("Missing invite import tray");
        const top = tray.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return top;
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
          tray.innerText.includes("Saved outreach");
      })()`,
      "visible saved manual invite import tray",
    );
    await captureScreenshot(client, creatorInviteImportScreenshotPath);

    await navigate(client, targets.brandCampaignsUrl);
    await waitForExpression(
      client,
      `(() => {
        return [...document.querySelectorAll('[data-testid="campaign-row"]')]
          .some((row) =>
            row.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) &&
            row.querySelector('[data-testid="campaign-payment-balance-due"]')?.innerText.includes("$323")
          );
      })()`,
      "brand campaign list balance due",
    );
    await captureScreenshot(client, brandListScreenshotPath);

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(client, targets.adminRevenueUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && document.body.innerText.includes("Paid credit $345") && document.body.innerText.includes("Balance due $323") && document.body.innerText.includes("$668")`,
      "admin revenue paid credit and balance due",
    );
    await captureScreenshot(client, adminRevenueScreenshotPath);

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect for 100 creator balance payment",
    });
    await navigate(client, targets.brandCampaignUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "100 creator balance payment campaign detail title",
    );
    await clickTab(client, "Setup");
    const hundredPayment = await payVisibleServiceFeeBalance(
      client,
      contexts,
      admin,
      targets,
      {
        balanceCents: 32_300,
        balanceDisplay: "$323",
        checkoutDescription: "100 creator and duration upgrade",
      },
    );
    await navigate(client, targets.brandCampaignUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "paid 100 creator campaign detail title",
    );
    await clickTab(client, "Setup");
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-receipt"]\')?.innerText.includes("Payment received")',
      "100-creator payment receipt",
    );
    await clickTab(client, "Creators");
    await waitForExpression(
      client,
      `(() => {
        const board = document.querySelector('[data-testid="campaign-creator-operations-board"]');
        const readiness = document.querySelector('[data-testid="campaign-creator-scale-readiness"]');
        const scaleRail = document.querySelector('[data-testid="campaign-creator-scale-rail"]');
        const scaleCapacity = document.querySelector('[data-testid="campaign-creator-scale-rail-capacity"]');
        const scaleInvitePipeline = document.querySelector('[data-testid="campaign-creator-scale-rail-invitePipeline"]');
        const scalePaymentExposure = document.querySelector('[data-testid="campaign-creator-scale-rail-paymentExposure"]');
        const scaleProofPressure = document.querySelector('[data-testid="campaign-creator-scale-rail-proofPressure"]');
        const capacityTrack = document.querySelector('[data-testid="campaign-creator-scale-capacity-track"]');
        const invitePipeline = document.querySelector('[data-testid="campaign-creator-scale-readiness-invitePipeline"]');
        const paymentExposure = document.querySelector('[data-testid="campaign-creator-scale-readiness-paymentExposure"]');
        const proofPressure = document.querySelector('[data-testid="campaign-creator-scale-readiness-proofPressure"]');
        const openSeats = document.querySelector('[data-testid="campaign-creator-open-seats"]');
        const scaleRailText = scaleRail?.innerText.toLowerCase() || "";
        return Boolean(
          board &&
          readiness &&
          scaleRail &&
          scaleCapacity &&
          scaleInvitePipeline &&
          scalePaymentExposure &&
          scaleProofPressure &&
          capacityTrack &&
          invitePipeline &&
          paymentExposure &&
          proofPressure &&
          openSeats &&
          readiness.innerText.includes("Scale readiness") &&
          readiness.innerText.includes("100-creator operating scope") &&
          readiness.innerText.includes("Invite pipeline") &&
          readiness.innerText.includes("Payment exposure") &&
          readiness.innerText.includes("Proof pressure") &&
          scaleRailText.includes("paid capacity") &&
          scaleRailText.includes("invite pipeline") &&
          scaleRailText.includes("payment exposure") &&
          scaleRailText.includes("proof pressure") &&
          board.innerText.includes("Creator operations") &&
          board.innerText.includes("1 / 100") &&
          board.innerText.includes("Open seats") &&
          openSeats.innerText.trim() === "99"
        );
      })()`,
      "final 100 paid creator operations",
    );
    const creatorOperationsText = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-creator-operations-board"]\')?.innerText || ""',
    );
    const creatorScaleReadinessText = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-creator-scale-readiness"]\')?.innerText || ""',
    );
    await captureScreenshot(client, creatorOperationsScreenshotPath);
    const finalPaymentEvents = hundredPayment.paymentEvents ?? [];
    const paymentEventsShowIncrementalFees =
      finalPaymentEvents.some(
        (event) =>
          event.service_fee_status === "paid" &&
          Number(event.amount_cents) === 14_900,
      ) &&
      finalPaymentEvents.some(
        (event) =>
          event.service_fee_status === "invoiced" &&
          Number(event.amount_cents) === 19_600,
      ) &&
      finalPaymentEvents.some(
        (event) =>
          event.service_fee_status === "paid" &&
          Number(event.amount_cents) === 19_600,
      ) &&
      finalPaymentEvents.some(
        (event) =>
          event.service_fee_status === "invoiced" &&
          Number(event.amount_cents) === 32_300,
      ) &&
      finalPaymentEvents.some(
        (event) =>
          event.service_fee_status === "paid" &&
          Number(event.amount_cents) === 32_300,
      );
    validateLargeCampaignCapacitySmoke({
      bodyText,
      creatorScaleReadinessText,
      creatorOperationsText,
      fiftyBodyText,
      fiftyCreatorScaleReadinessText,
      fiftyCreatorOperationsText,
      pendingCreatorScaleReadinessText,
      pendingCreatorOperationsText,
      payButtonText,
      paymentEventsShowIncrementalFees,
      stripeCheckoutUrls: [
        fiftyPayment.checkoutUrl,
        hundredPayment.checkoutUrl,
      ],
      consoleErrors,
    });

    await checkedQuery(
      "Mark paid 100-creator campaign recruiting for invite smoke",
      admin
        .from("campaigns")
        .update({
          status: "recruiting",
        })
        .eq("id", targets.campaignId),
    );

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect after balance payment",
    });
    await navigate(client, targets.brandCampaignUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "paid launch-ready campaign detail title",
    );
    await clickTab(client, "Creators");
    await waitForExpression(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        const button = document.querySelector('[data-testid="campaign-invite-import-submit"]');
        return Boolean(
          tray &&
          button &&
          tray.innerText.includes("Invite list") &&
          !tray.innerText.includes("The list can be saved now") &&
          button.innerText.includes("Send invites")
        );
      })()`,
      "creator invite import unlocked for email sending",
    );
    await waitForExpression(
      client,
      `(() => {
        return Boolean(
          document.querySelector('[data-testid="campaign-invite-list-search"]') &&
          document.querySelector('[data-testid="campaign-invite-list-filter"]') &&
          document.querySelector('[data-testid="campaign-invite-row"]') &&
          document.querySelector('[data-testid="campaign-invite-remove"]')
        );
      })()`,
      "saved invite list controls after unlock",
    );
    await evaluate(
      client,
      `(() => {
        const search = document.querySelector('[data-testid="campaign-invite-list-search"]');
        if (!search) throw new Error("Missing saved invite search input");
        const setInputValue = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set;
        setInputValue.call(search, "large-invite-one");
        search.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const rows = [...document.querySelectorAll('[data-testid="campaign-invite-row"]')];
        return rows.length === 1 &&
          rows[0].innerText.includes("large-invite-one@example.com") &&
          Boolean(rows[0].querySelector('[data-testid="campaign-invite-send"]'));
      })()`,
      "send saved manual email invite after unlock",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-invite-send"]');
        if (!button) throw new Error("Missing saved invite send button");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const row = document.querySelector('[data-testid="campaign-invite-row"]');
        return Boolean(
          row &&
          row.innerText.includes("large-invite-one@example.com") &&
          row.innerText.includes("Queued")
        );
      })()`,
      "saved manual email invite queued",
    );
    const savedSentInvites = await checkedQuery(
      "Find sent saved campaign invite row",
      admin
        .from("campaign_creator_invites")
        .select("contact_type, normalized_contact, status, queued_email_id")
        .eq("campaign_id", targets.campaignId)
        .eq("normalized_contact", "large-invite-one@example.com"),
    );
    if (
      savedSentInvites.length !== 1 ||
      savedSentInvites[0].contact_type !== "email" ||
      savedSentInvites[0].status !== "queued" ||
      !savedSentInvites[0].queued_email_id
    ) {
      throw new Error("Expected saved manual email invite to queue after unlock.");
    }
    const savedQueuedEmails = await checkedQuery(
      "Find sent saved campaign notification email",
      admin
        .from("notification_queue")
        .select("id, email, template, priority, status, data")
        .eq("id", savedSentInvites[0].queued_email_id),
    );
    if (
      savedQueuedEmails.length !== 1 ||
      savedQueuedEmails[0].email !== "large-invite-one@example.com" ||
      savedQueuedEmails[0].template !== "campaign_update" ||
      savedQueuedEmails[0].priority !== "immediate" ||
      savedQueuedEmails[0].status !== "pending" ||
      !savedQueuedEmails[0].data?.action_url?.includes(`/apply/${targets.campaignId}`) ||
      savedQueuedEmails[0].data?.campaign_id !== targets.campaignId
    ) {
      throw new Error("Expected saved invite send action to create a pending campaign update email.");
    }
    await evaluate(
      client,
      `(() => {
        const search = document.querySelector('[data-testid="campaign-invite-list-search"]');
        if (!search) throw new Error("Missing saved invite search input");
        const setInputValue = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set;
        setInputValue.call(search, "@lisa.global");
        search.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const rows = [...document.querySelectorAll('[data-testid="campaign-invite-row"]')];
        return rows.length === 1 &&
          rows[0].innerText.includes("@lisa.global") &&
          Boolean(rows[0].querySelector('[data-testid="campaign-invite-remove"]'));
      })()`,
      "remove saved manual handle invite",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-invite-remove"]');
        if (!button) throw new Error("Missing saved invite remove button");
        button.click();
        return true;
      })()`,
    );
    try {
      await waitForExpression(
        client,
        `(() => {
          const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
          const rows = [...document.querySelectorAll('[data-testid="campaign-invite-row"]')];
          return Boolean(
            tray &&
            tray.innerText.includes("No saved invites match this view.") &&
            rows.every((row) => !row.innerText.includes("@lisa.global"))
          );
        })()`,
        "saved manual handle removed from invite list",
      );
    } catch (error) {
      const diagnostics = await evaluate(
        client,
        `(() => ({
          empty: document.querySelector('[data-testid="campaign-invite-list-empty"]')?.innerText || "",
          rows: [...document.querySelectorAll('[data-testid="campaign-invite-row"]')].map((row) => row.innerText),
          search: document.querySelector('[data-testid="campaign-invite-list-search"]')?.value || "",
          toasts: [...document.querySelectorAll('[data-sonner-toast]')].map((toast) => toast.innerText)
        }))()`,
      ).catch((diagnosticError) => ({
        empty: "",
        rows: [`Unable to read invite removal diagnostics: ${diagnosticError.message}`],
        search: "",
        toasts: [],
      }));
      console.error(
        `Invite removal diagnostics:\\n${JSON.stringify(diagnostics, null, 2).slice(0, 2400)}`,
      );
      throw error;
    }
    const removedSavedInvites = await checkedQuery(
      "Find removed saved campaign invite row",
      admin
        .from("campaign_creator_invites")
        .select("id")
        .eq("campaign_id", targets.campaignId)
        .eq("normalized_contact", "@lisa.global"),
    );
    if (removedSavedInvites.length !== 0) {
      throw new Error("Expected saved manual handle invite to be removed.");
    }
    await evaluate(
      client,
      `(() => {
        const search = document.querySelector('[data-testid="campaign-invite-list-search"]');
        if (!search) throw new Error("Missing saved invite search input");
        const setInputValue = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set;
        setInputValue.call(search, "");
        search.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        return Boolean(
          tray &&
          tray.innerText.includes("large-invite-one@example.com") &&
          tray.innerText.includes("large-invite-two@example.com") &&
          !tray.innerText.includes("@lisa.global")
        );
      })()`,
      "saved invite list restored after row actions",
    );
    await evaluate(
      client,
      `(() => {
        const textarea = document.querySelector('[data-testid="campaign-invite-import-textarea"]');
        if (!textarea) throw new Error("Missing invite import textarea");
        const setTextareaValue = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        ).set;
        setTextareaValue.call(textarea, [
          "large-queued-one@example.com",
          "large-queued-two@example.com",
          "@jisoo.global",
        ].join("\\n"));
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const summary = document.querySelector('[data-testid="campaign-invite-import-summary"]');
        const button = document.querySelector('[data-testid="campaign-invite-import-submit"]');
        return Boolean(
          summary &&
          button &&
          summary.innerText.includes("Ready to invite") &&
          summary.innerText.includes("3") &&
          summary.innerText.includes("Emails") &&
          summary.innerText.includes("2") &&
          summary.innerText.includes("Handles") &&
          summary.innerText.includes("1") &&
          button.innerText.includes("Send invites") &&
          !button.disabled
        );
      })()`,
      "creator invite import unlocked preview",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-invite-import-submit"]');
        if (!button) throw new Error("Missing invite import submit button");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        return Boolean(
          tray &&
          tray.innerText.includes("Saved outreach") &&
          tray.innerText.includes("large-queued-one@example.com") &&
          tray.innerText.includes("large-queued-two@example.com") &&
          tray.innerText.includes("@jisoo.global") &&
          tray.innerText.includes("Queued") &&
          tray.innerText.includes("Manual")
        );
      })()`,
      "creator invite import saved queued outreach",
    );
    const sentInviteContacts = new Set([
      "@jisoo.global",
      "large-queued-one@example.com",
      "large-queued-two@example.com",
    ]);
    const queuedInvites = await checkedQuery(
      "Find queued large campaign invite import rows",
      admin
        .from("campaign_creator_invites")
        .select("contact_type, contact_value, normalized_contact, status, queued_email_id")
        .eq("campaign_id", targets.campaignId)
        .in("normalized_contact", [...sentInviteContacts])
        .order("contact_value", { ascending: true }),
    );
    const queuedEmailIds = queuedInvites
      .filter((invite) => invite.contact_type === "email")
      .map((invite) => invite.queued_email_id)
      .filter(Boolean);
    if (
      queuedInvites.length !== sentInviteContacts.size ||
      queuedEmailIds.length !== 2 ||
      queuedInvites.some((invite) => {
        if (!sentInviteContacts.has(invite.normalized_contact)) return true;
        if (invite.contact_type === "email") {
          return invite.status !== "queued" || !invite.queued_email_id;
        }
        return invite.status !== "manual" || invite.queued_email_id !== null;
      })
    ) {
      throw new Error("Expected unlocked invite import to queue emails and keep handles manual.");
    }
    const queuedEmails = await checkedQuery(
      "Find queued large campaign notification emails",
      admin
        .from("notification_queue")
        .select("id, email, template, priority, status, data")
        .in("id", queuedEmailIds)
        .order("email", { ascending: true }),
    );
    if (
      queuedEmails.length !== 2 ||
      queuedEmails.some(
        (queue) =>
          queue.status !== "pending" ||
          queue.template !== "campaign_update" ||
          queue.priority !== "immediate" ||
          !queue.data?.action_url?.includes(`/apply/${targets.campaignId}`) ||
          queue.data?.campaign_id !== targets.campaignId,
      )
    ) {
      throw new Error(
        "Expected queued campaign invite emails to remain pending during smoke.",
      );
    }
    await waitForExpression(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-invite-import-submit"]');
        return Boolean(
          button &&
          button.innerText.includes("Send invites") &&
          !button.innerText.includes("Saving")
        );
      })()`,
      "creator invite import send settled",
    );
    await evaluate(
      client,
      `(() => {
        document.querySelectorAll('[data-sonner-toast]').forEach((toast) => toast.remove());
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-sonner-toast]').length === 0`,
      "sonner toast overlay cleared before final invite screenshot",
      15000,
    );
    await evaluate(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        if (!tray) throw new Error("Missing invite import tray");
        const top = tray.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return top;
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
          tray.innerText.includes("large-queued-one@example.com") &&
          tray.innerText.includes("Queued");
      })()`,
      "visible saved queued invite import tray",
    );
    await captureScreenshot(client, creatorInviteSendScreenshotPath);

    return {
      ok: true,
      adminRevenueScreenshotPath,
      baseUrl: targets.baseUrl,
      brandListScreenshotPath,
      campaignUrl: targets.brandCampaignUrl,
      creatorInviteCapacityWarningScreenshotPath,
      creatorInviteImportScreenshotPath,
      creatorInviteSendScreenshotPath,
      creatorOperationsScreenshotPath,
      screenshotPath,
      devServerStarted: Boolean(devServer),
    };
  } finally {
    if (client) client.close();
    await stopChrome(chrome);
    await rm(userDataDir, { recursive: true, force: true });
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    await stopDevServer(devServer);
    if (previousCampaignTitle === undefined) {
      delete process.env.SMOKE_CAMPAIGN_TITLE;
    } else {
      process.env.SMOKE_CAMPAIGN_TITLE = previousCampaignTitle;
    }
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runLargeCampaignCapacitySmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
