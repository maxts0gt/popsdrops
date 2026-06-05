import {
  buildReportExportStory,
  getReportTrustDecision,
  type ReportExportCreator,
  type ReportExportData,
  type ReportExportMetric,
  type ReportExportPresentation,
  type ReportExportTrustItem,
} from "./report-export";

type SharedReportStoryMode = "trend" | "comparison" | "proof";
type SharedReportChartMetricKey =
  NonNullable<ReportExportPresentation["chartMetricKey"]>;

export interface SharedReportStoryPrimaryMetric {
  detail: string;
  journey: string;
  label: string;
  pointCount: number;
  value: string;
}

export interface SharedReportStoryComparisonRow {
  context: string;
  metricValue: string;
  name: string;
  rank: number;
  supportingValue: string;
}

export interface SharedReportStoryProofItem {
  detail: string;
  label: string;
  value: string;
}

export interface SharedReportStory {
  comparisonRows: SharedReportStoryComparisonRow[];
  decisionRead: string;
  detail: string;
  evidenceTrail: string;
  metricLabel: string;
  mode: SharedReportStoryMode;
  primaryMetric: SharedReportStoryPrimaryMetric | null;
  proofItems: SharedReportStoryProofItem[];
  proofSourceCount: number;
  sortDetail: string;
  title: string;
  trustDecision: string;
}

function isSharedReportStoryMode(value: string | undefined): value is SharedReportStoryMode {
  return value === "trend" || value === "comparison" || value === "proof";
}

function isChartMetricKey(value: unknown): value is SharedReportChartMetricKey {
  return (
    value === "views" ||
    value === "engagements" ||
    value === "engagementRate" ||
    value === "cpe"
  );
}

function parseMetricValue(value: string): number {
  const normalized = value.trim().toUpperCase();
  const multiplier = normalized.includes("B")
    ? 1_000_000_000
    : normalized.includes("M")
      ? 1_000_000
      : normalized.includes("K")
        ? 1_000
        : 1;
  const numeric = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(numeric) ? numeric * multiplier : 0;
}

function getMetricKey(metric: ReportExportMetric): SharedReportChartMetricKey | null {
  if (isChartMetricKey(metric.key)) return metric.key;

  const label = metric.label.toLowerCase();
  if (label.includes("engagement rate")) return "engagementRate";
  if (label.includes("engagement")) return "engagements";
  if (label.includes("cost per engagement") || label === "cpe") return "cpe";
  if (label.includes("view") || label.includes("reach")) return "views";

  return null;
}

function getCampaignSectionMetric(
  data: ReportExportData,
  metricKey: SharedReportChartMetricKey,
): ReportExportMetric | null {
  const campaignSection =
    data.sections.find((section) => section.sourceGroup !== "proof_source") ??
    data.sections[0];

  if (!campaignSection) return null;

  return campaignSection.metrics.find((metric) => getMetricKey(metric) === metricKey) ??
    campaignSection.metrics[0] ??
    null;
}

function buildMetricJourney(metric: ReportExportMetric | null): string {
  if (!metric) return "No metric reads yet.";
  if (metric.points.length < 2) return metric.value;

  const first = metric.points[0];
  const last = metric.points[metric.points.length - 1];

  return `${first.label} to ${last.label}`;
}

function buildPrimaryMetric(
  metric: ReportExportMetric | null,
  metricLabel: string,
): SharedReportStoryPrimaryMetric | null {
  if (!metric) return null;

  return {
    detail: metric.detail,
    journey: buildMetricJourney(metric),
    label: metricLabel,
    pointCount: metric.points.length,
    value: metric.value,
  };
}

function getComparisonMetricKey(data: ReportExportData): SharedReportChartMetricKey {
  const selectedKey = data.composition?.presentation?.chartMetricKey;

  return isChartMetricKey(selectedKey) ? selectedKey : "views";
}

