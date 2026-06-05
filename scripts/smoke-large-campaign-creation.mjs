#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";
import {
  createCdpPage,
  ensureDevServer,
  evaluate,
  findFreePort,
  launchChrome,
  loginForSmoke,
  navigate,
  stopDevServer,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";
import {
  fillStripeCheckoutTestPayment,
  trackRuntimeContexts,
  waitForCampaignServiceFeeStatus,
} from "./smoke-stripe-checkout-webhook.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_CAMPAIGN_TITLE = "Global Beauty 100-Creator Proof Launch";
const DEFAULT_COMPLIANCE_NOTES =
  "Use clear sponsored disclosure and avoid unapproved skin-care efficacy claims.";
const DEFAULT_REVIEW_SCREENSHOT_PATH =
  "output/playwright/large-campaign-creation-review-smoke.png";
const DEFAULT_REPORT_GOAL_SCREENSHOT_PATH =
  "output/playwright/large-campaign-creation-report-goal-smoke.png";
const DEFAULT_DETAIL_SCREENSHOT_PATH =
  "output/playwright/large-campaign-creation-detail-smoke.png";
const DEFAULT_LIST_SCREENSHOT_PATH =
  "output/playwright/large-campaign-creation-list-smoke.png";
const DEFAULT_ADMIN_REVENUE_SCREENSHOT_PATH =
  "output/playwright/large-campaign-creation-admin-revenue-smoke.png";
const DEFAULT_PAID_SCREENSHOT_PATH =
  "output/playwright/large-campaign-creation-paid-smoke.png";
const DEFAULT_PUBLIC_APPLY_SCREENSHOT_PATH =
  "output/playwright/large-campaign-creation-public-apply-smoke.png";

export function buildLargeCampaignCreationSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignTitle =
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_TITLE || DEFAULT_CAMPAIGN_TITLE,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminRevenueUrl: `${normalizedBaseUrl}/admin/revenue#service-fees`,
    baseUrl: normalizedBaseUrl,
    brandCampaignsUrl: `${normalizedBaseUrl}/b/campaigns`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    campaignNewUrl: `${normalizedBaseUrl}/b/campaigns/new`,
    campaignTitle,
  };
}

