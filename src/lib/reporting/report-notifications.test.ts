import { describe, expect, it } from "vitest";
import {
  buildReportCorrectionNotification,
  buildReportCorrectionResubmittedNotification,
  buildReportFollowUpNotification,
  buildReportReadyForReviewNotification,
} from "./report-notifications";

describe("report notifications", () => {
  it("builds a creator correction notice tied to the exact report proof", () => {
    expect(
      buildReportCorrectionNotification({
        campaignId: "campaign-1",
        campaignTitle: "K-Beauty Retail Launch",
        correctionNote: "Instagram screenshot needs the Insights view.",
        creatorId: "creator-1",
        evidenceId: "evidence-1",
        reportTaskId: "task-1",
      }),
    ).toEqual({
      user_id: "creator-1",
      type: "report_correction_requested",
      title: "Report correction requested",
      body: "Instagram screenshot needs the Insights view.",
      data: {
        campaign_id: "campaign-1",
        campaign_title: "K-Beauty Retail Launch",
        evidence_id: "evidence-1",
        report_task_id: "task-1",
      },
    });
  });

  it("builds a creator correction notice for mobile proof links", () => {
    expect(
      buildReportCorrectionNotification({
        campaignId: "campaign-1",
        campaignTitle: "K-Beauty Retail Launch",
        correctionNote: "Open the Instagram Insights screen and resend the proof link.",
        creatorId: "creator-1",
        performanceId: "performance-1",
        reportTaskId: "task-1",
      }),
    ).toEqual({
      user_id: "creator-1",
      type: "report_correction_requested",
      title: "Report correction requested",
      body: "Open the Instagram Insights screen and resend the proof link.",
      data: {
        campaign_id: "campaign-1",
        campaign_title: "K-Beauty Retail Launch",
        performance_id: "performance-1",
        report_task_id: "task-1",
      },
    });
  });

  it("builds a brand notice when creator report proof is ready for review", () => {
    expect(
      buildReportReadyForReviewNotification({
        brandId: "brand-1",
        campaignId: "campaign-1",
        campaignTitle: "K-Beauty Retail Launch",
        creatorName: "Mina Park",
        reportTaskId: "task-1",
      }),
    ).toEqual({
      user_id: "brand-1",
      type: "report_ready_for_review",
      title: "Report ready to review",
      body: "Mina Park submitted report proof for K-Beauty Retail Launch.",
      data: {
        campaign_id: "campaign-1",
        campaign_title: "K-Beauty Retail Launch",
        creator_name: "Mina Park",
        report_task_id: "task-1",
      },
    });
  });

  it("builds a brand notice when corrected report proof is resubmitted", () => {
    expect(
      buildReportCorrectionResubmittedNotification({
        brandId: "brand-1",
        campaignId: "campaign-1",
        campaignTitle: "K-Beauty Retail Launch",
        creatorName: "Mina Park",
        reportTaskId: "task-1",
      }),
    ).toEqual({
      user_id: "brand-1",
      type: "report_correction_resubmitted",
      title: "Correction resubmitted",
      body: "Mina Park resubmitted report proof for K-Beauty Retail Launch.",
      data: {
        campaign_id: "campaign-1",
        campaign_title: "K-Beauty Retail Launch",
        creator_name: "Mina Park",
        report_task_id: "task-1",
      },
    });
  });

  it("builds a creator follow-up notice for missed report tasks", () => {
    expect(
      buildReportFollowUpNotification({
        campaignId: "campaign-1",
        campaignTitle: "K-Beauty Retail Launch",
        creatorId: "creator-1",
        reportTaskId: "task-1",
      }),
    ).toEqual({
      user_id: "creator-1",
      type: "report_follow_up_requested",
      title: "Report follow-up requested",
      body: "K-Beauty Retail Launch still needs performance proof.",
      data: {
        campaign_id: "campaign-1",
        campaign_title: "K-Beauty Retail Launch",
        report_task_id: "task-1",
      },
    });
  });
});
