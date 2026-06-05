#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  getSmokeCampaignTitle,
  isExistingDevServerReady,
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
  waitForFunction,
} from "./smoke-campaign-detail.mjs";

export const DEFAULT_STRIPE_CHECKOUT_WEBHOOK_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000424";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/stripe-checkout-webhook-smoke.png";
const STRIPE_TEST_CARD = "4242424242424242";
export const STRIPE_INITIAL_PAID_CREATOR_CAPACITY_CENTS = 14900;
export const STRIPE_UPGRADE_BALANCE_DUE_CENTS = 44100;

export const STRIPE_LARGE_CAMPAIGN_SCOPE_UPDATE = Object.freeze({
  max_creators: 100,
  service_fee_cents: 59000,
  service_fee_status: "pending",
  service_package_snapshot: {
    mode: "private",
    feeCents: 59000,
    currency: "usd",
    creatorSourcingRequired: false,
    tierKey: "workspace",
    requiresCustomPricing: false,
    includedCreatorCount: 10,
    includedActiveDays: 45,
    includedReportingDays: 14,
    estimatedMaxCreators: 100,
    estimatedActiveDays: 45,
    estimatedReportingDays: 14,
    creatorOverageBlocks: 9,
    activeDayOverageBlocks: 0,
    reportingDayOverageBlocks: 0,
    overageFeeCents: 44100,
    balanceDueCents: STRIPE_UPGRADE_BALANCE_DUE_CENTS,
    paidCents: STRIPE_INITIAL_PAID_CREATOR_CAPACITY_CENTS,
  },
});

function dateDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function buildStripeLargeCampaignScopeUpdate() {
  return {
    ...STRIPE_LARGE_CAMPAIGN_SCOPE_UPDATE,
    content_due_date: dateDaysFromNow(8),
    monitoring_end_date: dateDaysFromNow(65),
    performance_due_date: dateDaysFromNow(65),
    posting_window_start: dateDaysFromNow(7),
    posting_window_end: dateDaysFromNow(51),
    recruitment_visibility: "open_applications",
  };
}

export function buildStripeCheckoutWebhookSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_STRIPE_CHECKOUT_CAMPAIGN_ID ||
    DEFAULT_STRIPE_CHECKOUT_WEBHOOK_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminCampaignsUrl: `${normalizedBaseUrl}/admin/campaigns`,
    adminRevenueUrl: `${normalizedBaseUrl}/admin/revenue`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    creatorDiscoverUrl: `${normalizedBaseUrl}/i/discover`,
    creatorDiscoverDetailUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
    publicApplyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
  };
}

