import type {
  CampaignReportTask,
  ContentPerformance,
  ContentSubmission,
  Deliverable,
} from "./campaign-room";

export type CampaignRoomTab = "brief" | "tasks" | "submit";

const campaignRoomTabs = new Set<CampaignRoomTab>([
  "brief",
  "tasks",
  "submit",
]);

function compareSubmissionRecency(
  left: ContentSubmission,
  right: ContentSubmission,
): number {
  if (left.version !== right.version) {
    return right.version - left.version;
  }

  const leftTime = new Date(
    left.publishedAt ?? left.submittedAt ?? 0,
  ).getTime();
  const rightTime = new Date(
    right.publishedAt ?? right.submittedAt ?? 0,
  ).getTime();

  return rightTime - leftTime;
}

export function getDeliverableSubmission(
  deliverable: Deliverable,
  submissions: ContentSubmission[],
): ContentSubmission | null {
  const exactMatches = submissions
    .filter((submission) => submission.deliverableId === deliverable.id)
    .sort(compareSubmissionRecency);

  if (exactMatches.length > 0) {
    return exactMatches[0] ?? null;
  }

  const legacyPlatformMatches = submissions
    .filter(
      (submission) =>
        submission.deliverableId == null &&
        submission.platform === deliverable.platform,
    )
    .sort(compareSubmissionRecency);

  return legacyPlatformMatches[0] ?? null;
}

export function getSelectedDeliverableId(
  deliverables: Deliverable[],
  currentDeliverableId: string | null,
): string | null {
  if (
    currentDeliverableId &&
    deliverables.some((deliverable) => deliverable.id === currentDeliverableId)
  ) {
    return currentDeliverableId;
  }

  return deliverables[0]?.id ?? null;
}

export function getInitialRoomTab(
  tabParam: string | string[] | undefined,
): CampaignRoomTab {
  const candidate = Array.isArray(tabParam) ? tabParam[0] : tabParam;

  if (candidate && campaignRoomTabs.has(candidate as CampaignRoomTab)) {
    return candidate as CampaignRoomTab;
  }

  return "brief";
}

export function getLatestPerformanceRead(
  submissionId: string | null | undefined,
  performance: ContentPerformance[],
): ContentPerformance | null {
  if (!submissionId) return null;

  const reads = performance
    .filter((read) => read.submissionId === submissionId)
    .sort((left, right) => {
      const leftTime = new Date(left.reportedAt ?? 0).getTime();
      const rightTime = new Date(right.reportedAt ?? 0).getTime();
      return rightTime - leftTime;
    });

  return reads[0] ?? null;
}

export function getOpenReportTask(
  tasks: CampaignReportTask[],
): CampaignReportTask | null {
  const statusPriority: Record<string, number> = {
    needs_revision: 0,
    pending: 1,
  };

  const openTasks = tasks
    .filter((task) =>
      ["pending", "needs_revision"].includes(task.status),
    )
    .sort((left, right) => {
      const priorityDelta =
        statusPriority[left.status] - statusPriority[right.status];
      if (priorityDelta !== 0) return priorityDelta;

      const leftTime = new Date(left.dueAt).getTime();
      const rightTime = new Date(right.dueAt).getTime();
      return leftTime - rightTime;
    });

  return openTasks[0] ?? null;
}

export function parseOptionalMetric(value: string): number | undefined {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Enter a valid metric value");
  }

  return Math.floor(parsed);
}

export function hasAtLeastOneMetric(values: Record<string, string>): boolean {
  return Object.values(values).some((value) => value.trim().length > 0);
}
