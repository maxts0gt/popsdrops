#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  captureScreenshot,
  createAdminClient,
  ensureSmokeDataDevUser,
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

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/privacy-controls-smoke.png";
const SMOKE_REASON = "Smoke denial reason visible to the account owner.";
const EXPIRED_EXPORT_ID = "00000000-0000-4000-8000-000000000777";

function buildPrivacyControlsTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    loginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    settingsUrl: `${normalizedBaseUrl}/b/settings`,
  };
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function cleanupStalePrivacySmokeRows(admin, profileId) {
  await checkedQuery(
    "Clean stale privacy controls smoke rows",
    admin
      .from("data_rights_requests")
      .delete()
      .eq("profile_id", profileId)
      .in("details", [
        "smoke privacy controls expired export",
        "smoke privacy controls denied request",
        "smoke privacy controls scheduled request",
      ]),
  );
}

async function seedPrivacyRequests(admin, profileId) {
  const now = new Date();
  const rows = [
    {
      id: EXPIRED_EXPORT_ID,
      profile_id: profileId,
      email: "brand@dev.popsdrops.com",
      request_type: "export",
      status: "completed",
      details: "smoke privacy controls expired export",
      retention_note: "Expired smoke export should not expose a download action.",
      completed_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      processed_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      export_storage_bucket: "privacy-exports",
      export_storage_path: `${profileId}/${EXPIRED_EXPORT_ID}/expired-smoke-export.json`,
      export_file_name: "expired-smoke-export.json",
      export_mime_type: "application/json",
      export_expires_at: new Date(
        now.getTime() - 2 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    },
    {
      id: randomUUID(),
      profile_id: profileId,
      email: "brand@dev.popsdrops.com",
      request_type: "export",
      status: "rejected",
      details: "smoke privacy controls denied request",
      retention_note: `Export cannot be completed for this smoke case. Admin denial reason: ${SMOKE_REASON}`,
      reviewed_at: now.toISOString(),
      processed_at: now.toISOString(),
      export_storage_bucket: "privacy-exports",
    },
    {
      id: randomUUID(),
      profile_id: profileId,
      email: "brand@dev.popsdrops.com",
      request_type: "deletion",
      status: "scheduled",
      details: "smoke privacy controls scheduled request",
      retention_note:
        "Deletion is scheduled automatically for this smoke case.",
      scheduled_for: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      verification_due_at: new Date(
        now.getTime() + 10 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      export_storage_bucket: "privacy-exports",
    },
  ];

  await checkedQuery(
    "Seed privacy request history",
    admin.from("data_rights_requests").insert(rows),
  );

  return rows.map((row) => row.id);
}

async function readRequestIds(admin, profileId) {
  const rows = await checkedQuery(
    "Read privacy request ids",
    admin
      .from("data_rights_requests")
      .select("id")
      .eq("profile_id", profileId),
  );

  return new Set((rows ?? []).map((row) => row.id));
}

async function waitForNewRequestIds(admin, profileId, beforeIds) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30000) {
    const afterIds = await readRequestIds(admin, profileId);
    const createdIds = Array.from(afterIds).filter((id) => !beforeIds.has(id));
    if (createdIds.length > 0) return createdIds;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return [];
}

async function cleanupPrivacyRequests(admin, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  await checkedQuery(
    "Clean privacy request smoke rows",
    admin.from("data_rights_requests").delete().in("id", uniqueIds),
  );
}

async function cleanupNotificationQueue(admin, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  await checkedQuery(
    "Clean privacy export notification queue smoke rows",
    admin.from("notification_queue").delete().in("id", uniqueIds),
  );
}

async function cleanupPrivacyExportArtifacts(admin, paths) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;

  const { error } = await admin.storage
    .from("privacy-exports")
    .remove(uniquePaths);

  if (error) throw new Error(`Clean privacy export artifacts: ${error.message}`);
}