export function validateLargeCampaignCreationSmoke({
  adminRevenueRowText,
  brandDetailText,
  brandListRowText,
  builderReviewText,
  campaignReportPlan,
  consoleErrors,
}) {
  const normalizedAdminRevenueRowText = normalizeSmokeText(adminRevenueRowText);
  const normalizedBrandDetailText = normalizeSmokeText(brandDetailText);
  const normalizedBrandListRowText = normalizeSmokeText(brandListRowText);
  const normalizedBuilderReviewText = normalizeSmokeText(builderReviewText);
  const checks = [
    ["builder review", normalizedBuilderReviewText],
    ["brand detail", normalizedBrandDetailText],
    ["brand campaign list", normalizedBrandListRowText],
    ["admin revenue row", normalizedAdminRevenueRowText],
  ];

  for (const [label, text] of checks) {
    if (!text.includes(DEFAULT_CAMPAIGN_TITLE)) {
      throw new Error(`Expected ${label} to show the board-ready campaign title.`);
    }
    if (!text.includes("100")) {
      throw new Error(`Expected ${label} to show 100 creator capacity.`);
    }
    if (!text.includes("$590")) {
      throw new Error(`Expected ${label} to show the full $590 service fee.`);
    }
  }

  if (!normalizedBrandDetailText.includes("Pay $590")) {
    throw new Error("Expected brand detail payment action to charge $590.");
  }

  if (!normalizedBrandDetailText.includes("Balance due $590")) {
    throw new Error("Expected brand detail to show Balance due $590.");
  }

  if (!normalizedBrandListRowText.includes("Balance due $590")) {
    throw new Error("Expected brand list row to show Balance due $590.");
  }

  if (!normalizedAdminRevenueRowText.includes("Balance due $590")) {
    throw new Error("Expected admin revenue row to show Balance due $590.");
  }

  if (normalizedAdminRevenueRowText.includes("Paid credit")) {
    throw new Error("Expected first-run creation to have no paid credit yet.");
  }

  if (
    !normalizedBuilderReviewText.includes("Report goal") ||
    !normalizedBuilderReviewText.includes("Leadership brief")
  ) {
    throw new Error("Expected builder review to show the Leadership brief report goal.");
  }

  if (
    !normalizedBuilderReviewText.includes("Report chart") ||
    !normalizedBuilderReviewText.includes("Trend view") ||
    !normalizedBuilderReviewText.includes("Report blocks") ||
    !normalizedBuilderReviewText.includes("Executive summary") ||
    !normalizedBuilderReviewText.includes("Report trust")
  ) {
    throw new Error("Expected builder review to show report chart and proof blocks.");
  }

  const blockIds = Array.isArray(campaignReportPlan?.report_block_ids)
    ? campaignReportPlan.report_block_ids
    : [];
  const hasLeadershipBlocks = [
    "executive_summary",
    "channel_story",
    "report_trust",
    "recommendations",
  ].every((blockId) => blockIds.includes(blockId));

  if (
    campaignReportPlan?.report_preset_id !== "leadership" ||
    campaignReportPlan?.report_chart_mode_id !== "trend" ||
    !hasLeadershipBlocks
  ) {
    throw new Error("Expected campaign creation to save the Leadership brief report goal plan.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export function validateLargeCampaignCreationPaymentSmoke({
  adminCampaignsShowsPaymentState,
  adminRevenueShowsTrace,
  brandReceiptVisible,
  checkoutShowsInitialFee,
  checkoutUrl,
  inviteUrl,
  launchEnabled,
  paymentEventCount,
  paymentEventsShowInitialFee,
  publicApplyShowsComplianceNotes,
  publicApplyHeroImageReady,
  publicApplyVisible,
  serviceFeeStatus,
  traceFields,
  consoleErrors,
}) {
  if (!checkoutUrl.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Expected payment to happen through Stripe-hosted Checkout.");
  }

  if (!checkoutShowsInitialFee) {
    throw new Error("Expected Stripe Checkout to show the full $590 initial campaign fee.");
  }

  if (serviceFeeStatus !== "paid") {
    throw new Error(
      `Expected webhook-paid campaign status. Got: ${serviceFeeStatus || "missing"}`,
    );
  }

  if (paymentEventCount < 2 || !paymentEventsShowInitialFee) {
    throw new Error(
      "Expected checkout creation and webhook payment events for the full $590 initial campaign fee.",
    );
  }

  if (
    !traceFields?.checkoutSessionId?.startsWith("cs_") ||
    !traceFields?.paymentIntentId?.startsWith("pi_") ||
    !traceFields?.lastEventId
  ) {
    throw new Error("Expected Stripe trace fields to be stored on the campaign.");
  }

  if (!brandReceiptVisible) {
    throw new Error("Expected brand billing scope to show the payment receipt.");
  }

  if (!launchEnabled) {
    throw new Error("Expected paid first-run campaign launch action to be enabled.");
  }

  if (!inviteUrl.includes("/apply/")) {
    throw new Error("Expected launched first-run campaign to reveal the invite URL.");
  }

  if (!publicApplyVisible) {
    throw new Error("Expected public apply page to show the launched large campaign.");
  }

  if (!publicApplyShowsComplianceNotes) {
    throw new Error("Expected public apply page to show compliance notes.");
  }

  if (!publicApplyHeroImageReady) {
    throw new Error("Expected public apply hero image to render before capture.");
  }

  if (!adminRevenueShowsTrace) {
    throw new Error("Expected admin revenue to show Stripe trace details.");
  }

  if (!adminCampaignsShowsPaymentState) {
    throw new Error("Expected admin campaigns to show the paid service fee state.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

function normalizeSmokeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function cleanupCampaignsByTitle(admin, campaignTitle) {
  const rows = await checkedQuery(
    "Find large campaign creation smoke campaigns",
    admin.from("campaigns").select("id").eq("title", campaignTitle),
  );

  for (const row of rows ?? []) {
    await cleanupApplicationFlowSmokeData(admin, row.id);
  }
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

async function clickVisibleButton(client, text, description = text) {
  await waitForExpression(
    client,
    `(() => {
      return [...document.querySelectorAll("button")]
        .some((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 &&
            rect.height > 0 &&
            !button.disabled &&
            button.innerText.trim().includes(${JSON.stringify(text)});
        });
    })()`,
    description,
  );
  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 &&
            rect.height > 0 &&
            !candidate.disabled &&
            candidate.innerText.trim().includes(${JSON.stringify(text)});
        });
      if (!button) throw new Error(${JSON.stringify(`Missing button: ${text}`)});
      button.click();
      return true;
    })()`,
  );
}

async function clickScopedButtonUntilPressed(
  client,
  selector,
  text,
  description,
  timeoutMs = 120000,
) {
  const readyExpression = `(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 &&
          rect.height > 0 &&
          !candidate.disabled &&
          candidate.innerText.includes(${JSON.stringify(text)});
      });
    return button?.getAttribute("aria-pressed") === "true";
  })()`;
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const alreadyPressed = await evaluate(client, readyExpression);
      if (alreadyPressed) return true;
    } catch (error) {
      lastError = error;
    }

    try {
      await evaluate(
        client,
        `(() => {
          const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
            .find((candidate) => {
              const rect = candidate.getBoundingClientRect();
              return rect.width > 0 &&
                rect.height > 0 &&
                !candidate.disabled &&
                candidate.innerText.includes(${JSON.stringify(text)});
            });
          if (!button) throw new Error(${JSON.stringify(`Missing button: ${text}`)});
          button.scrollIntoView({ block: "center", inline: "nearest" });
          button.click();
          return true;
        })()`,
      );
      return await waitForExpression(
        client,
        readyExpression,
        `${description} selected`,
        2500,
      );
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `Timed out waiting for ${description}: ${lastError?.message || "not ready"}`,
  );
}

async function clickVisibleButtonAndWait(
  client,
  text,
  readyExpression,
  description,
  timeoutMs = 120000,
) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const alreadyReady = await evaluate(client, readyExpression);
      if (alreadyReady) return true;
    } catch (error) {
      lastError = error;
    }

    try {
      await clickVisibleButton(client, text, description);
      return await waitForExpression(
        client,
        readyExpression,
        `${description} result`,
        2500,
      );
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(
    `Timed out waiting for ${description}: ${lastError?.message || "not ready"}`,
  );
}

async function setFieldValue(client, selector, value) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    `${selector} field`,
  );
  await evaluate(
    client,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error(${JSON.stringify(`Missing field: ${selector}`)});
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
      setter.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
}

async function attachCampaignImage(client) {
  await waitForExpression(
    client,
    'Boolean(document.querySelector("#campaign-image"))',
    "campaign image input",
  );
  await evaluate(
    client,
    `(async () => {
      async function createSmokeCampaignImageFile() {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 900;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Missing smoke image canvas context");

        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "#0f172a");
        gradient.addColorStop(0.42, "#1e293b");
        gradient.addColorStop(1, "#f8fafc");
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = "rgba(255, 255, 255, 0.88)";
        context.fillRect(96, 96, 1008, 708);

        context.strokeStyle = "rgba(15, 23, 42, 0.18)";
        context.lineWidth = 8;
        context.strokeRect(96, 96, 1008, 708);

        context.fillStyle = "#0f172a";
        context.font = "600 68px Inter, system-ui, sans-serif";
        context.fillText("Smoke product image", 150, 220);

        context.fillStyle = "#475569";
        context.font = "400 36px Inter, system-ui, sans-serif";
        context.fillText("Visible creator preview asset", 150, 286);

        context.fillStyle = "#0f172a";
        context.fillRect(150, 600, 330, 64);
        context.fillStyle = "#f8fafc";
        context.font = "600 30px Inter, system-ui, sans-serif";
        context.fillText("Proof-ready visual", 184, 642);

        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/png");
        });
        if (!blob) throw new Error("Unable to create smoke image blob");

        return new File([blob], "large-capacity-smoke.png", {
          type: "image/png",
        });
      }

      const input = document.querySelector("#campaign-image");
      if (!input) throw new Error("Missing campaign image input");
      const file = await createSmokeCampaignImageFile();
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="campaign-creator-preview-image-picker"]')?.innerText.includes("large-capacity-smoke.png")`,
    "campaign image selected",
  );
}

