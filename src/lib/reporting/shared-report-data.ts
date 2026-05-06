import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatCurrency,
  getMarketLabel,
  getPlatformLabel,
} from "@/lib/constants";
import type {
  ReportExportCreator,
  ReportExportData,
  ReportExportMetric,
  ReportExportSection,
  ReportExportTrustItem,
} from "@/lib/reporting/report-export";
import {
  buildAllPlatformReportMetrics,
  buildPlatformReportMetrics,
  buildReportCompletionMetric,
  buildReportEvidenceMetric,
  getAvailableReportPlatforms,
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

interface CampaignRow {
  id: string;
  title: string;
  total_spend: number | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
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

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateRange(campaign: CampaignRow): string {
  return `${formatDate(campaign.posting_window_start)} to ${formatDate(campaign.posting_window_end)}`;
}

function engagementCount(row: Record<string, number | null>): number {
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
    ? `${formatDate(`${evidence.dataWindow.start}T00:00:00.000Z`)} ~ ${formatDate(`${evidence.dataWindow.end}T00:00:00.000Z`)}`
    : "None";
  const reportStatus = evidence.totalTasks > 0
    ? `${evidence.submittedTasks}/${evidence.totalTasks} submitted`
    : "None";

  return [
    {
      label: "Evidence-backed reads",
      value: `${evidence.evidenceBackedReads}/${evidence.totalReads}`,
      detail: "Native analytics screenshots",
    },
    {
      label: "Verified reads",
      value: `${evidence.verifiedReads}/${evidence.totalReads}`,
      detail: evidence.confidence === "verified"
        ? "Verified by source evidence"
        : "Supported by source evidence",
    },
    {
      label: "Data window",
      value: dataWindow,
      detail: "Platform read dates",
    },
    {
      label: "Report status",
      value: reportStatus,
      detail: "Creator reporting tasks",
    },
  ];
}

async function buildCampaignSharedReport(campaignId: string): Promise<ReportExportData | null> {
  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title, total_spend, posting_window_start, posting_window_end")
    .eq("id", campaignId)
    .single();

  if (!campaign) return null;

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
         content_performance ( measurement_type, reported_at, views, likes, comments, shares, saves, clicks, screenshot_url, verification_status )`,
      )
      .in("campaign_member_id", memberIds);
    submissions = (data ?? []) as Record<string, unknown>[];
  }

  const reportReads: CampaignReportRead[] = [];
  const latestPerformanceBySubmission = new Map<
    string,
    {
      memberId: string;
      platform: string | null;
      row: Record<string, number | string | null>;
    }
  >();

  for (const submission of submissions) {
    const performanceRows = Array.isArray(submission.content_performance)
      ? submission.content_performance
      : submission.content_performance
        ? [submission.content_performance]
        : [];
    const submissionId = submission.id as string;
    const memberId = submission.campaign_member_id as string;
    const platform = submission.platform as string | null;

    for (const row of performanceRows as Array<Record<string, number | string | null>>) {
      const reportedAt = (row.reported_at as string | null) || new Date().toISOString();

      reportReads.push({
        campaignMemberId: memberId,
        submissionId,
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
      });

      const current = latestPerformanceBySubmission.get(submissionId);
      if (
        !current ||
        new Date(reportedAt).getTime() > new Date(current.row.reported_at as string).getTime()
      ) {
        latestPerformanceBySubmission.set(submissionId, { memberId, platform, row });
      }
    }
  }

  const reportTasks = ((tasks ?? []) as Array<Record<string, string | null>>).map((task) => ({
    dueAt: task.due_at || new Date().toISOString(),
    status: task.status || "pending",
    submittedAt: task.submitted_at,
  })) satisfies CampaignReportTask[];
  const availablePlatforms = getAvailableReportPlatforms(reportReads);
  const completionMetric = buildReportCompletionMetric(reportTasks);
  const evidenceMetric = buildReportEvidenceMetric({
    reads: reportReads,
    tasks: reportTasks,
  });
  const allMetrics = buildAllPlatformReportMetrics({ reads: reportReads, memberRates });
  const allCards = buildMetricConfigs({
    metrics: allMetrics,
    completion: completionMetric,
    readDetail: `${availablePlatforms.length} channels`,
    platformDetail: "All Channels",
  });
  const sections: ReportExportSection[] = [
    {
      title: "All Channels",
      detail: "Compared by channel.",
      metrics: allCards.filter((metric) => metric.key !== "reports"),
    },
    ...availablePlatforms.map((platform) => {
      const metrics = buildPlatformReportMetrics({
        reads: reportReads,
        memberRates,
        platform,
      });

      return {
        title: getPlatformLabel(platform),
        detail: "Platform-native metrics",
        metrics: buildMetricConfigs({
          metrics,
          completion: completionMetric,
          readDetail: metrics.readCount === 1 ? "1 read" : `${metrics.readCount} reads`,
          platformDetail: getPlatformLabel(platform),
        }).filter((metric) => metric.key !== "reports"),
      };
    }),
  ];
  const performanceByMemberPlatform = new Map<
    string,
    { views: number; engagements: number; platform: string | null }
  >();

  for (const performance of latestPerformanceBySubmission.values()) {
    const key = `${performance.memberId}:${performance.platform || "unknown"}`;
    const existing = performanceByMemberPlatform.get(key) ?? {
      views: 0,
      engagements: 0,
      platform: performance.platform,
    };

    performanceByMemberPlatform.set(key, {
      views: existing.views + numberValue(performance.row.views as number | null),
      engagements:
        existing.engagements +
        engagementCount(performance.row as Record<string, number | null>),
      platform: performance.platform || existing.platform,
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

  return {
    campaignTitle: campaign.title,
    dateRange: dateRange(campaign),
    generatedAt: new Date().toISOString(),
    kpis: allCards.map((card) => ({
      label: card.label,
      value: card.value,
      detail: card.detail,
    })),
    trust: buildTrustItems(evidenceMetric),
    sections,
    creators,
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
