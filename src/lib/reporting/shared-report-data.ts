import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatCurrency,
  getMarketLabel,
  getPlatformLabel,
} from "@/lib/constants";
import { CAMPAIGN_ASSET_BUCKET_ID } from "@/lib/campaigns/creative-kit-upload";
import {
  buildReportLeadershipHandoff,
  buildReportExportStory,
  buildReportProofReviewProvenance,
  type ReportExportCreator,
  type ReportExportData,
  type ReportExportMetric,
  type ReportExportRecommendation,
  type ReportExportSection,
  type ReportExportTrustItem,
} from "@/lib/reporting/report-export";
import {
  buildReportCompositionExportData,
  type ReportBuilderChartModeId,
  type ReportBuilderPresentation,
  type ReportBuilderPresetSelectionId,
} from "@/lib/reporting/report-builder";
import {
  formatReportChannelCount,
  formatReportReadCount,
} from "@/lib/reporting/report-count-labels";
import {
  expandReportReadByMetricPlatforms,
  buildAllPlatformReportMetrics,
  buildPlatformReportMetrics,
  buildReportCompletionMetric,
  buildReportEvidenceMetric,
  getAcceptedReportReads,
  getAvailableReportPlatforms,
  getMetricValueSourceType,
  partitionReportPlatforms,
  type CampaignReportRead,
  type CampaignReportTask,
  type PlatformReportMetrics,
  type ReportCompletionMetric,
  type ReportEvidenceMetric,
} from "@/lib/reporting/campaign-report-metrics";
import {
  hashReportShareToken,
  isReportShareTokenShape,
} from "@/lib/reporting/report-share-links";
import type { PerformanceAiExtractionStatus } from "@/types/database";

interface CampaignRow {
  id: string;
  brand_id: string;
  title: string;
  platforms: string[] | null;
  total_spend: number | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
}

interface CampaignReportPlanGoalRow {
  report_template_id: string | null;
  report_preset_id: string | null;
  report_chart_mode_id: string | null;
  report_block_ids: string[] | null;
  report_presentation: ReportBuilderPresentation | null;
}

interface BuildCampaignSharedReportOptions {
  applyCampaignComposition?: boolean;
}

interface SharedMemberPerformance {
  rowId: string;
  memberId: string;
  name: string;
  market: string | null;
  platform: string | null;
  rate: number | null;
  views: number;
  engagements: number;
  er: number;
  cpe: number;
  rating: number;
}

interface CampaignReportImageAssetRow {
  bucket_id: string | null;
  storage_path: string | null;
  title: string | null;
}

interface CampaignReportImage {
  signedUrl: string;
  title: string | null;
}

export interface SharedReportLinkMeta {
  id: string;
  campaignId: string;
  label: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface SharedReportPayload {
  share: SharedReportLinkMeta;
  report: ReportExportData;
}

function numberValue(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;

  return String(value);
}

function formatDate(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dateRange(campaign: CampaignRow): string {
  return `${formatDate(campaign.posting_window_start)} - ${formatDate(campaign.posting_window_end)}`;
}

const CAMPAIGN_REPORT_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

async function loadCampaignReportImage(
  supabase: ReturnType<typeof createAdminClient>,
  campaignId: string,
): Promise<CampaignReportImage | null> {
  const selectColumns = "title, bucket_id, storage_path";
  const readyImageQuery = () =>
    supabase
      .from("campaign_assets")
      .select(selectColumns)
      .eq("campaign_id", campaignId)
      .eq("status", "ready")
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true })
      .limit(1);

  const { data: preferredRows } = await readyImageQuery().eq(
    "asset_type",
    "product_image",
  );
  const { data: fallbackRows } =
    preferredRows && preferredRows.length > 0
      ? { data: null }
      : await readyImageQuery();
  const asset = ((preferredRows?.[0] ?? fallbackRows?.[0] ?? null) as
    | CampaignReportImageAssetRow
    | null);

  if (!asset?.storage_path) return null;

  const { data } = await supabase.storage
    .from(asset.bucket_id || CAMPAIGN_ASSET_BUCKET_ID)
    .createSignedUrl(
      asset.storage_path,
      CAMPAIGN_REPORT_IMAGE_SIGNED_URL_TTL_SECONDS,
    );