async function chooseGlobalMarket(client) {
  await clickVisibleButton(client, "Select markets", "market picker");
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="market-scope-list"]\'))',
    "market scope list",
  );
  await clickVisibleButton(client, "Global", "global market scope");
}

async function selectTimelineDates(client) {
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="timeline-calendar-grid"]\'))',
    "timeline calendar",
  );
  await evaluate(
    client,
    `(() => {
      const nextMonth = [...document.querySelectorAll("button")]
        .find((button) => button.getAttribute("aria-label") === "Next month");
      if (!nextMonth) throw new Error("Missing next month button");
      nextMonth.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const buttons = [...document.querySelectorAll('[data-testid="timeline-calendar-grid"] button')];
      return buttons.some((button) => button.innerText.trim().split("\\n")[0] === "2") &&
        buttons.some((button) => button.innerText.trim().split("\\n")[0] === "10");
    })()`,
    "next month timeline dates",
  );

  await clickTimelineDay(client, 2, "campaign start date");
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="campaign-timeline-selector"]')?.getAttribute("data-timeline-selected-field") === "end"`,
    "timeline moved to end date",
  );
  await clickTimelineDay(client, 10, "campaign end date");
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="campaign-timeline-selector"]')?.getAttribute("data-timeline-selected-field") === "application"`,
    "timeline moved to application deadline",
  );
}

