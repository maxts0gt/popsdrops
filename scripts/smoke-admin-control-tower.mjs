#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildApplicationFlowSmokeTargets,
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
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

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
export const DEFAULT_ADMIN_CONTROL_TOWER_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000122";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/admin-control-tower-smoke.png";
const SMOKE_SOURCE = "smoke-admin-control-tower";

function buildAdminControlTowerTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_ADMIN_CONTROL_TOWER_CAMPAIGN_ID ||
    DEFAULT_ADMIN_CONTROL_TOWER_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    adminHomeUrl: `${targets.baseUrl}/admin`,
    adminLoginUrl: `${targets.baseUrl}/auth/dev-login?role=admin`,
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

async function setupAdminControlTowerFixtures(admin, { campaignId, creatorId }) {
  const smokeId = `pd_admin_control_${randomUUID()}`;
  const waitlistEmail = `support+pd-control-${randomUUID().slice(0, 8)}@tengrivertex.com`;
  const createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const staleProofCreatedAt = new Date(
    Date.now() - 48 * 60 * 60 * 1000,
  ).toISOString();
  const memberId = randomUUID();
  const reportTaskId = randomUUID();
  const evidenceId = randomUUID();

  const waitlist = await checkedQuery(
    "Create admin control tower pending access row",
    admin
      .from("waitlist")
      .insert({
        type: "brand",
        email: waitlistEmail,
        full_name: "Control Tower Smoke",
        company_name: "PopsDrops Control Tower Smoke",
        industry: "beauty_skincare",
        website: "https://popsdrops.com",
        budget_range: "25k_100k",
        markets: ["US"],
        reason: `${SMOKE_SOURCE}: pending access exception. ${smokeId}`,
        referral_source: "codex-smoke",
        status: "pending",
        created_at: createdAt,
      })
      .select("id")
      .single(),
  );

  const queue = await checkedQuery(
    "Create admin control tower failed email queue row",
    admin
      .from("notification_queue")
      .insert({
        attempt_count: 1,
        data: {
          body: `${SMOKE_SOURCE}: failed email exception. ${smokeId}`,
          data: {
            smoke: true,
            smoke_id: smokeId,
            source: SMOKE_SOURCE,
          },
          recipientName: "Control Tower Smoke",
          recipient_name: "Control Tower Smoke",
          title: "Account Update",
        },
        email: waitlistEmail,
        last_error: "Smoke email failure for admin control tower.",
        priority: "immediate",
        processed_reason: "email_failed",
        status: "failed",
        template: "account_rejected",
      })
      .select("id")
      .single(),
  );

  await checkedQuery(
    "Create admin control tower report member",
    admin.from("campaign_members").insert({
      id: memberId,
      campaign_id: campaignId,
      creator_id: creatorId,
      accepted_rate: 275,
      payment_status: "pending",
      joined_at: createdAt,
    }),
  );

  await checkedQuery(
    "Create admin control tower report task",
    admin.from("campaign_report_tasks").insert({
      id: reportTaskId,
      campaign_id: campaignId,
      campaign_member_id: memberId,
      due_at: createdAt,
      status: "submitted",
      submitted_at: staleProofCreatedAt,
      task_key: "admin-control-tower:stale-proof",
    }),
  );

  await checkedQuery(
    "Create admin control tower stale proof",
    admin.from("content_performance_evidence").insert({
      id: evidenceId,
      campaign_id: campaignId,
      campaign_member_id: memberId,
      evidence_type: "screenshot",
      file_name: "admin-control-tower-stale-proof.png",
      mime_type: "image/png",
      report_task_id: reportTaskId,
      size_bytes: 1024,
      storage_path: `${campaignId}/${memberId}/${reportTaskId}/${evidenceId}/admin-control-tower-stale-proof.png`,
      uploaded_by: creatorId,
      created_at: staleProofCreatedAt,
      verification_status: "submitted",
    }),
  );

  return {
    evidenceId,
    memberId,
    queueId: queue.id,
    reportTaskId,
    smokeId,
    waitlistEmail,
    waitlistId: waitlist.id,
  };
}

