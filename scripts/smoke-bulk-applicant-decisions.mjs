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
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";

export const DEFAULT_BULK_APPLICANT_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000110";

const DEFAULT_SELECTED_SCREENSHOT_PATH =
  "output/playwright/bulk-applicants-selected-smoke.png";
const DEFAULT_ACCEPTED_SCREENSHOT_PATH =
  "output/playwright/bulk-applicants-accepted-smoke.png";
const DEFAULT_CLEARED_SCREENSHOT_PATH =
  "output/playwright/bulk-applicants-cleared-smoke.png";
const DEFAULT_MEMBER_OPERATIONS_SCREENSHOT_PATH =
  "output/playwright/bulk-members-operations-smoke.png";
const DEFAULT_MEMBER_FOLLOW_UP_READY_SCREENSHOT_PATH =
  "output/playwright/bulk-members-follow-up-ready-smoke.png";

const BULK_SMOKE_CREATORS = Array.from({ length: 4 }, (_, index) => {
  const number = index + 1;
  return {
    email: `bulk-applicant-${number}@dev.popsdrops.com`,
    name: `Bulk Creator ${number}`,
    rate: 200 + number * 25,
    pitch: `Bulk applicant ${number} can produce one clear smoke-test post.`,
  };
});

export function buildBulkApplicantSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_BULK_APPLICANT_CAMPAIGN_ID ||
    DEFAULT_BULK_APPLICANT_CAMPAIGN_ID,
} = {}) {
  return buildApplicationFlowSmokeTargets({ baseUrl, campaignId });
}

async function deleteBulkSmokeUsers(admin) {
  const emails = BULK_SMOKE_CREATORS.map((creator) => creator.email);
  const existingProfiles = await checkedQuery(
    "Find existing bulk smoke creator profiles",
    admin.from("profiles").select("id").in("email", emails),
  );

  for (const profile of existingProfiles ?? []) {
    const { error } = await admin.auth.admin.deleteUser(profile.id);
    if (error && !error.message.toLowerCase().includes("not found")) {
      throw new Error(`Delete bulk smoke user: ${error.message}`);
    }
  }
}

async function setupBulkApplicantSmokeData(admin, targets) {
  await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
  await deleteBulkSmokeUsers(admin);
  const { brandId } = await setupApplicationFlowSmokeData(admin, targets);

  const creatorRows = [];
  for (const creator of BULK_SMOKE_CREATORS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: creator.email,
      email_confirm: true,
      user_metadata: { full_name: creator.name },
    });
    if (error || !data?.user?.id) {
      throw new Error(`Create ${creator.name}: ${error?.message ?? "missing id"}`);
    }

    creatorRows.push({
      ...creator,
      id: data.user.id,
    });
  }

  await checkedQuery(
    "Create bulk smoke creator profiles",
    admin.from("profiles").upsert(
      creatorRows.map((creator) => ({
        id: creator.id,
        email: creator.email,
        full_name: creator.name,
        role: "creator",
        status: "approved",
        onboarding_completed: true,
      })),
      { onConflict: "id" },
    ),
  );

  await checkedQuery(
    "Create bulk smoke creator detail profiles",
    admin.from("creator_profiles").upsert(
      creatorRows.map((creator, index) => ({
        profile_id: creator.id,
        slug: `bulk-smoke-creator-${index + 1}`,
        bio: "Bulk applicant smoke-test creator.",
        primary_market: "us",
        platforms: ["tiktok"],
        tiktok: { handle: `bulk_creator_${index + 1}` },
        niches: ["beauty"],
        markets: ["us"],
        languages: ["en"],
        content_formats: ["short_video"],
        rate_card: { tiktok: { short_video: creator.rate } },
        rate_currency: "USD",
        rating: 4 + index / 10,
        review_count: 3 + index,
        tier: "rising",
        profile_completeness: 90,
      })),
      { onConflict: "profile_id" },
    ),
  );

  await checkedQuery(
    "Create bulk smoke applications",
    admin.from("campaign_applications").insert(
      creatorRows.map((creator) => ({
        campaign_id: targets.campaignId,
        creator_id: creator.id,
        proposed_rate: creator.rate,
        pitch: creator.pitch,
        status: "pending",
      })),
    ),
  );

  return {
    brandId,
    creatorIds: creatorRows.map((creator) => creator.id),
  };
}

