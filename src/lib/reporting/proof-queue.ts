export type ProofQueueEvidenceStatus = "submitted" | "verified" | "rejected";

export type ProofQueuePerformanceStatus =
  | "submitted"
  | "screenshot_verified"
  | "brand_verified"
  | "rejected";

export type ProofQueueTaskStatus =
  | "pending"
  | "submitted"
  | "submitted_late"
  | "verified"
  | "needs_revision"
  | "missed"
  | "excused"
  | string;

export type ProofQueueState =
  | "correction"
  | "correction_returned"
  | "review"
  | "metrics_only"
  | "verified"
  | "missed"
  | "excused"
  | "pending";

export type ProofQueuePerformanceRow = {
  measurement_type?: string | null;
  reported_at?: string | null;
  report_task_id: string | null;
  submission_id: string | null;
};

export function getProofQueueState({
  currentEvidenceStatus,
  currentPerformanceHasProof,
  currentPerformanceStatus,
  hasReturnedCorrection,
  taskStatus,
}: {
  currentEvidenceStatus?: ProofQueueEvidenceStatus | null;
  currentPerformanceHasProof?: boolean;
  currentPerformanceStatus?: ProofQueuePerformanceStatus | null;
  hasReturnedCorrection?: boolean;
  taskStatus: ProofQueueTaskStatus;
}): ProofQueueState {
  if (currentEvidenceStatus === "verified") return "verified";
  if (currentEvidenceStatus === "submitted") {
    return hasReturnedCorrection ? "correction_returned" : "review";
  }
  if (currentEvidenceStatus === "rejected") return "correction";

  if (
    currentPerformanceStatus === "brand_verified" ||
    currentPerformanceStatus === "screenshot_verified"
  ) {
    return "verified";
  }
  if (currentPerformanceStatus === "rejected") return "correction";
  if (currentPerformanceStatus === "submitted") {
    return currentPerformanceHasProof ? "review" : "metrics_only";
  }

  if (taskStatus === "verified") return "verified";
  if (taskStatus === "missed") return "missed";
  if (taskStatus === "excused") return "excused";
  if (taskStatus === "needs_revision") return "correction";

  return "pending";
}

function performanceQueueKey(row: ProofQueuePerformanceRow): string {
  const submissionKey = row.submission_id ?? "submission";
  const measurementKey = row.measurement_type ?? "measurement";
  return `${submissionKey}:${measurementKey}`;
}

export function getCurrentPerformanceRowsForTask<
  T extends ProofQueuePerformanceRow,
>(rows: T[], taskId: string): T[] {
  const latestRows = new Map<string, { row: T; index: number }>();

  rows
    .filter((row) => row.report_task_id === taskId)
    .forEach((row, index) => {
      const key = performanceQueueKey(row);
      const current = latestRows.get(key);
      const rowTime = row.reported_at ? new Date(row.reported_at).getTime() : index;
      const currentTime = current?.row.reported_at
        ? new Date(current.row.reported_at).getTime()
        : current?.index ?? -1;

      if (!current || rowTime >= currentTime) {
        latestRows.set(key, { row, index });
      }
    });

  return Array.from(latestRows.values())
    .toSorted((a, b) => a.index - b.index)
    .map((entry) => entry.row);
}