export function validateStripeCheckoutWebhookSmoke({
  adminCampaignsShowsPaymentState,
  adminRevenueShowsTrace,
  adminRevenueShowsScope,
  brandReceiptVisible,
  checkoutUrl,
  checkoutShowsLargeCampaignFee,
  creatorDetailVisible,
  creatorDiscoverVisible,
  paymentEventsShowUpgradeBalance = true,
  paymentEventCount,
  publicApplyVisible,
  serviceFeeStatus,
  setupShowsUpgradeBalance = true,
  traceFields,
  launchEnabled,
  inviteUrl,
  consoleErrors,
}) {
  if (!checkoutUrl.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Expected payment to happen through Stripe-hosted Checkout.");
  }

  if (!checkoutShowsLargeCampaignFee) {
    throw new Error(
      "Expected Stripe Checkout to show the $441 100-creator campaign fee upgrade balance.",
    );
  }

  if (!setupShowsUpgradeBalance) {
    throw new Error("Expected brand setup billing to show the $441 upgrade balance.");
  }

  if (serviceFeeStatus !== "paid") {
    throw new Error(
      `Expected webhook-paid campaign status. Got: ${serviceFeeStatus || "missing"}`,
    );
  }

  if (paymentEventCount < 3) {
    throw new Error(
      `Expected paid credit, checkout creation, and webhook payment events. Found: ${paymentEventCount}`,
    );
  }

  if (!paymentEventsShowUpgradeBalance) {
    throw new Error(
      "Expected payment events to preserve the $149 paid credit and $441 Stripe balance.",
    );
  }

  if (
    !traceFields?.checkoutSessionId?.startsWith("cs_") ||
    !traceFields?.paymentIntentId?.startsWith("pi_") ||
    !traceFields?.lastEventId
  ) {
    throw new Error("Expected Stripe trace fields to be stored on the campaign.");
  }

  if (!launchEnabled) {
    throw new Error("Expected paid campaign launch action to be enabled.");
  }

  if (!inviteUrl.includes("/apply/")) {
    throw new Error("Expected paid launched campaign to reveal the invite URL.");
  }

  if (!brandReceiptVisible) {
    throw new Error("Expected brand billing scope to show payment receipt details.");
  }

  if (!creatorDiscoverVisible) {
    throw new Error("Expected creator discovery to show the paid launched campaign.");
  }

  if (!creatorDetailVisible) {
    throw new Error("Expected creator detail to show the paid launched campaign.");
  }

  if (!publicApplyVisible) {
    throw new Error("Expected public apply page to show the paid launched campaign.");
  }

  if (!adminCampaignsShowsPaymentState) {
    throw new Error("Expected admin campaigns to show the paid service fee state.");
  }

  if (!adminRevenueShowsTrace) {
    throw new Error("Expected admin revenue to show Stripe trace and payment event details.");
  }

  if (!adminRevenueShowsScope) {
    throw new Error("Expected admin revenue to show the paid creator capacity scope.");
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

async function seedStripeCheckoutUpgradeCredit(admin, campaignId) {
  await checkedQuery(
    "Seed Stripe checkout smoke paid base fee credit",
    admin.from("campaign_payment_events").upsert(
      {
        amount_cents: STRIPE_INITIAL_PAID_CREATOR_CAPACITY_CENTS,
        campaign_id: campaignId,
        currency: "usd",
        event_id: `evt_smoke_initial_paid_capacity_${campaignId}`,
        event_summary: {
          smoke: "stripe-checkout-upgrade-balance",
          startingCreatorCapacity: 10,
        },
        event_type: "checkout.session.completed",
        provider: "stripe",
        service_fee_status: "paid",
      },
      { ignoreDuplicates: true, onConflict: "provider,event_id" },
    ),
  );
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

export function trackRuntimeContexts(client) {
  const contexts = new Map();

  client.on("Runtime.executionContextCreated", (event) => {
    if (event.context?.id) contexts.set(event.context.id, event.context);
  });
  client.on("Runtime.executionContextDestroyed", (event) => {
    contexts.delete(event.executionContextId);
  });
  client.on("Runtime.executionContextsCleared", () => {
    contexts.clear();
  });

  return contexts;
}

async function evaluateInContext(client, contextId, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    contextId,
    returnByValue: true,
    userGesture: true,
  });

  if (result.exceptionDetails) {
    const description =
      result.exceptionDetails.exception?.description ||
      result.exceptionDetails.text ||
      "Evaluation failed";
    throw new Error(description);
  }

  return result.result?.value;
}

async function withEveryContext(contexts, callback) {
  const results = [];
  for (const contextId of contexts.keys()) {
    try {
      const result = await callback(contextId);
      if (result) results.push(result);
    } catch {
      // Stripe rotates secure frames during checkout. Stale contexts are expected.
    }
  }
  return results;
}

function fieldFocusExpression(patterns) {
  return `(() => {
    const patterns = ${JSON.stringify(patterns)};
    const isVisible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const labelFor = (input) => {
      const explicitLabels = [...document.querySelectorAll("label")]
        .filter((label) => label.htmlFor && label.htmlFor === input.id)
        .map((label) => label.textContent || "");
      const wrappingLabel = input.closest("label")?.textContent || "";
      return [
        input.name,
        input.id,
        input.placeholder,
        input.autocomplete,
        input.getAttribute("aria-label"),
        input.getAttribute("data-elements-stable-field-name"),
        wrappingLabel,
        ...explicitLabels,
      ].filter(Boolean).join(" ").toLowerCase();
    };
    const target = [...document.querySelectorAll("input, textarea")]
      .filter((node) => !node.disabled && !node.readOnly && isVisible(node))
      .find((node) => patterns.some((pattern) => labelFor(node).includes(pattern)));
    if (!target) return null;
    target.scrollIntoView({ block: "center", inline: "center" });
    target.focus();
    target.click();
    return true;
  })()`;
}

async function focusStripeField(client, contexts, patterns) {
  const focused = await withEveryContext(contexts, (contextId) =>
    evaluateInContext(client, contextId, fieldFocusExpression(patterns)),
  );
  return focused.length > 0;
}

async function focusFirstStripeInput(client, contexts) {
  const focused = await withEveryContext(
    contexts,
    (contextId) =>
      evaluateInContext(
        client,
        contextId,
        `(() => {
          const target = [...document.querySelectorAll("input, textarea")]
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return !node.disabled && !node.readOnly && rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
            })[0];
          if (!target) return null;
          target.scrollIntoView({ block: "center", inline: "center" });
          target.focus();
          target.click();
          return true;
        })()`,
      ),
  );
  return focused.length > 0;
}

async function insertText(client, text) {
  await client.send("Input.insertText", { text });
}

async function pressKey(client, key) {
  const codes = {
    Enter: { code: "Enter", key: "Enter", windowsVirtualKeyCode: 13 },
    Tab: { code: "Tab", key: "Tab", windowsVirtualKeyCode: 9 },
  };
  const code = codes[key];
  if (!code) throw new Error(`Unsupported key: ${key}`);

  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    ...code,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    ...code,
  });
}

