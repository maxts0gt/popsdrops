import type { Database } from "@/types/database";

type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

type ReportCorrectionNotificationInput = {
  campaignId: string;
  campaignTitle: string;
  correctionNote: string;
  creatorId: string;
  evidenceId?: string;
  performanceId?: string;
  reportTaskId: string;
};

type ReportReadyForReviewNotificationInput = {
  brandId: string;
  campaignId: string;
  campaignTitle: string;
  creatorName: string;
  reportTaskId: string;
};

type ReportFollowUpNotificationInput = {
  campaignId: string;
  campaignTitle: string;
  creatorId: string;
  reportTaskId: string;
};

export function buildReportCorrectionNotification({
  campaignId,
  campaignTitle,
  correctionNote,
  creatorId,
  evidenceId,
  performanceId,
  reportTaskId,
}: ReportCorrectionNotificationInput): NotificationInsert {
  return {
    user_id: creatorId,
    type: "report_correction_requested",
    title: "Report correction requested",
    body: correctionNote,
    data: {
      campaign_id: campaignId,
      campaign_title: campaignTitle,
      ...(evidenceId ? { evidence_id: evidenceId } : {}),
      ...(performanceId ? { performance_id: performanceId } : {}),
      report_task_id: reportTaskId,
    },
  };
}

function buildBrandReportReviewNotification({
  type,
  title,
  body,
  brandId,
  campaignId,
  campaignTitle,
  creatorName,
  reportTaskId,
}: ReportReadyForReviewNotificationInput & {
  type: "report_ready_for_review" | "report_correction_resubmitted";
  title: string;
  body: string;
}): NotificationInsert {
  return {
    user_id: brandId,
    type,
    title,
    body,
    data: {
      campaign_id: campaignId,
      campaign_title: campaignTitle,
      creator_name: creatorName,
      report_task_id: reportTaskId,
    },
  };
}

export function buildReportReadyForReviewNotification(
  input: ReportReadyForReviewNotificationInput,
): NotificationInsert {
  return buildBrandReportReviewNotification({
    ...input,
    type: "report_ready_for_review",
    title: "Report ready to review",
    body: `${input.creatorName} submitted report proof for ${input.campaignTitle}.`,
  });
}

export function buildReportCorrectionResubmittedNotification(
  input: ReportReadyForReviewNotificationInput,
): NotificationInsert {
  return buildBrandReportReviewNotification({
    ...input,
    type: "report_correction_resubmitted",
    title: "Correction resubmitted",
    body: `${input.creatorName} resubmitted report proof for ${input.campaignTitle}.`,
  });
}

export function buildReportFollowUpNotification({
  campaignId,
  campaignTitle,
  creatorId,
  reportTaskId,
}: ReportFollowUpNotificationInput): NotificationInsert {
  return {
    user_id: creatorId,
    type: "report_follow_up_requested",
    title: "Report follow-up requested",
    body: `${campaignTitle} still needs performance proof.`,
    data: {
      campaign_id: campaignId,
      campaign_title: campaignTitle,
      report_task_id: reportTaskId,
    },
  };
}
