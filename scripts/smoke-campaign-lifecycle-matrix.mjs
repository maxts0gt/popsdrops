#!/usr/bin/env node

import { randomUUID } from "node:crypto";
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
  SMOKE_CAMPAIGN_TITLE,
  captureScreenshot,
  checkedQuery,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";

export const DEFAULT_CAMPAIGN_LIFECYCLE_MATRIX_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000115";
export const DEFAULT_CAMPAIGN_LIFECYCLE_MATRIX_SCREENSHOT_PATH =
  "output/playwright/campaign-lifecycle-matrix-smoke.png";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const CLOSED_PUBLIC_APPLICATION_MESSAGE =
  "This campaign is no longer accepting applications.";
const CLOSED_CREATOR_WORK_MESSAGE =
  "This campaign is read-only; completed work and proof stay visible.";

export const CAMPAIGN_LIFECYCLE_MATRIX = [
  {
    key: "draft",
    status: "draft",
    deadlineOffsetDays: 5,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: true,
      paidScopeUpdatable: true,
      reportingRequirementsEditable: true,
      agreementRulesEditable: true,
      announcementWritable: false,
      applicationDecisionable: false,
      publicApplyOpen: false,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: false,
      creatorWorkWritable: false,
      closedArchiveVisible: false,
    },
  },
  {
    key: "recruiting_open",
    status: "recruiting",
    deadlineOffsetDays: 5,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: true,
      paidScopeUpdatable: true,
      reportingRequirementsEditable: true,
      agreementRulesEditable: true,
      announcementWritable: true,
      applicationDecisionable: true,
      publicApplyOpen: true,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
      closedArchiveVisible: false,
    },
  },
  {
    key: "recruiting_deadline_passed",
    status: "recruiting",
    deadlineOffsetDays: -1,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: true,
      applicationDecisionable: true,
      publicApplyOpen: false,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
      closedArchiveVisible: false,
      closedInviteReason:
        "The application deadline has passed; saved outreach stays visible for audit.",
    },
  },
  {
    key: "in_progress",
    status: "in_progress",
    deadlineOffsetDays: 5,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: true,
      applicationDecisionable: false,
      publicApplyOpen: false,
      contentReviewDecisionable: true,
      proofReviewDecisionable: true,
      creatorRoomVisible: true,
      creatorWorkWritable: true,
      closedArchiveVisible: false,
      closedInviteReason:
        "Creator selection is closed because campaign work has started.",
    },
  },
  {
    key: "publishing",
    status: "publishing",
    deadlineOffsetDays: 5,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: true,
      applicationDecisionable: false,
      publicApplyOpen: false,
      contentReviewDecisionable: true,
      proofReviewDecisionable: true,
      creatorRoomVisible: true,
      creatorWorkWritable: true,
      closedArchiveVisible: false,
      closedInviteReason:
        "Creator selection is closed because campaign work has started.",
    },
  },
  {
    key: "monitoring",
    status: "monitoring",
    deadlineOffsetDays: 5,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: true,
      applicationDecisionable: false,
      publicApplyOpen: false,
      contentReviewDecisionable: true,
      proofReviewDecisionable: true,
      creatorRoomVisible: true,
      creatorWorkWritable: true,
      closedArchiveVisible: false,
      closedInviteReason:
        "Creator selection is closed because campaign work has started.",
    },
  },
  {
    key: "paused",
    status: "paused",
    deadlineOffsetDays: 5,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: false,
      applicationDecisionable: false,
      publicApplyOpen: false,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
      closedArchiveVisible: false,
      closedInviteReason: "Creator invites are paused until the campaign resumes.",
    },
  },
  {
    key: "completed",
    status: "completed",
    deadlineOffsetDays: -1,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: false,
      applicationDecisionable: false,
      publicApplyOpen: false,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
      closedArchiveVisible: true,
      closedInviteReason:
        "Campaign is complete; saved outreach stays visible for audit.",
    },
  },
  {
    key: "cancelled",
    status: "cancelled",
    deadlineOffsetDays: -1,
    expected: {
      inviteLinkShareable: false,
      inviteImportWritable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: false,
      applicationDecisionable: false,
      publicApplyOpen: false,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
      closedArchiveVisible: true,
      closedInviteReason:
        "Campaign was cancelled; saved outreach stays visible for audit.",
    },
  },
];

export function buildCampaignLifecycleMatrixTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_CAMPAIGN_LIFECYCLE_MATRIX_ID ||
    DEFAULT_CAMPAIGN_LIFECYCLE_MATRIX_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    publicApplyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    creatorCampaignUrl: `${normalizedBaseUrl}/i/campaigns/${campaignId}?tab=submit`,
  };
}

function dateDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function hasVisibleControl(count) {
  return Number(count) > 0;
}

function assertExpectedControl({
  actual,
  expected,
  phaseKey,
  label,
  violation,
}) {
  if (expected && !actual) {
    throw new Error(`${phaseKey} does not expose ${label}`);
  }

  if (!expected && actual) {
    throw new Error(`${phaseKey} exposes ${violation ?? label}`);
  }
}

export function validateCampaignLifecycleMatrix({ phaseStates, requireAll = false }) {
  const statesByKey = new Map(phaseStates.map((state) => [state.key, state]));

  if (requireAll) {
    for (const phase of CAMPAIGN_LIFECYCLE_MATRIX) {
      if (!statesByKey.has(phase.key)) {
        throw new Error(`Missing lifecycle phase state: ${phase.key}`);
      }
    }
  }

  for (const state of phaseStates) {
    const phase = CAMPAIGN_LIFECYCLE_MATRIX.find((item) => item.key === state.key);
    if (!phase) throw new Error(`Unknown lifecycle phase state: ${state.key}`);

    if (!state.pageText.includes(SMOKE_CAMPAIGN_TITLE)) {
      throw new Error(`${phase.key} did not render the smoke campaign.`);
    }

    assertExpectedControl({
      actual: hasVisibleControl(state.visibleInviteCopyCount),
      expected: phase.expected.inviteLinkShareable,
      phaseKey: phase.key,
      label: "invite sharing",
    });
    assertExpectedControl({
      actual: Boolean(state.inviteImportWritable),
      expected: phase.expected.inviteImportWritable,
      phaseKey: phase.key,
      label: "invite import writing",
    });
    if (
      phase.expected.closedInviteReason &&
      !String(state.creatorsText ?? "").includes(phase.expected.closedInviteReason)
    ) {
      throw new Error(
        `${phase.key} does not explain why creator invites are closed. Expected: ${phase.expected.closedInviteReason}`,
      );
    }
    assertExpectedControl({
      actual: hasVisibleControl(state.visiblePaidScopeControlCount),
      expected: phase.expected.paidScopeUpdatable,
      phaseKey: phase.key,
      label: "paid scope updates",
    });
    assertExpectedControl({
      actual: hasVisibleControl(state.visibleReportingRequirementControlCount),
      expected: phase.expected.reportingRequirementsEditable,
      phaseKey: phase.key,
      label: "reporting requirement edits",
    });
    assertExpectedControl({
      actual: hasVisibleControl(state.visibleAgreementConfigureCount),
      expected: phase.expected.agreementRulesEditable,
      phaseKey: phase.key,
      label: "agreement rule edits",
    });
    assertExpectedControl({
      actual: hasVisibleControl(state.visibleAnnouncementControlCount),
      expected: phase.expected.announcementWritable,
      phaseKey: phase.key,
      label: "creator announcements",
    });
    if (
      !phase.expected.paidScopeUpdatable &&
      !hasVisibleControl(state.visiblePaidScopeClosedNoteCount)
    ) {
      throw new Error(`${phase.key} does not explain locked paid scope.`);
    }
    assertExpectedControl({
      actual:
        hasVisibleControl(state.visibleInviteSendButtonCount) ||
        hasVisibleControl(state.visibleInviteRemoveButtonCount),
      expected: phase.expected.inviteLinkShareable || phase.expected.inviteImportWritable,
      phaseKey: phase.key,
      label: "saved invite management",
    });
    assertExpectedControl({
      actual:
        hasVisibleControl(state.visibleApplicantActionCount) ||
        hasVisibleControl(state.visibleApplicantSelectCount),
      expected: phase.expected.applicationDecisionable,
      phaseKey: phase.key,
      label: "applicant decisions",
    });
    assertExpectedControl({
      actual:
        state.publicApplyText.includes(SMOKE_CAMPAIGN_TITLE) &&
        !state.publicApplyText.includes(CLOSED_PUBLIC_APPLICATION_MESSAGE) &&
        !state.publicApplyText.includes("Campaign not found"),
      expected: phase.expected.publicApplyOpen,
      phaseKey: phase.key,
      label: "public application entry",
    });

    const publicCampaignRendered =
      state.publicApplyText.includes(SMOKE_CAMPAIGN_TITLE) &&
      !state.publicApplyText.includes("Campaign not found");

    if (publicCampaignRendered) {
      assertExpectedControl({
        actual: Boolean(state.privateInviteActiveVisible),
        expected: phase.expected.publicApplyOpen,
        phaseKey: phase.key,
        label: "active private invite copy",
        violation: "active private invite copy",
      });

      if (!phase.expected.publicApplyOpen && !state.privateInviteClosedAuditVisible) {
        throw new Error(`${phase.key} does not show private invite audit copy.`);
      }
    }

    assertExpectedControl({
      actual: hasVisibleControl(state.visibleContentDecisionCount),
      expected: phase.expected.contentReviewDecisionable,
      phaseKey: phase.key,
      label: "content review decisions",
    });
    assertExpectedControl({
      actual: hasVisibleControl(state.visibleProofDecisionCount),
      expected: phase.expected.proofReviewDecisionable,
      phaseKey: phase.key,
      label: "proof review decisions",
    });
    assertExpectedControl({
      actual: Boolean(state.creatorRoomVisible),
      expected: phase.expected.creatorRoomVisible,
      phaseKey: phase.key,
      label: "creator work room visibility",
    });
    assertExpectedControl({
      actual: hasVisibleControl(state.visibleCreatorWorkControlCount),
      expected: phase.expected.creatorWorkWritable,
      phaseKey: phase.key,
      label: "creator work controls",
    });

    if (
      phase.expected.creatorRoomVisible &&
      !phase.expected.creatorWorkWritable &&
      !state.creatorText.includes(CLOSED_CREATOR_WORK_MESSAGE)
    ) {
      throw new Error(
        `${phase.key} does not show creator read-only state. Creator text: ${state.creatorText
          .replace(/\s+/g, " ")
          .slice(0, 420)}`,
      );
    }

    if (phase.expected.closedArchiveVisible && !state.closedArchiveVisible) {
      throw new Error(`${phase.key} does not preserve closed archive visibility.`);
    }

    if (state.consoleErrors.length > 0) {
      throw new Error(`${phase.key} console errors found: ${state.consoleErrors.join(" | ")}`);
    }
  }

  return { ok: true };
}

