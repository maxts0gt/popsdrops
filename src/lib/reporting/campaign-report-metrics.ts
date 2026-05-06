const REPORT_PLATFORM_ORDER = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
  "facebook",
];

const SUBMITTED_REPORT_STATUSES = new Set([
  "submitted",
  "submitted_late",
  "verified",
  "needs_revision",
]);

const VERIFIED_READ_STATUSES = new Set([
  "screenshot_verified",
  "brand_verified",
]);

export interface CampaignReportRead {
  campaignMemberId: string;
  submissionId?: string | null;
  platform: string | null;
  reportedAt: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  screenshotUrl?: string | null;
  verificationStatus?: string | null;
  sourceType?: string | null;
}

export interface CampaignReportTask {
  dueAt: string;
  status: string;
  submittedAt?: string | null;
}

export interface PlatformReportMetricPoint {
  date: string;
  views: number;
  engagements: number;
}

export interface PlatformReportMetrics {
  views: number;
  engagements: number;
  engagementRate: number;
  spend: number;
  cpe: number;
  readCount: number;
  series: PlatformReportMetricPoint[];
}

export interface PlatformComparisonMetrics {
  platform: string;
  metrics: PlatformReportMetrics;
}

export interface ReportCompletionMetric {
  total: number;
  submitted: number;
  missed: number;
  percent: number;
  series: Array<{ date: string; submitted: number }>;
}

export interface ReportEvidenceMetric {
  totalReads: number;
  evidenceBackedReads: number;
  verifiedReads: number;
  totalTasks: number;
  submittedTasks: number;
  missedTasks: number;
  confidence: "verified" | "supported" | "incomplete" | "missing";
  dataWindow: { start: string; end: string } | null;
  sourceLabels: string[];
}

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function dateKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function readEngagements(read: CampaignReportRead): number {
  return (
    numberValue(read.likes) +
    numberValue(read.comments) +
    numberValue(read.shares) +
    numberValue(read.saves) +
    numberValue(read.clicks)
  );
}

function readUnitKey(read: CampaignReportRead): string {
  return `${read.submissionId || read.campaignMemberId}:${read.platform || "unknown"}`;
}

function platformSortValue(platform: string): number {
  const orderIndex = REPORT_PLATFORM_ORDER.indexOf(platform);
  return orderIndex === -1 ? REPORT_PLATFORM_ORDER.length : orderIndex;
}

function isSubmittedReportStatus(status: string): boolean {
  return SUBMITTED_REPORT_STATUSES.has(status);
}

function sourceLabel(sourceType: string | null | undefined): string {
  if (sourceType === "creator_confirmed") {
    return "AI extracted and creator confirmed";
  }
  if (sourceType === "ai_extracted") return "AI extracted, waiting for creator";
  if (sourceType === "brand_verified") return "Brand verified";
  if (sourceType === "platform_api") return "Platform API verified";
  return "Manual entry";
}

export function getAvailableReportPlatforms(
  reads: CampaignReportRead[],
): string[] {
  return Array.from(
    new Set(
      reads
        .map((read) => read.platform)
        .filter((platform): platform is string => Boolean(platform)),
    ),
  ).sort((a, b) => platformSortValue(a) - platformSortValue(b) || a.localeCompare(b));
}

export function buildPlatformReportMetrics({
  reads,
  memberRates,
  platform,
}: {
  reads: CampaignReportRead[];
  memberRates: Map<string, number>;
  platform: string;
}): PlatformReportMetrics {
  const platformReads = reads
    .filter((read) => read.platform === platform)
    .toSorted(
      (a, b) =>
        new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime(),
    );
  const unitKeys = Array.from(new Set(platformReads.map(readUnitKey)));
  const dates = Array.from(new Set(platformReads.map((read) => dateKey(read.reportedAt))));
  const latestByUnit = new Map<string, CampaignReportRead>();

  for (const read of platformReads) {
    latestByUnit.set(readUnitKey(read), read);
  }

  const series = dates.map((date) => {
    let views = 0;
    let engagements = 0;

    for (const unitKey of unitKeys) {
      const latestReadForDate = platformReads
        .filter((read) => readUnitKey(read) === unitKey && dateKey(read.reportedAt) <= date)
        .at(-1);

      if (latestReadForDate) {
        views += numberValue(latestReadForDate.views);
        engagements += readEngagements(latestReadForDate);
      }
    }

    return { date, views, engagements };
  });

  const latestReads = Array.from(latestByUnit.values());
  const views = latestReads.reduce((sum, read) => sum + numberValue(read.views), 0);
  const engagements = latestReads.reduce((sum, read) => sum + readEngagements(read), 0);
  const memberIds = new Set(latestReads.map((read) => read.campaignMemberId));
  let spend = 0;

  for (const memberId of memberIds) {
    spend += memberRates.get(memberId) ?? 0;
  }

  return {
    views,
    engagements,
    engagementRate: views > 0 ? (engagements / views) * 100 : 0,
    spend,
    cpe: engagements > 0 ? spend / engagements : 0,
    readCount: platformReads.length,
    series,
  };
}

