#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_CAMPAIGN_ID = "d0000000-0000-4000-8000-000000000001";
const DEFAULT_BILLING_CAMPAIGN_ID = "f0000000-0000-4000-8000-000000000149";
const ROLE_ORDER = ["owner", "admin", "manager", "viewer"];

const EXPECTED_BY_ROLE = {
  owner: {
    settingsInviteVisible: true,
    settingsReadonlyVisible: false,
    settingsManageUnavailableVisible: false,
    campaignCreateVisible: true,
    campaignInviteManageSurfaceVisible: true,
    campaignInviteReadOnlyVisible: false,
    serviceFeeActionVisible: true,
    serviceFeeActionEnabled: true,
    reportShareVisible: true,
    reportExportVisible: true,
  },
  admin: {
    settingsInviteVisible: true,
    settingsReadonlyVisible: false,
    settingsManageUnavailableVisible: false,
    campaignCreateVisible: true,
    campaignInviteManageSurfaceVisible: true,
    campaignInviteReadOnlyVisible: false,
    serviceFeeActionVisible: true,
    serviceFeeActionEnabled: false,
    reportShareVisible: true,
    reportExportVisible: true,
  },
  manager: {
    settingsInviteVisible: false,
    settingsReadonlyVisible: true,
    settingsManageUnavailableVisible: true,
    campaignCreateVisible: true,
    campaignInviteManageSurfaceVisible: true,
    campaignInviteReadOnlyVisible: false,
    serviceFeeActionVisible: true,
    serviceFeeActionEnabled: false,
    reportShareVisible: true,
    reportExportVisible: true,
  },
  viewer: {
    settingsInviteVisible: false,
    settingsReadonlyVisible: true,
    settingsManageUnavailableVisible: true,
    campaignCreateVisible: false,
    campaignInviteManageSurfaceVisible: false,
    campaignInviteReadOnlyVisible: true,
    serviceFeeActionVisible: true,
    serviceFeeActionEnabled: false,
    reportShareVisible: false,
    reportExportVisible: false,
  },
};

