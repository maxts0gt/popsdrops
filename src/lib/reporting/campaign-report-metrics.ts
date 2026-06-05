import { parseEvidenceStorageReference } from "./evidence-upload";

const REPORT_PLATFORM_ORDER = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
  "facebook",
  "x",
  "generic",
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

const CORRECTION_READ_STATUSES = new Set(["rejected"]);

const ACCEPTED_METRIC_SOURCE_TYPES = new Set([
  "creator_confirmed",
  "creator_manual",
  "brand_verified",
  "platform_api",
]);

export interface CampaignReportRead {
  campaignMemberId: string;
  submissionId?: string | null;
  reportTaskId?: string | null;
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
  evidenceVerificationStatus?: string | null;
  evidenceReviewedAt?: string | null;
  evidenceReviewedBy?: string | null;
  sourceType?: string | null;
  aiExtractionStatus?: string | null;
  hasReturnedCorrection?: boolean;
}

export interface CampaignReportMetricValue {
  platform?: string | null;
  metric_key?: string | null;
  metricKey?: string | null;
  metric_value?: number | null;
  metricValue?: number | null;
  source_type?: string | null;
  sourceType?: string | null;
}

export interface ReportPlatformPartition {
  campaignPlatforms: string[];
  proofSourcePlatforms: string[];
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
  pendingReviewReads: number;
  correctionRequestedReads: number;
  missingEvidenceReads: number;
  totalTasks: number;
  submittedTasks: number;
  missedTasks: number;
  actionRequiredTasks: number;
  confidence: "verified" | "supported" | "incomplete" | "missing";
  dataWindow: { start: string; end: string } | null;
  latestReviewedAt?: string | null;
  reviewerRecorded?: boolean;
  sourceLabels: string[];
}

export type ProofRoomScaleReadinessAction =
  | "share"
  | "review_pending"
  | "request_corrections"
  | "collect_missing_proof"
  | "recover_missed_tasks"
  | "wait_for_submissions";

export type ProofRoomScaleReadinessSeverity =
  | "ready"
  | "attention"
  | "blocked"
  | "empty";

export type ProofRoomScaleReadinessLaneId =
  | "correction"
  | "missed"
  | "missing_proof"
  | "review";

