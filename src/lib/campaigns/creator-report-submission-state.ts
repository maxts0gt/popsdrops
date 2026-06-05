import { reportTaskAcceptsCreatorSubmission } from "../reporting/report-task-status";

export type CreatorReportPerformanceRow = {
  id?: string | null;
  report_task_id: string | null;
  reported_at?: string | null;
  verification_status: string | null;
  evidence_review_note?: string | null;
};

export type CreatorReportSubmission = {
  status: string;
  platform: string | null;
  content_performance?:
    | CreatorReportPerformanceRow[]
    | CreatorReportPerformanceRow
    | null;
};

export type CreatorReportTask = {
  id: string;
  due_at: string;
  status: string;
};

export type CreatorReportSubmissionStatusKey =
  | "correction"
  | "submitted"
  | "waiting";

export type CreatorReportSubmissionState = {
  correctionNote: string | null;
  dueAt: string | null;
  isSubmitted: boolean;
  shouldShowForm: boolean;
  statusKey: CreatorReportSubmissionStatusKey;
};

function getPerformanceRows(
  submission: CreatorReportSubmission,
): CreatorReportPerformanceRow[] {
  if (Array.isArray(submission.content_performance)) {
    return submission.content_performance;
  }

  if (submission.content_performance) {
    return [submission.content_performance];
  }

  return [];
}

export function hasSubmissionReportForTask(
  submission: CreatorReportSubmission,
  reportTaskId: string | undefined,
): boolean {
  if (!reportTaskId) return false;
  return getPerformanceRows(submission).some(
    (row) => row.report_task_id === reportTaskId,
  );
}

function hasRejectedReportForTask(
  submission: CreatorReportSubmission,
  reportTaskId: string | undefined,
): boolean {
  const latestRow = getLatestReportForTask(submission, reportTaskId);

  return latestRow?.verification_status === "rejected";
}

function getCorrectionNote(row: CreatorReportPerformanceRow | null): string | null {
  const note = row?.evidence_review_note?.trim();
  return note || null;
}

function getLatestReportForTask(
  submission: CreatorReportSubmission,
  reportTaskId: string | undefined,
): CreatorReportPerformanceRow | null {
  if (!reportTaskId) return null;

  return getPerformanceRows(submission).reduce<{
    index: number;
    row: CreatorReportPerformanceRow;
  } | null>((latest, row, index) => {
    if (row.report_task_id !== reportTaskId) return latest;
    if (!latest) return { index, row };

    const rowTime = row.reported_at ? new Date(row.reported_at).getTime() : index;
    const latestTime = latest.row.reported_at
      ? new Date(latest.row.reported_at).getTime()
      : latest.index;

    return rowTime >= latestTime ? { index, row } : latest;
  }, null)?.row ?? null;
}

function hasAnyReport(submission: CreatorReportSubmission): boolean {
  return getPerformanceRows(submission).length > 0;
}

export function getCreatorReportSubmissionState({
  activeReportTask,
  isReportCorrection,
  submission,
}: {
  activeReportTask: CreatorReportTask | null;
  isReportCorrection: boolean;
  submission: CreatorReportSubmission;
}): CreatorReportSubmissionState {
  const isReportable = submission.status === "published" && Boolean(submission.platform);
  const hasActiveTaskReport = hasSubmissionReportForTask(
    submission,
    activeReportTask?.id,
  );
  const activeTaskIsClosed =
    activeReportTask != null &&
    !reportTaskAcceptsCreatorSubmission(activeReportTask.status);
  const hasRejectedActiveTaskReport = hasRejectedReportForTask(
    submission,
    activeReportTask?.id,
  );

  if (isReportCorrection) {
    const latestActiveTaskReport = getLatestReportForTask(
      submission,
      activeReportTask?.id,
    );
    const hasResolvedActiveTaskReport =
      latestActiveTaskReport != null &&
      latestActiveTaskReport.verification_status !== "rejected";

    return {
      correctionNote: hasRejectedActiveTaskReport
        ? getCorrectionNote(latestActiveTaskReport)
        : null,
      dueAt: hasRejectedActiveTaskReport ? activeReportTask?.due_at ?? null : null,
      isSubmitted:
        !hasRejectedActiveTaskReport &&
        (hasResolvedActiveTaskReport || hasAnyReport(submission)),
      shouldShowForm: isReportable && hasRejectedActiveTaskReport,
      statusKey: hasRejectedActiveTaskReport
        ? "correction"
        : hasResolvedActiveTaskReport || hasAnyReport(submission)
          ? "submitted"
          : "waiting",
    };
  }

  const isSubmitted = hasActiveTaskReport || activeTaskIsClosed;

  return {
    correctionNote: null,
    dueAt: isSubmitted ? null : activeReportTask?.due_at ?? null,
    isSubmitted,
    shouldShowForm: isReportable && !isSubmitted,
    statusKey: isSubmitted ? "submitted" : "waiting",
  };
}