async function seedLifecycleMatrixRows(admin, targets, creatorId) {
  const now = new Date().toISOString();
  const pendingApplicationId = randomUUID();
  const memberId = randomUUID();
  const submittedSubmissionId = randomUUID();
  const approvedSubmissionId = randomUUID();
  const publishedSubmissionId = randomUUID();
  const reportTaskId = randomUUID();
  const pendingReportTaskId = randomUUID();

  await checkedQuery(
    "Create lifecycle matrix pending application",
    admin.from("campaign_applications").insert({
      id: pendingApplicationId,
      campaign_id: targets.campaignId,
      creator_id: creatorId,
      proposed_rate: 275,
      pitch: "Lifecycle matrix smoke application.",
      status: "pending",
    }),
  );

  await checkedQuery(
    "Create lifecycle matrix member",
    admin.from("campaign_members").insert({
      id: memberId,
      campaign_id: targets.campaignId,
      creator_id: creatorId,
      accepted_rate: 100,
      payment_status: "pending",
      joined_at: now,
    }),
  );

  await checkedQuery(
    "Create lifecycle matrix submitted content",
    admin.from("content_submissions").insert({
      id: submittedSubmissionId,
      campaign_member_id: memberId,
      content_url: "https://example.com/lifecycle-matrix-draft",
      caption: "Lifecycle matrix submitted draft.",
      platform: "tiktok",
      status: "submitted",
      version: 1,
      revision_count: 0,
      submitted_at: now,
    }),
  );

  await checkedQuery(
    "Create lifecycle matrix approved content",
    admin.from("content_submissions").insert({
      id: approvedSubmissionId,
      campaign_member_id: memberId,
      content_url: "https://example.com/lifecycle-matrix-approved",
      caption: "Lifecycle matrix approved content.",
      platform: "tiktok",
      status: "approved",
      version: 1,
      revision_count: 0,
      submitted_at: now,
      reviewed_at: now,
    }),
  );

  await checkedQuery(
    "Create lifecycle matrix published content",
    admin.from("content_submissions").insert({
      id: publishedSubmissionId,
      campaign_member_id: memberId,
      content_url: "https://example.com/lifecycle-matrix-published",
      caption: "Lifecycle matrix published content.",
      platform: "tiktok",
      status: "published",
      version: 1,
      revision_count: 0,
      submitted_at: now,
      reviewed_at: now,
      published_url: "https://www.tiktok.com/@popsdrops-smoke/video/lifecycle",
      published_at: now,
    }),
  );

  await checkedQuery(
    "Create lifecycle matrix submitted report task",
    admin.from("campaign_report_tasks").insert({
      id: reportTaskId,
      campaign_id: targets.campaignId,
      campaign_member_id: memberId,
      task_key: "final_report",
      due_at: now,
      status: "submitted",
      submitted_at: now,
    }),
  );

  await checkedQuery(
    "Create lifecycle matrix pending report task",
    admin.from("campaign_report_tasks").insert({
      id: pendingReportTaskId,
      campaign_id: targets.campaignId,
      campaign_member_id: memberId,
      task_key: "extra:lifecycle-matrix",
      due_at: now,
      status: "pending",
    }),
  );

  await checkedQuery(
    "Create lifecycle matrix proof evidence",
    admin.from("content_performance").insert({
      submission_id: publishedSubmissionId,
      report_task_id: reportTaskId,
      measurement_type: "final_7d",
      views: 1234,
      likes: 101,
      comments: 9,
      shares: 12,
      screenshot_url: "https://example.com/lifecycle-matrix-proof.png",
      verification_status: "submitted",
      reported_at: now,
    }),
  );

  return {
    pendingApplicationId,
    memberId,
    submittedSubmissionId,
    approvedSubmissionId,
    publishedSubmissionId,
    reportTaskId,
    pendingReportTaskId,
  };
}

