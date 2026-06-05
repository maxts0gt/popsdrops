#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildApplicationFlowSmokeTargets,
  captureScreenshot,
  checkedQuery,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  getSmokeCampaignTitle,
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

export const DEFAULT_ADMIN_REPORT_COMMAND_CENTER_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000121";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_COMMAND_SCREENSHOT_PATH =
  "output/playwright/admin-report-command-center-smoke.png";
const DEFAULT_DRILL_IN_SCREENSHOT_PATH =
  "output/playwright/admin-report-command-center-drill-in-smoke.png";
const ADMIN_REPORT_EXCUSE_REASON =
  "Brand confirmed the creator could not access platform analytics before the reporting window closed.";
const ADMIN_REPORT_PROOF_INTERVENTION_NOTE =
  "PopsDrops ops asked the brand owner to review this proof before leadership sharing.";

function buildAdminReportCommandCenterTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_ADMIN_REPORT_COMMAND_CENTER_CAMPAIGN_ID ||
    DEFAULT_ADMIN_REPORT_COMMAND_CENTER_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    adminCampaignReportingUrl: `${targets.baseUrl}/admin/campaigns/${campaignId}?focus=reporting#admin-reporting-exceptions`,
    adminLoginUrl: `${targets.baseUrl}/auth/dev-login?role=admin`,
    adminReportsUrl: `${targets.baseUrl}/admin/reports`,
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

async function seedAdminReportCommandCenterRows(
  admin,
  { brandId, campaignId, creatorId },
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const yesterdayIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const reviewSlaBreachIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const returnedRejectedIso = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const returnedSubmittedIso = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const memberId = randomUUID();
  const missedTaskId = randomUUID();
  const submittedTaskId = randomUUID();
  const missingEvidenceTaskId = randomUUID();
  const revisionTaskId = randomUUID();
  const returnedTaskId = randomUUID();
  const submittedEvidenceId = randomUUID();
  const rejectedEvidenceId = randomUUID();
  const returnedRejectedEvidenceId = randomUUID();
  const returnedSubmittedEvidenceId = randomUUID();
  const exportJobId = randomUUID();

  await checkedQuery(
    "Create admin report command center member",
    admin.from("campaign_members").insert({
      id: memberId,
      campaign_id: campaignId,
      creator_id: creatorId,
      accepted_rate: 275,
      payment_status: "pending",
      joined_at: nowIso,
    }),
  );

  await checkedQuery(
    "Create admin report command center tasks",
    admin.from("campaign_report_tasks").insert([
      {
        id: missedTaskId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        task_key: "admin-report-command-center:missed",
        due_at: yesterdayIso,
        missed_at: nowIso,
        status: "missed",
      },
      {
        id: submittedTaskId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        task_key: "admin-report-command-center:submitted-proof",
        due_at: nowIso,
        status: "submitted",
        submitted_at: nowIso,
      },
      {
        id: missingEvidenceTaskId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        task_key: "admin-report-command-center:missing-proof",
        due_at: nowIso,
        status: "submitted",
        submitted_at: nowIso,
      },
      {
        id: revisionTaskId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        review_note:
          "Smoke correction request: screenshot crop does not show the full analytics date window.",
        task_key: "admin-report-command-center:needs-correction",
        due_at: nowIso,
        status: "needs_revision",
        submitted_at: nowIso,
      },
      {
        id: returnedTaskId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        task_key: "admin-report-command-center:returned-correction",
        due_at: nowIso,
        status: "submitted",
        submitted_at: returnedSubmittedIso,
      },
    ]),
  );

  await checkedQuery(
    "Create admin report command center evidence rows",
    admin.from("content_performance_evidence").insert([
      {
        id: submittedEvidenceId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        evidence_type: "screenshot",
        file_name: "admin-report-command-proof.png",
        mime_type: "image/png",
        report_task_id: submittedTaskId,
        size_bytes: 1024,
        storage_path: `${campaignId}/${memberId}/${submittedTaskId}/${submittedEvidenceId}/admin-report-command-proof.png`,
        uploaded_by: creatorId,
        created_at: reviewSlaBreachIso,
        verification_status: "submitted",
      },
      {
        id: rejectedEvidenceId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        evidence_type: "screenshot",
        file_name: "admin-report-command-rejected-proof.png",
        mime_type: "image/png",
        report_task_id: revisionTaskId,
        review_note:
          "Rejected proof smoke: platform screenshot is missing visible account identity.",
        size_bytes: 1024,
        storage_path: `${campaignId}/${memberId}/${revisionTaskId}/${rejectedEvidenceId}/admin-report-command-rejected-proof.png`,
        uploaded_by: creatorId,
        created_at: nowIso,
        verification_status: "rejected",
      },
      {
        id: returnedRejectedEvidenceId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        evidence_type: "screenshot",
        file_name: "admin-report-command-returned-rejected-proof.png",
        mime_type: "image/png",
        report_task_id: returnedTaskId,
        review_note:
          "Returned correction smoke: first proof was missing a visible date range.",
        size_bytes: 1024,
        storage_path: `${campaignId}/${memberId}/${returnedTaskId}/${returnedRejectedEvidenceId}/admin-report-command-returned-rejected-proof.png`,
        uploaded_by: creatorId,
        created_at: returnedRejectedIso,
        verification_status: "rejected",
      },
      {
        id: returnedSubmittedEvidenceId,
        campaign_id: campaignId,
        campaign_member_id: memberId,
        evidence_type: "screenshot",
        file_name: "admin-report-command-returned-proof.png",
        mime_type: "image/png",
        report_task_id: returnedTaskId,
        size_bytes: 1024,
        storage_path: `${campaignId}/${memberId}/${returnedTaskId}/${returnedSubmittedEvidenceId}/admin-report-command-returned-proof.png`,
        uploaded_by: creatorId,
        created_at: returnedSubmittedIso,
        verification_status: "submitted",
      },
    ]),
  );

  await checkedQuery(
    "Create admin report command center failed export",
    admin.from("report_export_jobs").insert({
      id: exportJobId,
      campaign_id: campaignId,
      requested_by: brandId,
      format: "html",
      status: "failed",
      file_name: "admin-report-command-center.html",
      mime_type: "text/html",
      error_message:
        "Smoke export failure for admin report command center triage.",
    }),
  );

  return {
    exportJobId,
    memberId,
    missedTaskId,
    missingEvidenceTaskId,
    rejectedEvidenceId,
    revisionTaskId,
    returnedRejectedEvidenceId,
    returnedSubmittedEvidenceId,
    returnedTaskId,
    submittedEvidenceId,
    submittedTaskId,
  };
}

