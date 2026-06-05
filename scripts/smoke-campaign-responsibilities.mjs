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
  createAdminClient,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_CAMPAIGN_ID = "d0000000-0000-4000-8000-000000000001";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/campaign-responsibilities-smoke.png";
const DEFAULT_LIST_SCREENSHOT_PATH =
  "output/playwright/campaign-responsibility-list-smoke.png";
const DEFAULT_MY_WORK_SCREENSHOT_PATH =
  "output/playwright/campaign-responsibility-my-work-smoke.png";
const DEFAULT_NEEDS_OWNER_SCREENSHOT_PATH =
  "output/playwright/campaign-responsibility-needs-owner-smoke.png";
const DEFAULT_CONTENT_OWNER_SCREENSHOT_PATH =
  "output/playwright/campaign-responsibility-content-owner-smoke.png";
const DEFAULT_REPORTING_OWNER_SCREENSHOT_PATH =
  "output/playwright/campaign-responsibility-reporting-owner-smoke.png";

export function buildCampaignResponsibilitiesSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_CAMPAIGN_RESPONSIBILITY_CAMPAIGN_ID || DEFAULT_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    campaignsUrl: `${normalizedBaseUrl}/b/campaigns`,
    campaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    managerLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand&teamRole=manager`,
  };
}

export function validateCampaignResponsibilitySmoke({
  assignment,
  approvalsAssignment,
  auditEntry,
  contentFilterText,
  contentOwnerText,
  listText,
  myWorkText,
  ownerlessText,
  panelText,
  reportingFilterText,
  reportingOwnerText,
  selectedAssigneeText,
  selectedApprovalsText,
  consoleErrors,
}) {
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  const requiredPanelText = [
    "Campaign responsibilities",
    "Owner",
    "Approvals",
    "Reporting",
    "Billing",
    "Access stays role-based.",
  ];
  for (const text of requiredPanelText) {
    if (!panelText.includes(text)) {
      throw new Error(`Missing responsibility panel text: ${text}`);
    }
  }

  if (assignment?.responsibility !== "reporting") {
    throw new Error("Expected reporting responsibility assignment to persist.");
  }

  if (approvalsAssignment?.responsibility !== "approvals") {
    throw new Error("Expected approvals responsibility assignment to persist.");
  }

  if (!auditEntry || auditEntry.action !== "campaign_responsibility_updated") {
    throw new Error("Expected campaign responsibility change in audit trail.");
  }

  if (!selectedAssigneeText.includes("Dev Brand Manager")) {
    throw new Error(
      `Expected visible reporting assignee to be Dev Brand Manager. Got: ${selectedAssigneeText}`,
    );
  }

  if (!selectedApprovalsText.includes("Dev Brand Manager")) {
    throw new Error(
      `Expected visible approvals assignee to be Dev Brand Manager. Got: ${selectedApprovalsText}`,
    );
  }

  const requiredContentOwnerText = ["Owner", "Approvals", "Dev Brand Manager"];
  for (const text of requiredContentOwnerText) {
    if (!contentOwnerText.includes(text)) {
      throw new Error(`Missing content workstream owner text: ${text}`);
    }
  }

  const requiredReportingOwnerText = ["Owner", "Reporting", "Dev Brand Manager"];
  for (const text of requiredReportingOwnerText) {
    if (!reportingOwnerText.includes(text)) {
      throw new Error(`Missing reporting workstream owner text: ${text}`);
    }
  }

  const requiredContentFilterText = ["All", "My work", "Needs review", "Corrections"];
  for (const text of requiredContentFilterText) {
    if (!contentFilterText.includes(text)) {
      throw new Error(`Missing content queue filter text: ${text}`);
    }
  }

  const requiredReportingFilterText = [
    "All",
    "My work",
    "Needs review",
    "Corrections",
    "Missed",
  ];
  for (const text of requiredReportingFilterText) {
    if (!reportingFilterText.includes(text)) {
      throw new Error(`Missing reporting queue filter text: ${text}`);
    }
  }

  const requiredListText = ["Owners", "Reporting", "Dev Brand Manager"];
  for (const text of requiredListText) {
    if (!listText.includes(text)) {
      throw new Error(`Missing campaign list responsibility text: ${text}`);
    }
  }

  const requiredMyWorkText = ["My work", "Chrome Launch Smoke Campaign", "Dev Brand Manager"];
  for (const text of requiredMyWorkText) {
    if (!myWorkText.includes(text)) {
      throw new Error(`Missing My work filter proof: ${text}`);
    }
  }

  if (ownerlessText.includes("Chrome Launch Smoke Campaign")) {
    throw new Error("Expected assigned smoke campaign to be hidden from Needs owner.");
  }

  if (!ownerlessText.includes("No owners")) {
    throw new Error("Expected Needs owner filter to show ownerless campaign rows.");
  }

  return true;
}

async function getDevManagerTeamMember(admin, campaignId) {
  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .select("id, brand_id")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaign) {
    throw new Error(`Smoke campaign not found: ${campaignError?.message ?? campaignId}`);
  }

  const { data: managerProfile, error: managerProfileError } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", "brand-manager@dev.popsdrops.com")
    .single();
  if (managerProfileError || !managerProfile) {
    throw new Error(
      `Dev brand manager was not provisioned: ${managerProfileError?.message ?? "missing profile"}`,
    );
  }

  const { data: managerMember, error: managerMemberError } = await admin
    .from("brand_team_members")
    .select("id, brand_id, user_id, role, accepted_at")
    .eq("brand_id", campaign.brand_id)
    .eq("user_id", managerProfile.id)
    .eq("role", "manager")
    .not("accepted_at", "is", null)
    .single();
  if (managerMemberError || !managerMember) {
    throw new Error(
      `Dev brand manager team row missing: ${managerMemberError?.message ?? "missing member"}`,
    );
  }

  return {
    brandId: campaign.brand_id,
    memberId: managerMember.id,
    name: managerProfile.full_name || managerProfile.email || "Dev Brand Manager",
  };
}

async function waitForAssignment(admin, { campaignId, memberId, responsibility }) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < 30000) {
    const { data, error } = await admin
      .from("campaign_responsibility_assignments")
      .select("id, campaign_id, brand_team_member_id, responsibility")
      .eq("campaign_id", campaignId)
      .eq("responsibility", responsibility)
      .maybeSingle();

    if (error) {
      lastError = error.message;
    } else if (data?.brand_team_member_id === memberId) {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Responsibility assignment did not persist: ${lastError}`);
}

