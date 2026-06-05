export type ReportTaskPerformanceRead = {
  submission_id: string | null;
  verification_status?: string | null;
  reported_at?: string | null;
};

export function getCompletedReportSubmissionCount(
  performanceRows: ReportTaskPerformanceRead[],
): number {
  const latestBySubmission = new Map<
    string,
    { row: ReportTaskPerformanceRead; index: number }
  >();

  performanceRows.forEach((row, index) => {
    if (!row.submission_id) return;

    const current = latestBySubmission.get(row.submission_id);
    const rowTime = row.reported_at ? new Date(row.reported_at).getTime() : index;
    const currentTime = current?.row.reported_at
      ? new Date(current.row.reported_at).getTime()
      : current?.index ?? -1;

    if (!current || rowTime >= currentTime) {
      latestBySubmission.set(row.submission_id, { row, index });
    }
  });

  return Array.from(latestBySubmission.values()).filter(
    ({ row }) => row.verification_status !== "rejected",
  ).length;
}
