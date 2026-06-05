export type CampaignLifecycleStatus =
  | "draft"
  | "recruiting"
  | "in_progress"
  | "publishing"
  | "monitoring"
  | "completed"
  | "paused"
  | "cancelled";

export type CampaignApplicationClosedReason =
  | "not_open"
  | "deadline_passed"
  | "work_started"
  | "paused"
  | "completed"
  | "cancelled";

type CampaignLifecycleInput = {
  status: string | null | undefined;
  applicationDeadline?: string | null | undefined;
  application_deadline?: string | null | undefined;
  now?: number;
};

type CampaignWorkStartInput = CampaignLifecycleInput & {
  memberCount: number;
  unresolvedApplicationCount: number;
};

type CampaignMetricSubmissionInput = {
  status: string | null | undefined;
  submissionStatus: string | null | undefined;
};

const dayMs = 1000 * 60 * 60 * 24;
const creatorWorkStatuses = new Set(["in_progress", "publishing", "monitoring"]);
const preWorkEditableStatuses = new Set(["draft", "recruiting"]);

function getApplicationDeadline(input: CampaignLifecycleInput) {
  return input.applicationDeadline ?? input.application_deadline ?? null;
}

export function isCampaignApplicationDeadlinePassed(
  value: string | null | undefined,
  now = Date.now(),
) {
  if (!value) return false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const nextDayStart = Date.UTC(year, month - 1, day + 1);
    return now >= nextDayStart;
  }

  const deadlineTime = new Date(value).getTime();
  return Number.isFinite(deadlineTime) && deadlineTime <= now;
}

export function getCampaignApplicationDeadlineDaysLeft(
  value: string | null | undefined,
  now = Date.now(),
) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const deadlineDayStart = Date.UTC(year, month - 1, day);
    const nowDate = new Date(now);
    const todayStart = Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate(),
    );

    return Math.max(0, Math.floor((deadlineDayStart - todayStart) / dayMs));
  }

  const deadlineTime = new Date(value).getTime();
  if (!Number.isFinite(deadlineTime)) return null;

  return Math.max(0, Math.ceil((deadlineTime - now) / dayMs));
}

export function getCampaignApplicationClosedReason(
  campaign: CampaignLifecycleInput,
  now = campaign.now ?? Date.now(),
): CampaignApplicationClosedReason | null {
  if (campaign.status === "recruiting") {
    return isCampaignApplicationDeadlinePassed(
      getApplicationDeadline(campaign),
      now,
    )
      ? "deadline_passed"
      : null;
  }

  if (
    campaign.status === "in_progress" ||
    campaign.status === "publishing" ||
    campaign.status === "monitoring"
  ) {
    return "work_started";
  }

  if (campaign.status === "paused") return "paused";
  if (campaign.status === "completed") return "completed";
  if (campaign.status === "cancelled") return "cancelled";

  return "not_open";
}

export function isCampaignApplicationOpen(
  campaign: CampaignLifecycleInput,
  now = campaign.now ?? Date.now(),
) {
  return getCampaignApplicationClosedReason(campaign, now) === null;
}

export function canCampaignAcceptCreatorInviteManagement(
  campaign: CampaignLifecycleInput,
) {
  if (!preWorkEditableStatuses.has(campaign.status ?? "")) return false;
  if (campaign.status !== "recruiting") return true;

  return !isCampaignApplicationDeadlinePassed(
    getApplicationDeadline(campaign),
    campaign.now,
  );
}

export function canCampaignAcceptCreatorInviteSending(
  campaign: CampaignLifecycleInput,
) {
  return (
    campaign.status === "recruiting" &&
    !isCampaignApplicationDeadlinePassed(
      getApplicationDeadline(campaign),
      campaign.now,
    )
  );
}

export function canCampaignAcceptApplicationDecision(
  campaign: CampaignLifecycleInput,
) {
  return campaign.status === "recruiting";
}

export function canCampaignAcceptApplicationSubmission(
  campaign: CampaignLifecycleInput,
) {
  return isCampaignApplicationOpen(campaign, campaign.now);
}

export function canCampaignUpdatePreWorkSetup(campaign: CampaignLifecycleInput) {
  return canCampaignAcceptCreatorInviteManagement(campaign);
}

export function canCampaignAcceptAgreementUpdate(
  campaign: CampaignLifecycleInput,
) {
  return canCampaignUpdatePreWorkSetup(campaign);
}

export function canCampaignAcceptAnnouncement(campaign: CampaignLifecycleInput) {
  return (
    campaign.status === "recruiting" ||
    creatorWorkStatuses.has(campaign.status ?? "")
  );
}

export function canCampaignStartWork(campaign: CampaignWorkStartInput) {
  return (
    campaign.status === "recruiting" &&
    campaign.memberCount > 0 &&
    campaign.unresolvedApplicationCount === 0
  );
}

export function canCampaignAcceptCreatorWork(campaign: CampaignLifecycleInput) {
  return creatorWorkStatuses.has(campaign.status ?? "");
}

export function canCampaignAcceptContentDecision(
  campaign: CampaignLifecycleInput,
) {
  return creatorWorkStatuses.has(campaign.status ?? "");
}

export function canCampaignAcceptProofSubmission(
  campaign: CampaignLifecycleInput,
) {
  return creatorWorkStatuses.has(campaign.status ?? "");
}