export function buildAllPlatformReportMetrics({
  reads,
  memberRates,
}: {
  reads: CampaignReportRead[];
  memberRates: Map<string, number>;
}): PlatformReportMetrics {
  const platformMetrics = getAvailableReportPlatforms(reads).map((platform) =>
    buildPlatformReportMetrics({ reads, memberRates, platform }),
  );
  const dates = Array.from(
    new Set(platformMetrics.flatMap((metrics) => metrics.series.map((point) => point.date))),
  ).sort((a, b) => a.localeCompare(b));
  const series = dates.map((date) => {
    let views = 0;
    let engagements = 0;

    for (const metrics of platformMetrics) {
      const latestPointForDate = metrics.series
        .filter((point) => point.date <= date)
        .at(-1);

      if (latestPointForDate) {
        views += latestPointForDate.views;
        engagements += latestPointForDate.engagements;
      }
    }

    return { date, views, engagements };
  });
  const latestPoint = series.at(-1);
  const spend = Array.from(memberRates.values()).reduce((sum, rate) => sum + rate, 0);
  const engagements = latestPoint?.engagements ?? 0;

  return {
    views: latestPoint?.views ?? 0,
    engagements,
    engagementRate: latestPoint && latestPoint.views > 0
      ? (latestPoint.engagements / latestPoint.views) * 100
      : 0,
    spend,
    cpe: engagements > 0 ? spend / engagements : 0,
    readCount: reads.length,
    series,
  };
}

export function buildReportCompletionMetric(
  tasks: CampaignReportTask[],
): ReportCompletionMetric {
  const sortedTasks = tasks.toSorted(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
  const submitted = sortedTasks.filter((task) =>
    isSubmittedReportStatus(task.status),
  ).length;
  const missed = sortedTasks.filter((task) => task.status === "missed").length;
  const dates = Array.from(new Set(sortedTasks.map((task) => dateKey(task.dueAt))));
  const series = dates.map((date) => ({
    date,
    submitted: sortedTasks.filter(
      (task) => dateKey(task.dueAt) <= date && isSubmittedReportStatus(task.status),
    ).length,
  }));

  return {
    total: sortedTasks.length,
    submitted,
    missed,
    percent: sortedTasks.length > 0
      ? Math.round((submitted / sortedTasks.length) * 100)
      : 0,
    series,
  };
}

export function buildReportEvidenceMetric({
  reads,
  tasks,
}: {
  reads: CampaignReportRead[];
  tasks: CampaignReportTask[];
}): ReportEvidenceMetric {
  const completion = buildReportCompletionMetric(tasks);
  const evidenceBackedReads = reads.filter((read) => Boolean(read.screenshotUrl)).length;
  const verifiedReads = reads.filter((read) =>
    VERIFIED_READ_STATUSES.has(read.verificationStatus || ""),
  ).length;
  const dates = reads
    .map((read) => dateKey(read.reportedAt))
    .toSorted((a, b) => a.localeCompare(b));

  let confidence: ReportEvidenceMetric["confidence"] = "missing";

  if (reads.length > 0 || tasks.length > 0) {
    if (completion.missed > 0 || evidenceBackedReads < reads.length) {
      confidence = "incomplete";
    } else if (reads.length > 0 && verifiedReads === reads.length) {
      confidence = "verified";
    } else {
      confidence = "supported";
    }
  }

  return {
    totalReads: reads.length,
    evidenceBackedReads,
    verifiedReads,
    totalTasks: completion.total,
    submittedTasks: completion.submitted,
    missedTasks: completion.missed,
    confidence,
    sourceLabels: Array.from(
      new Set(reads.map((read) => sourceLabel(read.sourceType))),
    ),
    dataWindow: dates.length > 0
      ? {
          start: dates[0],
          end: dates[dates.length - 1],
        }
      : null,
  };
}
