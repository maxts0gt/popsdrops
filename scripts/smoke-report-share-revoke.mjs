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
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";
import { clickButtonByText } from "./smoke-content-report-workflow.mjs";

export const DEFAULT_REPORT_SHARE_REVOKE_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000426";
export const REPORT_SHARE_CUSTOM_TITLE =
  "Shared proof room leadership report";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_ACTIVE_SCREENSHOT_PATH =
  "output/playwright/report-share-active-smoke.png";
const DEFAULT_REVOKED_SCREENSHOT_PATH =
  "output/playwright/report-share-revoked-smoke.png";
const DEFAULT_EXPIRED_SCREENSHOT_PATH =
  "output/playwright/report-share-expired-smoke.png";
const UNAVAILABLE_COPY =
  "This report link is expired, revoked, or no longer exists.";
const NO_PROOF_LEADERSHIP_HOLD_COPY =
  "Keep in proof room until at least one proof read is submitted and reviewed.";
const REPORT_SHARE_ROUTE_RETRY_ATTEMPTS = 3;
const REPORT_SHARE_ROUTE_RETRY_DELAY_MS = 1200;
const REPORT_SHARE_ROUTE_RETRY_REASON = "report route not-found retry";

export function buildReportShareRevokeSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_REPORT_SHARE_REVOKE_CAMPAIGN_ID ||
    DEFAULT_REPORT_SHARE_REVOKE_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    applyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    discoverUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandReportUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}/report`,
  };
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

async function configureSharedReportSmokeTitle(admin, campaignId) {
  await checkedQuery(
    "Configure shared report smoke title",
    admin
      .from("campaign_reporting_plans")
      .upsert(
        {
          campaign_id: campaignId,
          report_preset_id: "leadership",
          report_chart_mode_id: "trend",
          report_block_ids: [
            "executive_summary",
            "channel_story",
            "report_trust",
            "creator_table",
            "recommendations",
          ],
          report_presentation: {
            coverMode: "campaign_visual",
            typography: "quiet",
            density: "editorial",
            headline: REPORT_SHARE_CUSTOM_TITLE,
          },
        },
        { onConflict: "campaign_id" },
      ),
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getReportRouteState(client) {
  try {
    const state = await evaluate(
      client,
      `JSON.stringify({
        href: location.href,
        title: document.title,
        text: document.body.innerText.slice(0, 800),
        hasCampaignTitle: document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}),
        hasShareButton: Boolean(document.querySelector('[data-testid="report-share-button"]'))
      })`,
    );

    return JSON.parse(state);
  } catch (error) {
    return {
      href: "unknown",
      title: "unknown",
      text: error instanceof Error ? error.message : "Unable to read page state",
      hasCampaignTitle: false,
      hasShareButton: false,
    };
  }
}

function isReportRouteNotFoundState(state) {
  const text = `${state.title || ""}\n${state.text || ""}`.toLowerCase();
  return (
    text.includes("404") ||
    text.includes("not found") ||
    text.includes("could not be found")
  );
}

async function waitForReportShareButton(client, targets) {
  let lastError;
  let lastState;

  for (let attempt = 1; attempt <= REPORT_SHARE_ROUTE_RETRY_ATTEMPTS; attempt += 1) {
    await navigate(client, targets.brandReportUrl);
    lastState = await getReportRouteState(client);

    if (lastState.hasCampaignTitle && lastState.hasShareButton) {
      return;
    }

    if (isReportRouteNotFoundState(lastState)) {
      lastError = new Error(
        `${REPORT_SHARE_ROUTE_RETRY_REASON}: ${JSON.stringify(lastState)}`,
      );
    } else {
      try {
        await waitForExpression(
          client,
          `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) && Boolean(document.querySelector('[data-testid="report-share-button"]'))`,
          "report share button",
          60000,
        );
        return;
      } catch (error) {
        lastError = error;
        lastState = await getReportRouteState(client);
      }
    }

    if (attempt < REPORT_SHARE_ROUTE_RETRY_ATTEMPTS) {
      await sleep(REPORT_SHARE_ROUTE_RETRY_DELAY_MS);
    }
  }

  throw new Error(
    `Timed out waiting for report share button after ${REPORT_SHARE_ROUTE_RETRY_ATTEMPTS} attempts: ${lastError?.message ?? "not ready"}. Last state: ${JSON.stringify(lastState)}`,
  );
}

async function openReportShareDialog(client, targets) {
  await waitForReportShareButton(client, targets);
  await evaluate(
    client,
    'document.querySelector(\'[data-testid="report-share-button"]\')?.click()',
  );
  await waitForExpression(
    client,
    'document.body.innerText.includes("Create link")',
    "report share dialog",
    60000,
  );
}

async function createShareLink(client, targets) {
  await openReportShareDialog(client, targets);
  await clickButtonByText(client, "Create link");
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="report-share-url"]\')?.value.includes("/reports/share/pd_rpt_")',
    "created report share URL",
    60000,
  );

  const shareUrl = await evaluate(
    client,
    'document.querySelector(\'[data-testid="report-share-url"]\')?.value || ""',
  );

  if (!shareUrl.startsWith(targets.baseUrl)) {
    throw new Error(`Expected current app origin for share URL. Got: ${shareUrl}`);
  }

  return shareUrl;
}

async function assertSharedReportOpens(client, shareUrl) {
  await navigate(client, shareUrl);
  try {
    await waitForExpression(
      client,
      `(() => {
        const text = document.body.innerText || "";
        const lowerText = text.toLowerCase();
        return text.includes("Shared campaign report") &&
        text.includes(${JSON.stringify(REPORT_SHARE_CUSTOM_TITLE)}) &&
        lowerText.includes("trust decision") &&
        lowerText.includes("leadership hold") &&
        text.includes("Performance detail held for evidence review") &&
        text.includes(${JSON.stringify(NO_PROOF_LEADERSHIP_HOLD_COPY)});
      })()`,
      "active shared report",
      60000,
    );
  } catch (error) {
    const pageState = await evaluate(
      client,
      `JSON.stringify({
        href: location.href,
        text: document.body.innerText.slice(0, 800),
      })`,
    );
    throw new Error(`${error.message}. Page state: ${pageState}`);
  }

  return evaluate(client, "document.body.innerText");
}

async function assertSharedReportUnavailable(client, shareUrl) {
  await navigate(client, shareUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(UNAVAILABLE_COPY)})`,
    "unavailable shared report",
    60000,
  );

  return evaluate(client, "document.body.innerText");
}

