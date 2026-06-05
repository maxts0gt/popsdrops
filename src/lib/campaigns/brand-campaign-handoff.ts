export type BrandCampaignHandoffStageKey = "content" | "liveUrl" | "proof";

export type BrandCampaignHandoffStageTone = "done" | "attention" | "waiting";

export type BrandCampaignHandoffSubmission = {
  status: string;
  publishedUrl: string | null;
};

export type BrandCampaignHandoffReportTask = {
  status: string;
};

export type BrandCampaignHandoffStage = {
  key: BrandCampaignHandoffStageKey;
  doneCount: number;
  totalCount: number;
  blockedCount: number;
  value: string;
  tone: BrandCampaignHandoffStageTone;
};

export type BrandCampaignHandoffSummary = {
  stages: BrandCampaignHandoffStage[];
  blockedCount: number;
};

const contentDoneStatuses = new Set(["approved", "published"]);
const contentBlockedStatuses = new Set(["submitted", "revision_requested"]);
const proofDoneStatuses = new Set(["verified", "excused"]);
const proofBlockedStatuses = new Set([
  "submitted",
  "submitted_late",
  "needs_revision",
  "missed",
]);

function getStageTone({
  blockedCount,
  doneCount,
  totalCount,
}: {
  blockedCount: number;
  doneCount: number;
  totalCount: number;
}): BrandCampaignHandoffStageTone {
  if (totalCount > 0 && doneCount >= totalCount && blockedCount === 0) {
    return "done";
  }

  if (blockedCount > 0) {
    return "attention";
  }

  return "waiting";
}

function createStage({
  blockedCount,
  doneCount,
  key,
  totalCount,
}: {
  blockedCount: number;
  doneCount: number;
  key: BrandCampaignHandoffStageKey;
  totalCount: number;
}): BrandCampaignHandoffStage {
  return {
    key,
    blockedCount,
    doneCount,
    totalCount,
    value: totalCount > 0 ? `${doneCount}/${totalCount}` : "0",
    tone: getStageTone({ blockedCount, doneCount, totalCount }),
  };
}

export function getBrandCampaignHandoffSummary({
  reportTasks,
  submissions,
}: {
  reportTasks: BrandCampaignHandoffReportTask[];
  submissions: BrandCampaignHandoffSubmission[];
}): BrandCampaignHandoffSummary {
  const contentTotal = submissions.length;
  const contentDone = submissions.filter((submission) =>
    contentDoneStatuses.has(submission.status),
  ).length;
  const contentBlocked = submissions.filter((submission) =>
    contentBlockedStatuses.has(submission.status),
  ).length;

  const liveUrlTotal = contentDone;
  const liveUrlDone = submissions.filter(
    (submission) =>
      submission.status === "published" && Boolean(submission.publishedUrl),
  ).length;
  const liveUrlBlocked = Math.max(liveUrlTotal - liveUrlDone, 0);

  const proofTotal = reportTasks.length;
  const proofDone = reportTasks.filter((task) =>
    proofDoneStatuses.has(task.status),
  ).length;
  const proofBlocked = reportTasks.filter((task) =>
    proofBlockedStatuses.has(task.status),
  ).length;

  const stages = [
    createStage({
      key: "content",
      doneCount: contentDone,
      totalCount: contentTotal,
      blockedCount: contentBlocked,
    }),
    createStage({
      key: "liveUrl",
      doneCount: liveUrlDone,
      totalCount: liveUrlTotal,
      blockedCount: liveUrlBlocked,
    }),
    createStage({
      key: "proof",
      doneCount: proofDone,
      totalCount: proofTotal,
      blockedCount: proofBlocked,
    }),
  ];

  return {
    stages,
    blockedCount: stages.reduce((total, stage) => total + stage.blockedCount, 0),
  };
}
