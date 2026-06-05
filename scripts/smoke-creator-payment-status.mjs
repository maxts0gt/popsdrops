#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

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
import { captureScreenshot, loadLocalEnv } from "./smoke-application-flow.mjs";

export const DEFAULT_PAYMENT_CAMPAIGN_ID =
  "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010";
const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/creator-payment-status-smoke.png";
const DEFAULT_AUDIT_SCREENSHOT_PATH =
  "output/playwright/creator-payment-status-audit-smoke.png";
const DEFAULT_COMMUNICATIONS_SCREENSHOT_PATH =
  "output/playwright/creator-payment-status-communications-smoke.png";
const DEFAULT_CREATOR_NOTIFICATIONS_SCREENSHOT_PATH =
  "output/playwright/creator-payment-status-notifications-smoke.png";

export function buildCreatorPaymentStatusTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId = process.env.SMOKE_PAYMENT_CAMPAIGN_ID ||
    DEFAULT_PAYMENT_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}?tab=creators`,
    creatorCampaignUrl: `${normalizedBaseUrl}/i/campaigns/${campaignId}`,
    creatorEarningsUrl: `${normalizedBaseUrl}/i/earnings`,
    creatorNotificationsUrl: `${normalizedBaseUrl}/i/notifications`,
  };
}

function createAdminClientFromEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function readSmokeMember(admin, campaignId) {
  return checkedQuery(
    "Read creator payment status smoke member",
    admin
      .from("campaign_members")
      .select("id, campaign_id, creator_id, payment_status")
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .single(),
  );
}

async function updateMemberPaymentStatus(admin, memberId, status) {
  return checkedQuery(
    `Set creator payment status to ${status}`,
    admin
      .from("campaign_members")
      .update({ payment_status: status })
      .eq("id", memberId)
      .select("id, payment_status")
      .single(),
  );
}

async function waitForMemberPaymentStatus(admin, memberId, status) {
  const startedAt = Date.now();
  let lastStatus = "unknown";

  while (Date.now() - startedAt < 60000) {
    const member = await checkedQuery(
      "Poll creator payment status",
      admin
        .from("campaign_members")
        .select("payment_status")
        .eq("id", memberId)
        .single(),
    );
    lastStatus = member.payment_status;
    if (lastStatus === status) return member;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Expected creator payment status ${status}; latest status was ${lastStatus}.`,
  );
}

async function waitForPaymentStatusAudit(
  admin,
  { memberId, campaignId, creatorId, previousStatus, newStatus, startedAt },
) {
  const startedAtMs = Date.now();
  let latestAudit = null;

  while (Date.now() - startedAtMs < 60000) {
    const rows = await checkedQuery(
      "Poll creator payment status audit",
      admin
        .from("admin_audit_log")
        .select("id, action, target_type, target_id, metadata, created_at")
        .eq("action", "creator_payment_status_updated")
        .eq("target_type", "campaign_member")
        .eq("target_id", memberId)
        .gte("created_at", startedAt)
        .order("created_at", { ascending: false })
        .limit(5),
    );

    latestAudit = rows?.[0] ?? null;
    const matchingAudit = rows?.find((row) => {
      const metadata = row.metadata ?? {};
      return (
        metadata.campaign_id === campaignId &&
        metadata.creator_id === creatorId &&
        metadata.previous_status === previousStatus &&
        metadata.new_status === newStatus
      );
    });

    if (matchingAudit) return matchingAudit;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Expected creator payment status audit ${previousStatus} to ${newStatus}; latest audit was ${JSON.stringify(latestAudit)}.`,
  );
}

async function waitForPaymentStatusNotification(
  admin,
  { memberId, campaignId, creatorId, status, type, startedAt },
) {
  const startedAtMs = Date.now();
  let latestNotification = null;

  while (Date.now() - startedAtMs < 60000) {
    const rows = await checkedQuery(
      "Poll creator payment status notification",
      admin
        .from("notifications")
        .select("id, type, title, body, data, created_at")
        .eq("user_id", creatorId)
        .eq("type", type)
        .gte("created_at", startedAt)
        .order("created_at", { ascending: false })
        .limit(5),
    );

    latestNotification = rows?.[0] ?? null;
    const matchingNotification = rows?.find((row) => {
      const data = row.data ?? {};
      return (
        data.campaign_id === campaignId &&
        data.member_id === memberId &&
        data.payment_status === status
      );
    });

    if (matchingNotification) return matchingNotification;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Expected ${status} payment notification; latest notification was ${JSON.stringify(latestNotification)}.`,
  );
}

