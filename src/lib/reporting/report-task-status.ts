import type { CampaignReportTaskStatus } from "@/types/database";

export type ReportTaskDisplayStatus =
  | CampaignReportTaskStatus
  | "due_soon"
  | "overdue";

const DUE_SOON_HOURS = 48;
const CREATOR_REPORT_TASK_SUBMISSION_STATUSES = new Set<
  CampaignReportTaskStatus
>(["pending", "needs_revision", "missed"]);

export function reportTaskAcceptsCreatorSubmission(
  status: CampaignReportTaskStatus | string | null | undefined,
): boolean {
  return CREATOR_REPORT_TASK_SUBMISSION_STATUSES.has(
    status as CampaignReportTaskStatus,
  );
}

export function assertReportTaskAcceptsCreatorSubmission(
  status: CampaignReportTaskStatus | string | null | undefined,
) {
  if (!reportTaskAcceptsCreatorSubmission(status)) {
    throw new Error("This report read is already closed.");
  }
}

export function shouldMarkReportTaskMissed(input: {
  status: CampaignReportTaskStatus;
  dueAt: string;
  gracePeriodHours: number;
  now: Date;
}) {
  if (input.status !== "pending" && input.status !== "needs_revision") {
    return false;
  }

  const missedAt = addHours(new Date(input.dueAt), input.gracePeriodHours);
  return input.now.getTime() > missedAt.getTime();
}

export function getReportTaskDisplayStatus(input: {
  status: CampaignReportTaskStatus;
  dueAt: string;
  now: Date;
}): ReportTaskDisplayStatus {
  if (input.status !== "pending") return input.status;

  const dueAt = new Date(input.dueAt);
  if (input.now.getTime() > dueAt.getTime()) return "overdue";

  const dueSoonAt = addHours(input.now, DUE_SOON_HOURS);
  if (dueSoonAt.getTime() >= dueAt.getTime()) return "due_soon";

  return "pending";
}

export function getReportTaskMutationForSubmission(input: {
  status: CampaignReportTaskStatus;
  now: Date;
}) {
  return {
    status: input.status === "missed" ? "submitted_late" : "submitted",
    submitted_at: input.now.toISOString(),
  } satisfies {
    status: Extract<CampaignReportTaskStatus, "submitted" | "submitted_late">;
    submitted_at: string;
  };
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
