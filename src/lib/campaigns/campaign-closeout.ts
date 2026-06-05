import { getActiveCampaignSubmissions } from "./campaign-submissions";

export type CampaignCloseoutBlocker =
  | "campaign_not_active"
  | "pending_applicants"
  | "no_members"
  | "missing_content"
  | "missing_live_urls"
  | "missing_reports"
  | "unsettled_reports";

export type CampaignCloseoutMember = {
  id: string;
};

export type CampaignCloseoutSubmission = {
  id?: string | null;
  parentSubmissionId?: string | null;
  campaignMemberId: string;
  publishedUrl: string | null;
  status: string;
};

export type CampaignCloseoutReportTask = {
  campaignMemberId: string;
  status: string;
};

export type CampaignCloseoutInput = {
  campaignStatus: string;
  pendingApplicants: number;
  members: CampaignCloseoutMember[];
  submissions: CampaignCloseoutSubmission[];
  reportTasks: CampaignCloseoutReportTask[];
};

export type CampaignCloseoutReadiness = {
  ready: boolean;
  blockers: CampaignCloseoutBlocker[];
};

const completableCampaignStatuses = new Set(["monitoring"]);

const settledReportStatuses = new Set(["verified", "excused"]);

function hasPublishedLiveUrl(submission: CampaignCloseoutSubmission) {
  return submission.status === "published" && Boolean(submission.publishedUrl);
}

export function getCampaignCloseoutReadiness(
  input: CampaignCloseoutInput,
): CampaignCloseoutReadiness {
  const blockers: CampaignCloseoutBlocker[] = [];
  const memberIds = new Set(input.members.map((member) => member.id));
  const activeSubmissions = getActiveCampaignSubmissions(input.submissions);

  if (!completableCampaignStatuses.has(input.campaignStatus)) {
    blockers.push("campaign_not_active");
  }

  if (input.pendingApplicants > 0) {
    blockers.push("pending_applicants");
  }

  if (input.members.length === 0) {
    blockers.push("no_members");
  }

  if (activeSubmissions.length === 0) {
    blockers.push("missing_content");
  }

  const submittedMemberIds = new Set(
    activeSubmissions.map((submission) => submission.campaignMemberId),
  );
  const hasMissingMemberContent = [...memberIds].some(
    (memberId) => !submittedMemberIds.has(memberId),
  );
  if (hasMissingMemberContent && !blockers.includes("missing_content")) {
    blockers.push("missing_content");
  }

  const missingLiveUrls = activeSubmissions.some(
    (submission) => !hasPublishedLiveUrl(submission),
  );
  if (activeSubmissions.length > 0 && missingLiveUrls) {
    blockers.push("missing_live_urls");
  }

  if (input.reportTasks.length === 0) {
    blockers.push("missing_reports");
  }

  const reportMemberIds = new Set(
    input.reportTasks.map((task) => task.campaignMemberId),
  );
  const hasMissingMemberReports = [...memberIds].some(
    (memberId) => !reportMemberIds.has(memberId),
  );
  if (hasMissingMemberReports && !blockers.includes("missing_reports")) {
    blockers.push("missing_reports");
  }

  const hasUnsettledReports = input.reportTasks.some(
    (task) => !settledReportStatuses.has(task.status),
  );
  if (hasUnsettledReports) {
    blockers.push("unsettled_reports");
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function assertCampaignCloseoutReadiness(
  readiness: CampaignCloseoutReadiness,
) {
  if (!readiness.ready) {
    throw new Error("Campaign is not ready to complete.");
  }
}