async function typeStripeField(client, contexts, label, patterns, value) {
  const focused = await focusStripeField(client, contexts, patterns);
  if (!focused) return false;
  await insertText(client, value);
  return true;
}

async function clickStripePayButton(client, contexts) {
  const clicked = await withEveryContext(
    contexts,
    (contextId) =>
      evaluateInContext(
        client,
        contextId,
        `(() => {
          const buttons = [...document.querySelectorAll("button")].filter((button) => {
            const rect = button.getBoundingClientRect();
            return !button.disabled && rect.width > 0 && rect.height > 0;
          });
          const payButton =
            buttons.find((button) => /pay|complete|submit/i.test(button.textContent || "")) ||
            buttons.find((button) => button.type === "submit") ||
            buttons[buttons.length - 1];
          if (!payButton) return null;
          payButton.scrollIntoView({ block: "center", inline: "center" });
          payButton.click();
          return true;
        })()`,
      ),
  );

  if (clicked.length === 0) {
    await pressKey(client, "Enter");
  }
}

export async function fillStripeCheckoutTestPayment(client, contexts) {
  await waitForExpression(
    client,
    `location.hostname.endsWith("stripe.com") && document.body.innerText.includes("PopsDrops")`,
    "Stripe Checkout page",
    90000,
  );

  const cardFilled = await typeStripeField(
    client,
    contexts,
    "card number",
    ["card number", "cardnumber", "card", "1234", "number"],
    STRIPE_TEST_CARD,
  );

  if (!cardFilled) {
    const focused = await focusFirstStripeInput(client, contexts);
    if (!focused) throw new Error("Stripe card field was not found.");
    await insertText(client, STRIPE_TEST_CARD);
  }

  const expiryFilled = await typeStripeField(
    client,
    contexts,
    "card expiry",
    ["expiry", "expiration", "exp", "mm", "date"],
    "1234",
  );
  if (!expiryFilled) {
    await pressKey(client, "Tab");
    await insertText(client, "1234");
  }

  const cvcFilled = await typeStripeField(
    client,
    contexts,
    "card security code",
    ["cvc", "cvv", "security"],
    "123",
  );
  if (!cvcFilled) {
    await pressKey(client, "Tab");
    await insertText(client, "123");
  }

  const nameFilled = await typeStripeField(
    client,
    contexts,
    "cardholder name",
    ["cardholder", "name"],
    "PopsDrops Smoke",
  );
  if (!nameFilled) {
    await pressKey(client, "Tab");
    await insertText(client, "PopsDrops Smoke");
  }

  const postalFilled = await typeStripeField(
    client,
    contexts,
    "postal code",
    ["postal", "zip", "postcode"],
    "94105",
  );
  if (!postalFilled) {
    await pressKey(client, "Tab");
    await insertText(client, "94105");
  }

  await clickStripePayButton(client, contexts);
}