async function waitForNotificationQueue(admin, notificationId) {
  const startedAt = Date.now();
  let latestQueueItem = null;

  while (Date.now() - startedAt < 60000) {
    const rows = await checkedQuery(
      "Poll payment notification queue",
      admin
        .from("notification_queue")
        .select("id, notification_id, status, created_at")
        .eq("notification_id", notificationId)
        .order("created_at", { ascending: false })
        .limit(1),
    );

    latestQueueItem = rows?.[0] ?? null;
    if (latestQueueItem) return latestQueueItem;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Expected notification queue row for ${notificationId}; latest queue item was ${JSON.stringify(latestQueueItem)}.`,
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

async function clickSelector(client, selector, description) {
  const box = await waitForExpression(
    client,
    `(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return null;
      node.scrollIntoView({ block: "center", inline: "center" });
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    })()`,
    description,
  );

  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: box.x,
    y: box.y,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
}

async function pressKey(client, key) {
  const keyMap = {
    Enter: { code: "Enter", windowsVirtualKeyCode: 13 },
  };
  const keyConfig = keyMap[key];
  if (!keyConfig) throw new Error(`Unsupported smoke key: ${key}`);

  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    ...keyConfig,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    ...keyConfig,
  });
}

function paymentStatusLabel(status) {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "paid":
      return "Paid";
    default:
      return status;
  }
}

async function setPaymentStatusThroughBrandUi(
  client,
  targets,
  memberId,
  status,
) {
  const label = paymentStatusLabel(status);

  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b`,
    description: "brand login for creator payment status smoke",
  });

  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-member-id="${memberId}"] [data-testid="campaign-member-payment-status-select"]'))`,
    "brand creator payment selector",
  );

  await clickSelector(
    client,
    `[data-member-id="${memberId}"] [data-testid="campaign-member-payment-status-select"]`,
    "brand creator payment selector click target",
  );

  const visibleOptionCount = await evaluate(
    client,
    `document.querySelectorAll('[role="option"], [data-slot="select-item"], [data-radix-collection-item]').length`,
  );

  if (visibleOptionCount === 0) {
    await evaluate(
      client,
      `document.querySelector('[data-member-id="${memberId}"] [data-testid="campaign-member-payment-status-select"]')?.focus()`,
    );
    await pressKey(client, "Enter");
  }

  await waitForExpression(
    client,
    `([...document.querySelectorAll('[role="option"], [data-slot="select-item"], [data-radix-collection-item]')]
      .some((option) => option.textContent.trim() === ${JSON.stringify(label)}))`,
    `${status} payment status option`,
  );

  await clickSelector(
    client,
    `[data-testid="campaign-member-payment-status-option-${status}"]`,
    `${status} payment status option click target`,
  );

  await waitForExpression(
    client,
    `document.querySelector('[data-member-id="${memberId}"]')?.textContent.includes(${JSON.stringify(label)})`,
    `brand creator payment status ${status}`,
  );
}

async function assertCreatorSurfacesShowPaid(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator login for payment status smoke",
  });

  await navigate(client, targets.creatorCampaignUrl);
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="creator-room-payment-status"]\')?.textContent.toLowerCase().includes("paid")',
    "creator room paid payment status",
  );

  await navigate(client, targets.creatorEarningsUrl);
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="creator-earnings-ledger"]')?.innerText.includes("K-Beauty Retail Launch") &&
      document.querySelector('[data-testid="creator-earnings-ledger"]')?.innerText.includes("Paid") &&
      document.querySelector('[data-testid="creator-earnings-ledger"]')?.innerText.includes("Accepted")`,
    "creator earnings paid payment status",
  );
}

async function assertCreatorNotificationsShowPaymentStatuses(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator login for payment notification center smoke",
  });

  await navigate(client, targets.creatorNotificationsUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes("Payment marked paid") && document.body.innerText.includes("Payment marked overdue")`,
    "creator notification center payment statuses",
  );

  const paymentLinks = await evaluate(
    client,
    `([...document.querySelectorAll('a[href="/i/earnings"]')]
      .filter((link) => link.textContent.includes("Payment marked paid") || link.textContent.includes("Payment marked overdue"))
      .length)`,
  );

  if (paymentLinks < 2) {
    throw new Error(
      `Expected paid and overdue creator notifications to link to earnings; found ${paymentLinks}.`,
    );
  }
}