async function cleanupAdminReportCommandCenterAuditRows(admin, seededRows) {
  if (
    !seededRows?.missedTaskId &&
    !seededRows?.exportJobId &&
    !seededRows?.submittedEvidenceId
  ) {
    return;
  }

  if (seededRows?.missedTaskId) {
    await checkedQuery(
      "Clean admin report command center audit rows",
      admin
        .from("admin_audit_log")
        .delete()
        .eq("target_type", "campaign_report_task")
        .eq("target_id", seededRows.missedTaskId),
    );
  }

  if (seededRows?.exportJobId) {
    await checkedQuery(
      "Clean admin report command center export retry audit rows",
      admin
        .from("admin_audit_log")
        .delete()
        .eq("target_type", "report_export_job")
        .eq("target_id", seededRows.exportJobId),
    );
  }

  if (seededRows?.submittedEvidenceId) {
    await checkedQuery(
      "Clean admin report command center proof intervention audit rows",
      admin
        .from("admin_audit_log")
        .delete()
        .eq("target_type", "content_performance_evidence")
        .eq("target_id", seededRows.submittedEvidenceId),
    );
  }
}

function validateAdminReportCommandCenterSmoke({
  campaignId,
  campaignReadinessText,
  commandText,
  consoleErrors,
  drillInText,
  priorityText,
  rowText,
  summaryText,
}) {
  const requiredCommandText = [
    "Report command center",
    "Proof room exceptions",
    "Needs brand review",
    "Missing proof",
    "SLA breaches",
    "Missed reports",
    "Correction requests",
    "Export failures",
    getSmokeCampaignTitle(),
  ];
  const requiredCampaignReadinessText = [
    "Campaign leadership readiness",
    "Leadership hold",
    "blockers",
    "Review SLA breach is the top leadership gate.",
    "Leadership hold until brand verifies submitted proof.",
    "Review 1 submitted proof read before sharing.",
    "Brand reviews or requests correction on submitted proof.",
    getSmokeCampaignTitle(),
  ];
  const requiredRowText = [
    "Review SLA breach",
    "Proof review older than 24h",
    "Blocks report confidence until brand confirms proof.",
    "Leadership hold until brand verifies submitted proof.",
    "Review 1 submitted proof read before sharing.",
    "Open the campaign and push brand proof review.",
    "Brand owner",
    "PopsDrops ops",
    "Brand reviews or requests correction on submitted proof.",
    "Blocks board-ready artifact delivery.",
    "Leadership hold until replacement artifact is generated.",
    "Regenerate the failed report export before leadership sharing.",
    "Open the campaign and retry or inspect the failed export.",
    "Replacement export completes and old failure is traced.",
    "Missing proof",
    "Report task submitted without proof",
    "Blocks report confidence because submitted metrics have no proof source.",
    "Leadership hold until the submitted task has evidence attached.",
    "Ask creator to upload 1 missing proof read.",
    "Open the campaign and ask the creator to attach proof before review.",
    "Creator attaches evidence or admin returns the report task with an audit note.",
    "Blocks complete creator readout unless excused.",
    "Leadership hold unless the missed read is excused with audit trail.",
    "Open the campaign and excuse only with a written audit reason.",
    "Creator submits proof or admin excuses with a written audit reason.",
    "Leadership hold until creator returns usable proof.",
    "Resolve 1 correction request before leadership sharing.",
    "Leadership hold until corrected proof is reviewed.",
    "Review 1 corrected proof read before sharing.",
    "Missed report",
    "Correction request",
    "Correction returned",
    "Corrected proof awaiting brand review",
    "replaced a rejected proof",
    "admin-report-command-returned-proof.png",
    "Rejected proof",
    "Export failure",
    "Open campaign",
  ];
  const requiredNormalizedRowText = [
    "Leadership impact",
    "Leadership share gate",
    "Leadership next action",
    "Waiting",
    "Next move",
    "Escalation owner",
    "Clears when",
  ];
  const requiredDrillInText = [
    "Review reporting exceptions",
    "Review SLA breach",
    "Proof review older than 24h",
    "Ask the brand owner to review or intervene.",
    "admin-report-command-proof.png",
    "Correction returned",
    "Corrected proof awaiting brand review",
    "replaced a rejected proof",
    "admin-report-command-returned-proof.png",
    "Needs correction",
    "Report export failed",
    "Retry export",
    "Why can this missed report be excused?",
    "Required for audit",
    "Mark excused",
    "What did admin do?",
    "Saved to admin audit. Does not verify proof or change report totals.",
    "Record intervention",
    "Review proof",
  ];
  const expectedDrillInHref = `/admin/campaigns/${campaignId}?focus=reporting#admin-reporting-exceptions`;

  for (const text of requiredCommandText) {
    if (!commandText.includes(text)) {
      throw new Error(`Missing admin report command page text: ${text}`);
    }
  }

  for (const text of requiredRowText) {
    if (!rowText.includes(text)) {
      throw new Error(`Missing admin report exception row text: ${text}`);
    }
  }

  const normalizedRowText = rowText.toLowerCase();
  for (const text of requiredNormalizedRowText) {
    if (!normalizedRowText.includes(text.toLowerCase())) {
      throw new Error(`Missing admin report exception row text: ${text}`);
    }
  }

  for (const text of requiredDrillInText) {
    if (!drillInText.includes(text)) {
      throw new Error(`Missing admin campaign reporting drill-in text: ${text}`);
    }
  }

  for (const text of [
    "Needs brand review",
    "Missing proof",
    "SLA breaches",
    "Missed reports",
    "Correction requests",
    "Export failures",
  ]) {
    if (!summaryText.includes(text)) {
      throw new Error(`Missing admin report command summary text: ${text}`);
    }
  }

  for (const text of requiredCampaignReadinessText) {
    if (!campaignReadinessText.includes(text)) {
      throw new Error(`Missing admin report campaign readiness text: ${text}`);
    }
  }

  const normalizedPriorityText = priorityText.toLowerCase();
  if (
    !normalizedPriorityText.includes("priority intervention") ||
    !priorityText.includes("Review SLA breach") ||
    !normalizedPriorityText.includes("leadership impact") ||
    !normalizedPriorityText.includes("leadership share gate") ||
    !normalizedPriorityText.includes("leadership next action") ||
    !normalizedPriorityText.includes("waiting") ||
    !normalizedPriorityText.includes("next move") ||
    !normalizedPriorityText.includes("escalation owner") ||
    !normalizedPriorityText.includes("clears when") ||
    !/\b\d+[mhd] waiting\b/.test(normalizedPriorityText) ||
    !priorityText.includes("Brand owner") ||
    !priorityText.includes("Blocks report confidence until brand confirms proof.") ||
    !priorityText.includes("Leadership hold until brand verifies submitted proof.") ||
    !priorityText.includes("Review 1 submitted proof read before sharing.") ||
    !priorityText.includes("Open the campaign and push brand proof review.") ||
    !priorityText.includes("Brand reviews or requests correction on submitted proof.")
  ) {
    throw new Error(
      "Expected the admin report command center priority rail to surface the urgent review SLA breach with impact, share gate, waiting age, next move, owner, and clearance.",
    );
  }

  if (!commandText.includes(expectedDrillInHref)) {
    throw new Error(
      `Expected admin report rows to link to ${expectedDrillInHref}.`,
    );
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export async function runAdminReportCommandCenterSmoke() {
  await loadLocalEnv();

  const targets = buildAdminReportCommandCenterTargets();
  const admin = createAdminClient();
  const commandScreenshotPath = path.resolve(
    process.env.SMOKE_ADMIN_REPORT_COMMAND_CENTER_SCREENSHOT_PATH ||
      DEFAULT_COMMAND_SCREENSHOT_PATH,
  );
  const drillInScreenshotPath = path.resolve(
    process.env.SMOKE_ADMIN_REPORT_COMMAND_CENTER_DRILL_IN_SCREENSHOT_PATH ||
      DEFAULT_DRILL_IN_SCREENSHOT_PATH,
  );
  let fixture;
  let seededRows;
  let devServer;
  let chrome;
  let client;
  let userDataDir;
  const consoleErrors = [];

  try {
    fixture = await setupApplicationFlowSmokeData(admin, targets);
    seededRows = await seedAdminReportCommandCenterRows(admin, {
      ...fixture,
      campaignId: targets.campaignId,
    });

    devServer = (await isExistingDevServerReady(targets.baseUrl))
      ? null
      : await ensureDevServer(targets.baseUrl);
    const debugPort = await findFreePort();
    userDataDir = await mkdtemp(
      path.join(tmpdir(), "popsdrops-admin-report-command-smoke-"),
    );

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
      description: "admin dev login for report command center smoke",
    });

    await navigate(client, targets.adminReportsUrl);
    try {
      await waitForExpression(
        client,
        `(() => {
          const priorityRail = document.querySelector('[data-testid="admin-report-priority-rail"]');
          const priorityKind = document.querySelector('[data-testid="admin-report-priority-kind"]');
          const priorityTitle = document.querySelector('[data-testid="admin-report-priority-title"]');
          const priorityImpact = document.querySelector('[data-testid="admin-report-priority-impact"]');
          const priorityShareGatePanel = document.querySelector('[data-testid="admin-report-priority-share-gate-panel"]');
          const priorityShareGate = document.querySelector('[data-testid="admin-report-priority-share-gate"]');
          const priorityLeadershipNextAction = document.querySelector('[data-testid="admin-report-priority-leadership-next-action"]');
          const priorityOperations = document.querySelector('[data-testid="admin-report-priority-operations"]');
          const priorityAge = document.querySelector('[data-testid="admin-report-priority-age"]');
          const priorityNextStep = document.querySelector('[data-testid="admin-report-priority-next-step"]');
          const priorityOwner = document.querySelector('[data-testid="admin-report-priority-owner"]');
          const priorityClearance = document.querySelector('[data-testid="admin-report-priority-clearance"]');
          const summary = document.querySelector('[data-testid="admin-report-command-summary"]');
          const readiness = document.querySelector('[data-testid="admin-report-campaign-readiness"]');
          const readinessRows = [...document.querySelectorAll('[data-testid="admin-report-campaign-readiness-row"]')];
          const readinessCount = document.querySelector('[data-testid="admin-report-campaign-readiness-count"]');
          const readinessStatuses = [...document.querySelectorAll('[data-testid="admin-report-campaign-readiness-status"]')];
          const readinessPrimaries = [...document.querySelectorAll('[data-testid="admin-report-campaign-readiness-primary"]')];
          const readinessShareGates = [...document.querySelectorAll('[data-testid="admin-report-campaign-readiness-share-gate"]')];
          const readinessNextActions = [...document.querySelectorAll('[data-testid="admin-report-campaign-readiness-next-action"]')];
          const readinessClearances = [...document.querySelectorAll('[data-testid="admin-report-campaign-readiness-clearance"]')];
          const rows = [...document.querySelectorAll('[data-testid="admin-report-exception-row"]')];
          const rowDecisionGrids = [...document.querySelectorAll('[data-testid="admin-report-exception-decision-grid"]')];
          const rowImpacts = [...document.querySelectorAll('[data-testid="admin-report-exception-impact"]')];
          const rowShareGates = [...document.querySelectorAll('[data-testid="admin-report-exception-share-gate"]')];
          const rowLeadershipNextActions = [...document.querySelectorAll('[data-testid="admin-report-exception-leadership-next-action"]')];
          const rowOperationGrids = [...document.querySelectorAll('[data-testid="admin-report-exception-operations-grid"]')];
          const rowAges = [...document.querySelectorAll('[data-testid="admin-report-exception-age"]')];
          const rowNextSteps = [...document.querySelectorAll('[data-testid="admin-report-exception-next-step"]')];
          const rowOwners = [...document.querySelectorAll('[data-testid="admin-report-exception-owner"]')];
          const rowClearances = [...document.querySelectorAll('[data-testid="admin-report-exception-clearance"]')];
          const text = document.body.innerText || "";
          const normalizedText = text.toLowerCase();
          const links = [...document.querySelectorAll('a')].map((link) => link.getAttribute('href') || '').join(" ");
          const normalizedPriorityText = priorityRail?.innerText.toLowerCase() || "";
          return Boolean(priorityRail) &&
            Boolean(priorityKind) &&
            Boolean(priorityTitle?.innerText.trim()) &&
            Boolean(priorityImpact?.innerText.trim()) &&
            Boolean(priorityShareGatePanel) &&
            Boolean(priorityShareGate?.innerText.trim()) &&
            Boolean(priorityLeadershipNextAction?.innerText.trim()) &&
            Boolean(priorityOperations) &&
            Boolean(priorityAge?.innerText.trim()) &&
            Boolean(priorityNextStep?.innerText.trim()) &&
            Boolean(priorityOwner?.innerText.trim()) &&
            Boolean(priorityClearance?.innerText.trim()) &&
            normalizedPriorityText.includes("priority intervention") &&
            priorityRail.innerText.includes("Review SLA breach") &&
            normalizedPriorityText.includes("leadership impact") &&
            normalizedPriorityText.includes("leadership share gate") &&
            normalizedPriorityText.includes("leadership next action") &&
            normalizedPriorityText.includes("waiting") &&
            /\\b\\d+[mhd] waiting\\b/.test(normalizedPriorityText) &&
            normalizedPriorityText.includes("next move") &&
            normalizedPriorityText.includes("escalation owner") &&
            normalizedPriorityText.includes("clears when") &&
            priorityRail.innerText.includes("Brand owner") &&
            priorityRail.innerText.includes("Blocks report confidence until brand confirms proof.") &&
            priorityRail.innerText.includes("Leadership hold until brand verifies submitted proof.") &&
            priorityRail.innerText.includes("Review 1 submitted proof read before sharing.") &&
            priorityRail.innerText.includes("Open the campaign and push brand proof review.") &&
            priorityRail.innerText.includes("Brand reviews or requests correction on submitted proof.") &&
            Boolean(summary) &&
            Boolean(readiness) &&
            readinessRows.length >= 1 &&
            Boolean(readinessCount?.innerText.trim()) &&
            readinessStatuses.some((row) => row.innerText.includes("Leadership hold")) &&
            readinessPrimaries.some((row) => row.innerText.includes("top leadership gate")) &&
            readinessShareGates.some((row) => row.innerText.includes("Leadership hold until brand verifies submitted proof.")) &&
            readinessNextActions.some((row) => row.innerText.includes("Review 1 submitted proof read before sharing.")) &&
            readinessClearances.some((row) => row.innerText.includes("Brand reviews or requests correction on submitted proof.")) &&
            rows.length >= 7 &&
            rowDecisionGrids.length >= 7 &&
            rowImpacts.length >= 7 &&
            rowShareGates.length >= 7 &&
            rowLeadershipNextActions.length >= 7 &&
            rowOperationGrids.length >= 7 &&
            rowAges.length >= 7 &&
            rowAges.every((row) => /\\b\\d+[mhd] waiting\\b/i.test(row.innerText)) &&
            rowNextSteps.length >= 7 &&
            rowOwners.length >= 7 &&
            rowClearances.length >= 7 &&
             text.includes("Report command center") &&
             text.includes("Needs brand review") &&
             text.includes("Missing proof") &&
             text.includes("SLA breaches") &&
             text.includes("Campaign leadership readiness") &&
             text.includes("Leadership hold") &&
             text.includes("top leadership gate") &&
             text.includes("Review SLA breach") &&
             normalizedText.includes("leadership impact") &&
             normalizedText.includes("leadership share gate") &&
             normalizedText.includes("leadership next action") &&
             normalizedText.includes("waiting") &&
             normalizedText.includes("next move") &&
             normalizedText.includes("escalation owner") &&
             normalizedText.includes("clears when") &&
             text.includes("Brand owner") &&
             text.includes("PopsDrops ops") &&
             text.includes("Blocks report confidence until brand confirms proof.") &&
             text.includes("Leadership hold until brand verifies submitted proof.") &&
             text.includes("Review 1 submitted proof read before sharing.") &&
             text.includes("Open the campaign and push brand proof review.") &&
             text.includes("Brand reviews or requests correction on submitted proof.") &&
             text.includes("Blocks board-ready artifact delivery.") &&
             text.includes("Leadership hold until replacement artifact is generated.") &&
             text.includes("Regenerate the failed report export before leadership sharing.") &&
             text.includes("Blocks report confidence because submitted metrics have no proof source.") &&
             text.includes("Leadership hold until the submitted task has evidence attached.") &&
             text.includes("Ask creator to upload 1 missing proof read.") &&
             text.includes("Open the campaign and ask the creator to attach proof before review.") &&
             text.includes("Creator attaches evidence or admin returns the report task with an audit note.") &&
             text.includes("Open the campaign and retry or inspect the failed export.") &&
             text.includes("Replacement export completes and old failure is traced.") &&
             text.includes("Blocks complete creator readout unless excused.") &&
             text.includes("Leadership hold unless the missed read is excused with audit trail.") &&
             text.includes("Resolve 1 missed report read before leadership sharing.") &&
             text.includes("Open the campaign and excuse only with a written audit reason.") &&
             text.includes("Creator submits proof or admin excuses with a written audit reason.") &&
             text.includes("Leadership hold until creator returns usable proof.") &&
             text.includes("Resolve 1 correction request before leadership sharing.") &&
             text.includes("Leadership hold until corrected proof is reviewed.") &&
             text.includes("Review 1 corrected proof read before sharing.") &&
             text.includes("Correction returned") &&
             text.includes("Corrected proof awaiting brand review") &&
             text.includes("admin-report-command-returned-proof.png") &&
             Boolean(document.querySelector('[data-testid="admin-report-sla-breach-count"]')) &&
             text.includes("Missed report") &&
            text.includes("Correction request") &&
            text.includes("Rejected proof") &&
            text.includes("Export failure") &&
            links.includes(${JSON.stringify(`/admin/campaigns/${targets.campaignId}?focus=reporting#admin-reporting-exceptions`)});
        })()`,
        "admin report command center exception rows",
        60000,
      );
    } catch (error) {
      const diagnostics = await evaluate(
        client,
        `(() => ({
          checks: {
            hasPriorityRail: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')),
            hasPriorityKind: Boolean(document.querySelector('[data-testid="admin-report-priority-kind"]')),
            hasPriorityTitle: Boolean(document.querySelector('[data-testid="admin-report-priority-title"]')?.innerText.trim()),
            hasPriorityImpact: Boolean(document.querySelector('[data-testid="admin-report-priority-impact"]')?.innerText.trim()),
            hasPriorityShareGatePanel: Boolean(document.querySelector('[data-testid="admin-report-priority-share-gate-panel"]')),
            hasPriorityShareGate: Boolean(document.querySelector('[data-testid="admin-report-priority-share-gate"]')?.innerText.trim()),
            hasPriorityLeadershipNextAction: Boolean(document.querySelector('[data-testid="admin-report-priority-leadership-next-action"]')?.innerText.trim()),
            hasPriorityOperations: Boolean(document.querySelector('[data-testid="admin-report-priority-operations"]')),
            hasPriorityAge: Boolean(document.querySelector('[data-testid="admin-report-priority-age"]')?.innerText.trim()),
            hasPriorityNextStep: Boolean(document.querySelector('[data-testid="admin-report-priority-next-step"]')?.innerText.trim()),
            hasPriorityOwner: Boolean(document.querySelector('[data-testid="admin-report-priority-owner"]')?.innerText.trim()),
            hasPriorityClearance: Boolean(document.querySelector('[data-testid="admin-report-priority-clearance"]')?.innerText.trim()),
            priorityMentionsIntervention: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("priority intervention")),
            priorityMentionsReviewSla: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.includes("Review SLA breach")),
            priorityMentionsImpact: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("leadership impact")),
            priorityMentionsShareGate: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("leadership share gate")),
            priorityMentionsLeadershipNextAction: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("leadership next action")),
            priorityMentionsProofNextAction: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.includes("Review 1 submitted proof read before sharing.")),
            priorityMentionsWaiting: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("waiting")),
            priorityMentionsWaitingAge: /\\b\\d+[mhd] waiting\\b/i.test(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText || ""),
            priorityMentionsNextStep: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("next move")),
            priorityMentionsOwner: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("escalation owner")),
            priorityMentionsClearance: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.toLowerCase().includes("clears when")),
            priorityMentionsBrandOwner: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.includes("Brand owner")),
            priorityMentionsBrandReviewClearance: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.includes("Brand reviews or requests correction on submitted proof.")),
            priorityMentionsProofShareGate: Boolean(document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText.includes("Leadership hold until brand verifies submitted proof.")),
            hasSummary: Boolean(document.querySelector('[data-testid="admin-report-command-summary"]')),
            hasCampaignReadiness: Boolean(document.querySelector('[data-testid="admin-report-campaign-readiness"]')),
            campaignReadinessRowCount: document.querySelectorAll('[data-testid="admin-report-campaign-readiness-row"]').length,
            campaignReadinessStatusCount: document.querySelectorAll('[data-testid="admin-report-campaign-readiness-status"]').length,
            campaignReadinessPrimaryCount: document.querySelectorAll('[data-testid="admin-report-campaign-readiness-primary"]').length,
            campaignReadinessShareGateCount: document.querySelectorAll('[data-testid="admin-report-campaign-readiness-share-gate"]').length,
            campaignReadinessNextActionCount: document.querySelectorAll('[data-testid="admin-report-campaign-readiness-next-action"]').length,
            campaignReadinessClearanceCount: document.querySelectorAll('[data-testid="admin-report-campaign-readiness-clearance"]').length,
            campaignReadinessMentionsHold: Boolean(document.querySelector('[data-testid="admin-report-campaign-readiness"]')?.innerText.includes("Leadership hold")),
            campaignReadinessMentionsTopGate: Boolean(document.querySelector('[data-testid="admin-report-campaign-readiness"]')?.innerText.includes("top leadership gate")),
            rowCount: document.querySelectorAll('[data-testid="admin-report-exception-row"]').length,
            rowDecisionGridCount: document.querySelectorAll('[data-testid="admin-report-exception-decision-grid"]').length,
            rowImpactCount: document.querySelectorAll('[data-testid="admin-report-exception-impact"]').length,
            rowShareGateCount: document.querySelectorAll('[data-testid="admin-report-exception-share-gate"]').length,
            rowLeadershipNextActionCount: document.querySelectorAll('[data-testid="admin-report-exception-leadership-next-action"]').length,
            rowOperationGridCount: document.querySelectorAll('[data-testid="admin-report-exception-operations-grid"]').length,
            rowAgeCount: document.querySelectorAll('[data-testid="admin-report-exception-age"]').length,
            rowAgesHaveWaiting: [...document.querySelectorAll('[data-testid="admin-report-exception-age"]')].every((row) => /\\b\\d+[mhd] waiting\\b/i.test(row.innerText)),
            rowNextStepCount: document.querySelectorAll('[data-testid="admin-report-exception-next-step"]').length,
            rowOwnerCount: document.querySelectorAll('[data-testid="admin-report-exception-owner"]').length,
            rowClearanceCount: document.querySelectorAll('[data-testid="admin-report-exception-clearance"]').length,
            mentionsReportCommandCenter: (document.body.innerText || "").includes("Report command center"),
            mentionsNeedsBrandReview: (document.body.innerText || "").includes("Needs brand review"),
            mentionsMissingProof: (document.body.innerText || "").includes("Missing proof"),
            mentionsSlaBreaches: (document.body.innerText || "").includes("SLA breaches"),
            mentionsReviewSlaBreach: (document.body.innerText || "").includes("Review SLA breach"),
            mentionsLeadershipImpact: (document.body.innerText || "").toLowerCase().includes("leadership impact"),
            mentionsLeadershipShareGate: (document.body.innerText || "").toLowerCase().includes("leadership share gate"),
            mentionsLeadershipNextAction: (document.body.innerText || "").toLowerCase().includes("leadership next action"),
            mentionsWaiting: (document.body.innerText || "").toLowerCase().includes("waiting"),
            mentionsNextMove: (document.body.innerText || "").toLowerCase().includes("next move"),
            mentionsEscalationOwner: (document.body.innerText || "").toLowerCase().includes("escalation owner"),
            mentionsClearsWhen: (document.body.innerText || "").toLowerCase().includes("clears when"),
            mentionsBrandOwner: (document.body.innerText || "").includes("Brand owner"),
            mentionsPopsDropsOps: (document.body.innerText || "").includes("PopsDrops ops"),
            mentionsBrandProofImpact: (document.body.innerText || "").includes("Blocks report confidence until brand confirms proof."),
            mentionsBrandProofShareGate: (document.body.innerText || "").includes("Leadership hold until brand verifies submitted proof."),
            mentionsBrandProofLeadershipNextAction: (document.body.innerText || "").includes("Review 1 submitted proof read before sharing."),
            mentionsBrandProofNextStep: (document.body.innerText || "").includes("Open the campaign and push brand proof review."),
            mentionsBrandReviewClearance: (document.body.innerText || "").includes("Brand reviews or requests correction on submitted proof."),
            mentionsExportImpact: (document.body.innerText || "").includes("Blocks board-ready artifact delivery."),
            mentionsExportShareGate: (document.body.innerText || "").includes("Leadership hold until replacement artifact is generated."),
            mentionsExportLeadershipNextAction: (document.body.innerText || "").includes("Regenerate the failed report export before leadership sharing."),
            mentionsExportNextStep: (document.body.innerText || "").includes("Open the campaign and retry or inspect the failed export."),
            mentionsExportClearance: (document.body.innerText || "").includes("Replacement export completes and old failure is traced."),
            mentionsMissingProofImpact: (document.body.innerText || "").includes("Blocks report confidence because submitted metrics have no proof source."),
            mentionsMissingProofShareGate: (document.body.innerText || "").includes("Leadership hold until the submitted task has evidence attached."),
            mentionsMissingProofLeadershipNextAction: (document.body.innerText || "").includes("Ask creator to upload 1 missing proof read."),
            mentionsMissingProofNextStep: (document.body.innerText || "").includes("Open the campaign and ask the creator to attach proof before review."),
            mentionsMissingProofClearance: (document.body.innerText || "").includes("Creator attaches evidence or admin returns the report task with an audit note."),
            mentionsMissedImpact: (document.body.innerText || "").includes("Blocks complete creator readout unless excused."),
            mentionsMissedShareGate: (document.body.innerText || "").includes("Leadership hold unless the missed read is excused with audit trail."),
            mentionsMissedLeadershipNextAction: (document.body.innerText || "").includes("Resolve 1 missed report read before leadership sharing."),
            mentionsMissedNextStep: (document.body.innerText || "").includes("Open the campaign and excuse only with a written audit reason."),
            mentionsMissedClearance: (document.body.innerText || "").includes("Creator submits proof or admin excuses with a written audit reason."),
            mentionsCorrectionShareGate: (document.body.innerText || "").includes("Leadership hold until creator returns usable proof."),
            mentionsCorrectionLeadershipNextAction: (document.body.innerText || "").includes("Resolve 1 correction request before leadership sharing."),
            mentionsReturnedCorrectionShareGate: (document.body.innerText || "").includes("Leadership hold until corrected proof is reviewed."),
            mentionsReturnedCorrectionLeadershipNextAction: (document.body.innerText || "").includes("Review 1 corrected proof read before sharing."),
            mentionsCorrectionReturned: (document.body.innerText || "").includes("Correction returned"),
            mentionsCorrectedProof: (document.body.innerText || "").includes("Corrected proof awaiting brand review"),
            mentionsReturnedProofFile: (document.body.innerText || "").includes("admin-report-command-returned-proof.png"),
            hasSlaCount: Boolean(document.querySelector('[data-testid="admin-report-sla-breach-count"]')),
            mentionsMissedReport: (document.body.innerText || "").includes("Missed report"),
            mentionsCorrectionRequest: (document.body.innerText || "").includes("Correction request"),
            mentionsRejectedProof: (document.body.innerText || "").includes("Rejected proof"),
            mentionsExportFailure: (document.body.innerText || "").includes("Export failure"),
            linksTargetCampaign: [...document.querySelectorAll('a')].map((link) => link.getAttribute('href') || '').join(" ").includes(${JSON.stringify(`/admin/campaigns/${targets.campaignId}?focus=reporting#admin-reporting-exceptions`)})
          },
          body: document.body.innerText || "",
          links: [...document.querySelectorAll('a')].map((link) => link.getAttribute('href') || ""),
          priorityRail: document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText || "",
          priorityKind: document.querySelector('[data-testid="admin-report-priority-kind"]')?.innerText || "",
          priorityTitle: document.querySelector('[data-testid="admin-report-priority-title"]')?.innerText || "",
          priorityImpact: document.querySelector('[data-testid="admin-report-priority-impact"]')?.innerText || "",
          priorityShareGate: document.querySelector('[data-testid="admin-report-priority-share-gate"]')?.innerText || "",
          priorityAge: document.querySelector('[data-testid="admin-report-priority-age"]')?.innerText || "",
          priorityNextStep: document.querySelector('[data-testid="admin-report-priority-next-step"]')?.innerText || "",
          priorityOwner: document.querySelector('[data-testid="admin-report-priority-owner"]')?.innerText || "",
          priorityClearance: document.querySelector('[data-testid="admin-report-priority-clearance"]')?.innerText || "",
          campaignReadiness: document.querySelector('[data-testid="admin-report-campaign-readiness"]')?.innerText || "",
          rows: [...document.querySelectorAll('[data-testid="admin-report-exception-row"]')].map((row) => row.innerText),
          summary: document.querySelector('[data-testid="admin-report-command-summary"]')?.innerText || "",
          slaCount: document.querySelector('[data-testid="admin-report-sla-breach-count"]')?.innerText || ""
        }))()`,
      ).catch((diagnosticError) => ({
        body: "",
        links: [],
        priorityRail: "",
        priorityKind: "",
        priorityTitle: "",
        rows: [`Unable to read admin report diagnostics: ${diagnosticError.message}`],
        summary: "",
        slaCount: "",
      }));
      console.error(
        `Admin report command center diagnostics:\\n${JSON.stringify(
          { ...diagnostics, consoleErrors },
          null,
          2,
        ).slice(0, 5000)}`,
      );
      throw error;
    }
    await captureScreenshot(client, commandScreenshotPath);

    const commandText = await evaluate(
      client,
      `(() => {
        const links = [...document.querySelectorAll('a')].map((link) => link.getAttribute('href') || '').join("\\n");
        return (document.body.innerText || "") + "\\n" + links;
      })()`,
    );
    const summaryText = await evaluate(
      client,
      `document.querySelector('[data-testid="admin-report-command-summary"]')?.innerText ?? ""`,
    );
    const priorityText = await evaluate(
      client,
      `document.querySelector('[data-testid="admin-report-priority-rail"]')?.innerText ?? ""`,
    );
    const campaignReadinessText = await evaluate(
      client,
      `document.querySelector('[data-testid="admin-report-campaign-readiness"]')?.innerText ?? ""`,
    );
    const rowText = await evaluate(
      client,
      `[...document.querySelectorAll('[data-testid="admin-report-exception-row"]')].map((row) => row.innerText).join("\\n")`,
    );

    await navigate(client, targets.adminCampaignReportingUrl);
    await waitForExpression(
      client,
      `(() => {
        const panel = document.querySelector('[data-testid="admin-campaign-focus-panel"]');
        const rows = [...document.querySelectorAll('[data-testid="admin-reporting-exception-row"]')];
        const evidenceRows = [...document.querySelectorAll('[data-testid="admin-reporting-evidence-review-row"]')];
        const exportRows = [...document.querySelectorAll('[data-testid="admin-reporting-export-failure-row"]')];
        const reason = document.querySelector('[data-testid="admin-reporting-excuse-reason"]');
        const interventionForms = [...document.querySelectorAll('[data-testid="admin-reporting-proof-intervention-form"]')];
        const interventionNote = document.querySelector('[data-testid="admin-reporting-proof-intervention-note"]');
        const interventionSubmit = document.querySelector('[data-testid="admin-reporting-proof-intervention-submit"]');
        const text = document.body.innerText || "";
        const lowerText = text.toLowerCase();
        return Boolean(panel) &&
          rows.length >= 2 &&
          evidenceRows.length >= 2 &&
          exportRows.length >= 1 &&
          Boolean(reason) &&
          interventionForms.length >= 2 &&
          Boolean(interventionNote) &&
          Boolean(interventionSubmit) &&
          text.includes("Review reporting exceptions") &&
          text.includes("Review SLA breach") &&
          text.includes("Proof review older than 24h") &&
          text.includes("Ask the brand owner to review or intervene.") &&
          text.includes("admin-report-command-proof.png") &&
          text.includes("Correction returned") &&
          text.includes("Corrected proof awaiting brand review") &&
          text.includes("admin-report-command-returned-proof.png") &&
          lowerText.includes("failed report exports") &&
          text.includes("Report export failed") &&
          text.includes("Retry export") &&
          text.includes("Needs correction") &&
          text.includes("Why can this missed report be excused?") &&
          text.includes("Required for audit") &&
          text.includes("Mark excused") &&
          text.includes("What did admin do?") &&
          text.includes("Saved to admin audit. Does not verify proof or change report totals.") &&
          text.includes("Record intervention") &&
          text.includes("Review proof");
      })()`,
      "admin campaign reporting drill-in",
      60000,
    );
    await captureScreenshot(client, drillInScreenshotPath);
    const drillInText = await evaluate(
      client,
      `document.body.innerText || ""`,
    );

    await evaluate(
      client,
      `(() => {
        const row = document.querySelector(
          '[data-testid="admin-reporting-evidence-review-row"][data-evidence-id="${seededRows.submittedEvidenceId}"]',
        );
        const note = row?.querySelector('[data-testid="admin-reporting-proof-intervention-note"]');
        const submit = row?.querySelector('[data-testid="admin-reporting-proof-intervention-submit"]');
        if (!row || !note || !submit) {
          throw new Error("Missing proof intervention form");
        }

        const setTextareaValue = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        ).set;
        setTextareaValue.call(note, ${JSON.stringify(ADMIN_REPORT_PROOF_INTERVENTION_NOTE)});
        note.dispatchEvent(new Event("input", { bubbles: true }));
        submit.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const text = document.body.innerText || "";
        return text.includes("Reporting intervention trace") &&
          text.includes("Record proof review intervention") &&
          text.includes(${JSON.stringify(ADMIN_REPORT_PROOF_INTERVENTION_NOTE)}) &&
          document.querySelector('[data-testid="admin-reporting-intervention-trace"]') &&
          document.querySelector('[data-testid="admin-reporting-intervention-reason"]') &&
          text.includes("Review proof") &&
          text.includes("Saved to admin audit. Does not verify proof or change report totals.");
      })()`,
      "admin campaign reporting proof intervention submission",
      60000,
    );
    await captureScreenshot(client, drillInScreenshotPath);

    const proofInterventionAuditRows = await checkedQuery(
      "Verify admin report command center proof intervention audit entry",
      admin
        .from("admin_audit_log")
        .select("id, action, metadata")
        .eq("target_type", "content_performance_evidence")
        .eq("target_id", seededRows.submittedEvidenceId)
        .eq("action", "record_proof_review_intervention")
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const proofInterventionAuditEntry = proofInterventionAuditRows?.[0];
    if (
      !proofInterventionAuditEntry ||
      proofInterventionAuditEntry.metadata?.reason !==
        ADMIN_REPORT_PROOF_INTERVENTION_NOTE ||
      proofInterventionAuditEntry.metadata?.verification_status !== "submitted"
    ) {
      throw new Error(
        `Proof intervention audit entry is missing the governed note: ${JSON.stringify(proofInterventionAuditEntry)}`,
      );
    }

    const intervenedEvidence = await checkedQuery(
      "Verify admin report command center proof intervention preserves evidence truth",
      admin
        .from("content_performance_evidence")
        .select("id, verification_status, performance_id")
        .eq("id", seededRows.submittedEvidenceId)
        .single(),
    );
    if (
      intervenedEvidence.verification_status !== "submitted" ||
      intervenedEvidence.performance_id !== null
    ) {
      throw new Error(
        `Proof intervention changed evidence truth: ${JSON.stringify(intervenedEvidence)}`,
      );
    }

    await evaluate(
      client,
      `(() => {
        const form = document.querySelector('[data-testid="admin-reporting-export-retry-form"]');
        const submit = form?.querySelector('button[type="submit"]');
        if (!form || !submit) throw new Error("Missing export retry form");
        submit.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const text = document.body.innerText || "";
        return text.includes("Reporting intervention trace") &&
          text.includes("Retry report export") &&
          text.includes("Created replacement export");
      })()`,
      "admin campaign report export retry submission",
      60000,
    );
    await captureScreenshot(client, drillInScreenshotPath);

    const retriedExportJobs = await checkedQuery(
      "Verify admin report command center retried export job",
      admin
        .from("report_export_jobs")
        .select("id, campaign_id, format, status, storage_path")
        .eq("campaign_id", targets.campaignId)
        .neq("id", seededRows.exportJobId)
        .eq("format", "html")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const retriedExportJob = retriedExportJobs?.[0];
    if (!retriedExportJob?.storage_path) {
      throw new Error(
        `Report export retry did not create a durable replacement job: ${JSON.stringify(retriedExportJob)}`,
      );
    }

    const exportRetryAuditRows = await checkedQuery(
      "Verify admin report command center export retry audit entry",
      admin
        .from("admin_audit_log")
        .select("id, action, metadata")
        .eq("target_type", "report_export_job")
        .eq("target_id", seededRows.exportJobId)
        .eq("action", "retry_report_export")
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const exportRetryAuditEntry = exportRetryAuditRows?.[0];
    if (
      !exportRetryAuditEntry ||
      exportRetryAuditEntry.metadata?.new_job_id !== retriedExportJob.id ||
      exportRetryAuditEntry.metadata?.format !== "html"
    ) {
      throw new Error(
        `Report export retry audit entry is missing the replacement job: ${JSON.stringify(exportRetryAuditEntry)}`,
      );
    }

    await evaluate(
      client,
      `(() => {
        const reason = document.querySelector('[data-testid="admin-reporting-excuse-reason"]');
        const submit = document.querySelector('[data-testid="admin-reporting-excuse-submit"]');
        if (!reason || !submit) throw new Error("Missing governed excuse form");

        const setTextareaValue = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        ).set;
        setTextareaValue.call(reason, ${JSON.stringify(ADMIN_REPORT_EXCUSE_REASON)});
        reason.dispatchEvent(new Event("input", { bubbles: true }));
        submit.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const text = document.body.innerText || "";
        return text.includes("Review reporting exceptions") &&
          text.includes("Reporting intervention trace") &&
          text.includes(${JSON.stringify(ADMIN_REPORT_EXCUSE_REASON)}) &&
          document.querySelector('[data-testid="admin-reporting-intervention-trace"]') &&
          document.querySelector('[data-testid="admin-reporting-intervention-reason"]') &&
          text.includes("Review proof") &&
          !text.includes("Mark excused") &&
          !document.querySelector('[data-testid="admin-reporting-excuse-reason"]');
      })()`,
      "admin campaign reporting excuse submission",
      60000,
    );
    await captureScreenshot(client, drillInScreenshotPath);

    const excusedTask = await checkedQuery(
      "Verify admin report command center excused task",
      admin
        .from("campaign_report_tasks")
        .select("id, status, review_note, missed_at, excused_at")
        .eq("id", seededRows.missedTaskId)
        .single(),
    );
    if (
      excusedTask.status !== "excused" ||
      excusedTask.missed_at !== null ||
      !excusedTask.excused_at ||
      excusedTask.review_note !== `Excused by admin: ${ADMIN_REPORT_EXCUSE_REASON}`
    ) {
      throw new Error(
        `Report task was not excused with the governed reason: ${JSON.stringify(excusedTask)}`,
      );
    }

    const auditRows = await checkedQuery(
      "Verify admin report command center audit entry",
      admin
        .from("admin_audit_log")
        .select("id, action, metadata")
        .eq("target_type", "campaign_report_task")
        .eq("target_id", seededRows.missedTaskId)
        .eq("action", "excuse_report_task")
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const auditEntry = auditRows?.[0];
    if (
      !auditEntry ||
      auditEntry.metadata?.reason !== ADMIN_REPORT_EXCUSE_REASON ||
      auditEntry.metadata?.new_status !== "excused"
    ) {
      throw new Error(
        `Report task excuse audit entry is missing the governed reason: ${JSON.stringify(auditEntry)}`,
      );
    }

    validateAdminReportCommandCenterSmoke({
      campaignId: targets.campaignId,
      campaignReadinessText,
      commandText,
      consoleErrors,
      drillInText,
      priorityText,
      rowText,
      summaryText,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      commandScreenshotPath,
      devServerStarted: Boolean(devServer),
      drillInScreenshotPath,
      excusedTask,
      fixture,
      proofInterventionAuditEntry,
      retriedExportJob,
      seededRows,
    };
  } finally {
    client?.close();
    await stopChrome(chrome);
    if (userDataDir) {
      await rm(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    }
    await cleanupAdminReportCommandCenterAuditRows(admin, seededRows);
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    await stopDevServer(devServer);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAdminReportCommandCenterSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