  if (!data?.signedUrl) return null;

  return {
    signedUrl: data.signedUrl,
    title: asset.title ?? null,
  };
}

function engagementCount(row: {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
}): number {
  return (
    numberValue(row.likes) +
    numberValue(row.comments) +
    numberValue(row.shares) +
    numberValue(row.saves) +
    numberValue(row.clicks)
  );
}

function buildMetricPoints(
  metrics: PlatformReportMetrics,
  key: "views" | "engagements" | "engagementRate" | "cpe",
): ReportExportMetric["points"] {
  return metrics.series.map((point) => {
    let value = point.views;
    let label = formatNumber(point.views);

    if (key === "engagements") {
      value = point.engagements;
      label = formatNumber(point.engagements);
    } else if (key === "engagementRate") {
      value = point.views > 0 ? (point.engagements / point.views) * 100 : 0;
      label = `${value.toFixed(1)}%`;
    } else if (key === "cpe") {
      value = point.engagements > 0 ? metrics.spend / point.engagements : 0;
      label = value > 0 ? formatCurrency(value, "en", "USD", 2) : "-";
    }

    return {
      date: point.date,
      label,
      value,
    };
  });
}

function buildMetricConfigs({
  metrics,
  completion,
  readDetail,
  platformDetail,
}: {
  metrics: PlatformReportMetrics;
  completion: ReportCompletionMetric;
  readDetail: string;
  platformDetail: string;
}): ReportExportMetric[] {
  return [
    {
      key: "views",
      label: "Views",
      value: formatNumber(metrics.views),
      detail: readDetail,
      points: buildMetricPoints(metrics, "views"),
    },
    {
      key: "engagements",
      label: "Engagements",
      value: formatNumber(metrics.engagements),
      detail: readDetail,
      points: buildMetricPoints(metrics, "engagements"),
    },
    {
      key: "engagementRate",
      label: "Engagement Rate",
      value: `${metrics.engagementRate.toFixed(1)}%`,
      detail: platformDetail,
      points: buildMetricPoints(metrics, "engagementRate"),
    },
    {
      key: "cpe",
      label: "Cost per Engagement",
      value: metrics.cpe > 0 ? formatCurrency(metrics.cpe, "en", "USD", 2) : "-",
      detail: metrics.spend > 0
        ? `${formatCurrency(metrics.spend, "en")} spend`
        : "No spend yet",
      points: buildMetricPoints(metrics, "cpe"),
    },
    {
      key: "reports",
      label: "Reports received",
      value: `${completion.submitted}/${completion.total}`,
      detail: completion.missed > 0 ? `${completion.missed} missed` : "On track",
      points: completion.series.map((point) => ({
        date: point.date,
        label: String(point.submitted),
        value: point.submitted,
      })),
    },
  ];
}

function buildTrustItems(evidence: ReportEvidenceMetric): ReportExportTrustItem[] {
  const dataWindow = evidence.dataWindow
    ? `${formatDate(`${evidence.dataWindow.start}T00:00:00.000Z`)} - ${formatDate(`${evidence.dataWindow.end}T00:00:00.000Z`)}`
    : "None";
  const reportStatus = buildSharedReportStatusValue(evidence);
  const sourceValue = evidence.sourceLabels.length > 0
    ? evidence.sourceLabels.join(", ")
    : "None";
  const sourceDetail = buildSourceDetail(evidence, sourceValue);

  return [
    {
      key: "evidence_backed_reads",
      label: "Evidence-backed reads",
      value: `${evidence.evidenceBackedReads}/${evidence.totalReads}`,
      detail: "Native analytics screenshots",
    },
    {
      key: "verified_reads",
      label: "Verified reads",
      value: `${evidence.verifiedReads}/${evidence.totalReads}`,
      detail: evidence.confidence === "verified"
        ? "Verified by source evidence"
        : "Supported by source evidence",
    },
    {
      key: "data_window",
      label: "Data window",
      value: dataWindow,
      detail: "Platform read dates",
    },
    {
      key: "report_status",
      label: "Report status",
      value: reportStatus.value,
      detail: reportStatus.detail,
    },
    {
      key: "data_source",
      label: "Data source",
      value: sourceValue,
      detail: sourceDetail,
    },
  ];
}