async function runCampaignResponsibilitiesSmoke() {
  await loadLocalEnv();
  const targets = buildCampaignResponsibilitiesSmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
  );
  const listScreenshotPath = path.resolve(
    process.env.SMOKE_LIST_SCREENSHOT_PATH || DEFAULT_LIST_SCREENSHOT_PATH,
  );
  const myWorkScreenshotPath = path.resolve(
    process.env.SMOKE_MY_WORK_SCREENSHOT_PATH || DEFAULT_MY_WORK_SCREENSHOT_PATH,
  );
  const needsOwnerScreenshotPath = path.resolve(
    process.env.SMOKE_NEEDS_OWNER_SCREENSHOT_PATH ||
      DEFAULT_NEEDS_OWNER_SCREENSHOT_PATH,
  );
  const contentOwnerScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_OWNER_SCREENSHOT_PATH ||
      DEFAULT_CONTENT_OWNER_SCREENSHOT_PATH,
  );
  const reportingOwnerScreenshotPath = path.resolve(
    process.env.SMOKE_REPORTING_OWNER_SCREENSHOT_PATH ||
      DEFAULT_REPORTING_OWNER_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-responsibility-smoke-chrome-"),
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

    await loginForSmoke(client, {
      loginUrl: targets.managerLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b`,
      description: "brand manager responsibility login",
    });

    const manager = await getDevManagerTeamMember(admin, targets.campaignId);
    await admin
      .from("campaign_responsibility_assignments")
      .delete()
      .eq("campaign_id", targets.campaignId)
      .in("responsibility", ["approvals", "reporting"]);

    await navigate(client, targets.campaignUrl);
    await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-responsibility-panel"]\'))',
      "campaign responsibility panel",
    );

    const panelText = await evaluate(
      client,
      `document.querySelector('[data-testid="campaign-responsibility-panel"]')?.innerText || ""`,
    );

    await evaluate(
      client,
      `(() => {
        const select = document.querySelector('[data-testid="campaign-responsibility-select-reporting"]');
        if (!select) throw new Error("Missing reporting responsibility select");
        select.value = ${JSON.stringify(manager.memberId)};
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return select.value;
      })()`,
    );
    await evaluate(
      client,
      `(() => {
        const select = document.querySelector('[data-testid="campaign-responsibility-select-approvals"]');
        if (!select) throw new Error("Missing approvals responsibility select");
        select.value = ${JSON.stringify(manager.memberId)};
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return select.value;
      })()`,
    );

    const selectedAssigneeText = await waitForExpression(
      client,
      `(() => {
        const node = document.querySelector('[data-testid="campaign-responsibility-assignee-reporting"]');
        const text = node?.textContent || "";
        return text.includes("Dev Brand Manager") ? text : "";
      })()`,
      "visible reporting responsibility assignee",
      30000,
    );
    const selectedApprovalsText = await waitForExpression(
      client,
      `(() => {
        const node = document.querySelector('[data-testid="campaign-responsibility-assignee-approvals"]');
        const text = node?.textContent || "";
        return text.includes("Dev Brand Manager") ? text : "";
      })()`,
      "visible approvals responsibility assignee",
      30000,
    );

    const assignment = await waitForAssignment(admin, {
      campaignId: targets.campaignId,
      memberId: manager.memberId,
      responsibility: "reporting",
    });
    const approvalsAssignment = await waitForAssignment(admin, {
      campaignId: targets.campaignId,
      memberId: manager.memberId,
      responsibility: "approvals",
    });

    const { data: auditEntry, error: auditError } = await admin
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, metadata, created_at")
      .eq("target_type", "campaign")
      .eq("target_id", targets.campaignId)
      .eq("action", "campaign_responsibility_updated")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (auditError) throw new Error(auditError.message);

    await evaluate(
      client,
      `(() => {
        const panel = document.querySelector('[data-testid="campaign-responsibility-panel"]');
        if (!panel) throw new Error("Missing responsibility panel before screenshot");
        panel.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      })()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    await captureScreenshot(client, screenshotPath);

    await navigate(client, `${targets.campaignUrl}?tab=content`);
    const contentOwnerText = await waitForExpression(
      client,
      `(() => {
        const node = document.querySelector('[data-testid="campaign-content-approval-owner"]');
        const text = node?.textContent || "";
        return text.includes("Owner") && text.includes("Approvals") && text.includes("Dev Brand Manager")
          ? text
          : "";
      })()`,
      "content queue approvals owner chip",
      30000,
    );
    const contentFilterText = await waitForExpression(
      client,
      `(() => {
        const node = document.querySelector('[data-testid="campaign-content-queue-filters"]');
        const myWork = document.querySelector('[data-testid="campaign-content-queue-filter-my_work"]');
        const needsReview = document.querySelector('[data-testid="campaign-content-queue-filter-needs_review"]');
        const text = node?.textContent || "";
        return myWork && needsReview && text.includes("All") && text.includes("My work") && text.includes("Needs review")
          ? text
          : "";
      })()`,
      "content queue responsibility filters",
      30000,
    );
    await captureScreenshot(client, contentOwnerScreenshotPath);

    await navigate(client, `${targets.campaignUrl}?tab=reporting`);
    const reportingOwnerText = await waitForExpression(
      client,
      `(() => {
        const owner = document.querySelector('[data-testid="campaign-reporting-owner"]')?.textContent || "";
        const queueOwner = document.querySelector('[data-testid="campaign-reporting-proof-queue-owner"]')?.textContent || "";
        const text = owner + " " + queueOwner;
        return text.includes("Owner") && text.includes("Reporting") && text.includes("Dev Brand Manager")
          ? text
          : "";
      })()`,
      "reporting queue owner chips",
      30000,
    );
    const reportingFilterText = await waitForExpression(
      client,
      `(() => {
        const node = document.querySelector('[data-testid="campaign-reporting-proof-filters"]');
        const myWork = document.querySelector('[data-testid="campaign-reporting-proof-filter-my_work"]');
        const needsReview = document.querySelector('[data-testid="campaign-reporting-proof-filter-needs_review"]');
        const text = node?.textContent || "";
        return myWork && needsReview && text.includes("All") && text.includes("My work") && text.includes("Needs review") && text.includes("Missed")
          ? text
          : "";
      })()`,
      "reporting queue responsibility filters",
      30000,
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-reporting-proof-filter-needs_review"]');
        if (!button) throw new Error("Missing reporting needs-review filter");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const rows = Array.from(document.querySelectorAll('[data-testid="campaign-reporting-proof-row"]'));
        const body = document.body.innerText || "";
        return rows.length > 0 && body.includes("Needs review") ? String(rows.length) : "";
      })()`,
      "reporting needs-review filter rows",
      30000,
    );
    await evaluate(
      client,
      `(() => {
        const node = document.querySelector('[data-testid="campaign-reporting-owner"]');
        if (!node) throw new Error("Missing reporting owner before screenshot");
        node.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      })()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    await captureScreenshot(client, reportingOwnerScreenshotPath);

    await navigate(client, targets.campaignsUrl);
    await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-list-responsibilities"]\'))',
      "campaign list responsibilities",
      30000,
    );
    const listText = await waitForExpression(
      client,
      `(() => {
        const rows = Array.from(document.querySelectorAll('a[data-testid="campaign-row"]'));
        const row = rows.find((candidate) => candidate.getAttribute("href")?.includes(${JSON.stringify(targets.campaignId)}));
        const responsibilityNode = row?.querySelector('[data-testid="campaign-list-responsibilities"]');
        const reportingNode = row?.querySelector('[data-testid="campaign-list-responsibility-reporting"]');
        const text = responsibilityNode?.textContent || "";
        const reportingText = reportingNode?.textContent || "";
        return text.includes("Owners") && reportingText.includes("Reporting") && reportingText.includes("Dev Brand Manager")
          ? text
          : "";
      })()`,
      "campaign list reporting responsibility owner",
      30000,
    );
    await evaluate(
      client,
      `(() => {
        const rows = Array.from(document.querySelectorAll('a[data-testid="campaign-row"]'));
        const row = rows.find((candidate) => candidate.getAttribute("href")?.includes(${JSON.stringify(targets.campaignId)}));
        if (!row) throw new Error("Missing campaign row before list screenshot");
        row.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      })()`,
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    await captureScreenshot(client, listScreenshotPath);

    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-work-filter-mine"]');
        if (!button) throw new Error("Missing My work filter");
        button.click();
        return true;
      })()`,
    );
    const myWorkText = await waitForExpression(
      client,
      `(() => {
        const body = document.body.innerText || "";
        const rows = Array.from(document.querySelectorAll('a[data-testid="campaign-row"]'));
        const targetRow = rows.find((candidate) => candidate.getAttribute("href")?.includes(${JSON.stringify(targets.campaignId)}));
        const targetText = targetRow?.innerText || "";
        return body.includes("My work") && targetText.includes("Dev Brand Manager")
          ? body
          : "";
      })()`,
      "My work responsibility filter",
      30000,
    );
    await captureScreenshot(client, myWorkScreenshotPath);

    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-work-filter-needs-owner"]');
        if (!button) throw new Error("Missing Needs owner filter");
        button.click();
        return true;
      })()`,
    );
    const ownerlessText = await waitForExpression(
      client,
      `(() => {
        const body = document.body.innerText || "";
        const rows = Array.from(document.querySelectorAll('a[data-testid="campaign-row"]'));
        const hasTargetRow = rows.some((candidate) => candidate.getAttribute("href")?.includes(${JSON.stringify(targets.campaignId)}));
        return !hasTargetRow && body.includes("No owners") ? body : "";
      })()`,
      "Needs owner responsibility filter",
      30000,
    );
    await captureScreenshot(client, needsOwnerScreenshotPath);

    validateCampaignResponsibilitySmoke({
      assignment,
      approvalsAssignment,
      auditEntry,
      contentFilterText,
      contentOwnerText,
      listText,
      myWorkText,
      ownerlessText,
      panelText,
      reportingFilterText,
      reportingOwnerText,
      selectedAssigneeText,
      selectedApprovalsText,
      consoleErrors,
    });

    return {
      ok: true,
      assignment,
      auditEntryId: auditEntry?.id ?? null,
      screenshotPath,
      listScreenshotPath,
      myWorkScreenshotPath,
      needsOwnerScreenshotPath,
      contentOwnerScreenshotPath,
      reportingOwnerScreenshotPath,
    };
  } finally {
    if (client) {
      client.close();
    }
    if (chrome) {
      chrome.kill("SIGTERM");
    }
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    await stopDevServer(devServer);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  runCampaignResponsibilitiesSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
