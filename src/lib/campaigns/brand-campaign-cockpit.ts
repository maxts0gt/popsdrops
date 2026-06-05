export type CampaignNextActionKind =
  | "review_proof"
  | "resolve_missed"
  | "review_applicants"
  | "publish_rules"
  | "add_creative"
  | "invite_creators"
  | "review_content"
  | "collect_live_urls"
  | "monitor_corrections"
  | "wait_for_reports"
  | "complete_campaign"
  | "campaign_complete"
  | "pay_service_fee"
  | "start_work"
  | "no_blockers";

export type CampaignNextActionTone = "urgent" | "attention" | "setup" | "calm";

export type CampaignCockpitState = {
  campaignStatus?: string;
  pendingApplicants: number;
  reportProofToReview: number;
  reportCorrections: number;
  missedReports: number;
  pendingReports: number;
  hasPublishedAgreement: boolean;
  requiresAgreement?: boolean;
  hasCreatorPreviewImage: boolean;
  memberCount: number;
  approvedContent: number;
  totalContent: number;
  missingLiveUrls: number;
  serviceFeeRequired?: boolean;
  serviceFeePaid?: boolean;
  readyToComplete?: boolean;
};

export type CampaignNextAction = {
  kind: CampaignNextActionKind;
  tone: CampaignNextActionTone;
};

const completableCampaignStatuses = new Set(["monitoring"]);
const completedCampaignStatuses = new Set(["completed"]);

export function getCampaignNextAction(
  state: CampaignCockpitState,
): CampaignNextAction {
  if (
    state.campaignStatus &&
    completedCampaignStatuses.has(state.campaignStatus)
  ) {
    return { kind: "campaign_complete", tone: "calm" };
  }

  if (state.reportCorrections > 0) {
    return { kind: "monitor_corrections", tone: "urgent" };
  }

  if (state.reportProofToReview > 0) {
    return { kind: "review_proof", tone: "urgent" };
  }

  if (state.missedReports > 0) {
    return { kind: "resolve_missed", tone: "urgent" };
  }

  if (state.pendingApplicants > 0) {
    return { kind: "review_applicants", tone: "attention" };
  }

  if ((state.requiresAgreement ?? true) && !state.hasPublishedAgreement) {
    return { kind: "publish_rules", tone: "setup" };
  }

  if (!state.hasCreatorPreviewImage) {
    return { kind: "add_creative", tone: "setup" };
  }

  if (state.serviceFeeRequired && !state.serviceFeePaid) {
    return { kind: "pay_service_fee", tone: "attention" };
  }

  if (state.memberCount === 0) {
    return { kind: "invite_creators", tone: "attention" };
  }

  if (state.campaignStatus === "recruiting") {
    return { kind: "start_work", tone: "attention" };
  }

  if (state.totalContent > state.approvedContent) {
    return { kind: "review_content", tone: "attention" };
  }

  if (state.missingLiveUrls > 0) {
    return { kind: "collect_live_urls", tone: "attention" };
  }

  if (state.pendingReports > 0) {
    return { kind: "wait_for_reports", tone: "calm" };
  }

  if (
    state.readyToComplete &&
    state.campaignStatus &&
    completableCampaignStatuses.has(state.campaignStatus)
  ) {
    return { kind: "complete_campaign", tone: "attention" };
  }

  return { kind: "no_blockers", tone: "calm" };
}