function buildSourceDetail(
  evidence: ReportEvidenceMetric,
  sourceValue: string,
): string {
  const sourceText = sourceValue.toLowerCase();

  if (
    sourceText.includes("brand-reviewed proof") ||
    (evidence.totalReads > 0 && evidence.verifiedReads >= evidence.totalReads)
  ) {
    return "Creator evidence reviewed by brand";
  }

  if (
    sourceText.includes("creator-entered proof") ||
    (evidence.totalReads > 0 && evidence.verifiedReads < evidence.totalReads)
  ) {
    return "Creator-submitted values awaiting brand review";
  }

  return "Evidence path into PopsDrops";
}

function buildSharedReportStatusValue(
  evidence: ReportEvidenceMetric,
): { value: string; detail: string } {
  const submittedDetail = evidence.totalTasks > 0
    ? `${evidence.submittedTasks}/${evidence.totalTasks} submitted`
    : "Creator reporting tasks";

  if (evidence.totalTasks === 0) {
    return {
      value: "None",
      detail: "Creator reporting tasks",
    };
  }

  if (evidence.missedTasks > 0) {
    return {
      value: `${evidence.missedTasks} missed`,
      detail: submittedDetail,
    };
  }

  if (evidence.correctionRequestedReads > 0) {
    return {
      value: `${evidence.correctionRequestedReads} correction requested`,
      detail: submittedDetail,
    };
  }

  if (evidence.missingEvidenceReads > 0) {
    return {
      value: `${evidence.missingEvidenceReads} missing proof`,
      detail: submittedDetail,
    };
  }

  if (evidence.pendingReviewReads > 0) {
    return {
      value: `${evidence.pendingReviewReads} awaiting review`,
      detail: submittedDetail,
    };
  }

  return {
    value: "Ready for review",
    detail: submittedDetail,
  };
}

function getLatestSharedReportProofReview(
  evidenceRows: Array<{
    reviewed_at: string | null;
    reviewed_by: string | null;
    verification_status: string | null;
  }>,
): { reviewedAt: string | null; reviewerRecorded: boolean } {
  const reviewedEvidenceRows = evidenceRows.filter(
    (evidence) => evidence.reviewed_at && evidence.verification_status === "verified",
  );
  const reviewedAt = reviewedEvidenceRows
    .map((evidence) => evidence.reviewed_at)
    .filter((value): value is string => Boolean(value))
    .toSorted((first, second) => new Date(second).getTime() - new Date(first).getTime())[0] ??
    null;

  return {
    reviewedAt,
    reviewerRecorded: reviewedEvidenceRows.some((evidence) => Boolean(evidence.reviewed_by)),
  };
}

function buildRecommendations({
  allMetrics,
  performers,
  platformMetrics,
}: {
  allMetrics: PlatformReportMetrics;
  performers: SharedMemberPerformance[];
  platformMetrics: Array<{ platform: string; metrics: PlatformReportMetrics }>;
}): ReportExportRecommendation[] {
  const recommendations: ReportExportRecommendation[] = [];
  const topCreator = performers
    .filter((creator) => creator.views > 0)
    .toSorted((first, second) => second.views - first.views)[0];

  if (topCreator) {
    recommendations.push({
      title: "Top creator",
      value: topCreator.name,
      detail: `${formatNumber(topCreator.views)} views on ${getPlatformLabel(topCreator.platform || "")}`,
    });
  }

  const bestChannel = platformMetrics
    .filter((item) => item.metrics.readCount > 0 && item.metrics.views > 0)
    .toSorted(
      (first, second) =>
        second.metrics.engagementRate - first.metrics.engagementRate ||
        second.metrics.views - first.metrics.views,
    )[0];

  if (bestChannel) {
    recommendations.push({
      title: "Best channel",
      value: getPlatformLabel(bestChannel.platform),
      detail: `${bestChannel.metrics.engagementRate.toFixed(1)}% engagement rate across ${
        bestChannel.metrics.readCount === 1
          ? "1 read"
          : `${bestChannel.metrics.readCount} reads`
      }`,
    });
  }

  if (allMetrics.cpe > 0) {
    recommendations.push({
      title: "Efficiency",
      value: formatCurrency(allMetrics.cpe, "en", "USD", 2),
      detail: `${formatCurrency(allMetrics.spend, "en")} verified spend`,
    });
  }

  return recommendations.slice(0, 3);
}

