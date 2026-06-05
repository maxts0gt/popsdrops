import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_LIFECYCLE_MATRIX,
  validateCampaignLifecycleMatrix,
} from "./smoke-campaign-lifecycle-matrix.mjs";
import { SMOKE_CAMPAIGN_TITLE } from "./smoke-application-flow.mjs";

describe("campaign lifecycle matrix smoke contract", () => {
  it("covers every campaign stage and the recruiting deadline edge", () => {
    expect(CAMPAIGN_LIFECYCLE_MATRIX.map((phase) => phase.key)).toEqual([
      "draft",
      "recruiting_open",
      "recruiting_deadline_passed",
      "in_progress",
      "publishing",
      "monitoring",
      "paused",
      "completed",
      "cancelled",
    ]);

    expect(
      CAMPAIGN_LIFECYCLE_MATRIX.find((phase) => phase.key === "recruiting_open")
        ?.expected,
    ).toMatchObject({
      inviteLinkShareable: false,
      inviteImportWritable: true,
      paidScopeUpdatable: true,
      reportingRequirementsEditable: true,
      agreementRulesEditable: true,
      announcementWritable: true,
      applicationDecisionable: true,
      publicApplyOpen: true,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
    });

    expect(
      CAMPAIGN_LIFECYCLE_MATRIX.find(
        (phase) => phase.key === "recruiting_deadline_passed",
      )?.expected,
    ).toMatchObject({
      inviteImportWritable: false,
      applicationDecisionable: true,
      publicApplyOpen: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
    });

    expect(
      CAMPAIGN_LIFECYCLE_MATRIX.find((phase) => phase.key === "in_progress")
        ?.expected,
    ).toMatchObject({
      inviteLinkShareable: false,
      paidScopeUpdatable: false,
      reportingRequirementsEditable: false,
      agreementRulesEditable: false,
      announcementWritable: true,
      applicationDecisionable: false,
      contentReviewDecisionable: true,
      proofReviewDecisionable: true,
      creatorRoomVisible: true,
      creatorWorkWritable: true,
    });

    expect(
      CAMPAIGN_LIFECYCLE_MATRIX.find((phase) => phase.key === "completed")
        ?.expected,
    ).toMatchObject({
      inviteLinkShareable: false,
      inviteImportWritable: false,
      announcementWritable: false,
      applicationDecisionable: false,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
      closedArchiveVisible: true,
    });

    expect(
      CAMPAIGN_LIFECYCLE_MATRIX.find((phase) => phase.key === "paused")
        ?.expected,
    ).toMatchObject({
      inviteLinkShareable: false,
      inviteImportWritable: false,
      announcementWritable: false,
      applicationDecisionable: false,
      contentReviewDecisionable: false,
      proofReviewDecisionable: false,
      creatorRoomVisible: true,
      creatorWorkWritable: false,
      closedArchiveVisible: false,
    });
  });

  it("keeps draft hidden but accepted recruiting rooms read-only", () => {
    expect(() =>
      validateCampaignLifecycleMatrix({
        phaseStates: [
          {
            key: "draft",
            pageText: SMOKE_CAMPAIGN_TITLE,
            publicApplyText: "Campaign not found",
            creatorText: "Campaign not found You may not be a member of this campaign.",
            creatorRoomVisible: false,
            visibleInviteCopyCount: 0,
            visiblePaidScopeControlCount: 1,
      visiblePaidScopeClosedNoteCount: 0,
      visibleReportingRequirementControlCount: 1,
            visibleAgreementConfigureCount: 1,
            visibleAnnouncementControlCount: 0,
      inviteImportWritable: true,
      visibleInviteSendButtonCount: 1,
            visibleInviteRemoveButtonCount: 0,
            visibleApplicantActionCount: 0,
            visibleApplicantSelectCount: 0,
            visibleContentDecisionCount: 0,
            visibleProofDecisionCount: 0,
            visibleCreatorWorkControlCount: 0,
            closedArchiveVisible: false,
            consoleErrors: [],
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      validateCampaignLifecycleMatrix({
        phaseStates: [
          {
            key: "recruiting_open",
            pageText: SMOKE_CAMPAIGN_TITLE,
            publicApplyText: `${SMOKE_CAMPAIGN_TITLE} Apply Now`,
            privateInviteActiveVisible: true,
            privateInviteClosedAuditVisible: false,
            creatorText:
              "This campaign is read-only; completed work and proof stay visible.",
            creatorRoomVisible: true,
            visibleInviteCopyCount: 0,
            visiblePaidScopeControlCount: 1,
            visiblePaidScopeClosedNoteCount: 0,
            visibleReportingRequirementControlCount: 1,
            visibleAgreementConfigureCount: 1,
            visibleAnnouncementControlCount: 1,
            inviteImportWritable: true,
            visibleInviteSendButtonCount: 1,
            visibleInviteRemoveButtonCount: 0,
            visibleApplicantActionCount: 1,
            visibleApplicantSelectCount: 0,
            visibleContentDecisionCount: 0,
            visibleProofDecisionCount: 0,
            visibleCreatorWorkControlCount: 0,
            closedArchiveVisible: false,
            consoleErrors: [],
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      validateCampaignLifecycleMatrix({
        phaseStates: [
          {
            key: "completed",
            pageText: SMOKE_CAMPAIGN_TITLE,
            publicApplyText: "This campaign is no longer accepting applications.",
            creatorsText:
              "Campaign is complete; saved outreach stays visible for audit.",
            creatorText:
              "This campaign is read-only; completed work and proof stay visible.",
            creatorRoomVisible: false,
            visibleInviteCopyCount: 0,
            visiblePaidScopeControlCount: 0,
            visiblePaidScopeClosedNoteCount: 1,
            visibleReportingRequirementControlCount: 0,
            visibleAgreementConfigureCount: 0,
            visibleAnnouncementControlCount: 0,
            inviteImportWritable: false,
            visibleInviteSendButtonCount: 0,
            visibleInviteRemoveButtonCount: 0,
            visibleApplicantActionCount: 0,
            visibleApplicantSelectCount: 0,
            visibleContentDecisionCount: 0,
            visibleProofDecisionCount: 0,
            visibleCreatorWorkControlCount: 0,
            closedArchiveVisible: true,
            consoleErrors: [],
          },
        ],
      }),
    ).toThrow("completed does not expose creator work room visibility");
  });

  it("rejects closed campaign states that expose active controls", () => {
    expect(() =>
      validateCampaignLifecycleMatrix({
        phaseStates: [
          {
            key: "completed",
            pageText: SMOKE_CAMPAIGN_TITLE,
            publicApplyText: "This campaign is no longer accepting applications.",
            creatorsText:
              "Campaign is complete; saved outreach stays visible for audit.",
            creatorText:
              "This campaign is read-only; completed work and proof stay visible.",
            creatorRoomVisible: true,
            visibleInviteCopyCount: 1,
            visiblePaidScopeControlCount: 0,
            visiblePaidScopeClosedNoteCount: 1,
            visibleReportingRequirementControlCount: 0,
            visibleAgreementConfigureCount: 0,
            visibleAnnouncementControlCount: 1,
            inviteImportWritable: false,
            visibleInviteSendButtonCount: 0,
            visibleInviteRemoveButtonCount: 0,
            visibleApplicantActionCount: 0,
            visibleApplicantSelectCount: 0,
            visibleContentDecisionCount: 0,
            visibleProofDecisionCount: 0,
            visibleCreatorWorkControlCount: 0,
            closedArchiveVisible: true,
            consoleErrors: [],
          },
        ],
      }),
    ).toThrow("completed exposes invite sharing");

    expect(() =>
      validateCampaignLifecycleMatrix({
        phaseStates: [
          {
            key: "cancelled",
            pageText: SMOKE_CAMPAIGN_TITLE,
            publicApplyText: "This campaign is no longer accepting applications.",
            creatorsText:
              "Campaign was cancelled; saved outreach stays visible for audit.",
            creatorText:
              "This campaign is read-only; completed work and proof stay visible.",
            creatorRoomVisible: true,
            visibleInviteCopyCount: 0,
            visiblePaidScopeControlCount: 0,
            visiblePaidScopeClosedNoteCount: 1,
            visibleReportingRequirementControlCount: 0,
            visibleAgreementConfigureCount: 0,
            visibleAnnouncementControlCount: 0,
            inviteImportWritable: false,
            visibleInviteSendButtonCount: 0,
            visibleInviteRemoveButtonCount: 0,
            visibleApplicantActionCount: 1,
            visibleApplicantSelectCount: 0,
            visibleContentDecisionCount: 0,
            visibleProofDecisionCount: 0,
            visibleCreatorWorkControlCount: 0,
            closedArchiveVisible: true,
            consoleErrors: [],
          },
        ],
      }),
    ).toThrow("cancelled exposes applicant decisions");
  });

  it("requires exact brand invite close reasons for every locked stage", () => {
    expect(
      CAMPAIGN_LIFECYCLE_MATRIX.filter(
        (phase) => !phase.expected.inviteImportWritable,
      ).map((phase) => [phase.key, phase.expected.closedInviteReason]),
    ).toEqual([
      [
        "recruiting_deadline_passed",
        "The application deadline has passed; saved outreach stays visible for audit.",
      ],
      [
        "in_progress",
        "Creator selection is closed because campaign work has started.",
      ],
      [
        "publishing",
        "Creator selection is closed because campaign work has started.",
      ],
      [
        "monitoring",
        "Creator selection is closed because campaign work has started.",
      ],
      ["paused", "Creator invites are paused until the campaign resumes."],
      ["completed", "Campaign is complete; saved outreach stays visible for audit."],
      ["cancelled", "Campaign was cancelled; saved outreach stays visible for audit."],
    ]);

    expect(() =>
      validateCampaignLifecycleMatrix({
        phaseStates: [
          {
            key: "in_progress",
            pageText: SMOKE_CAMPAIGN_TITLE,
            publicApplyText:
              `${SMOKE_CAMPAIGN_TITLE} This campaign is no longer accepting applications.`,
            privateInviteActiveVisible: false,
            privateInviteClosedAuditVisible: true,
            creatorText:
              "This campaign is read-only; completed work and proof stay visible.",
            creatorsText:
              `${SMOKE_CAMPAIGN_TITLE} Creator invites Creator invites are closed for this campaign stage.`,
            creatorRoomVisible: true,
            visibleInviteCopyCount: 0,
            visiblePaidScopeControlCount: 0,
            visiblePaidScopeClosedNoteCount: 1,
            visibleReportingRequirementControlCount: 0,
            visibleAgreementConfigureCount: 0,
            visibleAnnouncementControlCount: 1,
            inviteImportWritable: false,
            visibleInviteSendButtonCount: 0,
            visibleInviteRemoveButtonCount: 0,
            visibleApplicantActionCount: 0,
            visibleApplicantSelectCount: 0,
            visibleContentDecisionCount: 1,
            visibleProofDecisionCount: 1,
            visibleCreatorWorkControlCount: 1,
            closedArchiveVisible: false,
            consoleErrors: [],
          },
        ],
      }),
    ).toThrow("in_progress does not explain why creator invites are closed");
  });

  it("wires a reusable browser smoke and npm entrypoint", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./smoke-campaign-lifecycle-matrix.mjs", import.meta.url)),
      "utf8",
    );
    const packageJson = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );

    expect(source).toContain("runCampaignLifecycleMatrixSmoke");
    expect(source).toContain("campaign-content-read-only-stage");
    expect(source).toContain("campaign-reporting-read-only-stage");
    expect(source).toContain("creator-work-read-only-stage");
    expect(source).toContain("campaign-capacity-upgrade-control");
    expect(source).toContain("campaign-capacity-closed-note");
    expect(source).toContain("campaign-announcement-control");
    expect(source).toContain("campaign-reporting-requirement-save");
    expect(source).toContain("brand-agreement-configure");
    expect(source).toContain("const creatorWorkspace =");
    expect(source).toContain("Boolean(creatorWorkspace && creatorWorkspace.offsetParent !== null)");
    expect(source).toContain("recruiting_deadline_passed");
    expect(source).toContain("publicApplyInviteUrl");
    expect(source).toContain("targets.inviteId");
    expect(source).toContain("privateInviteClosedAuditVisible");
    expect(source).toContain("privateInviteActiveVisible");
    expect(source).toContain("private invite audit copy");
    expect(source).toContain("smokePostDeadlineApplicationDecision");
    expect(source).toContain("postDeadlineDecision");
    expect(packageJson.scripts["smoke:campaign-lifecycle-matrix"]).toBe(
      "node scripts/smoke-campaign-lifecycle-matrix.mjs",
    );
  });

  it("uses the concrete brand campaign index for every brand login wait", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./smoke-campaign-lifecycle-matrix.mjs", import.meta.url)),
      "utf8",
    );

    expect(source).not.toContain('expectedUrlPrefix: `${targets.baseUrl}/b/`');
    expect(source).not.toContain('expectedUrlPrefix: `${targets.baseUrl}/i/`');
    expect(source.split('expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`').length - 1).toBe(3);
    expect(source.split('expectedUrlPrefix: `${targets.baseUrl}/i/home`').length - 1).toBe(1);
  });
});
