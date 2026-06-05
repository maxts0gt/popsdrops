#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { captureScreenshot, createAdminClient, loadLocalEnv } from "./smoke-application-flow.mjs";
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
  "output/playwright/admin-settings-governance-smoke.png";
const SMOKE_SOURCE = "smoke-admin-settings-governance";
const SMOKE_CREATOR_EMAIL = "creator@dev.popsdrops.com";
const SMOKE_ACTIONS = [
  "updatePlatformSetting",
  "updateDataRightsRequestStatus",
];
const RULE_SETTING_KEYS = [
  "enabled_markets",
  "creator_min_followers",
  "max_revisions_per_submission",
  "sla_approval_hours",
  "auto_approve_creators",
];

function buildAdminSettingsGovernanceTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    adminLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=admin`,
    adminSettingsUrl: `${normalizedBaseUrl}/admin/settings`,
    baseUrl: normalizedBaseUrl,
  };
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function ensureSmokeProfile(admin) {
  const existing = await checkedQuery(
    "Find settings smoke creator profile",
    admin
      .from("profiles")
      .select("id, email, full_name, role, status")
      .eq("email", SMOKE_CREATOR_EMAIL)
      .maybeSingle(),
  );

  if (existing) return existing;

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) {
    throw new Error(`List auth users: ${listed.error.message}`);
  }

  let authUser = listed.data.users.find(
    (user) => user.email?.toLowerCase() === SMOKE_CREATOR_EMAIL,
  );

  if (!authUser) {
    const created = await admin.auth.admin.createUser({
      email: SMOKE_CREATOR_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: "Dev Creator" },
    });

    if (created.error) {
      throw new Error(`Create settings smoke auth user: ${created.error.message}`);
    }

    authUser = created.data.user;
  }

  await checkedQuery(
    "Create settings smoke profile",
    admin.from("profiles").upsert(
      {
        id: authUser.id,
        email: SMOKE_CREATOR_EMAIL,
        full_name: "Dev Creator",
        onboarding_completed: true,
        role: "creator",
        status: "approved",
      },
      { onConflict: "id" },
    ),
  );

  return {
    id: authUser.id,
    email: SMOKE_CREATOR_EMAIL,
    full_name: "Dev Creator",
    role: "creator",
    status: "approved",
  };
}

async function readSettings(admin, keys) {
  const rows = await checkedQuery(
    "Read platform settings",
    admin.from("platform_settings").select("key, value").in("key", keys),
  );

  return new Map(rows.map((row) => [row.key, row.value]));
}

async function seedRules(admin, values) {
  const now = new Date().toISOString();
  await checkedQuery(
    "Seed platform rule settings",
    admin.from("platform_settings").upsert(
      Object.entries(values).map(([key, value]) => ({
        key,
        value,
        updated_at: now,
      })),
      { onConflict: "key" },
    ),
  );
}

async function restoreSettings(admin, previousSettings) {
  for (const key of RULE_SETTING_KEYS) {
    if (previousSettings.has(key)) {
      await checkedQuery(
        `Restore setting ${key}`,
        admin.from("platform_settings").upsert(
          {
            key,
            value: previousSettings.get(key),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        ),
      );
    } else {
      await checkedQuery(
        `Delete smoke setting ${key}`,
        admin.from("platform_settings").delete().eq("key", key),
      );
    }
  }
}

async function setupPrivacyFixtures(admin) {
  const profile = await ensureSmokeProfile(admin);
  const selfServeRequestId = randomUUID();
  const resolveExceptionRequestId = randomUUID();
  const denyExceptionRequestId = randomUUID();
  const smokeId = `pd_admin_settings_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  await checkedQuery(
    "Create privacy smoke requests",
    admin.from("data_rights_requests").insert([
      {
        id: selfServeRequestId,
        profile_id: profile.id,
        email: SMOKE_CREATOR_EMAIL,
        request_type: "export",
        status: "pending",
        details: `${SMOKE_SOURCE} ${smokeId} self-serve`,
        retention_note: "Smoke request should remain in the self-serve queue.",
        created_at: createdAt,
      },
      {
        id: resolveExceptionRequestId,
        profile_id: profile.id,
        email: SMOKE_CREATOR_EMAIL,
        request_type: "export",
        status: "failed",
        details: `${SMOKE_SOURCE} ${smokeId} resolve exception`,
        retention_note: "Smoke exception for admin settings governance resolve.",
        processing_error: "Smoke exception needs admin review.",
        created_at: createdAt,
      },
      {
        id: denyExceptionRequestId,
        profile_id: profile.id,
        email: SMOKE_CREATOR_EMAIL,
        request_type: "export",
        status: "reviewing",
        details: `${SMOKE_SOURCE} ${smokeId} deny exception`,
        retention_note: "Smoke exception for admin settings governance denial.",
        created_at: createdAt,
      },
    ]),
  );

  return {
    profile,
    selfServeRequestId,
    resolveExceptionRequestId,
    denyExceptionRequestId,
    smokeId,
  };
}