async function loadSharedReportCompositionTemplate({
  brandId,
  templateId,
  supabase,
}: {
  brandId: string;
  templateId: string | null | undefined;
  supabase: ReturnType<typeof createAdminClient>;
}) {
  if (!templateId) return null;

  const { data } = await supabase
    .from("report_composition_templates")
    .select("id, name, description, report_presentation")
    .eq("id", templateId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string | null,
    presentation: data.report_presentation as ReportBuilderPresentation | null,
  };
}

export async function buildCampaignSharedReport(
  campaignId: string,
  options: BuildCampaignSharedReportOptions = {},
): Promise<ReportExportData | null> {
  const shouldApplyCampaignComposition = options.applyCampaignComposition ?? true;
  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id, title, platforms, total_spend, posting_window_start, posting_window_end")
    .eq("id", campaignId)
    .single();

  if (!campaign) return null;

  const campaignImage = await loadCampaignReportImage(supabase, campaignId);

  const { data: reportPlanData } = await supabase
    .from("campaign_reporting_plans")
    .select("report_template_id, report_preset_id, report_chart_mode_id, report_block_ids, report_presentation")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  const reportPlan = reportPlanData as CampaignReportPlanGoalRow | null;
  const reportTemplate = await loadSharedReportCompositionTemplate({
    brandId: campaign.brand_id,
    templateId: reportPlan?.report_template_id,
    supabase,
  });

  const { data: reportingRequirements } = await supabase
    .from("campaign_reporting_requirements")
    .select("platform, platform_label")
    .eq("campaign_id", campaignId);
  const reportingPlatformLabels = new Map(
    (reportingRequirements || [])
      .filter((row) => row.platform && row.platform_label)
      .map((row) => [row.platform as string, row.platform_label as string]),
  );

  const { data: members } = await supabase
    .from("campaign_members")
    .select(
      `id, accepted_rate, creator_id,
       profiles!campaign_members_creator_id_fkey ( full_name )`,
    )
    .eq("campaign_id", campaignId);

  const { data: tasks } = await supabase
    .from("campaign_report_tasks")
    .select("due_at, status, submitted_at")
    .eq("campaign_id", campaignId);

  const memberRows = (members ?? []) as Array<Record<string, unknown>>;
  const creatorIds = memberRows
    .map((member) => member.creator_id as string)
    .filter(Boolean);
  const memberIds = memberRows.map((member) => member.id as string);
  const memberRates = new Map<string, number>();
  const creatorProfileMap = new Map<string, Record<string, unknown>>();

  for (const member of memberRows) {
    const rate = member.accepted_rate as number | null;
    if (rate != null) memberRates.set(member.id as string, rate);
  }

  if (creatorIds.length > 0) {
    const { data: creatorProfiles } = await supabase
      .from("creator_profiles")
      .select("profile_id, primary_market, rating, tiktok, instagram, snapchat, youtube, facebook")
      .in("profile_id", creatorIds);

    for (const profile of creatorProfiles ?? []) {
      creatorProfileMap.set(profile.profile_id as string, profile as Record<string, unknown>);
    }
  }

  let submissions: Record<string, unknown>[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from("content_submissions")
      .select(
        `id, campaign_member_id, platform,
         content_performance (
           id, report_task_id, measurement_type, reported_at, views, likes, comments, shares, saves, clicks, screenshot_url, verification_status,
           content_performance_metric_values ( platform, source_type, metric_key, metric_label, metric_value, confirmed_by_creator )
         )`,
      )
      .in("campaign_member_id", memberIds);
    submissions = (data ?? []) as Record<string, unknown>[];
  }

  const performanceIds = submissions.flatMap((submission) => {
    const performanceRows = Array.isArray(submission.content_performance)
      ? submission.content_performance
      : submission.content_performance
        ? [submission.content_performance]
        : [];

    return performanceRows
      .map((row) => (row as Record<string, unknown>).id as string | null)
      .filter(Boolean) as string[];
  });
  const aiStatusByPerformanceId = new Map<string, PerformanceAiExtractionStatus>();
  const evidenceByPerformanceId = new Map<
    string,
    {
      id: string;
      performance_id: string;
      reviewed_at: string | null;
      reviewed_by: string | null;
      verification_status: string | null;
    }
  >();

  if (performanceIds.length > 0) {
    const { data: evidences } = await supabase
      .from("content_performance_evidence")
      .select("id, performance_id, verification_status, reviewed_at, reviewed_by")
      .in("performance_id", performanceIds)
      .order("created_at", { ascending: false });

    for (const evidence of evidences ?? []) {
      if (
        evidence.performance_id &&
        evidence.id &&
        !evidenceByPerformanceId.has(evidence.performance_id)
      ) {
        evidenceByPerformanceId.set(evidence.performance_id, {
          id: evidence.id,
          performance_id: evidence.performance_id,
          reviewed_at: evidence.reviewed_at ?? null,
          reviewed_by: evidence.reviewed_by ?? null,
          verification_status: evidence.verification_status ?? null,
        });
      }
    }

    const evidenceIds = Array.from(evidenceByPerformanceId.values()).map(
      (evidence) => evidence.id,
    );

    if (evidenceIds.length > 0) {
      const { data: aiExtractions } = await supabase
        .from("content_performance_ai_extractions")
        .select("evidence_id, status, created_at")
        .in("evidence_id", evidenceIds)
        .order("created_at", { ascending: false });

      const aiStatusByEvidenceId = new Map<string, PerformanceAiExtractionStatus>();

      for (const extraction of aiExtractions ?? []) {
        const evidenceId = extraction.evidence_id;
        if (evidenceId && !aiStatusByEvidenceId.has(evidenceId)) {
          aiStatusByEvidenceId.set(
            evidenceId,
            extraction.status as PerformanceAiExtractionStatus,
          );
        }
      }

      for (const [performanceId, evidence] of evidenceByPerformanceId) {
        const aiExtractionStatus = aiStatusByEvidenceId.get(evidence.id);
        if (aiExtractionStatus) {
          aiStatusByPerformanceId.set(performanceId, aiExtractionStatus);
        }
      }
    }
  }

  const reportReads: CampaignReportRead[] = [];

  for (const submission of submissions) {
    const performanceRows = Array.isArray(submission.content_performance)
      ? submission.content_performance
      : submission.content_performance
        ? [submission.content_performance]
        : [];
    const submissionId = submission.id as string;
    const memberId = submission.campaign_member_id as string;
    const platform = submission.platform as string | null;

    for (const row of performanceRows as Array<Record<string, unknown>>) {
      const performanceId = row.id as string | null;
      const reportedAt = (row.reported_at as string | null) || new Date().toISOString();
      const metricValues = Array.isArray(row.content_performance_metric_values)
        ? row.content_performance_metric_values
        : [];
      const evidence = performanceId ? evidenceByPerformanceId.get(performanceId) : null;

      const read: CampaignReportRead = {
        campaignMemberId: memberId,
        submissionId,
        reportTaskId: row.report_task_id as string | null,
        platform,
        reportedAt,
        views: row.views as number | null,
        likes: row.likes as number | null,
        comments: row.comments as number | null,
        shares: row.shares as number | null,
        saves: row.saves as number | null,
        clicks: row.clicks as number | null,
        screenshotUrl: row.screenshot_url as string | null,
        verificationStatus: row.verification_status as string | null,
        evidenceVerificationStatus: evidence?.verification_status ?? null,
        evidenceReviewedAt: evidence?.reviewed_at ?? null,
        evidenceReviewedBy: evidence?.reviewed_by ?? null,
        aiExtractionStatus: performanceId
          ? aiStatusByPerformanceId.get(performanceId) ?? null
          : null,
        sourceType: getMetricValueSourceType(metricValues),
      };

      reportReads.push(...expandReportReadByMetricPlatforms(read, metricValues));
    }
  }

  const reportTasks = ((tasks ?? []) as Array<Record<string, string | null>>).map((task) => ({
    dueAt: task.due_at || new Date().toISOString(),
    status: task.status || "pending",
    submittedAt: task.submitted_at,
  })) satisfies CampaignReportTask[];
  const trustedReportReads = getAcceptedReportReads(reportReads);
  const availablePlatforms = getAvailableReportPlatforms(trustedReportReads);
  const {
    campaignPlatforms: campaignChannelPlatforms,
    proofSourcePlatforms,
  } = partitionReportPlatforms({
    availablePlatforms,
    campaignPlatforms: campaign.platforms,
  });
  const campaignChannelReads = trustedReportReads.filter(
    (read) => read.platform && campaignChannelPlatforms.includes(read.platform),
  );
  const completionMetric = buildReportCompletionMetric(reportTasks);
  const evidenceMetric = buildReportEvidenceMetric({
    reads: reportReads,
    tasks: reportTasks,
  });
  const allMetrics = buildAllPlatformReportMetrics({ reads: campaignChannelReads, memberRates });
  const platformMetrics = campaignChannelPlatforms.map((platform) => ({
    platform,
    metrics: buildPlatformReportMetrics({
      reads: campaignChannelReads,
      memberRates,
      platform,
    }),
  }));
  const proofSourceMetrics = proofSourcePlatforms.map((platform) => ({
    platform,
    metrics: buildPlatformReportMetrics({
      reads: trustedReportReads,
      memberRates,
      platform,
    }),
  }));
  const allCards = buildMetricConfigs({
    metrics: allMetrics,
    completion: completionMetric,
    readDetail: formatReportChannelCount(campaignChannelPlatforms.length),
    platformDetail: "All Channels",
  });
  const sections: ReportExportSection[] = [
    {
      title: "All Channels",
      detail: "Compared by channel.",
      sourceGroup: "campaign_channel",
      metrics: allCards.filter((metric) => metric.key !== "reports"),
    },
    ...platformMetrics.map((item) => ({
        title: getPlatformLabel(item.platform),
        detail: "Platform-native metrics",
        sourceGroup: "campaign_channel" as const,
        metrics: buildMetricConfigs({
          metrics: item.metrics,
          completion: completionMetric,
          readDetail: formatReportReadCount(item.metrics.readCount),
          platformDetail: getPlatformLabel(item.platform),
        }).filter((metric) => metric.key !== "reports"),
    })),
    ...proofSourceMetrics.map((item) => ({
      title: reportingPlatformLabels.get(item.platform) || getPlatformLabel(item.platform),
      detail: "Supporting evidence only. Not mixed into campaign channel totals.",
      sourceGroup: "proof_source" as const,
      metrics: buildMetricConfigs({
        metrics: item.metrics,
        completion: completionMetric,
        readDetail: formatReportReadCount(item.metrics.readCount),
        platformDetail: reportingPlatformLabels.get(item.platform) || getPlatformLabel(item.platform),
      }).filter((metric) => metric.key !== "reports" && metric.key !== "cpe"),
    })),
  ];
  const performanceByMemberPlatform = new Map<
    string,
    { views: number; engagements: number; platform: string | null }
  >();
  const latestTrustedReadBySubmission = new Map<string, CampaignReportRead>();

  for (const read of trustedReportReads) {
    const key =
      read.submissionId
        ? `${read.submissionId}:${read.platform || "unknown"}`
        :
      `${read.campaignMemberId}:${read.platform || "unknown"}:${read.reportedAt}`;
    const current = latestTrustedReadBySubmission.get(key);

    if (
      !current ||
      new Date(read.reportedAt).getTime() >= new Date(current.reportedAt).getTime()
    ) {
      latestTrustedReadBySubmission.set(key, read);
    }
  }

  for (const read of latestTrustedReadBySubmission.values()) {
    const key = `${read.campaignMemberId}:${read.platform || "unknown"}`;
    const existing = performanceByMemberPlatform.get(key) ?? {
      views: 0,
      engagements: 0,
      platform: read.platform,
    };

    performanceByMemberPlatform.set(key, {
      views: existing.views + numberValue(read.views),
      engagements: existing.engagements + engagementCount(read),
      platform: read.platform || existing.platform,
    });
  }

  const performers: SharedMemberPerformance[] = [];
  for (const member of memberRows) {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    const creatorProfile = creatorProfileMap.get(member.creator_id as string) ?? null;
    const name = (profile as Record<string, string> | null)?.full_name ?? "Creator";
    const market = (creatorProfile as Record<string, string | null> | null)?.primary_market ?? null;
    const rating = (creatorProfile as Record<string, number> | null)?.rating ?? 0;
    const entries = Array.from(performanceByMemberPlatform.entries()).filter(([key]) =>
      key.startsWith(`${member.id}:`),
    );

    for (const [rowId, value] of entries) {
      const rate = member.accepted_rate as number | null;
      const er = value.views > 0 ? (value.engagements / value.views) * 100 : 0;
      const cpe = value.engagements > 0 && rate ? rate / value.engagements : 0;

      performers.push({
        rowId,
        memberId: member.id as string,
        name,
        market,
        platform: value.platform,
        rate,
        views: value.views,
        engagements: value.engagements,
        er,
        cpe,
        rating,
      });
    }
  }

  const creators: ReportExportCreator[] = performers.map((creator) => ({
    name: creator.name,
    market: creator.market ? getMarketLabel(creator.market, "en") : "-",
    platform: getPlatformLabel(creator.platform || ""),
    views: formatNumber(creator.views),
    engagements: formatNumber(creator.engagements),
    er: `${creator.er.toFixed(1)}%`,
    cpe: creator.cpe > 0 ? formatCurrency(creator.cpe, "en", "USD", 2) : "-",
    spent: creator.rate != null ? formatCurrency(creator.rate, "en") : "-",
    rating: creator.rating > 0 ? creator.rating.toFixed(1) : "-",
  }));
  const latestProofReview = getLatestSharedReportProofReview(
    Array.from(evidenceByPerformanceId.values()),
  );

  const baseReport: ReportExportData = {
    campaignTitle: campaign.title,
    dateRange: dateRange(campaign),
    generatedAt: new Date().toISOString(),
    campaignImageAlt: campaignImage?.title ?? null,
    campaignImageUrl: campaignImage?.signedUrl ?? null,
    proofReview: buildReportProofReviewProvenance({
      reviewedAt: evidenceMetric.latestReviewedAt ?? latestProofReview.reviewedAt,
      reviewerRecorded: Boolean(evidenceMetric.reviewerRecorded) ||
        latestProofReview.reviewerRecorded,
    }),
    kpis: allCards.map((card) => ({
      key: card.key,
      label: card.label,
      value: card.value,
      detail: card.detail,
    })),
    trust: buildTrustItems(evidenceMetric),
    recommendations: buildRecommendations({
      allMetrics,
      performers,
      platformMetrics,
    }),
    sections,
    creators,
  };
  const baseReportWithLeadershipHandoff: ReportExportData = {
    ...baseReport,
    leadershipHandoff: buildReportLeadershipHandoff(baseReport),
  };

  if (!shouldApplyCampaignComposition) {
    return {
      ...baseReportWithLeadershipHandoff,
      story: buildReportExportStory(baseReportWithLeadershipHandoff),
    };
  }

  const composedReport = buildReportCompositionExportData(baseReportWithLeadershipHandoff, {
    blockIds: reportPlan?.report_block_ids,
    chartModeId: reportPlan?.report_chart_mode_id as
      | ReportBuilderChartModeId
      | null
      | undefined,
    presetId: reportPlan?.report_preset_id as
      | ReportBuilderPresetSelectionId
      | null
      | undefined,
    presentation: reportPlan?.report_presentation,
    template: reportTemplate,
  });

  return {
    ...composedReport,
    story: buildReportExportStory(composedReport),
  };
}

export async function getSharedReportByToken(
  token: string,
): Promise<SharedReportPayload | null> {
  if (!isReportShareTokenShape(token)) return null;

  const supabase = createAdminClient();
  const tokenHash = await hashReportShareToken(token);
  const { data: link } = await supabase
    .from("campaign_report_share_links")
    .select("id, campaign_id, label, expires_at, revoked_at, view_count, created_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!link || link.revoked_at) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return null;

  const report = await buildCampaignSharedReport(link.campaign_id);
  if (!report) return null;

  await supabase
    .from("campaign_report_share_links")
    .update({
      last_viewed_at: new Date().toISOString(),
      view_count: (link.view_count ?? 0) + 1,
    })
    .eq("id", link.id);

  return {
    share: {
      id: link.id,
      campaignId: link.campaign_id,
      label: link.label,
      expiresAt: link.expires_at,
      createdAt: link.created_at,
    },
    report,
  };
}
