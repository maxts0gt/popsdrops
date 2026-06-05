#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  getSmokeCampaignTitle,
  isExistingDevServerReady,
  loadLocalEnv,
  SMOKE_PITCH,
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

export const DEFAULT_SERVICE_FEE_GATE_CAMPAIGN_ID =
  "f0000000-0000-4000-8000-000000000149";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/campaign-service-fee-gate-smoke.png";

export function buildCampaignServiceFeeGateTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_SERVICE_FEE_GATE_CAMPAIGN_ID ||
    DEFAULT_SERVICE_FEE_GATE_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
  };
}

function validateCampaignServiceFeeGateSmoke({
  unpaidText,
  unpaidLaunchDisabled,
  unpaidInviteLocked,
  paidLaunchEnabled,
  launchedInviteUrl,
  launchedInviteCopyDisabled,
  consoleErrors,
}) {
  if (!unpaidText.includes("Pay to launch")) {
    throw new Error("Expected unpaid campaign to show the launch payment gate.");
  }

  if (!unpaidText.includes("Pay the PopsDrops fee to reveal the invite link.")) {
    throw new Error("Expected unpaid campaign to hide the invite behind payment.");
  }

  if (!unpaidLaunchDisabled) {
    throw new Error("Expected unpaid campaign launch action to be disabled.");
  }

  if (!unpaidInviteLocked) {
    throw new Error("Expected unpaid campaign invite link to stay locked.");
  }

  if (!paidLaunchEnabled) {
    throw new Error("Expected paid draft campaign launch action to be enabled.");
  }

  if (!launchedInviteUrl.includes("/apply/")) {
    throw new Error("Expected launched paid campaign to reveal the invite URL.");
  }

  if (launchedInviteCopyDisabled) {
    throw new Error("Expected launched paid campaign invite copy to be enabled.");
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

function createAnonSmokeClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for authenticated smoke client.",
    );
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createAuthenticatedSmokeCreatorClient(admin) {
  const creator = createAnonSmokeClient();
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "creator@dev.popsdrops.com",
  });

  if (generated.error) {
    throw new Error(
      `Generate smoke creator magic link: ${generated.error.message}`,
    );
  }

  const tokenHash = generated.data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Generated smoke creator magic link token hash is missing.");
  }

  const verified = await creator.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verified.error) {
    throw new Error(`Verify smoke creator OTP: ${verified.error.message}`);
  }

  if (!verified.data.session?.access_token) {
    throw new Error("Smoke creator OTP did not return a session.");
  }

  return creator;
}

async function assertDirectCreatorApplicationServiceFeeGate({
  admin,
  campaignId,
  creatorId,
}) {
  const creator = await createAuthenticatedSmokeCreatorClient(admin);

  try {
    await checkedQuery(
      "Prepare unpaid recruiting campaign for direct application gate",
      admin
        .from("campaigns")
        .update({ status: "recruiting", service_fee_status: "pending" })
        .eq("id", campaignId),
    );

    const unpaidInsert = await creator
      .from("campaign_applications")
      .insert({
        id: randomUUID(),
        campaign_id: campaignId,
        creator_id: creatorId,
        proposed_rate: 275,
        pitch: `${SMOKE_PITCH} direct API unpaid`,
        status: "pending",
      })
      .select("id")
      .single();

    if (!unpaidInsert.error) {
      throw new Error(
        "Expected unpaid direct creator application insert to fail.",
      );
    }

    await checkedQuery(
      "Mark direct application gate campaign paid",
      admin
        .from("campaigns")
        .update({ service_fee_status: "paid" })
        .eq("id", campaignId),
    );

    const paidInsert = await creator
      .from("campaign_applications")
      .insert({
        id: randomUUID(),
        campaign_id: campaignId,
        creator_id: creatorId,
        proposed_rate: 275,
        pitch: `${SMOKE_PITCH} direct API paid`,
        status: "pending",
      })
      .select("id")
      .single();

    if (paidInsert.error) {
      throw new Error(
        `Expected paid direct creator application insert to succeed. ${paidInsert.error.message}`,
      );
    }
  } finally {
    await checkedQuery(
      "Clean direct creator application smoke rows",
      admin.from("campaign_applications").delete().eq("campaign_id", campaignId),
    );
    await creator.auth.signOut().catch(() => {});
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

async function runCampaignServiceFeeGateSmoke() {
  await loadLocalEnv();

  const targets = buildCampaignServiceFeeGateTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_SERVICE_FEE_GATE_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();

  const { creatorId } = await setupApplicationFlowSmokeData(admin, targets);
  await assertDirectCreatorApplicationServiceFeeGate({
    admin,
    campaignId: targets.campaignId,
    creatorId,
  });
  await checkedQuery(
    "Prepare unpaid draft campaign",
    admin
      .from("campaigns")
      .update({
        status: "draft",
        service_fee_status: "pending",
        recruitment_visibility: "open_applications",
      })
      .eq("id", targets.campaignId),
  );

  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-service-fee-gate-smoke-"),
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
      description: "brand dev login redirect",
    });

    await navigate(client, targets.brandCampaignUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "campaign detail title",
    );
    const unpaidInviteLocked = await evaluate(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-invite-locked"]\'))',
    );

    await clickTab(client, "Setup");
    await waitForExpression(
      client,
      'document.body.innerText.includes("Pay to launch")',
      "unpaid campaign service fee gate",
    );
    const unpaidText = await evaluate(client, "document.body.innerText");
    const unpaidLaunchDisabled = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === true',
    );

    await checkedQuery(
      "Mark campaign service fee paid for smoke",
      admin
        .from("campaigns")
        .update({ service_fee_status: "paid" })
        .eq("id", targets.campaignId),
    );

    await navigate(client, `${targets.brandCampaignUrl}?tab=brief`);
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === false',
      "paid campaign launch action",
    );
    const paidLaunchEnabled = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-launch-action"]\')?.disabled === false',
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
    const launchedInviteUrl = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-strip"] input\')?.value || ""',
    );
    const launchedInviteCopyDisabled = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-invite-copy"]\')?.disabled === true',
    );

    validateCampaignServiceFeeGateSmoke({
      unpaidText,
      unpaidLaunchDisabled,
      unpaidInviteLocked,
      paidLaunchEnabled,
      launchedInviteUrl,
      launchedInviteCopyDisabled,
      consoleErrors,
    });

    await captureScreenshot(client, screenshotPath);

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignUrl: targets.brandCampaignUrl,
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
  runCampaignServiceFeeGateSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export {
  runCampaignServiceFeeGateSmoke,
  validateCampaignServiceFeeGateSmoke,
};