export interface ProofRoomScaleReadiness {
  action: ProofRoomScaleReadinessAction;
  attentionCount: number;
  readyForLeadership: boolean;
  scaleScope: "single" | "scale";
  severity: ProofRoomScaleReadinessSeverity;
  totalReads: number;
  totalTasks: number;
  verifiedCoveragePercent: number;
  verifiedReads: number;
  lanes: Array<{ id: ProofRoomScaleReadinessLaneId; count: number }>;
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

function trustReadUnitKey(read: CampaignReportRead, index: number): string {
  if (read.submissionId && read.reportTaskId) {
    return `${read.submissionId}:${read.reportTaskId}:${read.platform || "unknown"}`;
  }

  if (read.submissionId) {
    return `${read.submissionId}:${read.platform || "unknown"}`;
  }

  return `${read.campaignMemberId}:${read.platform || "unknown"}:${dateKey(read.reportedAt)}:${index}`;
}

export function getCurrentReportReads<T extends CampaignReportRead>(reads: T[]): T[] {
  const latest = new Map<string, { read: T; index: number }>();

  reads.forEach((read, index) => {
    const key = trustReadUnitKey(read, index);
    const current = latest.get(key);

    if (
      !current ||
      new Date(read.reportedAt).getTime() >= new Date(current.read.reportedAt).getTime()
    ) {
      latest.set(key, { read, index });
    }
  });

  return Array.from(latest.values())
    .toSorted((a, b) => a.index - b.index)
    .map((entry) => entry.read);
}

export function getCurrentReportReadsWithHistory<T extends CampaignReportRead>(
  reads: T[],
): Array<T & { hasReturnedCorrection: boolean }> {
  const latest = new Map<
    string,
    {
      hasRejectedHistory: boolean;
      index: number;
      read: T;
    }
  >();

  reads.forEach((read, index) => {
    const key = trustReadUnitKey(read, index);
    const current = latest.get(key);
    const hasRejectedHistory =
      Boolean(current?.hasRejectedHistory) || isCorrectionRead(read);

    if (
      !current ||
      new Date(read.reportedAt).getTime() >= new Date(current.read.reportedAt).getTime()
    ) {
      latest.set(key, {
        hasRejectedHistory,
        index,
        read,
      });
      return;
    }

    latest.set(key, {
      ...current,
      hasRejectedHistory,
    });
  });

  return Array.from(latest.values())
    .toSorted((a, b) => a.index - b.index)
    .map((entry) => ({
      ...entry.read,
      hasReturnedCorrection:
        entry.hasRejectedHistory && !isCorrectionRead(entry.read),
    }));
}

function platformSortValue(platform: string): number {
  const orderIndex = REPORT_PLATFORM_ORDER.indexOf(platform);
  return orderIndex === -1 ? REPORT_PLATFORM_ORDER.length : orderIndex;
}

function normalizeMetricPlatform(
  value: CampaignReportMetricValue,
  fallbackPlatform: string | null,
): string | null {
  return value.platform || fallbackPlatform;
}

function normalizeMetricKey(value: CampaignReportMetricValue): string | null {
  const key = value.metric_key ?? value.metricKey ?? null;
  return typeof key === "string" ? key.toLowerCase() : null;
}

function metricNumberValue(value: CampaignReportMetricValue): number | null {
  const metricValue = value.metric_value ?? value.metricValue ?? null;
  return Number.isFinite(metricValue) ? Number(metricValue) : null;
}

function firstMetricNumber(
  metricValues: CampaignReportMetricValue[],
  metricKeys: string[],
): number | null {
  for (const key of metricKeys) {
    const metricValue = metricValues.find((value) => normalizeMetricKey(value) === key);
    const number = metricValue ? metricNumberValue(metricValue) : null;

    if (number !== null) return number;
  }

  return null;
}

function sumMetricNumbers(
  metricValues: CampaignReportMetricValue[],
  metricKeys: string[],
): number | null {
  let total = 0;
  let hasValue = false;

  for (const value of metricValues) {
    const key = normalizeMetricKey(value);
    if (!key || !metricKeys.includes(key)) continue;

    const number = metricNumberValue(value);
    if (number === null) continue;

    total += number;
    hasValue = true;
  }

  return hasValue ? total : null;
}

function hasLegacyReadValues(read: CampaignReportRead): boolean {
  return [
    read.views,
    read.likes,
    read.comments,
    read.shares,
    read.saves,
    read.clicks,
  ].some((value) => Number.isFinite(value));
}

function deriveReadFieldsFromMetricValues(
  metricValues: CampaignReportMetricValue[],
  fallbackRead: Partial<CampaignReportRead>,
): Pick<CampaignReportRead, "views" | "likes" | "comments" | "shares" | "saves" | "clicks"> {
  return {
    views: firstMetricNumber(metricValues, [
      "views",
      "video_views",
      "impressions",
      "reach",
      "viewers",
    ]) ?? fallbackRead.views ?? null,
    likes: sumMetricNumbers(metricValues, [
      "likes",
      "reactions",
      "engagements",
    ]) ?? fallbackRead.likes ?? null,
    comments: sumMetricNumbers(metricValues, [
      "comments",
      "replies",
    ]) ?? fallbackRead.comments ?? null,
    shares: sumMetricNumbers(metricValues, [
      "shares",
      "reposts",
      "quotes",
    ]) ?? fallbackRead.shares ?? null,
    saves: sumMetricNumbers(metricValues, [
      "saves",
      "favorites",
      "bookmarks",
      "screenshots",
    ]) ?? fallbackRead.saves ?? null,
    clicks: sumMetricNumbers(metricValues, [
      "clicks",
      "link_clicks",
      "swipe_ups",
    ]) ?? fallbackRead.clicks ?? null,
  };
}

export function expandReportReadByMetricPlatforms<T extends CampaignReportRead>(
  read: T,
  metricValues: CampaignReportMetricValue[],
): T[] {
  if (metricValues.length === 0) return [read];

  const groupedMetricValues = new Map<string, CampaignReportMetricValue[]>();

  for (const metricValue of metricValues) {
    const platform = normalizeMetricPlatform(metricValue, read.platform);
    if (!platform) continue;

    const currentValues = groupedMetricValues.get(platform) ?? [];
    currentValues.push(metricValue);
    groupedMetricValues.set(platform, currentValues);
  }

  if (groupedMetricValues.size === 0) return [read];

  const expandedReads = Array.from(groupedMetricValues.entries())
    .toSorted(
      ([firstPlatform], [secondPlatform]) =>
        platformSortValue(firstPlatform) - platformSortValue(secondPlatform) ||
        firstPlatform.localeCompare(secondPlatform),
    )
    .map(([platform, values]) => {
      const shouldUseLegacyFallback = platform === read.platform;

      return {
        ...read,
        ...deriveReadFieldsFromMetricValues(
          values,
          shouldUseLegacyFallback ? read : {},
        ),
        platform,
        sourceType: getMetricValueSourceType(values),
      } as T;
    });

  const hasPrimaryMetricGroup = read.platform
    ? groupedMetricValues.has(read.platform)
    : false;

  if (!hasPrimaryMetricGroup && hasLegacyReadValues(read)) {
    return [read, ...expandedReads];
  }

  return expandedReads;
}

export function partitionReportPlatforms({
  availablePlatforms,
  campaignPlatforms,
}: {
  availablePlatforms: string[];
  campaignPlatforms: Array<string | null | undefined> | null | undefined;
}): ReportPlatformPartition {
  const campaignPlatformSet = new Set(
    (campaignPlatforms ?? []).filter((platform): platform is string => Boolean(platform)),
  );

  if (campaignPlatformSet.size === 0) {
    return {
      campaignPlatforms: availablePlatforms,
      proofSourcePlatforms: [],
    };
  }

  return {
    campaignPlatforms: availablePlatforms.filter((platform) =>
      campaignPlatformSet.has(platform),
    ),
    proofSourcePlatforms: availablePlatforms.filter(
      (platform) => !campaignPlatformSet.has(platform),
    ),
  };
}

function isSubmittedReportStatus(status: string): boolean {
  return SUBMITTED_REPORT_STATUSES.has(status);
}

function isVerifiedRead(read: CampaignReportRead): boolean {
  return (
    VERIFIED_READ_STATUSES.has(read.verificationStatus || "") ||
    read.evidenceVerificationStatus === "verified"
  );
}

function isAcceptedMetricSource(read: CampaignReportRead): boolean {
  if (read.sourceType === "ai_extracted") return false;
  if (read.aiExtractionStatus === "pending_confirmation") return false;
  if (!read.sourceType) return true;

  return ACCEPTED_METRIC_SOURCE_TYPES.has(read.sourceType);
}

export function getAcceptedReportReads<T extends CampaignReportRead>(
  reads: T[],
): T[] {
  return reads.filter((read) => isVerifiedRead(read) && isAcceptedMetricSource(read));
}

function isCorrectionRead(read: CampaignReportRead): boolean {
  return (
    CORRECTION_READ_STATUSES.has(read.verificationStatus || "") ||
    read.evidenceVerificationStatus === "rejected"
  );
}

function hasOpenableEvidence(read: CampaignReportRead): boolean {
  return Boolean(parseEvidenceStorageReference(read.screenshotUrl));
}

function sourceLabel(read: CampaignReportRead): string {
  const sourceType = read.sourceType;
  const aiExtractionStatus = read.aiExtractionStatus;

  if (
    isVerifiedRead(read) &&
    (!sourceType ||
      sourceType === "creator_confirmed" ||
      sourceType === "creator_manual" ||
      sourceType === "brand_verified")
  ) {
    return "Brand-reviewed proof";
  }

  if (sourceType === "creator_confirmed") {
    if (aiExtractionStatus === "edited_by_creator") {
      return "AI read, creator edited";
    }
    return "AI read, creator confirmed";
  }
  if (sourceType === "ai_extracted") return "AI read, waiting for creator";
  if (sourceType === "brand_verified") return "Brand verified";
  if (sourceType === "platform_api") return "Platform API verified";
  if (isVerifiedRead(read)) return "Brand-reviewed proof";
  return "Creator-entered proof";
}

export function getMetricValueSourceType(
  metricValues: Array<{ source_type?: unknown; sourceType?: unknown }>,
): string {
  const sourceTypes = new Set(
    metricValues
      .map((value) => value.source_type || value.sourceType)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );

  if (sourceTypes.has("creator_confirmed")) return "creator_confirmed";
  if (sourceTypes.has("brand_verified")) return "brand_verified";
  if (sourceTypes.has("platform_api")) return "platform_api";
  if (sourceTypes.has("ai_extracted")) return "ai_extracted";
  if (sourceTypes.has("creator_manual")) return "creator_manual";

  return "creator_manual";
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
  const platformReads = getAcceptedReportReads(reads)
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
  const acceptedReads = getAcceptedReportReads(reads);
  const platformMetrics = getAvailableReportPlatforms(acceptedReads).map((platform) =>
    buildPlatformReportMetrics({ reads: acceptedReads, memberRates, platform }),
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
    readCount: acceptedReads.length,
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

export function buildProofRoomScaleReadiness(
  evidence: ReportEvidenceMetric,
): ProofRoomScaleReadiness {
  const laneCandidates: ProofRoomScaleReadiness["lanes"] = [
    { id: "correction", count: evidence.correctionRequestedReads },
    { id: "missed", count: evidence.missedTasks },
    { id: "missing_proof", count: evidence.missingEvidenceReads },
    { id: "review", count: evidence.pendingReviewReads },
  ];
  const lanes = laneCandidates.filter((lane) => lane.count > 0);
  const attentionCount = lanes.reduce((total, lane) => total + lane.count, 0);
  const verifiedCoveragePercent = evidence.totalReads > 0
    ? Math.round((evidence.verifiedReads / evidence.totalReads) * 100)
    : 0;
  const scaleScope =
    evidence.totalTasks >= 50 || evidence.totalReads >= 50
      ? "scale"
      : "single";

  let action: ProofRoomScaleReadinessAction = "wait_for_submissions";
  let severity: ProofRoomScaleReadinessSeverity = "empty";

  if (evidence.totalTasks > 0 || evidence.totalReads > 0) {
    if (evidence.correctionRequestedReads > 0) {
      action = "request_corrections";
      severity = "blocked";
    } else if (evidence.missedTasks > 0) {
      action = "recover_missed_tasks";
      severity = "blocked";
    } else if (evidence.missingEvidenceReads > 0) {
      action = "collect_missing_proof";
      severity = "blocked";
    } else if (evidence.pendingReviewReads > 0) {
      action = "review_pending";
      severity = "attention";
    } else if (
      evidence.totalReads > 0 &&
      evidence.verifiedReads === evidence.totalReads &&
      evidence.confidence === "verified"
    ) {
      action = "share";
      severity = "ready";
    } else {
      action = "review_pending";
      severity = "attention";
    }
  }

  return {
    action,
    attentionCount,
    readyForLeadership: action === "share",
    scaleScope,
    severity,
    totalReads: evidence.totalReads,
    totalTasks: evidence.totalTasks,
    verifiedCoveragePercent,
    verifiedReads: evidence.verifiedReads,
    lanes,
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
  const currentReads = getCurrentReportReads(reads);
  const evidenceBackedReads = currentReads.filter(hasOpenableEvidence).length;
  const verifiedReads = currentReads.filter(
    (read) => hasOpenableEvidence(read) && isVerifiedRead(read),
  ).length;
  const correctionRequestedReads = currentReads.filter(isCorrectionRead).length;
  const missingEvidenceReads = currentReads.length - evidenceBackedReads;
  const pendingReviewReads = currentReads.filter(
    (read) => hasOpenableEvidence(read) && !isVerifiedRead(read) && !isCorrectionRead(read),
  ).length;
  const actionRequiredTasks = tasks.filter(
    (task) => task.status === "missed" || task.status === "needs_revision",
  ).length;
  const acceptedReads = getAcceptedReportReads(reads);
  const reviewedReads = currentReads.filter(
    (read) => hasOpenableEvidence(read) && isVerifiedRead(read) && read.evidenceReviewedAt,
  );
  const reviewDates = reviewedReads
    .map((read) => read.evidenceReviewedAt)
    .filter((value): value is string => Boolean(value))
    .toSorted((first, second) =>
      new Date(second).getTime() - new Date(first).getTime(),
    );
  const dataWindowReads = acceptedReads.length > 0 ? acceptedReads : currentReads;
  const dates = Array.from(
    new Set(dataWindowReads.map((read) => dateKey(read.reportedAt))),
  ).toSorted((a, b) => a.localeCompare(b));

  let confidence: ReportEvidenceMetric["confidence"] = "missing";

  if (currentReads.length > 0 || tasks.length > 0) {
    if (
      completion.missed > 0 ||
      evidenceBackedReads < currentReads.length ||
      correctionRequestedReads > 0 ||
      actionRequiredTasks > 0
    ) {
      confidence = "incomplete";
    } else if (currentReads.length > 0 && verifiedReads === currentReads.length) {
      confidence = "verified";
    } else {
      confidence = "supported";
    }
  }

  return {
    totalReads: currentReads.length,
    evidenceBackedReads,
    verifiedReads,
    pendingReviewReads,
    correctionRequestedReads,
    missingEvidenceReads,
    totalTasks: completion.total,
    submittedTasks: completion.submitted,
    missedTasks: completion.missed,
    actionRequiredTasks,
    confidence,
    latestReviewedAt: reviewDates[0] ?? null,
    reviewerRecorded: reviewedReads.some((read) => Boolean(read.evidenceReviewedBy)),
    sourceLabels: Array.from(
      new Set(
        currentReads.map((read) => sourceLabel(read)),
      ),
    ),
    dataWindow: dates.length > 0
      ? {
          start: dates[0],
          end: dates[dates.length - 1],
        }
      : null,
  };
}
