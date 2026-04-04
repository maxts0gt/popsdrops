import type { ContentSubmission, Deliverable } from "./campaign-room";

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