export function canCampaignAcceptProofDecision(
  campaign: CampaignLifecycleInput,
) {
  return creatorWorkStatuses.has(campaign.status ?? "");
}

export function canCampaignAcceptMetricSubmission(
  input: CampaignMetricSubmissionInput,
) {
  return (
    creatorWorkStatuses.has(input.status ?? "") &&
    input.submissionStatus === "published"
  );
}

export function assertCampaignAllowsCreatorInviteManagement(
  campaign: CampaignLifecycleInput,
) {
  if (!preWorkEditableStatuses.has(campaign.status ?? "")) {
    throw new Error("Creator invites can only be managed before launch or while recruiting.");
  }

  if (!canCampaignAcceptCreatorInviteManagement(campaign)) {
    throw new Error("The application deadline has already passed.");
  }
}

export function assertCampaignAllowsCreatorInviteSending(
  campaign: CampaignLifecycleInput,
) {
  if (campaign.status !== "recruiting") {
    throw new Error("Creator invites can only be sent while the campaign is recruiting.");
  }

  if (!canCampaignAcceptCreatorInviteSending(campaign)) {
    throw new Error("The application deadline has already passed.");
  }
}

export function assertCampaignAllowsApplicationDecision(
  campaign: CampaignLifecycleInput,
) {
  if (campaign.status !== "recruiting") {
    throw new Error("Application decisions are closed for this campaign stage.");
  }
}

export function assertCampaignAllowsApplicationSubmission(
  campaign: CampaignLifecycleInput | null | undefined,
): asserts campaign is CampaignLifecycleInput {
  if (!campaign || campaign.status !== "recruiting") {
    throw new Error("This campaign is not open for applications.");
  }

  if (!canCampaignAcceptApplicationSubmission(campaign)) {
    throw new Error("The application deadline has already passed.");
  }
}

export function assertCampaignAllowsApplicationDeadlineUpdate(
  campaign: CampaignLifecycleInput,
) {
  if (!preWorkEditableStatuses.has(campaign.status ?? "")) {
    throw new Error("Application deadline can only be changed before recruiting closes.");
  }

  if (!canCampaignUpdatePreWorkSetup(campaign)) {
    throw new Error("Application deadline can only be changed before recruiting closes.");
  }
}

export function assertCampaignAllowsPaidScopeUpdate(
  campaign: CampaignLifecycleInput,
) {
  if (!preWorkEditableStatuses.has(campaign.status ?? "")) {
    throw new Error("Campaign scope can only be changed before creator selection closes.");
  }

  if (!canCampaignUpdatePreWorkSetup(campaign)) {
    throw new Error("Campaign scope can only be changed before creator selection closes.");
  }
}

export function assertCampaignAllowsReportingRequirementUpdate(
  campaign: CampaignLifecycleInput,
) {
  if (!preWorkEditableStatuses.has(campaign.status ?? "")) {
    throw new Error("Only draft or recruiting campaigns can change proof fields.");
  }

  if (!canCampaignUpdatePreWorkSetup(campaign)) {
    throw new Error("Proof fields lock after recruiting closes.");
  }
}

export function assertCampaignAllowsAgreementUpdate(
  campaign: CampaignLifecycleInput,
) {
  if (!preWorkEditableStatuses.has(campaign.status ?? "")) {
    throw new Error("Campaign rules can only be changed before recruiting closes.");
  }

  if (!canCampaignAcceptAgreementUpdate(campaign)) {
    throw new Error("Campaign rules lock after recruiting closes.");
  }
}

export function assertCampaignAllowsAnnouncement(campaign: CampaignLifecycleInput) {
  if (!canCampaignAcceptAnnouncement(campaign)) {
    throw new Error("Creator updates can only be sent while the campaign is active.");
  }
}

export function assertCampaignAllowsWorkStart(campaign: CampaignWorkStartInput) {
  if (campaign.status !== "recruiting") {
    throw new Error("Campaign work can only start from recruiting.");
  }

  if (campaign.memberCount <= 0) {
    throw new Error("Accept at least one creator before starting work.");
  }

  if (campaign.unresolvedApplicationCount > 0) {
    throw new Error("Resolve pending applications before starting work.");
  }
}

export function assertCampaignAllowsCreatorWork(campaign: CampaignLifecycleInput) {
  if (!canCampaignAcceptCreatorWork(campaign)) {
    throw new Error("Creator work is closed for this campaign stage.");
  }
}

export function assertCampaignAllowsContentDecision(
  campaign: CampaignLifecycleInput,
) {
  if (!canCampaignAcceptContentDecision(campaign)) {
    throw new Error("Content decisions are closed for this campaign stage.");
  }
}

export function assertCampaignAllowsProofSubmission(
  campaign: CampaignLifecycleInput,
) {
  if (!canCampaignAcceptProofSubmission(campaign)) {
    throw new Error("Proof submission is closed for this campaign stage.");
  }
}

export function assertCampaignAllowsProofDecision(
  campaign: CampaignLifecycleInput,
) {
  if (!canCampaignAcceptProofDecision(campaign)) {
    throw new Error("Proof decisions are closed for this campaign stage.");
  }
}

export function assertCampaignAllowsMetricSubmission(
  input: CampaignMetricSubmissionInput,
) {
  if (!canCampaignAcceptCreatorWork(input)) {
    throw new Error("Creator work is closed for this campaign stage.");
  }

  if (input.submissionStatus !== "published") {
    throw new Error("Performance metrics can only be submitted after content is published.");
  }
}
