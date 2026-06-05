export type EvidenceReviewStatus = "submitted" | "verified" | "rejected";

export type EvidenceReviewRollupRow = {
  status: EvidenceReviewStatus;
  groupId?: string | null;
  submissionId?: string | null;
  measurementType?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

export type EvidenceReviewQueueStatus =
  | "correction"
  | "correction_returned"
  | "evidence_review";

export type CurrentEvidenceReviewRow<T extends EvidenceReviewRollupRow> = {
  hasReturnedCorrection: boolean;
  row: T;
  status: EvidenceReviewQueueStatus;
};

function reviewRollupKey(row: EvidenceReviewRollupRow): string {
  if (row.groupId) return row.groupId;

  if (row.submissionId && row.measurementType) {
    return `${row.submissionId}:${row.measurementType}`;
  }

  if (row.submissionId) {
    return row.submissionId;
  }

  if (row.measurementType) {
    return `proof:${row.measurementType}`;
  }

  return "proof:default";
}

function reviewRowTime(row: EvidenceReviewRollupRow, index: number) {
  const createdAt = row.createdAt ?? row.created_at;
  const time = createdAt ? new Date(createdAt).getTime() : NaN;
  return Number.isFinite(time) ? time : index;
}

export function getCurrentEvidenceReviewStatuses(
  rows: EvidenceReviewRollupRow[],
): EvidenceReviewStatus[] {
  const latestRows = new Map<string, { row: EvidenceReviewRollupRow; index: number }>();

  rows.forEach((row, index) => {
    const key = reviewRollupKey(row);
    const current = latestRows.get(key);
    const rowTime = reviewRowTime(row, index);
    const currentTime = current
      ? reviewRowTime(current.row, current.index)
      : -1;

    if (!current || rowTime >= currentTime) {
      latestRows.set(key, { row, index });
    }
  });

  return Array.from(latestRows.values())
    .toSorted((a, b) => a.index - b.index)
    .map((entry) => entry.row.status);
}

export function getCurrentEvidenceReviewRows<T extends EvidenceReviewRollupRow>(
  rows: T[],
): CurrentEvidenceReviewRow<T>[] {
  const groupedRows = new Map<string, Array<{ row: T; index: number }>>();

  rows.forEach((row, index) => {
    const key = reviewRollupKey(row);
    groupedRows.set(key, [...(groupedRows.get(key) ?? []), { row, index }]);
  });

  return Array.from(groupedRows.values()).flatMap(
    (entries): CurrentEvidenceReviewRow<T>[] => {
    const current = entries.reduce((latest, entry) =>
      reviewRowTime(entry.row, entry.index) >=
      reviewRowTime(latest.row, latest.index)
        ? entry
        : latest,
    );

    if (current.row.status === "verified") return [];

    if (current.row.status === "rejected") {
      return [
        {
          hasReturnedCorrection: false,
          row: current.row,
          status: "correction" as const,
        },
      ];
    }

    const currentTime = reviewRowTime(current.row, current.index);
    const hasReturnedCorrection = entries.some(
      (entry) =>
        entry.row.status === "rejected" &&
        reviewRowTime(entry.row, entry.index) <= currentTime,
    );

    return [
      {
        hasReturnedCorrection,
        row: current.row,
        status: hasReturnedCorrection
          ? ("correction_returned" as const)
          : ("evidence_review" as const),
      },
    ];
    },
  );
}

export function buildReportTaskReviewUpdate({
  evidenceStatuses,
  correctionNote,
  currentTaskStatus,
  reviewedAt,
}: {
  evidenceStatuses: EvidenceReviewStatus[];
  correctionNote?: string | null;
  currentTaskStatus: string | null | undefined;
  reviewedAt: string;
}) {
  if (evidenceStatuses.some((status) => status === "rejected")) {
    return {
      status: "needs_revision",
      verified_at: null,
      review_note: correctionNote?.trim() || "Correction requested",
    };
  }

  if (
    evidenceStatuses.length > 0 &&
    evidenceStatuses.every((status) => status === "verified")
  ) {
    return {
      status: "verified",
      verified_at: reviewedAt,
      review_note: null,
    };
  }

  return {
    status: currentTaskStatus === "submitted_late" ? "submitted_late" : "submitted",
    verified_at: null,
    review_note: null,
  };
}