async function revokeShareLinkThroughUi(client, targets) {
  await openReportShareDialog(client, targets);
  await waitForExpression(
    client,
    'document.body.innerText.includes("Revoke")',
    "active share link revoke action",
    60000,
  );
  await clickButtonByText(client, "Revoke");
  await waitForExpression(
    client,
    '!document.body.innerText.includes("Revoke") && document.body.innerText.includes("No shared links yet.")',
    "revoked share link removed from active list",
    60000,
  );
}

async function expireLatestShareLink(admin, campaignId) {
  const [latestLink] = await checkedQuery(
    "Find latest smoke share link",
    admin
      .from("campaign_report_share_links")
      .select("id, created_at, expires_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(1),
  );

  if (!latestLink) {
    throw new Error("Expected a share link to expire.");
  }

  const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  await checkedQuery(
    "Expire latest smoke share link",
    admin
      .from("campaign_report_share_links")
      .update({ created_at: createdAt, expires_at: expiresAt })
      .eq("id", latestLink.id),
  );

  return latestLink.id;
}

export function validateReportShareRevokeSmoke({
  activeShareText,
  expiredShareText,
  revokedShareText,
  activeShareUrl,
  expiredShareId,
  expiredShareUrl,
  consoleErrors,
}) {
  if (!activeShareUrl.includes("/reports/share/pd_rpt_")) {
    throw new Error(`Expected active secure share URL. Got: ${activeShareUrl}`);
  }
  if (!expiredShareUrl.includes("/reports/share/pd_rpt_")) {
    throw new Error(`Expected expired secure share URL. Got: ${expiredShareUrl}`);
  }
  if (!expiredShareId) {
    throw new Error("Expected expired share link row to be updated.");
  }
  if (!activeShareText.includes("Shared campaign report")) {
    throw new Error("Expected active share link to open the public report.");
  }
  if (!activeShareText.includes(REPORT_SHARE_CUSTOM_TITLE)) {
    throw new Error("Expected active share link to include the configured report title.");
  }
  if (!activeShareText.includes("Access expires")) {
    throw new Error("Expected active share link to disclose its access expiry.");
  }
  if (!activeShareText.includes("Data source")) {
    throw new Error("Expected active share link to include report trust evidence.");
  }
  if (!activeShareText.toLowerCase().includes("trust decision")) {
    throw new Error("Expected active share link to include the leadership trust decision.");
  }
  if (!activeShareText.toLowerCase().includes("leadership hold")) {
    throw new Error("Expected active share link with no proof reads to stay on leadership hold.");
  }
  if (!activeShareText.includes(NO_PROOF_LEADERSHIP_HOLD_COPY)) {
    throw new Error("Expected active share link to explain that at least one proof read is required.");
  }
  if (activeShareText.includes("Creator Performance")) {
    throw new Error("Expected no-proof leadership-hold share link to withhold creator performance.");
  }
  if (!revokedShareText.includes(UNAVAILABLE_COPY)) {
    throw new Error("Expected revoked share link to be unavailable.");
  }
  if (!expiredShareText.includes(UNAVAILABLE_COPY)) {
    throw new Error("Expected expired share link to be unavailable.");
  }
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export async function runReportShareRevokeSmoke() {
  await loadLocalEnv();

  const targets = buildReportShareRevokeSmokeTargets();
  const admin = createAdminClient();
  const activeScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_SHARE_ACTIVE_SCREENSHOT_PATH ||
      DEFAULT_ACTIVE_SCREENSHOT_PATH,
  );
  const revokedScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_SHARE_REVOKED_SCREENSHOT_PATH ||
      DEFAULT_REVOKED_SCREENSHOT_PATH,
  );
  const expiredScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_SHARE_EXPIRED_SCREENSHOT_PATH ||
      DEFAULT_EXPIRED_SCREENSHOT_PATH,
  );

  await setupApplicationFlowSmokeData(admin, targets);
  await configureSharedReportSmokeTitle(admin, targets.campaignId);

  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-report-share-revoke-smoke-"),
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

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login for report share revoke smoke",
    });
    await navigate(client, `${targets.brandCampaignUrl}?tab=reporting`);
    await clickTab(client, "Reporting");

    const activeShareUrl = await createShareLink(client, targets);
    const activeShareText = await assertSharedReportOpens(client, activeShareUrl);
    await captureScreenshot(client, activeScreenshotPath);

    await revokeShareLinkThroughUi(client, targets);
    const revokedShareText = await assertSharedReportUnavailable(
      client,
      activeShareUrl,
    );
    await captureScreenshot(client, revokedScreenshotPath);

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login for expired report share smoke",
    });
    const expiredShareUrl = await createShareLink(client, targets);
    const expiredShareId = await expireLatestShareLink(admin, targets.campaignId);
    const expiredShareText = await assertSharedReportUnavailable(
      client,
      expiredShareUrl,
    );
    await captureScreenshot(client, expiredScreenshotPath);

    validateReportShareRevokeSmoke({
      activeShareText,
      expiredShareId,
      expiredShareText,
      expiredShareUrl,
      revokedShareText,
      activeShareUrl,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignId: targets.campaignId,
      activeShareUrl,
      expiredShareId,
      expiredShareUrl,
      screenshots: {
        active: activeScreenshotPath,
        expired: expiredScreenshotPath,
        revoked: revokedScreenshotPath,
      },
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    await stopChrome(chrome);
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    }

    await stopDevServer(devServer);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runReportShareRevokeSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