async function readCampaignApplicationStatus(admin, applicationId) {
  const row = await checkedQuery(
    "Read lifecycle matrix application status",
    admin
      .from("campaign_applications")
      .select("status")
      .eq("id", applicationId)
      .single(),
  );

  return row.status;
}

async function smokePostDeadlineApplicationDecision({
  admin,
  applicationId,
  client,
  phase,
  targets,
}) {
  await setCampaignPhase(admin, targets.campaignId, phase);
  const beforeStatus = await readCampaignApplicationStatus(admin, applicationId);
  if (beforeStatus !== "pending") {
    throw new Error(
      `Expected a pending applicant before post-deadline decision smoke. Got ${beforeStatus}.`,
    );
  }

  await navigate(
    client,
    `${targets.brandCampaignUrl}?tab=creators&matrix=post-deadline-decision`,
  );
  await waitForExpression(
    client,
    `(() => {
      const text = document.body.innerText;
      const actions = [...document.querySelectorAll('[data-testid="campaign-applicant-action"]')]
        .filter((node) => node.offsetParent !== null);
      return text.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
        actions.some((node) => node.textContent.includes("Decline"));
    })()`,
    "post-deadline applicant decision controls",
  );

  await evaluate(
    client,
    `(() => {
      const action = [...document.querySelectorAll('[data-testid="campaign-applicant-action"]')]
        .find((node) => node.offsetParent !== null && node.textContent.includes("Decline"));
      const button = [...(action?.querySelectorAll("button") || [])]
        .find((node) => node.textContent.includes("Decline"));
      if (!button) throw new Error("Missing post-deadline Decline button");
      button.click();
      return true;
    })()`,
  );

  let afterStatus = beforeStatus;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    afterStatus = await readCampaignApplicationStatus(admin, applicationId);
    if (afterStatus === "rejected") break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (afterStatus !== "rejected") {
    throw new Error(
      `Expected brand applicant decision to work after intake deadline. Before: ${beforeStatus}. After: ${afterStatus}.`,
    );
  }

  return {
    applicationId,
    beforeStatus,
    afterStatus,
  };
}