export function validateBulkApplicantSmoke({
  selectedText,
  acceptedText,
  clearedText,
  rosterFilterText = "",
  memberOpsText,
  consoleErrors,
}) {
  const normalizedSelectedText = selectedText.toLowerCase();
  const normalizedAcceptedText = acceptedText.toLowerCase();
  const normalizedClearedText = clearedText.toLowerCase();
  const normalizedRosterFilterText = rosterFilterText.toLowerCase();
  const normalizedMemberOpsText = memberOpsText.toLowerCase();

  const requiredSelectedText = [
    ["campaign title", SMOKE_CAMPAIGN_TITLE],
    ["over selected count", "4 selected"],
    ["open seats", "3 open seats"],
    ["capacity warning", "Select up to 3 open seats"],
    ["bulk accept", "Accept selected"],
  ];
  const requiredAcceptedText = [
    ["accepted member", "Bulk Creator"],
    ["remaining applicant", "1 selected"],
  ];
  const requiredClearedText = [
    ["empty applicants", "No applications yet"],
    ["accepted member", "Bulk Creator"],
  ];
  const requiredRosterFilterText = [
    ["report readiness", "Report readiness"],
    ["ready reports", "Ready"],
    ["review reports", "To review"],
    ["needs attention filter", "Needs attention"],
    ["missed proof filter", "Missed proof"],
    ["payment open filter", "Payment open"],
    ["roster search result", "Bulk Creator 3"],
    ["filter selection reset", "0 selected"],
  ];
  const requiredMemberOpsText = [
    ["member selection count", "3 selected"],
    ["missed proof count", "2 missed proof"],
    ["follow-up count action", "Follow up 2 missed proof"],
    ["paid payment status", "Paid"],
    ["follow-up confirmation", "2 follow-up requested"],
  ];

  for (const [label, text] of requiredSelectedText) {
    if (!normalizedSelectedText.includes(text.toLowerCase())) {
      throw new Error(`Missing selected bulk applicant proof: ${label}`);
    }
  }

  for (const [label, text] of requiredAcceptedText) {
    if (!normalizedAcceptedText.includes(text.toLowerCase())) {
      throw new Error(`Missing accepted bulk applicant proof: ${label}`);
    }
  }

  for (const [label, text] of requiredClearedText) {
    if (!normalizedClearedText.includes(text.toLowerCase())) {
      throw new Error(`Missing cleared bulk applicant proof: ${label}`);
    }
  }

  for (const [label, text] of requiredRosterFilterText) {
    if (!normalizedRosterFilterText.includes(text.toLowerCase())) {
      throw new Error(`Missing member roster filter proof: ${label}`);
    }
  }

  for (const [label, text] of requiredMemberOpsText) {
    if (!normalizedMemberOpsText.includes(text.toLowerCase())) {
      throw new Error(`Missing bulk member operation proof: ${label}`);
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function runBulkApplicantSmoke() {
  await loadLocalEnv();

  const targets = buildBulkApplicantSmokeTargets();
  const selectedScreenshotPath = path.resolve(
    process.env.SMOKE_BULK_APPLICANTS_SELECTED_SCREENSHOT_PATH ||
      DEFAULT_SELECTED_SCREENSHOT_PATH,
  );
  const acceptedScreenshotPath = path.resolve(
    process.env.SMOKE_BULK_APPLICANTS_ACCEPTED_SCREENSHOT_PATH ||
      DEFAULT_ACCEPTED_SCREENSHOT_PATH,
  );
  const clearedScreenshotPath = path.resolve(
    process.env.SMOKE_BULK_APPLICANTS_CLEARED_SCREENSHOT_PATH ||
      DEFAULT_CLEARED_SCREENSHOT_PATH,
  );
  const memberOperationsScreenshotPath = path.resolve(
    process.env.SMOKE_BULK_MEMBERS_OPERATIONS_SCREENSHOT_PATH ||
      DEFAULT_MEMBER_OPERATIONS_SCREENSHOT_PATH,
  );
  const memberFollowUpReadyScreenshotPath = path.resolve(
    process.env.SMOKE_BULK_MEMBERS_FOLLOW_UP_READY_SCREENSHOT_PATH ||
      DEFAULT_MEMBER_FOLLOW_UP_READY_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-bulk-applicants-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    selectedText: "",
    acceptedText: "",
    clearedText: "",
    rosterFilterText: "",
    memberOpsText: "",
  };

  try {
    const { creatorIds } = await setupBulkApplicantSmokeData(admin, targets);

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
      `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
      "brand campaign detail",
    );
    await clickTab(client, "Creators");
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-testid="campaign-applicant-select"]').length === 4 &&
        document.body.innerText.includes("0 selected") &&
        document.body.innerText.includes("3 open seats")`,
      "bulk applicant toolbar",
    );

    await evaluate(
      client,
      `(() => {
        const selectAll = document.querySelector('[data-testid="campaign-applicant-select-all"]');
        if (!selectAll) throw new Error("Missing applicant select all");
        selectAll.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("4 selected") &&
        document.body.innerText.includes("Select up to 3 open seats") &&
        document.querySelector('[data-testid="campaign-applicant-bulk-accept"]')?.disabled === true`,
      "bulk applicant over capacity state",
    );
    smokeEvidence.selectedText = await evaluate(client, "document.body.innerText");
    await captureScreenshot(client, selectedScreenshotPath, {
      captureBeyondViewport: true,
    });

    await evaluate(
      client,
      `(() => {
        const boxes = [...document.querySelectorAll('[data-testid="campaign-applicant-select"]')];
        const last = boxes.at(-1);
        if (!last) throw new Error("Missing applicant checkbox");
        last.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("3 selected") &&
        !document.body.innerText.includes("Select up to 3 open seats") &&
        document.querySelector('[data-testid="campaign-applicant-bulk-accept"]')?.disabled === false`,
      "bulk applicant accepted selection",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-applicant-bulk-accept"]');
        if (!button) throw new Error("Missing bulk accept button");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-testid="campaign-member-row"]').length === 3 &&
        document.querySelectorAll('[data-testid="campaign-applicant-select"]').length === 1`,
      "bulk accepted applicants",
    );
    await evaluate(
      client,
      `(() => {
        const remaining = document.querySelector('[data-testid="campaign-applicant-select"]');
        if (!remaining) throw new Error("Missing remaining applicant checkbox");
        remaining.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("1 selected") &&
        document.querySelector('[data-testid="campaign-applicant-bulk-decline"]')?.disabled === false`,
      "remaining applicant selected",
    );
    smokeEvidence.acceptedText = await evaluate(client, "document.body.innerText");
    await captureScreenshot(client, acceptedScreenshotPath, {
      captureBeyondViewport: true,
    });

    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-applicant-bulk-decline"]');
        if (!button) throw new Error("Missing bulk decline button");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelector('[data-testid="campaign-creators-empty-note"]')?.innerText.includes("No applications yet") &&
        document.querySelectorAll('[data-testid="campaign-member-row"]').length === 3`,
      "bulk applicant queue cleared",
    );
    smokeEvidence.clearedText = await evaluate(client, "document.body.innerText");
    await captureScreenshot(client, clearedScreenshotPath, {
      captureBeyondViewport: true,
    });

    const acceptedMembers = await checkedQuery(
      "Verify bulk accepted campaign members",
      admin
        .from("campaign_members")
        .select("id")
        .eq("campaign_id", targets.campaignId),
    );
    if ((acceptedMembers ?? []).length !== 3) {
      throw new Error("Expected exactly three accepted campaign members.");
    }

    const reportTasks = await checkedQuery(
      "Find bulk member report tasks",
      admin
        .from("campaign_report_tasks")
        .select("id, campaign_member_id")
        .eq("campaign_id", targets.campaignId)
        .in(
          "campaign_member_id",
          acceptedMembers.map((member) => member.id),
        ),
    );
    const missedTaskIds = (reportTasks ?? []).slice(0, 2).map((task) => task.id);
    if (missedTaskIds.length !== 2) {
      throw new Error("Expected two report tasks to mark missed.");
    }
    await checkedQuery(
      "Mark selected report tasks missed",
      admin
        .from("campaign_report_tasks")
        .update({
          status: "missed",
          missed_at: new Date().toISOString(),
          review_note: null,
        })
        .in("id", missedTaskIds),
    );
    await checkedQuery(
      "Move bulk smoke campaign into proof review stage",
      admin
        .from("campaigns")
        .update({ status: "monitoring" })
        .eq("id", targets.campaignId),
    );

    await navigate(client, `${targets.brandCampaignUrl}?tab=creators`);
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-testid="campaign-member-row"]').length === 3 &&
        document.body.innerText.includes("0 selected") &&
        Boolean(document.querySelector('[data-testid="campaign-member-report-readiness"]')) &&
        Boolean(document.querySelector('[data-testid="campaign-member-report-readiness-ready"]')) &&
        Boolean(document.querySelector('[data-testid="campaign-member-report-readiness-review"]')) &&
        Boolean(document.querySelector('[data-testid="campaign-member-report-readiness-missed"]')) &&
        Boolean(document.querySelector('[data-testid="campaign-member-report-readiness-paymentOpen"]')) &&
        Boolean(document.querySelector('[data-testid="campaign-member-roster-search"]')) &&
        Boolean(document.querySelector('[data-testid="campaign-member-roster-filter-missed_proof"]')) &&
        Boolean(document.querySelector('[data-testid="campaign-member-bulk-payment-select"]'))`,
      "bulk member operations toolbar",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-member-roster-filter-missed_proof"]');
        if (!button) throw new Error("Missing missed proof roster filter");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-testid="campaign-member-row"]').length === 2 &&
        document.body.innerText.includes("Missed proof")`,
      "missed proof roster filter",
    );
    await evaluate(
      client,
      `(() => {
        const selectAll = document.querySelector('[data-testid="campaign-member-select-all"]');
        if (!selectAll) throw new Error("Missing filtered member select all");
        selectAll.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("2 selected")`,
      "filtered member selection",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-member-roster-filter-all"]');
        if (!button) throw new Error("Missing all roster filter");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-testid="campaign-member-row"]').length === 3 &&
        document.body.innerText.includes("0 selected")`,
      "member filter clears hidden selections",
    );
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('[data-testid="campaign-member-roster-search"]');
        if (!input) throw new Error("Missing member roster search");
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(input, "Bulk Creator 3");
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: "Bulk Creator 3",
            inputType: "insertText",
          }),
        );
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-testid="campaign-member-row"]').length === 1 &&
        document.body.innerText.includes("Bulk Creator 3")`,
      "member roster search",
    );
    smokeEvidence.rosterFilterText = await evaluate(client, "document.body.innerText");
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('[data-testid="campaign-member-roster-search"]');
        if (!input) throw new Error("Missing member roster search");
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        valueSetter?.call(input, "");
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: null,
            inputType: "deleteContentBackward",
          }),
        );
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelectorAll('[data-testid="campaign-member-row"]').length === 3 &&
        document.body.innerText.includes("0 selected")`,
      "member roster search cleared",
    );
    await evaluate(
      client,
      `(() => {
        const selectAll = document.querySelector('[data-testid="campaign-member-select-all"]');
        if (!selectAll) throw new Error("Missing member select all");
        selectAll.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("3 selected") &&
        document.body.innerText.includes("2 missed proof") &&
        document.querySelector('[data-testid="campaign-member-bulk-follow-up"]')?.innerText.includes("Follow up 2 missed proof") &&
        document.querySelector('[data-testid="campaign-member-bulk-follow-up"]')?.disabled === false`,
      "bulk member selection state",
    );
    const selectedMemberOpsText = await evaluate(client, "document.body.innerText");
    await evaluate(
      client,
      `(() => {
        const select = document.querySelector('[data-testid="campaign-member-bulk-payment-select"]');
        if (!select) throw new Error("Missing member payment select");
        select.value = "paid";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `document.querySelector('[data-testid="campaign-member-bulk-payment-save"]')?.disabled === false`,
      "bulk member payment enabled",
    );
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-member-bulk-payment-save"]');
        if (!button) throw new Error("Missing member payment apply button");
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `[...document.querySelectorAll('[data-testid="campaign-member-payment-status"]')]
        .filter((node) => node.innerText.includes("Paid")).length === 3`,
      "bulk member payment status applied",
    );
    await waitForExpression(
      client,
      `document.body.innerText.includes("2 missed proof") &&
        document.querySelector('[data-testid="campaign-member-bulk-follow-up"]')?.innerText.includes("Follow up 2 missed proof") &&
        document.querySelector('[data-testid="campaign-member-bulk-follow-up"]')?.disabled === false`,
      "bulk member follow-up ready after payment update",
    );
    await captureScreenshot(client, memberFollowUpReadyScreenshotPath, {
      captureBeyondViewport: true,
    });
    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="campaign-member-bulk-follow-up"]');
        if (!button) throw new Error("Missing member follow-up button");
        if (button.disabled) throw new Error("Member follow-up button stayed disabled");
        button.click();
        return true;
      })()`,
    );

    const paidMembers = await checkedQuery(
      "Verify bulk member payment statuses",
      admin
        .from("campaign_members")
        .select("id")
        .eq("campaign_id", targets.campaignId)
        .eq("payment_status", "paid"),
    );
    if ((paidMembers ?? []).length !== 3) {
      throw new Error("Expected exactly three paid campaign members.");
    }

    let followedUpTasks = [];
    const followUpDeadline = Date.now() + 30000;
    while (Date.now() < followUpDeadline) {
      followedUpTasks =
        (await checkedQuery(
          "Verify bulk missed proof follow-up notes",
          admin
            .from("campaign_report_tasks")
            .select("id")
            .in("id", missedTaskIds)
            .eq("review_note", "Follow-up requested"),
        )) ?? [];
      if (followedUpTasks.length === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if ((followedUpTasks ?? []).length !== 2) {
      throw new Error("Expected two missed proof follow-up notes.");
    }
    await waitForExpression(
      client,
      `!document.body.innerText.includes("Following up...") &&
        [...document.querySelectorAll('[data-testid="campaign-member-follow-up-report"]')]
          .filter((node) => node.innerText.includes("Sent")).length === 2`,
      "bulk missed proof follow-up reflected in rows",
    );
    smokeEvidence.memberOpsText = `${selectedMemberOpsText}\n${await evaluate(client, "document.body.innerText")}\n${followedUpTasks.length} follow-up requested`;
    await captureScreenshot(client, memberOperationsScreenshotPath, {
      captureBeyondViewport: true,
    });

    const remainingPendingApplications = await checkedQuery(
      "Verify no pending bulk applications",
      admin
        .from("campaign_applications")
        .select("id")
        .eq("campaign_id", targets.campaignId)
        .eq("status", "pending"),
    );
    if ((remainingPendingApplications ?? []).length !== 0) {
      throw new Error("Expected bulk applicant queue to have no pending rows.");
    }

    validateBulkApplicantSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      selectedScreenshotPath,
      acceptedScreenshotPath,
      clearedScreenshotPath,
      memberFollowUpReadyScreenshotPath,
      memberOperationsScreenshotPath,
      creatorIds,
      keptSmokeData: process.env.SMOKE_KEEP_DATA === "1",
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
      await deleteBulkSmokeUsers(admin);
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
  runBulkApplicantSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