async function cleanupAdminControlTowerFixtures(admin, fixture) {
  if (!fixture) return;

  await checkedQuery(
    "Delete admin control tower queue row",
    admin.from("notification_queue").delete().eq("id", fixture.queueId),
  );
  await checkedQuery(
    "Delete admin control tower waitlist row",
    admin.from("waitlist").delete().eq("id", fixture.waitlistId),
  );
}

export function validateAdminControlTowerSmoke({
  consoleErrors,
  pageText,
  rowText,
  summaryText,
}) {
  const requiredPageText = [
    "Control tower",
    "What needs attention",
    "Access overdue",
    "Proof review SLA",
    "Email delivery",
  ];
  const requiredSummaryText = ["Access", "Campaign exceptions", "Email queue"];
  const requiredRowText = [
    "Access overdue",
    "Review access",
    "Proof review SLA",
    "Open reports",
    "submitted proof",
    "Email delivery",
    "Open communications",
  ];

  for (const text of requiredPageText) {
    if (!pageText.includes(text)) {
      throw new Error(`Missing admin control tower page text: ${text}`);
    }
  }

  for (const text of requiredSummaryText) {
    if (!summaryText.includes(text)) {
      throw new Error(`Missing admin control tower summary text: ${text}`);
    }
  }

  for (const text of requiredRowText) {
    if (!rowText.includes(text)) {
      throw new Error(`Missing admin attention row text: ${text}`);
    }
  }

  if (!pageText.includes("/admin/approvals")) {
    throw new Error("Expected admin control tower to link to /admin/approvals.");
  }

  if (!pageText.includes("/admin/reports")) {
    throw new Error("Expected admin control tower stale proof rows to link to /admin/reports.");
  }

  if (!pageText.includes("/admin/communications?status=failed")) {
    throw new Error(
      "Expected admin control tower to link failed email rows to /admin/communications?status=failed.",
    );
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export async function runAdminControlTowerSmoke() {
  await loadLocalEnv();

  const targets = buildAdminControlTowerTargets();
  const admin = createAdminClient();
  const screenshotPath = path.resolve(
    process.env.SMOKE_ADMIN_CONTROL_TOWER_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const campaignFixture = await setupApplicationFlowSmokeData(admin, targets);
  const fixture = await setupAdminControlTowerFixtures(admin, {
    campaignId: targets.campaignId,
    creatorId: campaignFixture.creatorId,
  });
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-admin-control-tower-smoke-"),
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
      loginUrl: targets.adminLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/admin`,
      description: "admin dev login for control tower smoke",
    });
    await navigate(client, targets.adminHomeUrl);
    await waitForExpression(
      client,
      `(() => {
        const summary = document.querySelector('[data-testid="admin-control-tower-summary"]');
        const rows = [...document.querySelectorAll('[data-testid="admin-attention-row"]')];
        const text = document.body.innerText || "";
        const links = [...document.querySelectorAll('a')].map((link) => link.getAttribute('href') || '').join(" ");
        return Boolean(summary) &&
          rows.length >= 2 &&
          text.includes("Control tower") &&
          text.includes("What needs attention") &&
          text.includes("Access overdue") &&
          text.includes("Proof review SLA") &&
          text.includes("Email delivery") &&
          links.includes("/admin/approvals") &&
          links.includes("/admin/reports") &&
          links.includes("/admin/communications?status=failed");
      })()`,
      "admin control tower exception rows",
      60000,
    );

    await captureScreenshot(client, screenshotPath);
    const pageText = await evaluate(
      client,
      `(() => {
        const links = [...document.querySelectorAll('a')].map((link) => link.getAttribute('href') || '').join("\\n");
        return (document.body.innerText || "") + "\\n" + links;
      })()`,
    );
    const summaryText = await evaluate(
      client,
      `document.querySelector('[data-testid="admin-control-tower-summary"]')?.innerText ?? ""`,
    );
    const rowText = await evaluate(
      client,
      `[...document.querySelectorAll('[data-testid="admin-attention-row"]')].map((row) => row.innerText).join("\\n")`,
    );

    validateAdminControlTowerSmoke({
      consoleErrors,
      pageText,
      rowText,
      summaryText,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      fixture,
      screenshotPath,
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
    await cleanupAdminControlTowerFixtures(admin, fixture);
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    await stopDevServer(devServer);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAdminControlTowerSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