function getComparisonMetricLabel(
  data: ReportExportData,
  metricKey: SharedReportChartMetricKey,
): string {
  return data.kpis.find((metric) => metric.key === metricKey)?.label ??
    (metricKey === "engagementRate"
      ? "Engagement Rate"
      : metricKey === "engagements"
        ? "Engagements"
        : metricKey === "cpe"
          ? "Cost per Engagement"
          : "Views");
}

function getCreatorMetricValue(
  creator: ReportExportCreator,
  metricKey: SharedReportChartMetricKey,
): string {
  if (metricKey === "engagements") return creator.engagements;
  if (metricKey === "engagementRate") return creator.er;
  if (metricKey === "cpe") return creator.cpe;

  return creator.views;
}

function buildComparisonRows(
  data: ReportExportData,
  metricKey: SharedReportChartMetricKey,
): SharedReportStoryComparisonRow[] {
  const viewsLabel = getComparisonMetricLabel(data, "views");

  return [...data.creators]
    .sort((first, second) => {
      const firstValue = parseMetricValue(getCreatorMetricValue(first, metricKey));
      const secondValue = parseMetricValue(getCreatorMetricValue(second, metricKey));

      return metricKey === "cpe"
        ? firstValue - secondValue || parseMetricValue(second.views) - parseMetricValue(first.views)
        : secondValue - firstValue || parseMetricValue(second.views) - parseMetricValue(first.views);
    })
    .slice(0, 5)
    .map((creator, index) => ({
      context: `${creator.platform} / ${creator.market}`,
      metricValue: getCreatorMetricValue(creator, metricKey),
      name: creator.name,
      rank: index + 1,
      supportingValue: `${viewsLabel} ${creator.views}`,
    }));
}

function buildComparisonSortDetail(
  metricLabel: string,
  metricKey: SharedReportChartMetricKey,
): string {
  if (metricKey === "cpe") {
    return `Sorted by ${metricLabel}. Lower CPE ranks first.`;
  }

  return `Sorted by ${metricLabel}. Platform definitions stay separate.`;
}

function buildProofItems(data: ReportExportData): SharedReportStoryProofItem[] {
  const reviewItem = data.proofReview
    ? [{
        detail: data.proofReview.detail,
        label: data.proofReview.label,
        value: data.proofReview.value,
      }]
    : [];
  const trustItems = data.trust.map((item) => ({
    detail: item.detail,
    label: item.label,
    value: item.value,
  }));
  const proofSourceItems = data.sections
    .filter((section) => section.sourceGroup === "proof_source")
    .map((section) => ({
      detail: section.detail,
      label: section.title,
      value: section.metrics[0]?.value ?? "Ready",
    }));

  return [...trustItems, ...reviewItem, ...proofSourceItems].slice(0, 8);
}

function getProofSourceCount(data: ReportExportData): number {
  return data.sections.filter((section) => section.sourceGroup === "proof_source").length;
}

export function buildSharedReportStory(data: ReportExportData): SharedReportStory {
  const mode = isSharedReportStoryMode(data.composition?.chartModeId)
    ? data.composition.chartModeId
    : "trend";
  const story = buildReportExportStory(data);
  const trustDecision = getReportTrustDecision(data);
  const metricKey = getComparisonMetricKey(data);
  const metricLabel = getComparisonMetricLabel(data, metricKey);
  const primaryMetric = getCampaignSectionMetric(data, metricKey);

  return {
    comparisonRows: mode === "comparison" ? buildComparisonRows(data, metricKey) : [],
    decisionRead: story.decisionRead,
    detail:
      data.composition?.chartLayoutDetail ??
      data.composition?.chartModeDetail ??
      "Selected evidence view.",
    evidenceTrail: story.evidenceTrail,
    metricLabel,
    mode,
    primaryMetric: buildPrimaryMetric(primaryMetric, metricLabel),
    proofItems: buildProofItems(data),
    proofSourceCount: getProofSourceCount(data),
    sortDetail: buildComparisonSortDetail(metricLabel, metricKey),
    title:
      data.composition?.chartLayoutTitle ??
      data.composition?.chartModeTitle ??
      "Primary report story",
    trustDecision,
  };
}
