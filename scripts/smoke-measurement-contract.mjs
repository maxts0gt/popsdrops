#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCdpPage,
  ensureDevServer,
  stopDevServer,
  evaluate,
  findFreePort,
  launchChrome,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";
import { submitCreatorApplication } from "./smoke-application-acceptance.mjs";
import {
  DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID,
  buildApplicationFlowSmokeTargets,
  captureScreenshot,
  checkedQuery,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeDataDevUser,
  ensureSmokeIdentityEnvDefaults,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";
import {
  acceptCreatorApplication,
  approveBrandContent,
  publishCreatorContent,
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  transitionSmokeCampaignToActiveWork,
  verifyBrandReportEvidence,
} from "./smoke-content-report-workflow.mjs";

const DEFAULT_MEASUREMENT_CONTRACT_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000117";
const DEFAULT_CREATOR_SCREENSHOT_PATH =
  "output/playwright/measurement-contract-creator-fields-smoke.png";
const DEFAULT_BRAND_SCREENSHOT_PATH =
  "output/playwright/measurement-contract-brand-verified-smoke.png";
const DEFAULT_PROOF_SOURCE_SCREENSHOT_PATH =
  "output/playwright/measurement-contract-proof-source-lane-smoke.png";
const SELECTED_METRIC_KEYS = ["comments", "favorites"];
const ADDITIONAL_PROOF_METRIC_KEYS = ["replies", "bookmarks"];
const EXPECTED_CREATOR_FIELDS = ["Comments", "Favorites", "Replies", "Bookmarks"];
const EXCLUDED_CREATOR_FIELDS = ["Views", "Likes", "Shares"];

function buildMeasurementContractSmokeTargets() {
  const targets = buildApplicationFlowSmokeTargets({
    campaignId:
      process.env.SMOKE_MEASUREMENT_CONTRACT_CAMPAIGN_ID ||
      DEFAULT_MEASUREMENT_CONTRACT_CAMPAIGN_ID ||
      DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID,
  });

  return {
    ...targets,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${targets.campaignId}`,
    brandReportUrl: `${targets.baseUrl}/b/campaigns/${targets.campaignId}/report`,
  };
}

async function setSmokeMeasurementContract(admin, campaignId) {
  await checkedQuery(
    "Set smoke measurement report composition",
    admin
      .from("campaign_reporting_plans")
      .upsert(
        {
          campaign_id: campaignId,
          report_preset_id: "proof_audit",
          report_chart_mode_id: "proof",
          report_block_ids: [
            "report_framing",
            "executive_summary",
            "proof_sources",
            "report_trust",
            "creator_table",
            "recommendations",
          ],
        },
        { onConflict: "campaign_id" },
      ),
  );

  await checkedQuery(
    "Set smoke measurement contract metrics",
    admin
      .from("campaign_reporting_requirements")
      .update({ required_metric_keys: SELECTED_METRIC_KEYS })
      .eq("campaign_id", campaignId),
  );

  await checkedQuery(
    "Add smoke X proof channel requirement",
    admin.from("campaign_reporting_requirements").insert({
      campaign_id: campaignId,
      platform: "x",
      platform_label: null,
      content_format: "short_video",
      account_requirement: "native_insights_required",
      evidence_types: ["public_url", "manual_metrics", "screenshot"],
      required_metric_keys: ADDITIONAL_PROOF_METRIC_KEYS,
      ai_extraction_allowed: true,
      creator_confirmation_required: true,
      sort_order: 2,
    }),
  );
}

async function readCreatorProofMetricFields(client) {
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"performance-metric-grid\\"]") != null`,
    "creator measurement contract proof grid",
    60000,
  );

  return evaluate(
    client,
    `(() => [...document.querySelectorAll('[data-testid="performance-metric-input-control"] input')]
      .map((input) => input.getAttribute("aria-label"))
      .filter(Boolean))()`,
  );
}

async function focusCreatorProofMetricGrid(client) {
  await evaluate(
    client,
    `(() => {
      const target = document.querySelector("[data-testid=\\"performance-metric-grid\\"]");
      if (!target) return false;
      const top = target.getBoundingClientRect().top + window.scrollY - 180;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const target = document.querySelector("[data-testid=\\"performance-metric-grid\\"]");
      if (!target) return false;
      const rect = target.getBoundingClientRect();
      return rect.top >= 120 && rect.top < window.innerHeight - 120;
    })()`,
    "creator measurement contract fields visible",
    60000,
  );
}

async function focusBrandProofSourceLanes(client) {
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"report-proof-source-lanes\\"]") != null`,
    "brand proof-source lanes",
    60000,
  );
  await evaluate(
    client,
    `(() => {
      const target = document.querySelector("[data-testid=\\"report-proof-source-lanes\\"]");
      if (!target) return false;
      const top = target.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const target = document.querySelector("[data-testid=\\"report-proof-source-lanes\\"]");
      if (!target) return false;
      const rect = target.getBoundingClientRect();
      return rect.top >= 80 && rect.top < window.innerHeight - 80;
    })()`,
    "brand proof-source lanes visible",
    60000,
  );
}