export function buildBrandRolePermissionSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId = process.env.SMOKE_BRAND_ROLE_CAMPAIGN_ID || DEFAULT_CAMPAIGN_ID,
  billingCampaignId =
    process.env.SMOKE_BRAND_ROLE_BILLING_CAMPAIGN_ID ||
    DEFAULT_BILLING_CAMPAIGN_ID,
  reportCampaignId =
    process.env.SMOKE_BRAND_ROLE_REPORT_CAMPAIGN_ID || campaignId,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    campaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    billingCampaignId,
    billingCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${billingCampaignId}`,
    campaignsUrl: `${normalizedBaseUrl}/b/campaigns`,
    reportCampaignId,
    reportUrl: `${normalizedBaseUrl}/b/campaigns/${reportCampaignId}/report`,
    settingsUrl: `${normalizedBaseUrl}/b/settings`,
    loginUrls: {
      owner: `${normalizedBaseUrl}/auth/dev-login?role=brand&teamRole=owner`,
      admin: `${normalizedBaseUrl}/auth/dev-login?role=brand&teamRole=admin`,
      manager: `${normalizedBaseUrl}/auth/dev-login?role=brand&teamRole=manager`,
      viewer: `${normalizedBaseUrl}/auth/dev-login?role=brand&teamRole=viewer`,
    },
  };
}

function assertFlag(role, state, key) {
  const expected = EXPECTED_BY_ROLE[role][key];
  if (state[key] !== expected) {
    throw new Error(
      `${role} expected ${key}=${expected}, received ${state[key]}`,
    );
  }
}

export function validateBrandRolePermissionSmoke({ roleStates, consoleErrors }) {
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  for (const role of ROLE_ORDER) {
    const state = roleStates[role];
    if (!state) {
      throw new Error(`Missing smoke state for ${role}`);
    }

    for (const key of Object.keys(EXPECTED_BY_ROLE[role])) {
      assertFlag(role, state, key);
    }
  }

  return true;
}

export async function assertBrandReportRouteAvailable(targets) {
  const response = await fetch(targets.reportUrl, {
    redirect: "manual",
  });

  if (response.status === 404) {
    throw new Error(
      `Brand report route is not registered for role smoke: ${targets.reportUrl}`,
    );
  }

  if (response.status >= 500) {
    throw new Error(
      `Brand report route returned ${response.status} before role smoke: ${targets.reportUrl}`,
    );
  }
}

export async function seedReportPerformanceForRoleSmoke(client, targets) {
  const seedUrl =
    `${targets.baseUrl}/dev/seed-report-performance` +
    `?campaignId=${encodeURIComponent(targets.reportCampaignId)}` +
    "&scenario=verified";

  await loginForSmoke(client, {
    loginUrl: targets.loginUrls.owner,
    expectedUrlPrefix: `${targets.baseUrl}/b`,
    description: "owner brand report seed login",
  });
  await navigate(client, seedUrl);
  await waitForExpression(
    client,
    "Boolean(document.body?.innerText?.trim())",
    "brand role report seed response",
    60000,
  );
  const seedResult = await evaluate(
    client,
    `(() => {
      try {
        return JSON.parse(document.body.innerText);
      } catch {
        return { success: false, error: document.body.innerText.slice(0, 500) };
      }
    })()`,
  );

  if (seedResult === null || seedResult.success !== true) {
    throw new Error(
      `Failed to seed report evidence for brand role smoke: ${
        seedResult?.error || "unknown seed response"
      }`,
    );
  }

  return seedResult;
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function seedBillingCampaignForRoleSmoke(admin, targets) {
  const billingTargets = {
    ...targets,
    campaignId: targets.billingCampaignId,
    brandCampaignUrl: targets.billingCampaignUrl,
  };

  await setupApplicationFlowSmokeData(admin, billingTargets);
  await checkedQuery(
    "Prepare unpaid billing permission campaign",
    admin
      .from("campaigns")
      .update({ status: "draft", service_fee_status: "pending" })
      .eq("id", targets.billingCampaignId),
  );
}

export async function cleanupBillingCampaignForRoleSmoke(admin, targets) {
  await cleanupApplicationFlowSmokeData(admin, targets.billingCampaignId);
}

async function countSelector(client, selector) {
  return evaluate(
    client,
    `document.querySelectorAll(${JSON.stringify(selector)}).length`,
  );
}

async function collectRoleState(client, targets, role) {
  await loginForSmoke(client, {
    loginUrl: targets.loginUrls[role],
    expectedUrlPrefix: `${targets.baseUrl}/b`,
    description: `${role} brand team login`,
  });

  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="brand-team-settings"]\'))',
    `${role} settings`,
    60000,
  );
  const settingsInviteVisible =
    (await countSelector(client, '[data-testid="brand-team-invite-form"]')) > 0;
  const settingsReadonlyVisible =
    (await countSelector(client, '[data-testid="brand-profile-readonly-badge"]')) > 0;
  const settingsManageUnavailableVisible =
    (await countSelector(client, '[data-testid="brand-team-manage-unavailable"]')) >
    0;

  await navigate(client, targets.campaignsUrl);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="campaign-operations-summary"]\')) || Boolean(document.querySelector(\'[data-testid="campaign-row"]\'))',
    `${role} campaign list`,
    60000,
  );
  const campaignCreateVisible =
    (await countSelector(client, '[data-testid="campaign-create-action"]')) > 0;

  await navigate(client, targets.campaignUrl);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="campaign-command-center"]\'))',
    `${role} campaign detail`,
    60000,
  );
  const campaignInviteCopyVisible =
    (await countSelector(client, '[data-testid="campaign-invite-copy"]')) > 0;
  const campaignInviteLockedVisible =
    (await countSelector(client, '[data-testid="campaign-invite-locked"]')) > 0;
  const campaignInviteReadOnlyVisible =
    (await countSelector(client, '[data-testid="campaign-invite-read-only"]')) > 0;
  const campaignInviteManageSurfaceVisible =
    campaignInviteCopyVisible || campaignInviteLockedVisible;

  await navigate(client, targets.reportUrl);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="campaign-report-page"]\')) || Boolean(document.querySelector(\'[data-testid="campaign-report-unavailable"]\'))',
    `${role} report page`,
    60000,
  );
  await waitForExpression(
    client,
    `(() => {
      const reportPage = document.querySelector('[data-testid="campaign-report-page"]');
      const unavailable = document.querySelector('[data-testid="campaign-report-unavailable"]');
      return Boolean(unavailable) || Boolean(reportPage?.dataset.reportRole && reportPage.dataset.reportRole !== 'loading');
    })()`,
    `${role} report permission state`,
    60000,
  );
  const reportShareVisible =
    (await countSelector(client, '[data-testid="report-share-button"]')) > 0;
  const reportExportVisible =
    (await countSelector(client, '[data-testid="report-export-menu"]')) > 0;

  await navigate(client, `${targets.billingCampaignUrl}?tab=brief`);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="campaign-service-fee-action"]\'))',
    `${role} billing permission`,
    60000,
  );
  const serviceFeeActionVisible =
    (await countSelector(client, '[data-testid="campaign-service-fee-action"]')) >
    0;
  const serviceFeeActionEnabled = await evaluate(
    client,
    'document.querySelector(\'[data-testid="campaign-service-fee-action"]\')?.disabled === false',
  );

  return {
    settingsInviteVisible,
    settingsReadonlyVisible,
    settingsManageUnavailableVisible,
    campaignCreateVisible,
    campaignInviteCopyVisible,
    campaignInviteLockedVisible,
    campaignInviteManageSurfaceVisible,
    campaignInviteReadOnlyVisible,
    serviceFeeActionVisible,
    serviceFeeActionEnabled,
    reportShareVisible,
    reportExportVisible,
  };
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

async function closeCdpClient(client) {
  if (!client) return;

  const socket = client.ws;
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    client.close();
    return;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1000);
    const finish = () => {
      clearTimeout(timeout);
      resolve();
    };

    socket.addEventListener("close", finish, { once: true });
    socket.addEventListener("error", finish, { once: true });

    client.close();
  });
}

export async function runBrandRolePermissionSmoke({
  screenshotDirectory = "output/playwright",
  targets = buildBrandRolePermissionSmokeTargets(),
} = {}) {
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "popsdrops-brand-roles-"));
  let chrome;
  let client;
  let devServer;
  let admin;
  const consoleErrors = [];

  try {
    await loadLocalEnv();
    admin = createAdminClient();
    devServer = await ensureDevServer(targets.baseUrl);
    await seedBillingCampaignForRoleSmoke(admin, targets);
    await assertBrandReportRouteAvailable(targets);
    chrome = await launchChrome({ debugPort, userDataDir });
    client = await createCdpPage(debugPort);
    await client.send("Runtime.enable");
    await client.send("Page.enable");

    client.on("Runtime.consoleAPICalled", (event) => {
      if (event.type === "error") {
        consoleErrors.push(
          event.args.map((arg) => arg.value || arg.description || "").join(" "),
        );
      }
    });
    client.on("Runtime.exceptionThrown", (event) => {
      consoleErrors.push(event.exceptionDetails?.text || "Runtime exception");
    });

    await seedReportPerformanceForRoleSmoke(client, targets);

    const roleStates = {};
    for (const role of ROLE_ORDER) {
      roleStates[role] = await collectRoleState(client, targets, role);

      if (role === "owner" || role === "viewer") {
        await captureScreenshot(
          client,
          path.join(screenshotDirectory, `brand-role-permissions-${role}.png`),
        );
      }
    }

    validateBrandRolePermissionSmoke({ roleStates, consoleErrors });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignId: targets.campaignId,
      reportCampaignId: targets.reportCampaignId,
      roleStates,
      screenshots: {
        owner: path.join(screenshotDirectory, "brand-role-permissions-owner.png"),
        viewer: path.join(screenshotDirectory, "brand-role-permissions-viewer.png"),
      },
      devServerStarted: Boolean(devServer),
    };
  } finally {
    const clientClosed = closeCdpClient(client);
    await stopChrome(chrome);
    await clientClosed;
    if (admin) {
      await cleanupBillingCampaignForRoleSmoke(admin, targets);
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
  runBrandRolePermissionSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