async function cleanupSmokeData(admin, { requestIds, auditStartedAt, previousSettings }) {
  if (requestIds?.length) {
    for (const requestId of requestIds) {
      await checkedQuery(
        `Delete privacy denial queue ${requestId}`,
        admin
          .from("notification_queue")
          .delete()
          .eq("template", "privacy_request_denied")
          .contains("data", { data: { request_id: requestId } }),
      );
    }
    await checkedQuery(
      "Delete privacy smoke audits",
      admin.from("admin_audit_log").delete().in("target_id", requestIds),
    );
    await checkedQuery(
      "Delete privacy smoke requests",
      admin.from("data_rights_requests").delete().in("id", requestIds),
    );
  }

  if (auditStartedAt) {
    await checkedQuery(
      "Delete settings smoke audits",
      admin
        .from("admin_audit_log")
        .delete()
        .eq("target_type", "platform_setting")
        .eq("action", "update_setting")
        .gte("created_at", auditStartedAt),
    );
  }

  if (previousSettings) {
    await restoreSettings(admin, previousSettings);
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

async function assertSelfServePrivacyRow(client, requestId) {
  await evaluate(
    client,
    `(() => {
      const row = document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${requestId}"]`,
      )});
      if (!row) throw new Error("Missing self-serve privacy smoke row");
      const rowText = row.innerText;
      if (!rowText.includes("Self-serve queue")) {
        throw new Error("Self-serve privacy row should show queue status");
      }
      const buttons = [...row.querySelectorAll("button")].map((node) => node.textContent.trim());
      if (buttons.length > 0) {
        throw new Error(\`Self-serve privacy row exposed admin action: \${buttons.join(", ")}\`);
      }
      return true;
    })()`,
  );
}

async function clickPrivacyExceptionResolve(client, requestId) {
  await evaluate(
    client,
    `(() => {
      const row = document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${requestId}"]`,
      )});
      if (!row) throw new Error("Missing privacy exception smoke row");
      const rowText = row.innerText;
      if (!rowText.includes("Review exception")) {
        throw new Error("Privacy exception row should be labeled Review exception");
      }
      const buttonLabels = [...row.querySelectorAll("button")].map((node) => node.textContent.trim());
      const allowedLabels = ["Deny with reason", "Mark resolved"];
      const unexpected = buttonLabels.filter((label) => !allowedLabels.includes(label));
      if (unexpected.length > 0) {
        throw new Error(\`Privacy exception row exposed unexpected action: \${unexpected.join(", ")}\`);
      }
      if (!buttonLabels.includes("Deny with reason")) {
        throw new Error("Privacy exception row is missing Deny with reason action");
      }
      const button = [...row.querySelectorAll("button")]
        .find((node) => node.textContent.trim() === "Mark resolved");
      if (!button) throw new Error("Missing Mark resolved action");
      button.click();
      return true;
    })()`,
  );
}