export function validateMeasurementContractSmoke({
  metricFields,
  submittedMetricRows = [],
  brandReportText,
  consoleErrors,
}) {
  for (const field of EXPECTED_CREATOR_FIELDS) {
    if (!metricFields.includes(field)) {
      throw new Error(`Missing selected creator metric field: ${field}`);
    }
  }

  for (const field of EXCLUDED_CREATOR_FIELDS) {
    if (metricFields.includes(field)) {
      throw new Error(`Unexpected unselected creator metric field: ${field}`);
    }
  }

  if (!brandReportText.toLowerCase().includes("verified")) {
    throw new Error("Missing verified brand report evidence after submission.");
  }

  if (submittedMetricRows.length > 0) {
    const submittedKeysByPlatform = new Map();
    for (const row of submittedMetricRows) {
      const keys = submittedKeysByPlatform.get(row.platform) ?? new Set();
      keys.add(row.metric_key);
      submittedKeysByPlatform.set(row.platform, keys);
    }

    for (const metricKey of SELECTED_METRIC_KEYS) {
      if (!submittedKeysByPlatform.get("tiktok")?.has(metricKey)) {
        throw new Error(`Missing submitted TikTok metric: ${metricKey}`);
      }
    }

    for (const metricKey of ADDITIONAL_PROOF_METRIC_KEYS) {
      if (!submittedKeysByPlatform.get("x")?.has(metricKey)) {
        throw new Error(`Missing submitted X proof metric: ${metricKey}`);
      }
    }

    if (!brandReportText.includes("Additional proof sources")) {
      throw new Error("Missing separate proof-source lane on the brand report.");
    }

    if (!brandReportText.includes("Proof source") || !brandReportText.includes("X")) {
      throw new Error("Missing labeled X proof source on the brand report.");
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function readSubmittedMetricRows(admin, campaignId) {
  const reportTasks = await checkedQuery(
    "Read smoke report task ids",
    admin
      .from("campaign_report_tasks")
      .select("id")
      .eq("campaign_id", campaignId),
  );
  const reportTaskIds = (reportTasks ?? []).map((task) => task.id);
  if (reportTaskIds.length === 0) return [];

  return checkedQuery(
    "Read smoke submitted metric rows",
    admin
      .from("content_performance_metric_values")
      .select("platform, metric_key")
      .in("report_task_id", reportTaskIds),
  );
}

async function runMeasurementContractSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildMeasurementContractSmokeTargets();
  const creatorScreenshotPath = path.resolve(
    process.env.SMOKE_MEASUREMENT_CONTRACT_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_SCREENSHOT_PATH,
  );
  const brandScreenshotPath = path.resolve(
    process.env.SMOKE_MEASUREMENT_CONTRACT_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_SCREENSHOT_PATH,
  );
  const proofSourceScreenshotPath = path.resolve(
    process.env.SMOKE_MEASUREMENT_CONTRACT_PROOF_SOURCE_SCREENSHOT_PATH ||
      DEFAULT_PROOF_SOURCE_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-measurement-contract-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  let metricFields = [];
  let submittedMetricRows = [];
  let brandReportText = "";

  try {
    await setupApplicationFlowSmokeData(admin, targets);
    await setSmokeMeasurementContract(admin, targets.campaignId);

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
    await approveBrandContent(client, targets);
    await publishCreatorContent(client, targets);

    metricFields = await readCreatorProofMetricFields(client);
    validateMeasurementContractSmoke({
      metricFields,
      brandReportText: "Verified",
      consoleErrors,
    });
    await focusCreatorProofMetricGrid(client);
    await captureScreenshot(client, creatorScreenshotPath);

    await submitCreatorPerformanceProof(client);
    submittedMetricRows = await readSubmittedMetricRows(admin, targets.campaignId);
    if (submittedMetricRows.length === 0) {
      throw new Error("No submitted metric rows were persisted.");
    }
    brandReportText = await verifyBrandReportEvidence(client, targets);
    await captureScreenshot(client, brandScreenshotPath);
    await focusBrandProofSourceLanes(client);
    await captureScreenshot(client, proofSourceScreenshotPath);

    validateMeasurementContractSmoke({
      metricFields,
      submittedMetricRows,
      brandReportText,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignId: targets.campaignId,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      metricFields,
      submittedMetricRows,
      creatorScreenshotPath,
      brandScreenshotPath,
      proofSourceScreenshotPath,
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
  runMeasurementContractSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