export async function waitForCampaignServiceFeeStatus(
  admin,
  campaignId,
  expectedStatus,
  timeoutMs = 120000,
) {
  const startedAt = Date.now();
  let lastStatus = null;

  while (Date.now() - startedAt < timeoutMs) {
    const campaign = await checkedQuery(
      "Read smoke campaign service fee status",
      admin
        .from("campaigns")
        .select(
          "service_fee_status, service_fee_checkout_session_id, service_fee_payment_intent_id, service_fee_last_event_id, service_fee_last_event_type, service_fee_last_event_at",
        )
        .eq("id", campaignId)
        .single(),
    );

    lastStatus = campaign?.service_fee_status ?? null;
    if (lastStatus === expectedStatus) return campaign;

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(
    `Timed out waiting for Stripe webhook to mark service fee ${expectedStatus}. Last status: ${lastStatus || "missing"}`,
  );
}

async function runStripeCheckoutWebhookSmoke() {
  await loadLocalEnv();

  const targets = buildStripeCheckoutWebhookSmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_STRIPE_CHECKOUT_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();

  await setupApplicationFlowSmokeData(admin, targets);
  await seedStripeCheckoutUpgradeCredit(admin, targets.campaignId);
  await checkedQuery(
    "Prepare Stripe checkout smoke campaign",
    admin
      .from("campaigns")
      .update({
        ...buildStripeLargeCampaignScopeUpdate(),
        status: "draft",
      })
      .eq("id", targets.campaignId),
  );

  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-stripe-checkout-smoke-"),
  );
  let chrome;
  let client;
  let checkoutUrl = "";
  let checkoutShowsLargeCampaignFee = false;
  let setupShowsUpgradeBalance = false;
  let paymentEventsShowUpgradeBalance = false;
  let paymentEventCount = 0;
  let serviceFeeStatus = "";
  let traceFields = {
    checkoutSessionId: "",
    lastEventId: "",
    paymentIntentId: "",
  };
  let launchEnabled = false;
  let adminCampaignsShowsPaymentState = false;
  let adminRevenueShowsTrace = false;
  let adminRevenueShowsScope = false;
  let brandReceiptVisible = false;
  let creatorDetailVisible = false;
  let creatorDiscoverVisible = false;
  let inviteUrl = "";
  let publicApplyVisible = false;
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
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect",
    });

    await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "campaign detail title",
    );
    await clickTab(client, "Setup");
    await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-service-fee-action"]\'))',
      "campaign service fee action",
    );
    setupShowsUpgradeBalance = await waitForExpression(
      client,
      'document.body.innerText.includes("Balance due") && document.body.innerText.includes("$441") && document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.innerText.includes("$441")',
      "brand setup upgrade balance",
      90000,
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
    try {
      checkoutShowsLargeCampaignFee = await waitForExpression(
        client,
        'document.body.innerText.includes("PopsDrops") && document.body.innerText.includes("$441")',
        "Stripe Checkout $441 upgrade balance",
        90000,
      );
    } catch (error) {
      const stripeText = await evaluate(client, "document.body.innerText").catch(
        (textError) => `Unable to read Stripe page text: ${textError.message}`,
      );
      console.error(
        `Stripe Checkout page text before failure:\n${stripeText.slice(0, 1600)}`,
      );
      await captureScreenshot(
        client,
        screenshotPath.replace(/\.png$/u, "-stripe-checkout-failure.png"),
      ).catch(() => {});
      throw error;
    }

    await fillStripeCheckoutTestPayment(client, contexts);
    await waitForExpression(
      client,
      `location.href.startsWith(${JSON.stringify(targets.brandCampaignUrl)}) && location.search.includes("checkout=success")`,
      "checkout success redirect",
      120000,
    );

    const paidCampaign = await waitForCampaignServiceFeeStatus(
      admin,
      targets.campaignId,
      "paid",
    );
    serviceFeeStatus = paidCampaign.service_fee_status;
    traceFields = {
      checkoutSessionId: paidCampaign.service_fee_checkout_session_id || "",
      lastEventId: paidCampaign.service_fee_last_event_id || "",
      paymentIntentId: paidCampaign.service_fee_payment_intent_id || "",
    };
    const paymentEvents = await checkedQuery(
      "Read smoke campaign payment events",
      admin
        .from("campaign_payment_events")
        .select("amount_cents, event_type, service_fee_status")
        .eq("campaign_id", targets.campaignId),
    );
    paymentEventCount = paymentEvents?.length ?? 0;
    paymentEventsShowUpgradeBalance =
      (paymentEvents ?? []).some(
        (event) =>
          event.service_fee_status === "paid" &&
          Number(event.amount_cents) === STRIPE_INITIAL_PAID_CREATOR_CAPACITY_CENTS,
      ) &&
      (paymentEvents ?? []).some(
        (event) =>
          event.service_fee_status === "invoiced" &&
          Number(event.amount_cents) === STRIPE_UPGRADE_BALANCE_DUE_CENTS,
      ) &&
      (paymentEvents ?? []).some(
        (event) =>
          event.service_fee_status === "paid" &&
          Number(event.amount_cents) === STRIPE_UPGRADE_BALANCE_DUE_CENTS &&
          event.event_type === "checkout.session.completed",
      );

    await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
    await clickTab(client, "Setup");
    brandReceiptVisible = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-receipt"]\')?.innerText.includes("Payment received") && document.querySelector(\'[data-testid="campaign-service-fee-reference"]\')?.innerText.includes("Payment intent")',
      "brand payment receipt",
      90000,
    );
    launchEnabled = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === false',
      "paid campaign launch action",
      90000,
    );
    await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.click()',
    );
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value.includes("/apply/")',
      "paid launched invite URL",
    );
    inviteUrl = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value || ""',
    );

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
      `function (title) {
        return document.body.innerText.includes(title) &&
          [...document.querySelectorAll('[data-testid="creator-discover-card"]')]
            .some((node) => node.textContent.includes(title));
      }`,
      [getSmokeCampaignTitle()],
      "creator discovery paid launched campaign",
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
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && !document.body.innerText.includes("Campaign not found")`,
      "creator detail paid launched campaign",
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
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && !document.body.innerText.includes("Campaign not found") && !document.body.innerText.includes("Not found")`,
      "public apply paid launched campaign",
      90000,
    );

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(client, targets.adminRevenueUrl);
    adminRevenueShowsTrace = await waitForExpression(
      client,
      `document.querySelector('[data-testid="admin-revenue-payment-event"]')?.innerText.includes("checkout.session.completed") && document.querySelector('[data-testid="admin-revenue-stripe-reference"]')?.innerText.includes(${JSON.stringify(traceFields.paymentIntentId.slice(0, 12))})`,
      "admin revenue Stripe trace",
      90000,
    );
    adminRevenueShowsScope = await waitForExpression(
      client,
      '[...document.querySelectorAll(\'[data-testid="admin-revenue-service-fee-scope"]\')].some((node) => node.innerText.includes("Creator capacity") && node.innerText.includes("100"))',
      "admin revenue creator capacity scope",
      90000,
    );
    await navigate(client, targets.adminCampaignsUrl);
    adminCampaignsShowsPaymentState = await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && [...document.querySelectorAll('[data-testid="admin-campaigns-service-fee-status"]')].some((node) => (node.textContent || "").toLowerCase().includes("paid"))`,
      "admin campaigns paid service fee state",
      90000,
    );

    validateStripeCheckoutWebhookSmoke({
      adminCampaignsShowsPaymentState,
      adminRevenueShowsTrace,
      adminRevenueShowsScope,
      brandReceiptVisible,
      checkoutUrl,
      checkoutShowsLargeCampaignFee,
      creatorDetailVisible,
      creatorDiscoverVisible,
      paymentEventsShowUpgradeBalance,
      paymentEventCount,
      publicApplyVisible,
      serviceFeeStatus,
      setupShowsUpgradeBalance,
      traceFields,
      launchEnabled,
      inviteUrl,
      consoleErrors,
    });

    await captureScreenshot(client, screenshotPath);

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignUrl: targets.brandCampaignUrl,
      checkoutHost: new URL(checkoutUrl).host,
      adminCampaignsShowsPaymentState,
      adminRevenueShowsTrace,
      adminRevenueShowsScope,
      brandReceiptVisible,
      checkoutShowsLargeCampaignFee,
      creatorDetailVisible,
      creatorDiscoverVisible,
      paymentEventsShowUpgradeBalance,
      paymentEventCount,
      publicApplyVisible,
      serviceFeeStatus,
      setupShowsUpgradeBalance,
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
  runStripeCheckoutWebhookSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runStripeCheckoutWebhookSmoke };