async function chooseLeadershipReportGoal(client) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="campaign-report-goal-preset"][data-preset-id="leadership"]'))`,
    "campaign report goal presets",
  );
  await evaluate(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="campaign-report-goal-preset"][data-preset-id="leadership"]');
      if (!button) throw new Error("Missing Leadership brief report goal");
      button.click();
      return true;
    })()`,
  );
  try {
    await waitForExpression(
      client,
      `(() => {
        const preset = document.querySelector('[data-testid="campaign-report-goal-preset"][data-preset-id="leadership"]');
        const reportGoalText = document.querySelector('[data-testid="campaign-report-goal"]')?.textContent || "";
        const proofOutputText = document.querySelector('[data-testid="campaign-report-output-preview"]')?.textContent || "";
        return preset?.getAttribute("aria-pressed") === "true" &&
          reportGoalText.includes("Leadership brief") &&
          proofOutputText.includes("Proof output") &&
          proofOutputText.includes("Leadership brief") &&
          proofOutputText.includes("Trend view") &&
          proofOutputText.includes("Executive summary") &&
          proofOutputText.includes("Report trust");
      })()`,
      "Leadership brief report goal proof output selected",
    );
  } catch (error) {
    const reportGoalText = await evaluate(
      client,
      `document.querySelector('[data-testid="campaign-report-goal"]')?.textContent || ""`,
    );
    const proofOutputText = await evaluate(
      client,
      `document.querySelector('[data-testid="campaign-report-output-preview"]')?.textContent || ""`,
    );
    throw new Error(
      `${error.message}. Report goal text: ${JSON.stringify(reportGoalText)}. Proof output text: ${JSON.stringify(proofOutputText)}.`,
    );
  }
}

async function focusReportGoalSelector(client) {
  await evaluate(
    client,
    `(() => {
      const target = document.querySelector('[data-testid="campaign-report-goal"]');
      if (!target) return false;
      const top = target.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const target = document.querySelector('[data-testid="campaign-report-goal"]');
      if (!target) return false;
      const rect = target.getBoundingClientRect();
      return rect.top >= 80 && rect.top < window.innerHeight - 120;
    })()`,
    "campaign report goal selector visible",
  );
}

async function focusReportGoalOutputPreview(client) {
  await evaluate(
    client,
    `(() => {
      const target = document.querySelector('[data-testid="campaign-report-output-preview"]');
      if (!target) return false;
      const top = target.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const target = document.querySelector('[data-testid="campaign-report-output-preview"]');
      if (!target) return false;
      const rect = target.getBoundingClientRect();
      return rect.top >= 80 && rect.top < window.innerHeight - 120;
    })()`,
    "campaign report proof output visible",
  );
}

async function clickTimelineDay(client, day, description) {
  await evaluate(
    client,
    `(() => {
      const buttons = [...document.querySelectorAll('[data-testid="timeline-calendar-grid"] button')];
      const button = buttons.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const label = candidate.innerText.trim().split("\\n")[0];
        return rect.width > 0 &&
          rect.height > 0 &&
          label === ${JSON.stringify(String(day))} &&
          !candidate.className.includes("text-muted-foreground/45");
      });
      if (!button) throw new Error(${JSON.stringify(`Missing ${description}`)});
      button.click();
      return true;
    })()`,
  );
}

async function selectOpenApplicationsVisibility(client) {
  await clickScopedButtonUntilPressed(
    client,
    '[data-testid="campaign-recruitment-visibility"] button',
    "Open applications",
    "open applications visibility selected",
  );
}

async function fillLargeCampaignBuilder(
  client,
  campaignTitle,
  { reportGoalScreenshotPath } = {},
) {
  await selectOpenApplicationsVisibility(client);
  await clickVisibleButtonAndWait(
    client,
    "Next",
    'Boolean(document.querySelector("#title"))',
    "campaign model next",
  );

  await setFieldValue(client, "#title", campaignTitle);
  await setFieldValue(
    client,
    "#description",
    "Private proof-room smoke campaign for a 100 creator cross-border launch.",
  );
  await attachCampaignImage(client);
  await clickVisibleButton(client, "TikTok", "TikTok platform");
  await chooseGlobalMarket(client);
  await clickVisibleButton(client, "Next", "campaign basics next");

  await setFieldValue(
    client,
    "#requirements",
    "Create a short proof-ready launch post and submit final evidence.",
  );
  await clickVisibleButton(client, "Beauty & Skincare", "beauty niche");
  await clickVisibleButton(client, "Next", "campaign brief next");

  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="creator-capacity-preset-50"]')) &&
      Boolean(document.querySelector('[data-testid="creator-capacity-preset-100"]'))`,
    "50 and 100 creator capacity presets",
  );
  await evaluate(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="creator-capacity-preset-100"]');
      if (!button) throw new Error("Missing 100 creator preset");
      button.click();
      return true;
    })()`,
  );
  await setFieldValue(client, "#creatorBudget", "1000");
  await setFieldValue(client, "#productValue", "300");
  await setFieldValue(client, "#fulfillmentBudget", "200");
  await selectTimelineDates(client);
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="campaign-investment-summary"]')?.innerText.includes("$590") &&
      document.querySelector('[data-testid="service-fee-capacity-summary"]')?.innerText.includes("100 creator capacity")`,
    "100 creator creation fee summary",
  );
  await chooseLeadershipReportGoal(client);
  if (reportGoalScreenshotPath) {
    await focusReportGoalSelector(client);
    await focusReportGoalOutputPreview(client);
    await captureScreenshot(client, reportGoalScreenshotPath);
  }
  await clickVisibleButton(client, "Next", "campaign budget next");
  await setFieldValue(client, "#complianceNotes", DEFAULT_COMPLIANCE_NOTES);
  await clickVisibleButton(client, "Next", "campaign settings next");
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="campaign-review-billing-scope"]')?.innerText.includes("$590") &&
      document.querySelector('[data-testid="campaign-review-billing-scope"]')?.innerText.includes("100") &&
      document.body.innerText.includes(${JSON.stringify(DEFAULT_COMPLIANCE_NOTES)})`,
    "campaign review billing scope",
  );
}

function extractCampaignIdFromUrl(url) {
  const match = url.match(/\/b\/campaigns\/([0-9a-f-]{36})(?:[/?#]|$)/i);
  return match?.[1] ?? "";
}

export async function runLargeCampaignCreationSmoke() {
  await loadLocalEnv();

  const targets = buildLargeCampaignCreationSmokeTargets();
  const reviewScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_REVIEW_SCREENSHOT_PATH ||
      DEFAULT_REVIEW_SCREENSHOT_PATH,
  );
  const reportGoalScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_REPORT_GOAL_SCREENSHOT_PATH ||
      DEFAULT_REPORT_GOAL_SCREENSHOT_PATH,
  );
  const detailScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_DETAIL_SCREENSHOT_PATH ||
      DEFAULT_DETAIL_SCREENSHOT_PATH,
  );
  const listScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_LIST_SCREENSHOT_PATH ||
      DEFAULT_LIST_SCREENSHOT_PATH,
  );
  const adminRevenueScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_ADMIN_REVENUE_SCREENSHOT_PATH ||
      DEFAULT_ADMIN_REVENUE_SCREENSHOT_PATH,
  );
  const paidScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_PAID_SCREENSHOT_PATH ||
      DEFAULT_PAID_SCREENSHOT_PATH,
  );
  const publicApplyScreenshotPath = path.resolve(
    process.env.SMOKE_LARGE_CAMPAIGN_CREATION_PUBLIC_APPLY_SCREENSHOT_PATH ||
      DEFAULT_PUBLIC_APPLY_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  await cleanupCampaignsByTitle(admin, targets.campaignTitle);

  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-large-campaign-creation-smoke-"),
  );
  let chrome;
  let client;
  let campaignId = "";
  let checkoutUrl = "";
  let checkoutShowsInitialFee = false;
  let serviceFeeStatus = "";
  let paymentEventCount = 0;
  let paymentEventsShowInitialFee = false;
  let traceFields = {
    checkoutSessionId: "",
    lastEventId: "",
    paymentIntentId: "",
  };
  let brandReceiptVisible = false;
  let launchEnabled = false;
  let inviteUrl = "";
  let publicApplyShowsComplianceNotes = false;
  let publicApplyHeroImageReady = false;
  let publicApplyVisible = false;
  let adminRevenueShowsTrace = false;
  let adminCampaignsShowsPaymentState = false;
  let campaignReportPlan = null;
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
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect",
    });

    await navigate(client, targets.campaignNewUrl);
    await waitForExpression(
      client,
      'document.body.innerText.includes("Create Campaign")',
      "campaign builder title",
    );
    await fillLargeCampaignBuilder(client, targets.campaignTitle, {
      reportGoalScreenshotPath,
    });
    const builderReviewText = await evaluate(
      client,
      `[
        document.body.innerText,
        document.querySelector('[data-testid="campaign-review-billing-scope"]')?.innerText || "",
      ].join("\\n")`,
    );
    await captureScreenshot(client, reviewScreenshotPath);

    await clickVisibleButton(client, "Save Draft", "save draft");
    await waitForExpression(
      client,
      `location.pathname.match(/^\\/b\\/campaigns\\/[0-9a-f-]{36}$/) &&
        document.body.innerText.includes(${JSON.stringify(targets.campaignTitle)})`,
      "created campaign detail redirect",
      120000,
    );
    campaignId = extractCampaignIdFromUrl(await evaluate(client, "location.href"));
    if (!campaignId) throw new Error("Unable to resolve created campaign id.");

    campaignReportPlan = await checkedQuery(
      "Read smoke campaign report goal plan",
      admin
        .from("campaign_reporting_plans")
        .select("report_template_id, report_preset_id, report_chart_mode_id, report_block_ids")
        .eq("campaign_id", campaignId)
        .maybeSingle(),
    );

    await navigate(client, `${targets.baseUrl}/b/campaigns/${campaignId}?tab=brief`);
    await waitForExpression(
      client,
      `document.querySelector('[data-testid="campaign-billing-scope"]')?.innerText.includes("100") &&
        document.querySelector('[data-testid="campaign-billing-scope"]')?.innerText.includes("$590") &&
        document.body.innerText.includes("Balance due") &&
        document.body.innerText.includes("$590")`,
      "created campaign 100 creator billing scope",
    );
    const brandDetailText = await evaluate(
      client,
      `[
        document.body.innerText,
        document.querySelector('[data-testid="campaign-billing-scope"]')?.innerText || "",
        document.querySelector('[data-testid="campaign-service-fee-action"]')?.innerText || "",
      ].join("\\n")`,
    );
    await captureScreenshot(client, detailScreenshotPath);

    await navigate(client, targets.brandCampaignsUrl);
    await waitForExpression(
      client,
      `(() => {
        return [...document.querySelectorAll('[data-testid="campaign-row"]')]
          .some((row) =>
            row.innerText.includes(${JSON.stringify(targets.campaignTitle)}) &&
            row.querySelector('[data-testid="campaign-payment-balance-due"]')?.innerText.includes("$590")
          );
      })()`,
      "brand list 100 creator balance",
    );
    const brandListRowText = await evaluate(
      client,
      `(() => {
        const row = [...document.querySelectorAll('[data-testid="campaign-row"]')]
          .find((candidate) => candidate.innerText.includes(${JSON.stringify(targets.campaignTitle)}));
        return row?.innerText || "";
      })()`,
    );
    await captureScreenshot(client, listScreenshotPath);

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect",
    });
    await navigate(
      client,
      `${targets.baseUrl}/admin/revenue?campaign=${campaignId}#service-fees`,
    );
    await waitForExpression(
      client,
      `(() => {
        const row = document.querySelector(${JSON.stringify(`#service-fee-${campaignId}`)});
        return Boolean(row &&
          row.innerText.includes(${JSON.stringify(targets.campaignTitle)}) &&
          row.innerText.includes("100") &&
          row.innerText.includes("$590") &&
          row.innerText.includes("Balance due $590"));
      })()`,
      "admin revenue 100 creator first fee",
    );
    const adminRevenueRowText = await evaluate(
      client,
      `document.querySelector(${JSON.stringify(`#service-fee-${campaignId}`)})?.innerText || ""`,
    );
    await captureScreenshot(client, adminRevenueScreenshotPath);

    validateLargeCampaignCreationSmoke({
      adminRevenueRowText,
      brandDetailText,
      brandListRowText,
      builderReviewText,
      campaignReportPlan,
      consoleErrors,
    });

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect for first-run checkout",
    });
    await navigate(client, `${targets.baseUrl}/b/campaigns/${campaignId}?tab=brief`);
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.innerText.includes("$590")',
      "first-run $590 payment action",
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
    checkoutShowsInitialFee = await waitForExpression(
      client,
      'document.body.innerText.includes("PopsDrops") && document.body.innerText.includes("$590")',
      "Stripe Checkout $590 initial campaign fee",
      90000,
    );
    await fillStripeCheckoutTestPayment(client, contexts);
    await waitForExpression(
      client,
      `location.href.startsWith(${JSON.stringify(`${targets.baseUrl}/b/campaigns/${campaignId}`)}) && location.search.includes("checkout=success")`,
      "first-run checkout success redirect",
      120000,
    );

    const paidCampaign = await waitForCampaignServiceFeeStatus(
      admin,
      campaignId,
      "paid",
    );
    serviceFeeStatus = paidCampaign.service_fee_status;
    traceFields = {
      checkoutSessionId: paidCampaign.service_fee_checkout_session_id || "",
      lastEventId: paidCampaign.service_fee_last_event_id || "",
      paymentIntentId: paidCampaign.service_fee_payment_intent_id || "",
    };

    const paymentEvents = await checkedQuery(
      "Read large campaign creation payment events",
      admin
        .from("campaign_payment_events")
        .select("amount_cents, event_type, service_fee_status")
        .eq("campaign_id", campaignId),
    );
    paymentEventCount = paymentEvents?.length ?? 0;
    paymentEventsShowInitialFee =
      (paymentEvents ?? []).some(
        (event) =>
          event.service_fee_status === "invoiced" &&
          Number(event.amount_cents) === 59000,
      ) &&
      (paymentEvents ?? []).some(
        (event) =>
          event.service_fee_status === "paid" &&
          Number(event.amount_cents) === 59000 &&
          event.event_type === "checkout.session.completed",
      );

    await navigate(client, `${targets.baseUrl}/b/campaigns/${campaignId}?tab=brief`);
    brandReceiptVisible = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-service-fee-receipt"]\')?.innerText.includes("Payment received") && document.querySelector(\'[data-testid="campaign-service-fee-reference"]\')?.innerText.includes("Payment intent")',
      "first-run brand payment receipt",
      90000,
    );
    launchEnabled = await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === false',
      "first-run paid campaign launch action",
      90000,
    );
    await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.click()',
    );
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value.includes("/apply/")',
      "first-run launched invite URL",
      90000,
    );
    inviteUrl = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value || ""',
    );
    await navigate(client, `${targets.baseUrl}/apply/${campaignId}`);
    await waitForExpression(
      client,
      'document.querySelectorAll(".animate-pulse").length === 0',
      "public apply skeletons",
    );
    publicApplyVisible = await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(targets.campaignTitle)}) && !document.body.innerText.includes("Campaign not found") && !document.body.innerText.includes("Not found")`,
      "public apply launched large campaign",
      90000,
    );
    publicApplyShowsComplianceNotes = await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(DEFAULT_COMPLIANCE_NOTES)})`,
      "public apply compliance notes",
      90000,
    );
    publicApplyHeroImageReady = await waitForExpression(
      client,
      `(() => {
        const image = document.querySelector('[data-testid="public-apply-campaign-image"] img');
        return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      })()`,
      "public apply hero image",
      90000,
    );
    await captureScreenshot(client, publicApplyScreenshotPath, {
      captureBeyondViewport: true,
    });

    await loginForSmoke(client, {
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login redirect after first-run checkout",
    });
    await navigate(
      client,
      `${targets.baseUrl}/admin/revenue?campaign=${campaignId}#service-fees`,
    );
    adminRevenueShowsTrace = await waitForExpression(
      client,
      `document.querySelector('[data-testid="admin-revenue-payment-event"]')?.innerText.includes("checkout.session.completed") && document.querySelector('[data-testid="admin-revenue-stripe-reference"]')?.innerText.includes(${JSON.stringify(traceFields.paymentIntentId.slice(0, 12))})`,
      "admin revenue Stripe trace for first-run payment",
      90000,
    );
    await navigate(client, `${targets.baseUrl}/admin/campaigns`);
    adminCampaignsShowsPaymentState = await waitForExpression(
      client,
      `${JSON.stringify(targets.campaignTitle)} && document.body.innerText.includes(${JSON.stringify(targets.campaignTitle)}) && [...document.querySelectorAll('[data-testid="admin-campaigns-service-fee-status"]')].some((node) => (node.textContent || "").toLowerCase().includes("paid"))`,
      "admin campaigns paid first-run service fee state",
      90000,
    );

    validateLargeCampaignCreationPaymentSmoke({
      adminCampaignsShowsPaymentState,
      adminRevenueShowsTrace,
      brandReceiptVisible,
      checkoutShowsInitialFee,
      checkoutUrl,
      inviteUrl,
      launchEnabled,
      paymentEventCount,
      paymentEventsShowInitialFee,
      publicApplyShowsComplianceNotes,
      publicApplyHeroImageReady,
      publicApplyVisible,
      serviceFeeStatus,
      traceFields,
      consoleErrors,
    });
    await captureScreenshot(client, paidScreenshotPath);

    return {
      ok: true,
      adminRevenueScreenshotPath,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: `${targets.baseUrl}/b/campaigns/${campaignId}`,
      campaignId,
      checkoutHost: new URL(checkoutUrl).host,
      detailScreenshotPath,
      devServerStarted: Boolean(devServer),
      listScreenshotPath,
      paidScreenshotPath,
      paymentEventCount,
      publicApplyScreenshotPath,
      reportGoalScreenshotPath,
      serviceFeeStatus,
      reviewScreenshotPath,
    };
  } finally {
    if (client) client.close();
    await stopChrome(chrome);
    await rm(userDataDir, { recursive: true, force: true });
    if (campaignId) {
      await cleanupApplicationFlowSmokeData(admin, campaignId);
    } else {
      await cleanupCampaignsByTitle(admin, targets.campaignTitle);
    }
    await stopDevServer(devServer);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runLargeCampaignCreationSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