async function clickPrivacyExceptionDeny(client, requestId, reason) {
  await evaluate(
    client,
    `(() => {
      const row = document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${requestId}"]`,
      )});
      if (!row) throw new Error("Missing privacy denial smoke row");
      if (!row.innerText.includes("Review exception")) {
        throw new Error("Privacy denial row should be labeled Review exception");
      }

      const openButton = [...row.querySelectorAll("button")]
        .find((node) => node.textContent.trim() === "Deny with reason");
      if (!openButton) throw new Error("Missing Deny with reason action");
      openButton.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `Boolean(document.querySelector(${JSON.stringify(
      `[data-testid="admin-data-rights-row-${requestId}"]`,
    )})?.querySelector('[data-testid="admin-data-rights-deny-reason"]'))`,
    "privacy denial reason field",
  );

  await evaluate(
    client,
    `(() => {
      const row = document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${requestId}"]`,
      )});
      if (!row) throw new Error("Missing privacy denial smoke row after opening");

      const reasonInput = row.querySelector('[data-testid="admin-data-rights-deny-reason"]');
      if (!reasonInput) throw new Error("Missing denial reason field");
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set;
      setter.call(reasonInput, ${JSON.stringify(reason)});
      reasonInput.dispatchEvent(new Event("input", { bubbles: true }));
      reasonInput.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `(() => {
      const row = document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${requestId}"]`,
      )});
      const confirmButton = [...(row?.querySelectorAll("button") ?? [])]
        .find((node) => node.textContent.trim() === "Confirm denial");
      return Boolean(confirmButton && !confirmButton.disabled);
    })()`,
    "enabled privacy denial confirmation",
  );

  await evaluate(
    client,
    `(() => {
      const row = document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${requestId}"]`,
      )});
      if (!row) throw new Error("Missing privacy denial smoke row before confirming");
      const confirmButton = [...row.querySelectorAll("button")]
        .find((node) => node.textContent.trim() === "Confirm denial");
      if (!confirmButton) throw new Error("Missing Confirm denial action");
      if (confirmButton.disabled) {
        throw new Error("Confirm denial should be enabled after reason input");
      }
      confirmButton.click();
      return true;
    })()`,
  );
}

async function updatePlatformRulesInUi(client, minFollowers) {
  await evaluate(
    client,
    `(() => {
      const setInputValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(input, String(value));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      setInputValue(document.querySelector("#minFollowers"), ${minFollowers});
      setInputValue(document.querySelector("#maxRevisions"), 4);
      setInputValue(document.querySelector("#slaHours"), 36);

      const autoApproveLabel = [...document.querySelectorAll("label")]
        .find((node) => node.textContent.includes("Auto-approve new creator accounts"));
      const autoApprove = autoApproveLabel?.querySelector('input[type="checkbox"]');
      if (!autoApprove) throw new Error("Missing auto-approve setting");
      if (!autoApprove.checked) autoApprove.click();

      const buttons = [...document.querySelectorAll("button")];
      const saveRules = buttons.find((node) =>
        node.textContent.includes("Save Rules"),
      );
      if (!saveRules) throw new Error("Missing Save Rules button");
      saveRules.click();
      return true;
    })()`,
  );
}

async function updateEnabledMarketsInUi(client) {
  await evaluate(
    client,
    `(() => {
      const picker = document.querySelector('[data-testid="admin-settings-market-picker"]');
      if (!picker) throw new Error("Missing admin settings market picker");
      const trigger = [...picker.querySelectorAll("button")]
        .find((node) =>
          node.textContent.includes("Select enabled markets") ||
          node.textContent.includes("selected"),
        );
      if (!trigger) throw new Error("Missing enabled markets picker trigger");
      trigger.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="admin-settings-market-picker"] [data-testid="market-scope-list"]'))`,
    "admin settings market scope list",
  );

  await evaluate(
    client,
    `(() => {
      const picker = document.querySelector('[data-testid="admin-settings-market-picker"]');
      if (!picker) throw new Error("Missing admin settings market picker after opening");
      const globalButton = [...picker.querySelectorAll('[data-testid="market-scope-list"] button')]
        .find((node) => node.textContent.trim() === "Global");
      if (!globalButton) throw new Error("Missing Global market scope option");
      globalButton.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `document.querySelector('[data-testid="admin-settings-market-picker"] [data-testid="selected-markets-list"]')?.innerText.includes("Global")`,
    "admin settings selected global market",
  );

  await evaluate(
    client,
    `(() => {
      const saveButton = [...document.querySelectorAll("button")]
        .find((node) => node.textContent.includes("Save enabled markets"));
      if (!saveButton) throw new Error("Missing Save enabled markets button");
      saveButton.click();
      return true;
    })()`,
  );
}

function settingValueMatches(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

async function waitForSettingValue(admin, key, expectedValue) {
  const startedAt = Date.now();
  let lastValue;

  while (Date.now() - startedAt < 15000) {
    const row = await checkedQuery(
      `Read setting ${key}`,
      admin.from("platform_settings").select("value").eq("key", key).maybeSingle(),
    );
    lastValue = row?.value;
    if (settingValueMatches(lastValue, expectedValue)) return row;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(
    `Expected ${key} to be ${expectedValue}. Last value: ${JSON.stringify(lastValue)}`,
  );
}

async function waitForDataRightsStatus(admin, requestId, expectedStatus) {
  const startedAt = Date.now();
  let lastStatus;

  while (Date.now() - startedAt < 15000) {
    const row = await checkedQuery(
      "Read data-rights request status",
      admin
        .from("data_rights_requests")
        .select("status, reviewed_at, reviewed_by, retention_note")
        .eq("id", requestId)
        .single(),
    );
    lastStatus = row.status;
    if (lastStatus === expectedStatus && row.reviewed_at && row.reviewed_by) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(
    `Expected data-rights status ${expectedStatus}. Last status: ${lastStatus}`,
  );
}

async function validateAuditRows(
  admin,
  { resolveRequestId, denyRequestId, denialReason, auditStartedAt, minFollowers },
) {
  const [resolvedAuditRows, deniedAuditRows, settingAuditRows] = await Promise.all([
    checkedQuery(
      "Read resolved data-rights smoke audit",
      admin
        .from("admin_audit_log")
        .select("id, action, target_id, metadata")
        .eq("target_id", resolveRequestId)
        .eq("action", "update_data_rights_request_status"),
    ),
    checkedQuery(
      "Read denied data-rights smoke audit",
      admin
        .from("admin_audit_log")
        .select("id, action, target_id, metadata")
        .eq("target_id", denyRequestId)
        .eq("action", "update_data_rights_request_status"),
    ),
    checkedQuery(
      "Read settings smoke audit",
      admin
        .from("admin_audit_log")
        .select("id, action, target_id, metadata, created_at")
        .eq("target_type", "platform_setting")
        .eq("action", "update_setting")
        .contains("metadata", {
          key: "creator_min_followers",
          value: minFollowers,
        })
        .gte("created_at", auditStartedAt),
    ),
  ]);

  if (!resolvedAuditRows.some((row) => row.metadata?.new_status === "completed")) {
    throw new Error("Expected privacy request audit row for resolved exception.");
  }

  if (
    !deniedAuditRows.some(
      (row) =>
        row.metadata?.new_status === "rejected" &&
        row.metadata?.reason === denialReason,
    )
  ) {
    throw new Error("Expected privacy request audit row with denial reason.");
  }

  if (!settingAuditRows.some((row) => row.metadata?.value === minFollowers)) {
    throw new Error("Expected settings audit row for creator_min_followers.");
  }

  return {
    resolvedDataRightsAuditId: resolvedAuditRows[0]?.id ?? null,
    deniedDataRightsAuditId: deniedAuditRows[0]?.id ?? null,
    settingAuditId: settingAuditRows[0]?.id ?? null,
  };
}

async function validatePrivacyDenialEmail(admin, { denyRequestId, denialReason }) {
  const rows = await checkedQuery(
    "Read privacy denial notification queue",
    admin
      .from("notification_queue")
      .select("id, email, template, data, status")
      .eq("email", SMOKE_CREATOR_EMAIL)
      .eq("template", "privacy_request_denied")
      .order("created_at", { ascending: false })
      .limit(10),
  );

  const row = rows.find(
    (item) =>
      item.data?.data?.request_id === denyRequestId &&
      item.data?.data?.reason === denialReason,
  );

  if (!row) {
    throw new Error("Expected privacy denial email queue row with the reason.");
  }

  return {
    privacyDenialQueueId: row.id,
    privacyDenialQueueStatus: row.status,
  };
}

function validateAdminSettingsGovernanceSmoke({
  bodyText,
  consoleErrors,
  selfServeRowVisible,
  exceptionRowVisible,
  exceptionStatus,
  deniedExceptionStatus,
  minFollowersValue,
  screenshotPath,
}) {
  const requiredText = [
    "Platform Settings",
    "Privacy Requests",
    "Export and deletion requests stay automatic when possible.",
    "Self-serve queue",
    "Review exception",
    "Mark resolved",
    "Deny with reason",
    "Platform Rules",
    "Enabled Markets",
    "Save enabled markets",
    "Min Followers for Visibility",
    "Save Rules",
  ];

  for (const text of requiredText) {
    if (!bodyText.includes(text)) {
      throw new Error(`Missing admin settings proof: ${text}`);
    }
  }

  if (!selfServeRowVisible) {
    throw new Error("Expected self-serve privacy smoke row to be visible.");
  }

  if (!exceptionRowVisible) {
    throw new Error("Expected highlighted privacy exception smoke row to be visible.");
  }

  if (exceptionStatus !== "completed") {
    throw new Error(`Expected privacy exception to be resolved. Got: ${exceptionStatus}`);
  }

  if (deniedExceptionStatus !== "rejected") {
    throw new Error(`Expected privacy denial exception to be rejected. Got: ${deniedExceptionStatus}`);
  }

  if (minFollowersValue < 1000) {
    throw new Error(`Expected creator_min_followers smoke value. Got: ${minFollowersValue}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true, screenshotPath };
}