async function waitForCompletedExport(admin, requestId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 45000) {
    const row = await checkedQuery(
      "Read completed privacy export",
      admin
        .from("data_rights_requests")
        .select(
          "id, status, export_storage_bucket, export_storage_path, export_file_name, export_expires_at, processing_error",
        )
        .eq("id", requestId)
        .single(),
    );

    if (row.status === "completed" && row.export_storage_path) return row;
    if (row.status === "failed") {
      throw new Error(row.processing_error ?? "Privacy export failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error("Privacy export did not complete.");
}

async function readPrivacyExportArtifact(admin, exportRow, profileId) {
  const { data, error } = await admin.storage
    .from(exportRow.export_storage_bucket ?? "privacy-exports")
    .download(exportRow.export_storage_path);

  if (error) throw new Error(`Download privacy export artifact: ${error.message}`);

  const payload = JSON.parse(await data.text());
  if (payload.profile_id !== profileId) {
    throw new Error("Privacy export artifact profile did not match smoke user.");
  }
  if (payload.format !== "popsdrops.privacy_export.v1") {
    throw new Error("Privacy export artifact format was not recognized.");
  }

  return payload;
}

async function readDataExportReadyEmail(admin, requestId) {
  const rows = await checkedQuery(
    "Read data export ready notification",
    admin
      .from("notification_queue")
      .select("id, email, template, priority, data")
      .eq("template", "data_export_ready")
      .eq("priority", "immediate"),
  );

  const row = (rows ?? []).find(
    (item) => item.data?.data?.request_id === requestId,
  );

  if (!row) {
    throw new Error("Data export ready email was not queued.");
  }

  return row;
}

async function clickExportRequest(client) {
  await evaluate(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="privacy-export-request"]');
      if (!button) throw new Error("Missing privacy export request button.");
      button.scrollIntoView({ block: "center" });
      button.click();
      return true;
    })()`,
  );
}

async function waitForChromeExit(chrome, timeoutMs = 1000) {
  if (!chrome || chrome.exitCode !== null || chrome.signalCode !== null) {
    return;
  }

  await Promise.race([
    new Promise((resolve) => {
      chrome.once("exit", resolve);
      chrome.once("error", resolve);
    }),
    sleep(timeoutMs),
  ]);
}

async function cleanupBrowserUserDataDir(chrome, tmpDir) {
  if (chrome?.exitCode === null && chrome?.signalCode === null) {
    chrome.kill();
  }

  await waitForChromeExit(chrome);
  await rm(tmpDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 250,
  });
}

async function run() {
  await loadLocalEnv();

  const targets = buildPrivacyControlsTargets();
  const admin = createAdminClient();
  const brandProfileId = await ensureSmokeDataDevUser(admin, "brand");
  await cleanupStalePrivacySmokeRows(admin, brandProfileId);
  const seededIds = await seedPrivacyRequests(admin, brandProfileId);
  const beforeIds = await readRequestIds(admin, brandProfileId);

  const tmpDir = await mkdtemp(path.join(tmpdir(), "popsdrops-privacy-"));
  const debugPort = await findFreePort();
  const devServer = await ensureDevServer(targets.baseUrl);
  const chrome = await launchChrome({ debugPort, userDataDir: tmpDir });
  const client = await createCdpPage(debugPort);
  const cleanupIds = new Set(seededIds);
  const cleanupArtifactPaths = new Set();
  const cleanupNotificationIds = new Set();

  try {
    await loginForSmoke(client, {
      loginUrl: targets.loginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b`,
      description: "brand login for privacy controls smoke",
    });

    await navigate(client, targets.settingsUrl);
    await waitForExpression(
      client,
      `Boolean(document.querySelector('[data-testid="privacy-request-history"]'))`,
      "privacy request history",
      60000,
    );

    await evaluate(
      client,
      `(() => {
        const history = document.querySelector('[data-testid="privacy-request-history"]');
        history?.scrollIntoView({ block: "center" });
        return true;
      })()`,
    );

    await waitForExpression(
      client,
      `document.body.innerText.includes("Denied") && document.body.innerText.includes(${JSON.stringify(SMOKE_REASON)})`,
      "denied request reason visible to user",
      60000,
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("Scheduled")`,
      "scheduled deletion status visible to user",
      60000,
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("Expired")`,
      "expired export visible without download-first affordance",
      60000,
    );

    await clickExportRequest(client);

    await waitForExpression(
      client,
      `document.body.innerText.includes("Completed") && Boolean(document.querySelector('[data-testid="privacy-export-download"]'))`,
      "new export request completed with download action",
      60000,
    );

    const createdIds = await waitForNewRequestIds(
      admin,
      brandProfileId,
      beforeIds,
    );
    for (const id of createdIds) cleanupIds.add(id);

    if (createdIds.length === 0) {
      throw new Error("Export request did not create a new privacy request row.");
    }

    const exportRow = await waitForCompletedExport(admin, createdIds[0]);
    cleanupArtifactPaths.add(exportRow.export_storage_path);
    const artifact = await readPrivacyExportArtifact(
      admin,
      exportRow,
      brandProfileId,
    );
    const exportReadyEmail = await readDataExportReadyEmail(admin, createdIds[0]);
    cleanupNotificationIds.add(exportReadyEmail.id);

    await waitForExpression(
      client,
      `document.querySelector('[data-testid="privacy-export-request"]')?.disabled === false`,
      "export request action to settle",
      60000,
    );
    await evaluate(
      client,
      `(() => {
        const history = document.querySelector('[data-testid="privacy-request-history"]');
        history?.scrollIntoView({ block: "start" });
        window.scrollBy(0, 120);
        return true;
      })()`,
    );

    await captureScreenshot(
      client,
      process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          screenshot:
            process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
          seededRows: seededIds.length,
          newRows: createdIds.length,
          exportStatus: exportRow.status,
          exportFile: exportRow.export_file_name,
          exportSections: Object.keys(artifact).length,
          exportReadyEmail: exportReadyEmail.template,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanupNotificationQueue(admin, Array.from(cleanupNotificationIds));
    await cleanupPrivacyExportArtifacts(admin, Array.from(cleanupArtifactPaths));
    await cleanupPrivacyRequests(admin, Array.from(cleanupIds));
    try {
      await cleanupBrowserUserDataDir(chrome, tmpDir);
    } finally {
      await stopDevServer(devServer);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