async function setCampaignPhase(admin, campaignId, phase) {
  const timestamp = new Date().toISOString();
  await checkedQuery(
    `Set lifecycle matrix campaign phase ${phase.key}`,
    admin
      .from("campaigns")
      .update({
        status: phase.status,
        application_deadline: dateDaysFromNow(phase.deadlineOffsetDays),
        completed_at: phase.status === "completed" ? timestamp : null,
        updated_at: timestamp,
      })
      .eq("id", campaignId),
  );
}

async function waitForCampaignTitle(client, description) {
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)})`,
    description,
  );
}

async function inspectPublicApply(client, targets, phase) {
  const inviteId = targets.inviteId || `lifecycle-matrix-${phase.key}`;
  const publicApplyInviteUrl = `${targets.publicApplyUrl}?invite=${encodeURIComponent(inviteId)}&matrix=${phase.key}`;
  await navigate(client, publicApplyInviteUrl);
  await waitForExpression(
    client,
    `(() => {
      const text = document.body.innerText;
      return text.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) ||
        text.includes(${JSON.stringify(CLOSED_PUBLIC_APPLICATION_MESSAGE)}) ||
        text.includes("Campaign not found");
    })()`,
    `${phase.key} public apply`,
  );
  return evaluate(
    client,
    `(() => {
      const text = document.body.innerText;
      return {
        publicApplyText: text,
        privateInviteActiveVisible:
          Boolean(document.querySelector('[data-testid="public-apply-private-invite"]')) &&
          text.includes("Apply here; locked materials open after acceptance."),
        privateInviteClosedAuditVisible:
          Boolean(document.querySelector('[data-testid="public-apply-private-invite"]')) &&
          text.includes("This private invite is preserved"),
      };
    })()`,
  );
}

async function inspectBrandPhase(client, targets, phase) {
  await navigate(client, `${targets.brandCampaignUrl}?matrix=${phase.key}`);
  await waitForCampaignTitle(client, `${phase.key} brand overview`);

  const overviewState = await evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      return {
        overviewText: document.body.innerText,
        visibleInviteCopyCount: visible('[data-testid="campaign-invite-copy"]').length,
        visibleInviteLockedCount: visible('[data-testid="campaign-invite-locked"]').length,
        visibleAnnouncementControlCount: visible('[data-testid="campaign-announcement-control"]').length,
      };
    })()`,
  );

  await navigate(client, `${targets.brandCampaignUrl}?tab=brief&matrix=${phase.key}`);
  await waitForCampaignTitle(client, `${phase.key} brand setup`);
  await waitForExpression(
    client,
    `(() => {
      const scope = document.querySelector('[data-testid="campaign-billing-scope"]');
      const control = document.querySelector('[data-testid="campaign-capacity-upgrade-control"]');
      const note = document.querySelector('[data-testid="campaign-capacity-closed-note"]');
      return Boolean(scope && ${
        phase.expected.paidScopeUpdatable
          ? "control && control.offsetParent !== null"
          : "note && note.offsetParent !== null"
      });
    })()`,
    `${phase.key} paid scope state`,
  );
  const setupState = await evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      const enabledVisible = (selector) =>
        visible(selector).filter((node) => !node.disabled);
      return {
        setupText: document.body.innerText,
        visiblePaidScopeControlCount: visible('[data-testid="campaign-capacity-upgrade-control"]').length,
        visiblePaidScopeClosedNoteCount: visible('[data-testid="campaign-capacity-closed-note"]').length,
        visibleReportingRequirementControlCount:
          enabledVisible('[data-testid="campaign-reporting-requirement-save"]').length +
          enabledVisible('[data-testid="campaign-reporting-metric-toggle"]').length,
        visibleAgreementConfigureCount: enabledVisible('[data-testid="brand-agreement-configure"]').length,
      };
    })()`,
  );

  await navigate(client, `${targets.brandCampaignUrl}?tab=creators&matrix=${phase.key}`);
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="campaign-creator-invite-import"]'))`,
    `${phase.key} creator invite tray`,
  );
  const creatorState = await evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      const enabledVisible = (selector) =>
        visible(selector).filter((node) => !node.disabled);
      const textarea = document.querySelector('[data-testid="campaign-invite-import-textarea"]');
      return {
        creatorsText: document.body.innerText,
        inviteImportWritable: Boolean(textarea && textarea.offsetParent !== null && !textarea.disabled),
        visibleInviteSendButtonCount: enabledVisible('[data-testid="campaign-invite-send"]').length,
        visibleInviteRemoveButtonCount: enabledVisible('[data-testid="campaign-invite-remove"]').length,
        visibleApplicantActionCount: enabledVisible('[data-testid="campaign-applicant-action"]').length,
        visibleApplicantSelectCount: enabledVisible('[data-testid="campaign-applicant-select"], [data-testid="campaign-applicant-select-all"]').length,
      };
    })()`,
  );

  await navigate(client, `${targets.brandCampaignUrl}?tab=content&matrix=${phase.key}`);
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="campaign-content-table"]'))`,
    `${phase.key} content table`,
  );
  const contentState = await evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      return {
        contentText: document.body.innerText,
        visibleContentDecisionCount: visible(
          '[data-testid="campaign-content-request-revision"], [data-testid="campaign-content-approve"]'
        ).length,
        contentReadOnlyVisible: visible('[data-testid="campaign-content-read-only-stage"]').length > 0,
      };
    })()`,
  );

  await navigate(client, `${targets.brandCampaignUrl}?tab=reporting&matrix=${phase.key}`);
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="campaign-reporting-proof-queue"]'))`,
    `${phase.key} proof queue`,
  );
  const reportingState = await evaluate(
    client,
    `(() => {
      const visible = (selector) =>
        [...document.querySelectorAll(selector)].filter((node) => node.offsetParent !== null);
      return {
        reportingText: document.body.innerText,
        visibleProofDecisionCount: visible(
          '[data-testid="campaign-reporting-verify-proof"], [data-testid="campaign-reporting-request-correction"]'
        ).length + visible(
          '[data-testid="campaign-reporting-follow-up-missed"], [data-testid="campaign-reporting-mark-excused"]'
        ).length,
        proofReadOnlyVisible: visible('[data-testid="campaign-reporting-read-only-stage"]').length > 0,
      };
    })()`,
  );

  return {
    ...overviewState,
    ...setupState,
    ...creatorState,
    ...contentState,
    ...reportingState,
    pageText: [
      overviewState.overviewText,
      setupState.setupText,
      creatorState.creatorsText,
      contentState.contentText,
      reportingState.reportingText,
    ].join("\\n"),
    closedArchiveVisible:
      creatorState.creatorsText.includes("Creator invites are closed for this campaign stage.") &&
      contentState.contentReadOnlyVisible &&
      reportingState.proofReadOnlyVisible,
  };
}

