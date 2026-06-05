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
  checkedQuery,
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
  getSubmitPerformanceProofButtonTexts,
  isRecoverableBrowserSmokeError,
  publishCreatorContent,
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  transitionSmokeCampaignToActiveWork,
  openBrandReportingProofQueue,
} from "./smoke-content-report-workflow.mjs";

export const DEFAULT_REPORTING_REQUIREMENT_CONFIG_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000118";

const DEFAULT_BRAND_CONFIG_SCREENSHOT_PATH =
  "output/playwright/reporting-requirement-config-brand-smoke.png";
const DEFAULT_CREATOR_METRICS_SCREENSHOT_PATH =
  "output/playwright/reporting-requirement-config-creator-smoke.png";
const DEFAULT_BRAND_QUEUE_SCREENSHOT_PATH =
  "output/playwright/reporting-requirement-config-brand-queue-smoke.png";

export function buildReportingRequirementConfigSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_REPORTING_REQUIREMENT_CONFIG_CAMPAIGN_ID ||
    DEFAULT_REPORTING_REQUIREMENT_CONFIG_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    brandCampaignUrl: `${targets.baseUrl}/b/campaigns/${campaignId}`,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
  };
}

export function validateReportingRequirementConfigSmoke({
  brandConfigText,
  creatorMetricsText,
  brandQueueText,
  metricKeys,
  consoleErrors,
}) {
  const normalizedBrandConfigText = brandConfigText.toLowerCase();
  const normalizedCreatorMetricsText = creatorMetricsText.toLowerCase();
  const normalizedBrandQueueText = brandQueueText.toLowerCase();

  const requiredBrandConfigText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["proof fields title", "Proof fields"],
    ["save action", "Save proof fields"],
    ["shares option", "Shares"],
  ];
  const requiredCreatorMetricsText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["report goal", "Report goal"],
    ["report goal preset", "Creator performance"],
    ["report trust block", "report trust"],
    ["proof upload", "Upload analytics proof"],
    ["views metric", "Views"],
    ["likes metric", "Likes"],
    ["comments metric", "Comments"],
    ["shares metric", "Shares"],
  ];
  const requiredBrandQueueText = [
    ["proof queue", "Proof Queue"],
    ["report goal", "Report goal"],
    ["report goal preset", "Creator performance"],
    ["report trust block", "report trust"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["proof state", "Needs review"],
  ];

  for (const [label, text] of requiredBrandConfigText) {
    if (!normalizedBrandConfigText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand proof-field config proof: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorMetricsText) {
    if (!normalizedCreatorMetricsText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator proof metric proof: ${label}`);
    }
  }

  if (normalizedCreatorMetricsText.includes("favorites")) {
    throw new Error("Creator proof form showed an unselected TikTok metric.");
  }

  for (const [label, text] of requiredBrandQueueText) {
    if (!normalizedBrandQueueText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand proof queue proof: ${label}`);
    }
  }

  for (const metricKey of ["views", "likes", "comments", "shares"]) {
    if (!metricKeys.includes(metricKey)) {
      throw new Error(`Missing saved reporting metric key: ${metricKey}`);
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function createSmokeBrowserSession(consoleErrors) {
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-reporting-requirement-config-smoke-"),
  );
  const chrome = await launchChrome({ debugPort, userDataDir });
  const client = await createCdpPage(debugPort);

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

  return { chrome, client, userDataDir };
}

async function closeSmokeBrowserSession(session) {
  if (!session) return;

  session.client?.close();
  session.chrome?.kill();
  await rm(session.userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}

async function restartSmokeBrowserSession(session, consoleErrors) {
  await closeSmokeBrowserSession(session);
  return createSmokeBrowserSession(consoleErrors);
}

async function waitForSavedMetricKeys(admin, campaignId, expectedMetricKeys) {
  const startedAt = Date.now();
  let lastMetricKeys = [];

  while (Date.now() - startedAt < 30000) {
    const rows = await checkedQuery(
      "Read saved reporting requirement metric keys",
      admin
        .from("campaign_reporting_requirements")
        .select("required_metric_keys")
        .eq("campaign_id", campaignId)
        .eq("platform", "tiktok")
        .order("sort_order", { ascending: true }),
    );
    lastMetricKeys = rows?.[0]?.required_metric_keys ?? [];
    if (expectedMetricKeys.every((metricKey) => lastMetricKeys.includes(metricKey))) {
      return lastMetricKeys;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for saved reporting metric keys. Last keys: ${lastMetricKeys.join(", ")}`,
  );
}

async function waitForCreatorProofPersisted(admin, campaignId, expectedMetricKeys) {
  const submittedStatuses = new Set(["submitted", "submitted_late", "verified"]);
  const startedAt = Date.now();
  let lastState = "not inspected";

  while (Date.now() - startedAt < 60000) {
    const tasks = await checkedQuery(
      "Read submitted report task state",
      admin
        .from("campaign_report_tasks")
        .select("id, status")
        .eq("campaign_id", campaignId)
        .order("due_at", { ascending: true }),
    );
    const submittedTask = (tasks ?? []).find((task) =>
      submittedStatuses.has(task.status),
    );
    const taskIds = (tasks ?? []).map((task) => task.id);
    lastState = `tasks=${(tasks ?? [])
      .map((task) => `${task.id}:${task.status}`)
      .join(", ")}`;

    if (submittedTask && taskIds.length > 0) {
      const metricRows = await checkedQuery(
        "Read submitted proof metric values",
        admin
          .from("content_performance_metric_values")
          .select("metric_key, report_task_id")
          .in("report_task_id", taskIds),
      );
      const submittedMetricKeys = (metricRows ?? [])
        .filter((row) => row.report_task_id === submittedTask.id)
        .map((row) => row.metric_key);
      lastState = `${lastState}; metrics=${submittedMetricKeys.join(", ")}`;

      if (
        expectedMetricKeys.every((metricKey) =>
          submittedMetricKeys.includes(metricKey),
        )
      ) {
        return {
          taskId: submittedTask.id,
          taskStatus: submittedTask.status,
          metricKeys: submittedMetricKeys,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for persisted creator proof: ${lastState}`);
}

async function configureBrandProofFields(
  client,
  admin,
  targets,
  brandConfigScreenshotPath,
) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for proof fields",
  });
  await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
      document.querySelector("[data-testid=\\"campaign-reporting-config\\"]") != null`,
    "brand proof-field config panel",
  );
  await clickTab(client, "Setup");
  await waitForExpression(
    client,
    `(() => {
      const card = document.querySelector("[data-testid=\\"campaign-reporting-config\\"]");
      if (!card) return false;
      const text = card.innerText;
      return text.includes("Proof fields") &&
        text.includes("Views") &&
        text.includes("Likes") &&
        text.includes("Comments") &&
        text.includes("Shares");
    })()`,
    "brand proof-field metric toggles",
  );
  await evaluate(
    client,
    `(() => {
      const card = document.querySelector("[data-testid=\\"campaign-reporting-config\\"]");
      if (!card) throw new Error("Missing proof fields card");
      const toggle = card.querySelector('[data-testid="campaign-reporting-metric-toggle"][data-metric-key="shares"]');
      if (!toggle) throw new Error("Missing Shares metric toggle");
      if (toggle.getAttribute("data-selected") !== "true") {
        toggle.click();
      }
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const card = document.querySelector("[data-testid=\\"campaign-reporting-config\\"]");
      const toggle = card?.querySelector('[data-testid="campaign-reporting-metric-toggle"][data-metric-key="shares"]');
      const save = card?.querySelector('[data-testid="campaign-reporting-requirement-save"]');
      return toggle?.getAttribute("data-selected") === "true" && save && !save.disabled;
    })()`,
    "brand shares proof metric selected",
  );
  await evaluate(
    client,
    `(() => {
      const card = document.querySelector("[data-testid=\\"campaign-reporting-config\\"]");
      const top = card.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return true;
    })()`,
  );
  const brandConfigTextBeforeSave = await evaluate(client, "document.body.innerText");
  await captureScreenshot(client, brandConfigScreenshotPath, {
    captureBeyondViewport: true,
  });
  await evaluate(
    client,
    `(() => {
      const card = document.querySelector("[data-testid=\\"campaign-reporting-config\\"]");
      const save = card?.querySelector('[data-testid="campaign-reporting-requirement-save"]');
      if (!save || save.disabled) throw new Error("Missing enabled proof fields save action");
      save.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const card = document.querySelector("[data-testid=\\"campaign-reporting-config\\"]");
      const save = card?.querySelector('[data-testid="campaign-reporting-requirement-save"]');
      return Boolean(save?.disabled);
    })()`,
    "brand proof-field save settled",
    60000,
  );
  const metricKeys = await waitForSavedMetricKeys(admin, targets.campaignId, [
    "views",
    "likes",
    "comments",
    "shares",
  ]);

  return { brandConfigText: brandConfigTextBeforeSave, metricKeys };
}

async function verifyCreatorProofFields(client, targets, creatorMetricsScreenshotPath) {
  await waitForExpression(
    client,
    `(() => {
      const context = document.querySelector("[data-testid=\\"performance-report-goal-context\\"]");
      if (!context) return false;
      const text = context.innerText;
      return text.includes("Report goal") &&
        text.includes("Creator performance") &&
        text.includes("report trust");
    })()`,
    "creator report goal context",
    60000,
  );
  await waitForExpression(
    client,
    `(() => {
      const grid = document.querySelector("[data-testid=\\"performance-metric-grid\\"]");
      if (!grid) return false;
      const text = grid.innerText;
      return text.includes("Views") &&
        text.includes("Likes") &&
        text.includes("Comments") &&
        text.includes("Shares") &&
        !text.includes("Favorites");
    })()`,
    "creator customized proof metric inputs",
    60000,
  );
  await evaluate(
    client,
    `(() => {
      const target = document.querySelector("[data-testid=\\"performance-report-goal-context\\"]");
      const top = target.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const target = document.querySelector("[data-testid=\\"performance-report-goal-context\\"]");
      if (!target) return false;
      const rect = target.getBoundingClientRect();
      return rect.top >= 60 && rect.top <= window.innerHeight - 80;
    })()`,
    "creator report goal context visible",
    60000,
  );
  await captureScreenshot(client, creatorMetricsScreenshotPath);

  return evaluate(client, "document.body.innerText");
}

async function submitConfiguredCreatorProof(client, admin, targets) {
  try {
    return await submitCreatorPerformanceProof(client);
  } catch (error) {
    if (
      !String(error?.message ?? error).includes(
        "creator report submitted state",
      )
    ) {
      throw error;
    }

    await waitForCreatorProofPersisted(admin, targets.campaignId, [
      "views",
      "likes",
      "comments",
      "shares",
    ]);
    await navigate(client, `${targets.creatorCampaignUrl}?tab=submit`);
    await waitForExpression(
      client,
      `(() => {
        const text = document.body?.innerText ?? "";
        return text.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
          (text.includes("Proof sent for review") || text.includes("Submitted"));
      })()`,
      "creator proof persisted after refresh",
      60000,
    );

    return evaluate(client, "document.body.innerText");
  }
}

async function ensureProofSubmitButtonMentionsExpectedAction(client) {
  const buttonTexts = getSubmitPerformanceProofButtonTexts();
  await waitForExpression(
    client,
    `(() => {
      const texts = ${JSON.stringify(buttonTexts)};
      return [...document.querySelectorAll("button")]
        .some((button) => texts.some((text) => button.textContent.trim().includes(text)));
    })()`,
    "creator proof submit action",
    60000,
  );
}

async function runReportingRequirementConfigSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildReportingRequirementConfigSmokeTargets();
  const brandConfigScreenshotPath = path.resolve(
    process.env.SMOKE_REPORTING_REQUIREMENT_CONFIG_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_CONFIG_SCREENSHOT_PATH,
  );
  const creatorMetricsScreenshotPath = path.resolve(
    process.env.SMOKE_REPORTING_REQUIREMENT_CONFIG_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_METRICS_SCREENSHOT_PATH,
  );
  const brandQueueScreenshotPath = path.resolve(
    process.env.SMOKE_REPORTING_REQUIREMENT_CONFIG_QUEUE_SCREENSHOT_PATH ||
      DEFAULT_BRAND_QUEUE_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  let browserSession;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    brandConfigText: "",
    creatorMetricsText: "",
    brandQueueText: "",
    metricKeys: [],
  };

  try {
    await setupApplicationFlowSmokeData(admin, targets);
    browserSession = await createSmokeBrowserSession(consoleErrors);
    client = browserSession.client;

    const runRecoverableStep = async (description, step) => {
      try {
        return await step();
      } catch (error) {
        if (!isRecoverableBrowserSmokeError(error)) {
          throw error;
        }

        process.stderr.write(
          `[smoke] Retrying proof-field smoke step "${description}" after browser reset: ${error.message}\n`,
        );
        browserSession = await restartSmokeBrowserSession(
          browserSession,
          consoleErrors,
        );
        client = browserSession.client;
        return step();
      }
    };

    const brandConfig = await runRecoverableStep("configure brand proof fields", () =>
      configureBrandProofFields(
        client,
        admin,
        targets,
        brandConfigScreenshotPath,
      ),
    );
    smokeEvidence.brandConfigText = brandConfig.brandConfigText;
    smokeEvidence.metricKeys = brandConfig.metricKeys;

    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    await runRecoverableStep("accept creator application", () =>
      acceptCreatorApplication(client, targets),
    );
    await transitionSmokeCampaignToActiveWork(admin, targets.campaignId);
    await runRecoverableStep("submit creator draft", () =>
      submitCreatorDraft(client, targets),
    );
    await runRecoverableStep("approve brand content", () =>
      approveBrandContent(client, targets),
    );
    await runRecoverableStep("publish creator content", () =>
      publishCreatorContent(client, targets),
    );
    await ensureProofSubmitButtonMentionsExpectedAction(client);
    smokeEvidence.creatorMetricsText = await verifyCreatorProofFields(
      client,
      targets,
      creatorMetricsScreenshotPath,
    );
    await runRecoverableStep("submit creator performance proof", () =>
      submitConfiguredCreatorProof(client, admin, targets),
    );
    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect for proof queue",
    });
    smokeEvidence.brandQueueText = await openBrandReportingProofQueue(client, targets, {
      expectedTexts: [getSmokeCreatorDisplayName(), "Needs review"],
      proofQueueScreenshotPath: brandQueueScreenshotPath,
      requireReviewControls: true,
    });

    validateReportingRequirementConfigSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      brandConfigScreenshotPath,
      creatorMetricsScreenshotPath,
      brandQueueScreenshotPath,
      metricKeys: smokeEvidence.metricKeys,
      keptSmokeData: process.env.SMOKE_KEEP_DATA === "1",
      devServerStarted: Boolean(devServer),
    };
  } finally {
    await closeSmokeBrowserSession(browserSession);

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    }
    await stopDevServer(devServer);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runReportingRequirementConfigSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
