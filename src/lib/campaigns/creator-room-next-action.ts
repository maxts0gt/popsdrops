import { getActiveCampaignSubmissions } from "./campaign-submissions";

export type CreatorRoomTab = "brief" | "tasks" | "submit";

export type CreatorRoomNextActionKey =
  | "reportCorrection"
  | "contentRevision"
  | "firstDraft"
  | "brandReview"
  | "publishUrl"
  | "performanceProof"
  | "performanceOverdue"
  | "proofReview"
  | "onTrack";

export interface CreatorRoomSubmissionState {
  id?: string | null;
  parentSubmissionId?: string | null;
  status: string;
  publishedUrl: string | null;
}

export interface CreatorRoomReportTaskState {
  status: string;
  dueAt: string | null;
}

export interface CreatorRoomNextAction {
  key: CreatorRoomNextActionKey;
  targetTab: CreatorRoomTab;
  dueAt: string | null;
}

const submittedReportStatuses = new Set(["submitted", "submitted_late"]);
const settledReportStatuses = new Set(["submitted", "submitted_late", "verified"]);

export function getActiveCreatorRoomSubmissions<
  T extends Pick<CreatorRoomSubmissionState, "id" | "parentSubmissionId">,
>(submissions: T[]): T[] {
  return getActiveCampaignSubmissions(submissions);
}

export function getCreatorRoomNextAction({
  now = new Date(),
  submissions,
  reportTasks,
}: {
  now?: Date;
  submissions: CreatorRoomSubmissionState[];
  reportTasks: CreatorRoomReportTaskState[];
}): CreatorRoomNextAction {
  const correctionReportTask = reportTasks.find(
    (task) => task.status === "needs_revision",
  );

  if (correctionReportTask) {
    return {
      key: "reportCorrection",
      targetTab: "submit",
      dueAt: correctionReportTask.dueAt,
    };
  }

  const activeSubmissions = getActiveCreatorRoomSubmissions(submissions);

  if (
    activeSubmissions.some(
      (submission) => submission.status === "revision_requested",
    )
  ) {
    return {
      key: "contentRevision",
      targetTab: "submit",
      dueAt: null,
    };
  }

  if (activeSubmissions.length === 0) {
    return {
      key: "firstDraft",
      targetTab: "submit",
      dueAt: null,
    };
  }

  if (activeSubmissions.some((submission) => submission.status === "submitted")) {
    return {
      key: "brandReview",
      targetTab: "submit",
      dueAt: null,
    };
  }

  if (
    activeSubmissions.some(
      (submission) =>
        submission.status === "approved" && !submission.publishedUrl,
    )
  ) {
    return {
      key: "publishUrl",
      targetTab: "submit",
      dueAt: null,
    };
  }

  const openReportTask = reportTasks.find(
    (task) => !settledReportStatuses.has(task.status),
  );

  if (
    openReportTask &&
    activeSubmissions.some((submission) => submission.status === "published")
  ) {
    const dueTime = openReportTask.dueAt
      ? new Date(openReportTask.dueAt).getTime()
      : Number.NaN;
    const isOverdue =
      openReportTask.status === "missed" ||
      (Number.isFinite(dueTime) && now.getTime() > dueTime);

    return {
      key: isOverdue ? "performanceOverdue" : "performanceProof",
      targetTab: "submit",
      dueAt: openReportTask.dueAt,
    };
  }

  const proofReviewReportTask = reportTasks.find((task) =>
    submittedReportStatuses.has(task.status),
  );

  if (
    proofReviewReportTask &&
    activeSubmissions.some((submission) => submission.status === "published")
  ) {
    return {
      key: "proofReview",
      targetTab: "submit",
      dueAt: proofReviewReportTask.dueAt,
    };
  }

  return {
    key: "onTrack",
    targetTab: "tasks",
    dueAt: null,
  };
}