async function inspectCreatorPhase(client, targets, phase) {
  await navigate(client, `${targets.creatorCampaignUrl}&matrix=${phase.key}`);
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="creator-submit-workspace"]')) ||
      document.body.innerText.includes("Campaign not found")`,
    `${phase.key} creator submit route`,
  );

  return evaluate(
    client,
    `(() => {
      const visible = (node) => node.offsetParent !== null;
      const workButtonPattern = /Submit draft|Save live URL|Send .* proof|Resubmit proof|Add read/;
      const workButtons = [...document.querySelectorAll('button')]
        .filter(visible)
        .filter((button) => workButtonPattern.test(button.innerText || ""));
      const workPanels = [...document.querySelectorAll(
        '[data-testid="performance-evidence-block"], [data-testid="performance-metric-grid"]'
      )].filter(visible);
      const contentFormHints = [...document.querySelectorAll('input, textarea')]
        .filter(visible)
        .filter((node) => {
          const aria = node.getAttribute("aria-label") || "";
          const placeholder = node.getAttribute("placeholder") || "";
          return /Draft content link|Notes for brand|Drive, Dropbox|Frame\\.io/.test(
            aria + " " + placeholder,
          );
        });

      return {
        creatorText: document.body.innerText,
        creatorRoomVisible: (() => {
          const creatorWorkspace = document.querySelector('[data-testid="creator-submit-workspace"]');
          return Boolean(creatorWorkspace && creatorWorkspace.offsetParent !== null);
        })(),
        creatorReadOnlyVisible: (() => {
          const readOnlyBanner = document.querySelector('[data-testid="creator-work-read-only-stage"]');
          return Boolean(readOnlyBanner && readOnlyBanner.offsetParent !== null);
        })(),
        visibleCreatorWorkControlCount:
          workButtons.length + workPanels.length + contentFormHints.length,
      };
    })()`,
  );
}

export async function runCampaignLifecycleMatrixSmoke() {
  await loadLocalEnv();

  process.env.POPSDROPS_SMOKE_QUEUE_ONLY ||= "1";

  const targets = buildCampaignLifecycleMatrixTargets();
  process.env.NEXT_PUBLIC_APP_URL = targets.baseUrl;

  const screenshotPath = path.resolve(
    process.env.SMOKE_CAMPAIGN_LIFECYCLE_MATRIX_SCREENSHOT_PATH ||
      DEFAULT_CAMPAIGN_LIFECYCLE_MATRIX_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  const { creatorId } = await setupApplicationFlowSmokeData(admin, targets);
  const seededRows = await seedLifecycleMatrixRows(admin, targets, creatorId);

  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-campaign-lifecycle-matrix-"),
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

    const brandAndPublicStates = new Map();
    for (const phase of CAMPAIGN_LIFECYCLE_MATRIX) {
      await setCampaignPhase(admin, targets.campaignId, phase);
      const publicApplyState = await inspectPublicApply(client, targets, phase);
      const brandState = await inspectBrandPhase(client, targets, phase);
      brandAndPublicStates.set(phase.key, { ...brandState, ...publicApplyState });
    }

    await loginForSmoke(client, {
      loginUrl: targets.creatorLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/i/home`,
      description: "creator dev login redirect",
    });

    const phaseStates = [];
    for (const phase of CAMPAIGN_LIFECYCLE_MATRIX) {
      await setCampaignPhase(admin, targets.campaignId, phase);
      const creatorState = await inspectCreatorPhase(client, targets, phase);
      const brandState = brandAndPublicStates.get(phase.key);
      phaseStates.push({
        key: phase.key,
        ...brandState,
        ...creatorState,
        consoleErrors,
      });
    }

    validateCampaignLifecycleMatrix({ phaseStates, requireAll: true });

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect for post-deadline decision",
    });
    const postDeadlineDecision = await smokePostDeadlineApplicationDecision({
      admin,
      applicationId: seededRows.pendingApplicationId,
      client,
      phase: CAMPAIGN_LIFECYCLE_MATRIX.find(
        (item) => item.key === "recruiting_deadline_passed",
      ),
      targets,
    });

    await setCampaignPhase(
      admin,
      targets.campaignId,
      CAMPAIGN_LIFECYCLE_MATRIX.find((phase) => phase.key === "completed"),
    );
    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect for final screenshot",
    });
    await navigate(client, `${targets.brandCampaignUrl}?tab=creators&matrix=screenshot`);
    await waitForExpression(
      client,
      `Boolean(document.querySelector('[data-testid="campaign-creator-invite-import"]'))`,
      "final lifecycle matrix screenshot tray",
    );
    await evaluate(
      client,
      `(() => {
        const tray = document.querySelector('[data-testid="campaign-creator-invite-import"]');
        if (!tray) throw new Error("Missing lifecycle matrix tray");
        const top = tray.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await captureScreenshot(client, screenshotPath);

    return {
      ok: true,
      campaignId: targets.campaignId,
      phases: phaseStates.map((state) => ({
        key: state.key,
        visibleInviteCopyCount: state.visibleInviteCopyCount,
        visiblePaidScopeControlCount: state.visiblePaidScopeControlCount,
        visiblePaidScopeClosedNoteCount: state.visiblePaidScopeClosedNoteCount,
        visibleReportingRequirementControlCount:
          state.visibleReportingRequirementControlCount,
        visibleAgreementConfigureCount: state.visibleAgreementConfigureCount,
        visibleAnnouncementControlCount: state.visibleAnnouncementControlCount,
        inviteImportWritable: state.inviteImportWritable,
        visibleApplicantActionCount: state.visibleApplicantActionCount,
        visibleContentDecisionCount: state.visibleContentDecisionCount,
        visibleProofDecisionCount: state.visibleProofDecisionCount,
        visibleCreatorWorkControlCount: state.visibleCreatorWorkControlCount,
      })),
      postDeadlineDecision,
      screenshotPath,
    };
  } finally {
    client?.close();
    chrome?.kill();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId).catch(
      (error) => {
        process.stderr.write(`[smoke] Cleanup failed: ${error.message}\\n`);
      },
    );
    await stopDevServer(devServer);
  }
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  runCampaignLifecycleMatrixSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