async function assertAdminAuditShowsPaymentStatus(client, targets, auditId) {
  await loginForSmoke(client, {
    loginUrl: targets.adminLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/admin`,
    description: "admin login for creator payment status audit smoke",
  });

  await navigate(
    client,
    `${targets.baseUrl}/admin/audit?entry=${auditId}#audit-entry-${auditId}`,
  );
  await waitForExpression(
    client,
    `document.body.innerText.includes("Track creator payment") && document.body.innerText.includes("Pending to Paid for K-Beauty Retail Launch")`,
    "admin audit creator payment status row",
  );
}

async function assertAdminCommunicationsShowsPaymentNotification(
  client,
  targets,
  queueId,
  { typeLabel, title },
) {
  await loginForSmoke(client, {
    loginUrl: targets.adminLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/admin`,
    description: "admin login for creator payment notification smoke",
  });

  await navigate(
    client,
    `${targets.baseUrl}/admin/communications?queue=${queueId}#notification-queue-${queueId}`,
  );
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(typeLabel)}) && document.body.innerText.includes(${JSON.stringify(title)})`,
    "admin communications creator payment notification row",
  );
}

async function smokeCreatorPaymentStatusChange({
  admin,
  client,
  targets,
  member,
  fromStatus,
  toStatus,
  notificationType,
}) {
  const statusChangeStartedAt = new Date(Date.now() - 1000).toISOString();

  await updateMemberPaymentStatus(admin, member.id, fromStatus);
  await setPaymentStatusThroughBrandUi(client, targets, member.id, toStatus);
  await waitForMemberPaymentStatus(admin, member.id, toStatus);

  const audit = await waitForPaymentStatusAudit(admin, {
    memberId: member.id,
    campaignId: targets.campaignId,
    creatorId: member.creator_id,
    previousStatus: fromStatus,
    newStatus: toStatus,
    startedAt: statusChangeStartedAt,
  });
  const notification = await waitForPaymentStatusNotification(admin, {
    memberId: member.id,
    campaignId: targets.campaignId,
    creatorId: member.creator_id,
    status: toStatus,
    type: notificationType,
    startedAt: statusChangeStartedAt,
  });
  const queueItem = await waitForNotificationQueue(admin, notification.id);

  return { audit, notification, queueItem };
}

async function runCreatorPaymentStatusSmoke() {
  await loadLocalEnv();

  const targets = buildCreatorPaymentStatusTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
  );
  const auditScreenshotPath = path.resolve(
    process.env.SMOKE_AUDIT_SCREENSHOT_PATH || DEFAULT_AUDIT_SCREENSHOT_PATH,
  );
  const communicationsScreenshotPath = path.resolve(
    process.env.SMOKE_COMMUNICATIONS_SCREENSHOT_PATH ||
      DEFAULT_COMMUNICATIONS_SCREENSHOT_PATH,
  );
  const creatorNotificationsScreenshotPath = path.resolve(
    process.env.SMOKE_CREATOR_NOTIFICATIONS_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_NOTIFICATIONS_SCREENSHOT_PATH,
  );
  const admin = createAdminClientFromEnv();
  const member = await readSmokeMember(admin, targets.campaignId);
  const originalStatus = member.payment_status;
  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-payment-status-smoke-"),
  );
  let chrome;
  let client;

  try {
    chrome = await launchChrome({ debugPort, userDataDir });
    client = await createCdpPage(debugPort);
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    const overdue = await smokeCreatorPaymentStatusChange({
      admin,
      client,
      targets,
      member,
      fromStatus: "pending",
      toStatus: "overdue",
      notificationType: "campaign_update",
    });
    await assertAdminCommunicationsShowsPaymentNotification(
      client,
      targets,
      overdue.queueItem.id,
      {
        typeLabel: "Campaign update",
        title: "Payment marked overdue",
      },
    );

    const paid = await smokeCreatorPaymentStatusChange({
      admin,
      client,
      targets,
      member,
      fromStatus: "pending",
      toStatus: "paid",
      notificationType: "payment_received",
    });
    await assertCreatorSurfacesShowPaid(client, targets);
    await captureScreenshot(client, screenshotPath);
    await assertCreatorNotificationsShowPaymentStatuses(client, targets);
    await captureScreenshot(client, creatorNotificationsScreenshotPath);
    await assertAdminAuditShowsPaymentStatus(client, targets, paid.audit.id);
    await captureScreenshot(client, auditScreenshotPath);
    await assertAdminCommunicationsShowsPaymentNotification(
      client,
      targets,
      paid.queueItem.id,
      {
        typeLabel: "Payment received",
        title: "Payment marked paid",
      },
    );
    await captureScreenshot(client, communicationsScreenshotPath);

    return {
      ok: true,
      campaignId: targets.campaignId,
      memberId: member.id,
      overdueAuditId: overdue.audit.id,
      overdueNotificationId: overdue.notification.id,
      overdueQueueId: overdue.queueItem.id,
      paidAuditId: paid.audit.id,
      paidNotificationId: paid.notification.id,
      paidQueueId: paid.queueItem.id,
      screenshotPath,
      auditScreenshotPath,
      communicationsScreenshotPath,
      creatorNotificationsScreenshotPath,
      devServerStarted: Boolean(devServer),
    };
  } finally {
    if (client) client.close();
    await stopChrome(chrome);
    await updateMemberPaymentStatus(admin, member.id, originalStatus).catch(
      () => {},
    );
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
  runCreatorPaymentStatusSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