async function runAdminSettingsGovernanceSmoke() {
  await loadLocalEnv();

  const targets = buildAdminSettingsGovernanceTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  const previousSettings = await readSettings(admin, RULE_SETTING_KEYS);
  const minFollowers = 1200 + Math.floor(Math.random() * 300);
  const auditStartedAt = new Date(Date.now() - 1000).toISOString();
  const denialReason =
    "Identity verification did not match the account owner for this smoke request.";
  let fixture = null;
  let devServer = null;
  let chrome = null;
  let client = null;
  const consoleErrors = [];

  try {
    await seedRules(admin, {
      enabled_markets: ["us"],
      creator_min_followers: 700,
      max_revisions_per_submission: 2,
      sla_approval_hours: 24,
      auto_approve_creators: false,
    });
    fixture = await setupPrivacyFixtures(admin);

    devServer = await ensureDevServer(targets.baseUrl);
    const debugPort = await findFreePort();
    const userDataDir = await mkdtemp(path.join(tmpdir(), "popsdrops-admin-settings-"));
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
      description: "admin dev login redirect",
    });

    await navigate(
      client,
      `${targets.adminSettingsUrl}?data_rights=${fixture.resolveExceptionRequestId}`,
    );
    await waitForExpression(
      client,
      'document.body.innerText.includes("Platform Settings")',
      "admin settings shell",
    );
    await waitForExpression(
      client,
      `Boolean(document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${fixture.resolveExceptionRequestId}"]`,
      )}))`,
      "highlighted privacy request",
    );

    const bodyText = await evaluate(client, "document.body.innerText");
    await assertSelfServePrivacyRow(client, fixture.selfServeRequestId);
    await clickPrivacyExceptionResolve(client, fixture.resolveExceptionRequestId);
    const resolvedExceptionRow = await waitForDataRightsStatus(
      admin,
      fixture.resolveExceptionRequestId,
      "completed",
    );
    await waitForExpression(
      client,
      `document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${fixture.resolveExceptionRequestId}"]`,
      )})?.innerText.includes("Completed")`,
      "privacy exception resolved label",
    );
    await clickPrivacyExceptionDeny(
      client,
      fixture.denyExceptionRequestId,
      denialReason,
    );
    const deniedExceptionRow = await waitForDataRightsStatus(
      admin,
      fixture.denyExceptionRequestId,
      "rejected",
    );
    if (!deniedExceptionRow.retention_note?.includes(denialReason)) {
      throw new Error("Expected denied request to keep the denial reason.");
    }
    await waitForExpression(
      client,
      `document.querySelector(${JSON.stringify(
        `[data-testid="admin-data-rights-row-${fixture.denyExceptionRequestId}"]`,
      )})?.innerText.includes("Denied")`,
      "privacy exception denied label",
    );

    await updateEnabledMarketsInUi(client);
    await waitForSettingValue(admin, "enabled_markets", ["global"]);

    await updatePlatformRulesInUi(client, minFollowers);
    await waitForSettingValue(admin, "creator_min_followers", minFollowers);
    await waitForSettingValue(admin, "max_revisions_per_submission", 4);
    await waitForSettingValue(admin, "sla_approval_hours", 36);
    await waitForSettingValue(admin, "auto_approve_creators", true);

    const auditEvidence = await validateAuditRows(admin, {
      auditStartedAt,
      denialReason,
      denyRequestId: fixture.denyExceptionRequestId,
      minFollowers,
      resolveRequestId: fixture.resolveExceptionRequestId,
    });
    const emailEvidence = await validatePrivacyDenialEmail(admin, {
      denialReason,
      denyRequestId: fixture.denyExceptionRequestId,
    });

    await captureScreenshot(client, screenshotPath);

    const result = validateAdminSettingsGovernanceSmoke({
      bodyText,
      consoleErrors,
      selfServeRowVisible: true,
      exceptionRowVisible: true,
      exceptionStatus: resolvedExceptionRow.status,
      deniedExceptionStatus: deniedExceptionRow.status,
      minFollowersValue: minFollowers,
      screenshotPath,
    });

    console.log(
      JSON.stringify(
        {
          ...result,
          actions: SMOKE_ACTIONS,
          auditEvidence,
          emailEvidence,
          baseUrl: targets.baseUrl,
          privacyDeniedExceptionRequestId: fixture.denyExceptionRequestId,
          privacyResolvedExceptionRequestId: fixture.resolveExceptionRequestId,
          privacySelfServeRequestId: fixture.selfServeRequestId,
          enabledMarkets: ["global"],
          minFollowers,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanupSmokeData(admin, {
      auditStartedAt,
      previousSettings,
      requestIds: fixture
        ? [
            fixture.selfServeRequestId,
            fixture.resolveExceptionRequestId,
            fixture.denyExceptionRequestId,
          ]
        : [],
    }).catch((error) => {
      console.error(`Cleanup failed: ${error.message}`);
    });
    await stopChrome(chrome);
    if (client) client.close();
    await stopDevServer(devServer);
    if (chrome?.spawnargs) {
      const userDataDir = chrome.spawnargs.find((arg) =>
        arg.startsWith("--user-data-dir="),
      )?.slice("--user-data-dir=".length);
      if (userDataDir) {
        await rm(userDataDir, { force: true, recursive: true }).catch(() => {});
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAdminSettingsGovernanceSmoke().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  buildAdminSettingsGovernanceTargets,
  validateAdminSettingsGovernanceSmoke,
};
