export type CampaignSubmissionVersionRef = {
  id?: string | null;
  parentSubmissionId?: string | null;
};

export function getActiveCampaignSubmissions<
  T extends CampaignSubmissionVersionRef,
>(submissions: T[]): T[] {
  const supersededSubmissionIds = new Set(
    submissions
      .map((submission) => submission.parentSubmissionId)
      .filter((id): id is string => Boolean(id)),
  );

  if (supersededSubmissionIds.size === 0) {
    return submissions;
  }

  return submissions.filter(
    (submission) =>
      submission.id == null || !supersededSubmissionIds.has(submission.id),
  );
}
