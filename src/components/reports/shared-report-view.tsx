"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  CircleCheck,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import type {
  ReportExportData,
  ReportExportMetric,
  ReportExportMetricPoint,
  ReportExportPresentation,
  ReportHeroMetric,
} from "@/lib/reporting/report-export";
import {
  buildReportHeroMetrics,
  getReportBodyKpis,
  getReportDisplayTitle,
} from "@/lib/reporting/report-export";
import type { SharedReportPayload } from "@/lib/reporting/shared-report-data";
import {
  getSharedReportLeadershipGate,
  getSharedReportNextAction,
  getSharedReportProofBasis,
  type SharedReportProofBasisKey,
  getSharedReportTrustDecision,
} from "@/lib/reporting/shared-report-trust";
import {
  buildSharedReportStory,
  type SharedReportStory,
} from "@/lib/reporting/shared-report-story";
import { formatReportCompactDate } from "@/lib/reporting/report-date-format";
import { useTranslation } from "@/lib/i18n";

interface SharedReportViewProps {
  data: ReportExportData;
  share: SharedReportPayload["share"];
}

interface HoveredPoint extends ReportExportMetricPoint {
  x: number;
  y: number;
  metricLabel: string;
}

type SortDirection = "asc" | "desc";
type CreatorSortKey =
  | "creator"
  | "market"
  | "platform"
  | "views"
  | "engagements"
  | "er"
  | "cpe"
  | "spent"
  | "rating";

interface SortState<T extends string> {
  key: T;
  direction: SortDirection;
}

interface SharedReportSortHeaderProps {
  activeSort: SortState<CreatorSortKey>;
  align?: "start" | "end";
  defaultDirection?: SortDirection;
  label: string;
  onSort: (key: CreatorSortKey, defaultDirection: SortDirection) => void;
  sortKey: CreatorSortKey;
}

type SharedReportCreatorRow = ReportExportData["creators"][number];
const sharedReportTrustIcons = [FileCheck2, ShieldCheck, CalendarDays, CircleCheck];
const sharedReportHoldTrustItemKeys = [
  "evidence_backed_reads",
  "verified_reads",
  "report_status",
  "data_source",
] as const;
const sharedReportHoldPerformanceBlockIds = new Set([
  "executive_summary",
  "channel_story",
  "proof_sources",
  "recommendations",
  "creator_table",
]);

function getNextSortState<T extends string>(
  current: SortState<T>,
  key: T,
  defaultDirection: SortDirection,
): SortState<T> {
  if (current.key !== key) return { key, direction: defaultDirection };

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

function parseMetricSortValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return null;

  const multiplier = trimmed.toUpperCase().includes("K") ? 1000 : 1;
  const numeric = Number(trimmed.replace(/[$,%K,\s]/gi, ""));
  return Number.isFinite(numeric) ? numeric * multiplier : null;
}

function compareSortValues(
  first: string | number | null | undefined,
  second: string | number | null | undefined,
): number {
  if (first == null && second == null) return 0;
  if (first == null) return 1;
  if (second == null) return -1;
  if (typeof first === "number" && typeof second === "number") return first - second;

  return String(first).localeCompare(String(second), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function applySortDirection(value: number, direction: SortDirection): number {
  return direction === "asc" ? value : -value;
}

function getCreatorSortValue(
  creator: SharedReportCreatorRow,
  key: CreatorSortKey,
): string | number | null {
  if (key === "creator") return creator.name;
  if (key === "market") return creator.market;
  if (key === "platform") return creator.platform;
  if (key === "views") return parseMetricSortValue(creator.views);
  if (key === "engagements") return parseMetricSortValue(creator.engagements);
  if (key === "er") return parseMetricSortValue(creator.er);
  if (key === "cpe") return parseMetricSortValue(creator.cpe);
  if (key === "spent") return parseMetricSortValue(creator.spent);
  return parseMetricSortValue(creator.rating);
}

function SharedReportSortHeader({
  activeSort,
  align = "start",
  defaultDirection = "asc",
  label,
  onSort,
  sortKey,
}: SharedReportSortHeaderProps) {
  const isActive = activeSort.key === sortKey;
  const ariaSort = isActive
    ? activeSort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      aria-sort={ariaSort}
      className={`px-5 py-3 ${align === "end" ? "text-end" : "text-start"}`}
    >
      <button
        type="button"
        data-testid="shared-report-sort-header"
        data-sort-key={sortKey}
        onClick={() => onSort(sortKey, defaultDirection)}
        className={`inline-flex w-full items-center gap-1 text-xs font-semibold uppercase transition hover:text-slate-900 ${
          align === "end" ? "justify-end" : "justify-start"
        }`}
      >
        <span>{label}</span>
        <ArrowUpDown className={isActive ? "size-3 text-slate-900" : "size-3"} />
      </button>
    </th>
  );
}

function axisValue(metric: ReportExportMetric, value: number): string {
  const sample = metric.points.find((point) => point.label)?.label ?? metric.value;

  if (sample.includes("$")) {
    return `$${value.toLocaleString("en-US", {
      maximumFractionDigits: value < 10 ? 2 : 0,
    })}`;
  }

  if (sample.includes("%")) {
    return `${value.toFixed(1)}%`;
  }

  if (sample.includes("K") && value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function chartDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function snapshotDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatSharedReportAccessDate(
  value: string | null,
): string {
  return formatReportCompactDate(value);
}

function getSharedReportPresentation(data: ReportExportData): ReportExportPresentation {
  const presentation = data.composition?.presentation;

  return {
    coverMode: presentation?.coverMode === "proof_room"
      ? "proof_room"
      : "campaign_visual",
    typography: presentation?.typography === "compact" ? "compact" : "quiet",
    density: presentation?.density === "compact" ? "compact" : "editorial",
    ...(presentation?.headline ? { headline: presentation.headline } : {}),
    ...(presentation?.executiveQuestion
      ? { executiveQuestion: presentation.executiveQuestion }
      : {}),
    ...(presentation?.kpiIds?.length ? { kpiIds: presentation.kpiIds } : {}),
    ...(presentation?.trustIds?.length ? { trustIds: presentation.trustIds } : {}),
    ...(presentation?.kpiLabels && Object.keys(presentation.kpiLabels).length
      ? { kpiLabels: presentation.kpiLabels }
      : {}),
    ...(presentation?.trustLabels && Object.keys(presentation.trustLabels).length
      ? { trustLabels: presentation.trustLabels }
      : {}),
    ...(presentation?.sectionLabels && Object.keys(presentation.sectionLabels).length
      ? { sectionLabels: presentation.sectionLabels }
      : {}),
  };
}

function getSharedReportCoverMetricIcon(metric: ReportHeroMetric) {
  if (metric.source === "kpi") return BarChart3;
  if (metric.key === "data_window") return CalendarDays;
  if (metric.key === "evidence_backed_reads") return FileCheck2;
  return ShieldCheck;
}

function getSharedReportProofBasisLabel(
  key: SharedReportProofBasisKey,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  if (key === "included") return t("evidence.summary.included");
  if (key === "needs-review") return t("evidence.summary.review");
  if (key === "corrections") return t("evidence.summary.corrections");
  return t("evidence.summary.missing");
}

function getSharedReportHoldTrustItems(data: ReportExportData) {
  const preferredItems = sharedReportHoldTrustItemKeys.flatMap((key) => {
    const item = data.trust.find((candidate) => candidate.key === key);
    return item ? [item] : [];
  });
  const preferredKeys = new Set(preferredItems.map((item) => item.key));
  const remainingItems = data.trust.filter(
    (item) => !item.key || !preferredKeys.has(item.key),
  );

  return [...preferredItems, ...remainingItems].slice(0, 4);
}

function buildSharedReportHoldCoverMetrics(data: ReportExportData): ReportHeroMetric[] {
  return getSharedReportHoldTrustItems(data).slice(0, 3).map((item, index) => ({
    key: item.key ?? `trust-${index}`,
    label: item.label,
    value: item.value,
    detail: item.detail,
    source: "trust" as const,
  }));
}

function SharedReportLeadershipHoldPanel({
  data,
  leadershipGate,
  nextAction,
}: {
  data: ReportExportData;
  leadershipGate: ReturnType<typeof getSharedReportLeadershipGate>;
  nextAction: string;
}) {
  const { t } = useTranslation("brand.report");
  const holdTrustItems = getSharedReportHoldTrustItems(data);

  return (
    <section
      data-testid="shared-report-leadership-hold-panel"
      className="mb-6 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            <ShieldCheck className="size-3.5" />
            <span>{leadershipGate.label}</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold leading-tight text-slate-800">
            Performance detail held for evidence review
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Public performance charts, creator rows, and recommendations stay inside the proof room until the brand reviews the required evidence.
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
            {leadershipGate.detail}
          </p>
          <div
            data-testid="shared-report-hold-next-action"
            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <p className="text-[10px] font-semibold uppercase leading-none tracking-normal text-slate-500">
              {t("builder.chartStory.nextAction")}
            </p>
            <strong className="mt-1.5 block text-sm font-medium leading-5 text-slate-800">
              {nextAction}
            </strong>
          </div>
        </div>
        {holdTrustItems.length ? (
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            {holdTrustItems.map((item, index) => {
              const Icon = sharedReportTrustIcons[index] ?? CircleCheck;

              return (
                <article
                  key={item.key ?? item.label}
                  data-testid="shared-report-hold-proof-item"
                  className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Icon className="size-3.5 shrink-0" />
                    <p className="truncate text-[11px] font-semibold uppercase tracking-normal">
                      {item.label}
                    </p>
                  </div>
                  <p className="font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere]">
                    {item.value}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                    {item.detail}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SharedReportStoryPanel({
  leadershipGate,
  story,
}: {
  leadershipGate: ReturnType<typeof getSharedReportLeadershipGate>;
  story: SharedReportStory;
}) {
  const { t } = useTranslation("brand.report");
  const showPerformanceStory = leadershipGate.state === "ready";
  const shouldShowProofStory = story.mode === "proof" || !showPerformanceStory;
  const primaryMetric = story.primaryMetric;
  const isSingleReadTrendStory =
    showPerformanceStory &&
    story.mode === "trend" &&
    primaryMetric !== null &&
    primaryMetric.pointCount < 2;
  const proofSummary = story.proofSourceCount > 0
    ? t("builder.chartStory.proofSourceCount", {
      count: String(story.proofSourceCount),
    })
    : story.proofItems.length ? t("builder.chartStory.proofSources") : t("builder.chartStory.noProofSources");

  return (
    <section
      data-testid="shared-report-story-panel"
      data-shared-report-story-mode={story.mode}
      className="mb-6 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm"
    >
      <div className="grid border-b border-slate-200 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.34fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            {t("builder.chartStory.title")}
          </p>
          <h2 className="mt-2 max-w-3xl text-xl font-semibold leading-tight text-slate-800">
            {story.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {story.detail}
          </p>
          {isSingleReadTrendStory && primaryMetric ? (
            <div
              data-testid="shared-report-story-snapshot-callout"
              className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[minmax(0,0.36fr)_minmax(0,1fr)] sm:items-center"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                  {t("chart.snapshot.title")}
                </p>
                <p className="mt-2 font-mono text-[13px] font-medium leading-tight text-slate-700">
                  {primaryMetric.value}
                </p>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                {t("chart.snapshot.detail")}
              </p>
            </div>
          ) : null}
        </div>
        <div className="grid border-t border-slate-200 bg-slate-50/70 lg:border-s lg:border-t-0">
          <div className="border-b border-slate-200 px-5 py-4 last:border-b-0">
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.chartStory.decisionRead")}
            </p>
            <p
              data-testid="shared-report-story-decision"
              className="mt-1 text-sm font-medium leading-5 text-slate-700"
            >
              {story.decisionRead}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.chartStory.evidenceTrail")}
            </p>
            <p
              data-testid="shared-report-story-evidence"
              className="mt-1 text-sm font-medium leading-5 text-slate-700"
            >
              {story.evidenceTrail}
            </p>
          </div>
        </div>
      </div>

      {showPerformanceStory && story.mode === "trend" && story.primaryMetric ? (
        <div
          data-testid="shared-report-story-trend"
          className="grid gap-4 border-t border-slate-200 bg-slate-50/30 p-5 lg:grid-cols-[minmax(0,0.34fr)_minmax(0,1fr)] sm:p-6"
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.chartStory.selectedMetric")}
            </p>
            <p className="mt-2 text-sm font-semibold leading-tight text-slate-800">
              {story.primaryMetric.label}
            </p>
            <p className="mt-2 font-mono text-[13px] font-medium leading-tight text-slate-700">
              {story.primaryMetric.value}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {story.metricLabel}
            </p>
            <p className="mt-2 text-lg font-medium leading-tight text-slate-800">
              {story.primaryMetric.journey}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {story.primaryMetric.detail}
            </p>
          </div>
        </div>
      ) : null}

      {showPerformanceStory && story.mode === "comparison" ? (
        <div
          data-testid="shared-report-story-comparison"
          className="p-5 sm:p-6"
        >
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                {t("builder.chartStory.selectedMetric")}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {story.metricLabel}
              </p>
            </div>
            <p className="max-w-xl text-xs leading-5 text-slate-500 sm:text-end">
              {story.sortDetail}
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            {story.comparisonRows.map((row) => (
              <article
                key={`${row.rank}:${row.name}`}
                data-testid="shared-report-story-comparison-row"
                className="grid gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.28fr)_minmax(0,0.28fr)] sm:items-center"
              >
                <span className="font-mono text-xs font-medium text-slate-400">
                  {String(row.rank).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{row.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.context}</p>
                </div>
                <p className="font-mono text-[13px] font-medium text-slate-700 sm:text-end">
                  {row.metricValue}
                </p>
                <p className="text-xs text-slate-500 sm:text-end">
                  {row.supportingValue}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {shouldShowProofStory ? (
        <div
          data-testid="shared-report-story-proof"
          className="border-t border-slate-200 p-5 sm:p-6"
        >
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                {t("builder.chartStory.evidenceStatus")}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {story.trustDecision}
              </p>
            </div>
            <p className="text-xs leading-5 text-slate-500 sm:text-end">
              {proofSummary}
            </p>
          </div>
          {story.proofItems.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {story.proofItems.map((item) => (
                <article
                  key={`${item.label}:${item.value}`}
                  data-testid="shared-report-story-proof-item"
                  className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere]">
                    {item.value}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                    {item.detail}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SharedReportExecutiveCover({
  campaignImageAlt,
  campaignImageUrl,
  dateRange,
  executiveQuestion,
  headline,
  leadershipGate,
  metrics,
  nextAction,
  presentation,
  proofBasis,
}: {
  campaignImageAlt?: string | null;
  campaignImageUrl?: string | null;
  dateRange: string;
  executiveQuestion?: string | null;
  headline: string;
  leadershipGate: ReturnType<typeof getSharedReportLeadershipGate>;
  metrics: ReportHeroMetric[];
  nextAction: string;
  presentation: ReportExportPresentation;
  proofBasis: ReturnType<typeof getSharedReportProofBasis>;
}) {
  const { t } = useTranslation("brand.report");
  const [campaignImageFailed, setCampaignImageFailed] = useState(false);
  const shouldUseCampaignImage =
    presentation.coverMode !== "proof_room" && Boolean(campaignImageUrl);
  const shouldRenderCampaignImage = shouldUseCampaignImage && !campaignImageFailed;
  const coverSource = shouldRenderCampaignImage
    ? "campaign-image"
    : presentation.coverMode === "proof_room" ? "proof-room" : "fallback";
  const compactTypography = presentation.typography === "compact";
  const compactDensity = presentation.density === "compact";

  useEffect(() => {
    setCampaignImageFailed(false);
  }, [campaignImageUrl]);

  return (
    <section
      data-testid="shared-report-executive-cover"
      data-cover-mode={presentation.coverMode}
      data-typography={presentation.typography}
      data-density={presentation.density}
      className={[
        "mb-7 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm",
        compactDensity ? "lg:min-h-[294px]" : "lg:min-h-[330px]",
      ].join(" ")}
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div
          className={[
            "min-w-0",
            compactDensity ? "p-5 sm:p-6 lg:p-7" : "p-6 sm:p-8 lg:p-10",
          ].join(" ")}
        >
          <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            {t("cover.kicker")}
          </p>
          <h1
            className={[
              "max-w-3xl text-pretty font-semibold leading-tight text-slate-800",
              compactTypography
                ? "mt-3 text-xl sm:text-2xl"
                : "mt-4 text-2xl sm:text-3xl",
            ].join(" ")}
          >
            {headline}
          </h1>
          <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="shrink-0 text-slate-500">{t("cover.window")}:</span>
            <span className="font-mono text-[11px] font-medium text-slate-700 [overflow-wrap:anywhere]">
              {dateRange}
            </span>
          </div>
          {executiveQuestion ? (
            <p
              data-testid="shared-report-executive-question"
              className={[
                "max-w-3xl border-s-2 border-slate-900 ps-3 text-pretty leading-6 text-slate-700",
                compactDensity ? "mt-4 text-sm" : "mt-5 text-[15px]",
              ].join(" ")}
            >
              <span
                data-testid="shared-report-executive-cover-question"
                className="mb-1 block text-[10px] font-semibold uppercase leading-none tracking-normal text-slate-500"
              >
                {t("builder.output.executiveQuestion")}
              </span>
              {executiveQuestion}
            </p>
          ) : null}
          <div
            className={[
              "grid overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)] divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0",
              compactDensity ? "mt-5" : "mt-7",
            ].join(" ")}
            data-testid="shared-report-executive-cover-evidence-strip"
          >
            {metrics.map((metric) => {
              const Icon = getSharedReportCoverMetricIcon(metric);

              return (
                <article
                  key={`${metric.source}:${metric.key}`}
                  data-testid="shared-report-executive-cover-metric"
                  data-cover-metric-source={metric.source}
                  data-cover-metric-key={metric.key}
                  className={[
                    "min-w-0 bg-white/80 px-3.5",
                    compactDensity ? "py-3" : "py-3.5",
                  ].join(" ")}
                >
                  <div data-testid="shared-report-executive-cover-evidence-item">
                    <div
                      className={[
                        "flex items-center gap-2 text-slate-500",
                        compactDensity ? "mb-2" : "mb-3",
                      ].join(" ")}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <p className="line-clamp-2 text-[10px] font-semibold uppercase leading-snug tracking-normal">
                        {metric.label}
                      </p>
                    </div>
                    <p
                      className={[
                        "line-clamp-2 font-medium leading-snug text-slate-700",
                        compactTypography ? "text-xs" : "text-sm",
                      ].join(" ")}
                    >
                      {metric.value}
                    </p>
                    {metric.detail ? (
                      <p
                        data-testid="shared-report-executive-cover-metric-detail"
                        className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-500"
                      >
                        {metric.detail}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <div
            data-testid="shared-report-leadership-gate"
            data-leadership-state={leadershipGate.state}
            className={[
              "mt-4 rounded-xl border px-3 py-3",
              leadershipGate.state === "ready"
                ? "border-slate-200 bg-white"
                : "border-slate-300 bg-slate-50",
            ].join(" ")}
          >
            <div
              data-testid="shared-report-executive-cover-trust-decision"
              data-cover-trust-state={leadershipGate.state}
              className="flex items-start gap-2.5"
            >
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    {t("builder.output.trustDecision")}
                  </p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-normal text-slate-500">
                    {leadershipGate.label}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium leading-5 text-slate-700">
                  {leadershipGate.detail}
                </p>
                <div
                  data-testid="shared-report-leadership-next-action"
                  className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase leading-none tracking-normal text-slate-500">
                    {t("builder.chartStory.nextAction")}
                  </p>
                  <strong className="mt-1.5 block text-sm font-medium leading-5 text-slate-800">
                    {nextAction}
                  </strong>
                </div>
                <div
                  data-testid="shared-report-proof-basis"
                  className="mt-3 border-t border-slate-200 pt-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                    {t("evidence.command.countsLabel")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {proofBasis.map((item) => (
                      <span
                        key={item.key}
                        data-testid="shared-report-proof-basis-item"
                        data-proof-basis-key={item.key}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium leading-none text-slate-600"
                      >
                        <strong className="font-mono text-[11px] font-semibold text-slate-700">
                          {item.value}
                        </strong>
                        <span>{getSharedReportProofBasisLabel(item.key, t)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          data-testid="shared-report-executive-cover-visual"
          data-cover-source={coverSource}
          className={[
            "relative overflow-hidden border-t border-slate-200 bg-slate-950 text-white lg:border-s lg:border-t-0",
            compactDensity ? "min-h-[220px]" : "min-h-[260px]",
          ].join(" ")}
        >
          <div
            aria-hidden="true"
            data-testid="shared-report-executive-cover-visual-backdrop"
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(13,148,136,0.18),transparent_28%),radial-gradient(circle_at_78%_82%,rgba(245,158,11,0.14),transparent_30%)]" />
            <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:36px_36px]" />
            <div
              data-testid="shared-report-executive-cover-proof-card"
              className="absolute left-5 top-5 w-[calc(100%-2.5rem)] max-w-[18rem] rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl"
            >
              <p className="text-[10px] font-semibold uppercase tracking-normal text-white/45">
                {t("cover.kicker")}
              </p>
              <div className="mt-4 h-2 w-24 rounded-full bg-white/35" />
              <div className="mt-3 h-2 w-36 rounded-full bg-white/18" />
              <div className="mt-3 h-2 w-20 rounded-full bg-white/14" />
            </div>
          </div>
          {shouldRenderCampaignImage ? (
            <>
              <img
                src={campaignImageUrl!}
                alt={campaignImageAlt ?? t("cover.visualDetail")}
                className="absolute inset-0 size-full object-contain p-4"
                data-testid="shared-report-executive-cover-image"
                onError={() => setCampaignImageFailed(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/78 via-slate-950/12 to-slate-950/42" />
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 shadow-2xl backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-white/55">
                  {t("cover.visualTitle")}
                </p>
                <p className="mt-2 text-base font-semibold leading-tight text-white">
                  {campaignImageAlt ?? t("cover.visualDetail")}
                </p>
              </div>
            </>
          ) : (
            <div
              className={[
                "relative flex h-full flex-col justify-between",
                compactDensity ? "min-h-[220px] p-5" : "min-h-[260px] p-6",
              ].join(" ")}
            >
              <div className="relative rounded-2xl border border-white/10 bg-slate-950/45 p-5 shadow-2xl backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-white/55">
                  {presentation.coverMode === "proof_room"
                    ? t("cover.kicker")
                    : t("cover.visualTitle")}
                </p>
                <p className="mt-2 text-base font-semibold leading-tight text-white">
                  {presentation.coverMode === "proof_room"
                    ? headline
                    : t("cover.visualDetail")}
                </p>
              </div>
              <div className="relative space-y-2">
                {metrics.slice(0, 3).map((metric) => (
                  <div
                    key={`${metric.source}:${metric.key}:shared-fallback`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-white/10 py-2.5"
                  >
                    <p className="line-clamp-1 text-[11px] font-medium uppercase tracking-normal text-slate-400">
                      {metric.label}
                    </p>
                    <p className="max-w-[8rem] truncate text-sm font-semibold tabular-nums text-white">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportLineChart({ metric }: { metric: ReportExportMetric }) {
  const { t } = useTranslation("brand.report");
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const width = 760;
  const height = 300;
  const left = 58;
  const right = 36;
  const top = 26;
  const bottom = 58;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...metric.points.map((point) => point.value), 1);
  const midValue = maxValue / 2;
  const positioned = metric.points.map((point, index) => {
    const x = metric.points.length === 1
      ? left + chartWidth / 2
      : left + (index / (metric.points.length - 1)) * chartWidth;
    const y = top + chartHeight - (point.value / maxValue) * chartHeight;

    return { ...point, x, y };
  });
  const linePath = positioned
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = positioned.length > 0
    ? `${linePath} L ${positioned[positioned.length - 1].x} ${top + chartHeight} L ${positioned[0].x} ${top + chartHeight} Z`
    : "";

  if (metric.points.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
        {t("share.noChartData")}
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        className="h-auto w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metric.label} chart`}
      >
        <line x1={left} x2={width - right} y1={top} y2={top} stroke="#e8edf3" />
        <line
          x1={left}
          x2={width - right}
          y1={top + chartHeight / 2}
          y2={top + chartHeight / 2}
          stroke="#e8edf3"
        />
        <line
          x1={left}
          x2={width - right}
          y1={top + chartHeight}
          y2={top + chartHeight}
          stroke="#d5dde8"
        />
        <text x={left - 14} y={top + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-semibold">
          {axisValue(metric, maxValue)}
        </text>
        <text x={left - 14} y={top + chartHeight / 2 + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-semibold">
          {axisValue(metric, midValue)}
        </text>
        <text x={left - 14} y={top + chartHeight + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-semibold">
          0
        </text>
        <path d={areaPath} fill="#0f172a" opacity="0.06" />
        <path
          d={linePath}
          fill="none"
          stroke="#0f172a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {positioned.map((point) => (
          <circle
            key={`${point.date}-${point.label}`}
            data-testid="shared-report-point"
            cx={point.x}
            cy={point.y}
            r="5"
            fill="#fff"
            stroke="#0f172a"
            strokeWidth="3"
            tabIndex={0}
            onBlur={() => setHoveredPoint(null)}
            onFocus={() => setHoveredPoint({ ...point, metricLabel: metric.label })}
            onMouseEnter={() => setHoveredPoint({ ...point, metricLabel: metric.label })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
        {positioned.map((point) => (
          <text
            key={`${point.date}-label`}
            x={point.x}
            y={height - 22}
            textAnchor="middle"
            className="fill-slate-500 text-[12px] font-semibold"
          >
            {chartDate(point.date)}
          </text>
        ))}
      </svg>
      {hoveredPoint && (
        <div
          data-testid="shared-report-tooltip"
          className="pointer-events-none absolute rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <p className="font-semibold text-slate-900">{hoveredPoint.metricLabel}</p>
          <p className="text-slate-600">
            {hoveredPoint.label} · {chartDate(hoveredPoint.date)}
          </p>
        </div>
      )}
    </div>
  );
}

function SharedReportSnapshotLedger({
  metrics,
}: {
  metrics: ReportExportMetric[];
}) {
  const { t } = useTranslation("brand.report");

  return (
    <div
      data-testid="shared-report-snapshot-ledger"
      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70"
    >
      <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,0.78fr)] border-b border-slate-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:grid">
        <p>{t("share.snapshotMetric")}</p>
        <p>{t("share.snapshotValue")}</p>
        <p>{t("share.snapshotContext")}</p>
        <p>{t("share.snapshotRead")}</p>
        <p className="text-end">{t("share.snapshotDate")}</p>
      </div>
      {metrics.map((metric) => {
        const point = metric.points[0];

        return (
          <div
            key={metric.key ?? metric.label}
            data-testid="shared-report-snapshot-row"
            className="grid gap-2 border-b border-slate-200 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,1.15fr)_minmax(0,0.72fr)_minmax(0,0.78fr)] sm:items-center sm:gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{metric.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:hidden">
                {metric.detail}
              </p>
            </div>
            <p className="font-mono text-sm font-semibold text-slate-800">
              {metric.value}
            </p>
            <p className="hidden text-xs leading-5 text-slate-500 sm:block">
              {metric.detail}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {t("share.snapshotReadLabel")}
            </p>
            <p className="font-mono text-xs font-medium text-slate-600 sm:text-end">
              {point ? snapshotDate(point.date) : "-"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function getSharedReportBlockOrder(data: ReportExportData): string[] {
  if (data.blocks?.length) {
    return data.blocks.map((block) => block.id);
  }

  return [
    "executive_summary",
    "channel_story",
    "proof_sources",
    "report_trust",
    "recommendations",
    "creator_table",
  ];
}

function SharedReportFraming({ data }: { data: ReportExportData }) {
  const { t } = useTranslation("brand.report");

  if (!data.composition && !data.blocks?.length) return null;

  return (
    <section
      data-testid="shared-report-composition"
      className="mb-6 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {data.composition && (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {t("share.composition")}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {data.composition.presetTitle}
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {data.composition.presetDetail}
            </p>
          </div>
        )}
        {data.blocks?.length ? (
          <div className="flex max-w-xl flex-wrap gap-2 lg:justify-end">
            <span className="sr-only">{t("share.blocks")}</span>
            {data.blocks.map((block) => (
              <span
                key={block.id}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {block.title}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SharedReportSections({
  sections,
}: {
  sections: ReportExportData["sections"];
}) {
  const { t } = useTranslation("brand.report");
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedMetricKey, setSelectedMetricKey] = useState(
    sections[0]?.metrics[0]?.key ?? sections[0]?.metrics[0]?.label ?? "",
  );
  const selectedSection = sections[selectedSectionIndex] ?? sections[0];
  const selectedMetric = useMemo(() => {
    return (
      selectedSection?.metrics.find(
        (metric) => (metric.key ?? metric.label) === selectedMetricKey,
      ) ??
      selectedSection?.metrics[0] ??
      null
    );
  }, [selectedMetricKey, selectedSection]);
  const isSnapshotOnlySection = Boolean(
    selectedSection &&
    selectedSection.metrics.length > 0 &&
    selectedSection.metrics.every((metric) => metric.points.length === 1),
  );
  const selectedSectionHeading = isSnapshotOnlySection
    ? t("share.snapshotReadLabel")
    : selectedSection?.detail;
  const selectedSectionDetail = isSnapshotOnlySection
    ? t("chart.snapshot.detail")
    : null;

  if (sections.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {sections.map((section, index) => (
              <button
                key={section.title}
                type="button"
                onClick={() => {
                  setSelectedSectionIndex(index);
                  setSelectedMetricKey(section.metrics[0]?.key ?? section.metrics[0]?.label ?? "");
                }}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  selectedSectionIndex === index
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            {selectedSectionHeading}
          </h2>
          {selectedSectionDetail ? (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {selectedSectionDetail}
            </p>
          ) : null}
        </div>
        {!isSnapshotOnlySection && selectedSection?.metrics.length ? (
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {selectedSection.metrics.map((metric) => (
              <button
                key={metric.key ?? metric.label}
                type="button"
                onClick={() => setSelectedMetricKey(metric.key ?? metric.label)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  (metric.key ?? metric.label) === selectedMetricKey
                    ? "bg-slate-900 text-white"
                    : "text-slate-600"
                }`}
              >
                {metric.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {selectedSection && isSnapshotOnlySection ? (
        <div className="p-5">
          <SharedReportSnapshotLedger metrics={selectedSection.metrics} />
        </div>
      ) : selectedMetric ? (
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {selectedSection?.title}
              </p>
              <p
                data-testid="shared-report-selected-metric-value"
                className="mt-1 font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere]"
              >
                {selectedMetric.value}
              </p>
            </div>
            <p className="text-sm text-slate-500">{selectedMetric.detail}</p>
          </div>
          <ReportLineChart metric={selectedMetric} />
        </div>
      ) : null}
    </section>
  );
}

export function SharedReportView({ data, share }: SharedReportViewProps) {
  const { t } = useTranslation("brand.report");
  const reportDisplayTitle = getReportDisplayTitle(data);
  const sharedReportPresentation = getSharedReportPresentation(data);
  const sharedReportExecutiveQuestion =
    sharedReportPresentation.executiveQuestion ??
    data.composition?.executiveQuestion ??
    null;
  const defaultSharedReportCoverMetrics = buildReportHeroMetrics(data);
  const [creatorSort, setCreatorSort] = useState<SortState<CreatorSortKey>>({
    key: "views",
    direction: "desc",
  });
  const bodyKpis = useMemo(() => getReportBodyKpis(data), [data]);
  const hasExecutiveSummary = bodyKpis.length > 0;
  const hasReportTrust = data.trust.length > 0;
  const hasCreatorTable =
    data.creators.length > 0 ||
    Boolean(data.blocks?.some((block) => block.id === "creator_table"));
  const campaignSections = useMemo(
    () => data.sections.filter((section) => section.sourceGroup !== "proof_source"),
    [data.sections],
  );
  const proofSourceSections = useMemo(
    () => data.sections.filter((section) => section.sourceGroup === "proof_source"),
    [data.sections],
  );
  const handleCreatorSort = (
    key: CreatorSortKey,
    defaultDirection: SortDirection,
  ) => {
    setCreatorSort((current) =>
      getNextSortState(current, key, defaultDirection),
    );
  };
  const sortedCreators = useMemo(
    () =>
      data.creators.toSorted((first, second) => {
        const result = compareSortValues(
          getCreatorSortValue(first, creatorSort.key),
          getCreatorSortValue(second, creatorSort.key),
        );

        return applySortDirection(result, creatorSort.direction);
      }),
     [creatorSort, data.creators],
  );
  const trustDecision = getSharedReportTrustDecision(data);
  const leadershipGate = getSharedReportLeadershipGate(trustDecision);
  const sharedReportNextAction = getSharedReportNextAction(data);
  const sharedReportProofBasis = useMemo(
    () => getSharedReportProofBasis(data),
    [data],
  );
  const sharedReportStory = useMemo(() => buildSharedReportStory(data), [data]);
  const sharedReportCoverMetrics = leadershipGate.state === "hold"
    ? buildSharedReportHoldCoverMetrics(data)
    : defaultSharedReportCoverMetrics;
  const visibleSharedReportBlockOrder = leadershipGate.state === "hold"
    ? getSharedReportBlockOrder(data).filter(
      (blockId) => !sharedReportHoldPerformanceBlockIds.has(blockId),
    )
    : getSharedReportBlockOrder(data);
  const renderSharedReportBlock = (blockId: string, blockTitle?: string) => {
    let content: ReactNode = null;

    switch (blockId) {
      case "report_framing":
        return <SharedReportFraming key={blockId} data={data} />;
      case "executive_summary":
        content = hasExecutiveSummary && bodyKpis.length === 1 ? (
          <section className="mb-5">
            <article
              data-testid="shared-report-kpi-watchpoint"
              data-summary-metric-key={bodyKpis[0].key ?? bodyKpis[0].label}
              className="grid gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:grid-cols-[minmax(120px,0.34fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                Leadership watchpoint
              </p>
              <div className="min-w-0">
                <p
                  data-testid="shared-report-kpi-label"
                  className="text-sm font-semibold leading-tight text-slate-800"
                >
                  {bodyKpis[0].label}
                </p>
                <p
                  data-testid="shared-report-kpi-detail"
                  className="mt-1 text-xs leading-5 text-slate-500"
                >
                  {bodyKpis[0].detail}
                </p>
              </div>
              <p
                data-testid="shared-report-kpi-value"
                className="font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere] sm:text-end"
              >
                {bodyKpis[0].value}
              </p>
            </article>
          </section>
        ) : hasExecutiveSummary ? (
          <section
            className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            {bodyKpis.map((metric) => (
              <article
                key={metric.key ?? metric.label}
                data-testid="shared-report-kpi-card"
                data-summary-metric-key={metric.key ?? metric.label}
                className="grid min-h-[96px] grid-rows-[2rem_auto_1fr] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm"
              >
                <p
                  data-testid="shared-report-kpi-label"
                  className="line-clamp-2 text-[11px] font-semibold uppercase tracking-normal text-slate-500"
                >
                  {metric.label}
                </p>
                <p
                  data-testid="shared-report-kpi-value"
                  className="self-end font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere]"
                >
                  {metric.value}
                </p>
                <p
                  data-testid="shared-report-kpi-detail"
                  className="self-end line-clamp-2 text-xs leading-tight text-slate-500"
                >
                  {metric.detail}
                </p>
              </article>
            ))}
          </section>
        ) : null;
        break;
      case "channel_story":
        content = campaignSections.length > 0 ? (
          <SharedReportSections sections={campaignSections} />
        ) : null;
        break;
      case "proof_sources":
        content = proofSourceSections.length > 0 ? (
          <SharedReportSections sections={proofSourceSections} />
        ) : null;
        break;
      case "report_trust":
        content = hasReportTrust ? (
          <section
            className="mb-8 space-y-3"
          >
            <article
              data-testid="shared-report-trust-decision"
              data-trust-state={leadershipGate.state}
              className={[
                "rounded-xl border p-4",
                leadershipGate.state === "ready"
                  ? "border-slate-200 bg-white"
                  : "border-slate-300 bg-slate-50",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-slate-500">
                <ShieldCheck className="size-4" />
                <p className="text-xs font-medium">{t("builder.output.trustDecision")}</p>
              </div>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {trustDecision}
              </p>
            </article>
            <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-5">
              {data.trust.map((item, index) => {
                const Icon = sharedReportTrustIcons[index] ?? CircleCheck;

                return (
                  <article
                    key={item.label}
                    className="border-b border-slate-200 p-4 last:border-b-0 sm:border-e sm:last:border-e-0 lg:border-b-0"
                  >
                    <div className="mb-3 flex items-center gap-2 text-slate-500">
                      <Icon className="size-4" />
                      <p
                        data-testid="shared-report-trust-label"
                        className="truncate text-xs font-medium"
                      >
                        {item.label}
                      </p>
                    </div>
                    <p
                      data-testid="shared-report-trust-value"
                      className="font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere]"
                    >
                      {item.value}
                    </p>
                    <p
                      data-testid="shared-report-trust-detail"
                      className="mt-1 line-clamp-2 text-xs text-slate-500"
                    >
                      {item.detail}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null;
        break;
      case "recommendations": {
        const [primaryRecommendation, ...supportingRecommendations] =
          data.recommendations ?? [];
        const recommendationCount = data.recommendations?.length ?? 0;

        content = primaryRecommendation ? (
          <section
            className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white"
            data-testid="shared-report-recommendations"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <CircleCheck className="size-4 flex-none text-slate-500" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Decision memo
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">
                    {t("section.recommendations")}
                  </h2>
                </div>
              </div>
              <span className="flex-none rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                {recommendationCount === 1
                  ? "1 action"
                  : `${recommendationCount} actions`}
              </span>
            </div>
            <article
              className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(120px,0.28fr)_minmax(0,1fr)]"
              data-testid="shared-report-recommendation-primary"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Recommended move
              </p>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  {primaryRecommendation.title}
                </p>
                <p className="mt-1 text-lg font-semibold leading-tight text-slate-900">
                  {primaryRecommendation.value}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {primaryRecommendation.detail}
                </p>
              </div>
            </article>
            {supportingRecommendations.length > 0 ? (
              <div
                className="border-t border-slate-200"
                data-testid="shared-report-recommendation-evidence"
              >
                <p className="bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Supporting evidence
                </p>
                {supportingRecommendations.map((item, index) => (
                  <article
                    key={`${item.title}:${item.value}`}
                    className="grid gap-3 border-t border-slate-200 px-5 py-3 md:grid-cols-[2rem_minmax(0,1fr)]"
                  >
                    <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-400">
                      {String(index + 2).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.detail}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null;
        break;
      }
      case "creator_table":
        content = hasCreatorTable ? (
          <section
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">{t("section.creatorPerformance")}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-start text-xs font-semibold uppercase text-slate-500">
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      label={t("table.creator")}
                      onSort={handleCreatorSort}
                      sortKey="creator"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      label={t("table.market")}
                      onSort={handleCreatorSort}
                      sortKey="market"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      label={t("table.platform")}
                      onSort={handleCreatorSort}
                      sortKey="platform"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      align="end"
                      defaultDirection="desc"
                      label={t("table.views")}
                      onSort={handleCreatorSort}
                      sortKey="views"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      align="end"
                      defaultDirection="desc"
                      label={t("table.engagements")}
                      onSort={handleCreatorSort}
                      sortKey="engagements"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      align="end"
                      defaultDirection="desc"
                      label={t("table.er")}
                      onSort={handleCreatorSort}
                      sortKey="er"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      align="end"
                      defaultDirection="asc"
                      label={t("table.cpe")}
                      onSort={handleCreatorSort}
                      sortKey="cpe"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      align="end"
                      defaultDirection="desc"
                      label={t("table.spent")}
                      onSort={handleCreatorSort}
                      sortKey="spent"
                    />
                    <SharedReportSortHeader
                      activeSort={creatorSort}
                      align="end"
                      defaultDirection="desc"
                      label={t("table.rating")}
                      onSort={handleCreatorSort}
                      sortKey="rating"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedCreators.map((creator) => (
                    <tr key={`${creator.name}-${creator.platform}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-5 py-3 font-medium">{creator.name}</td>
                      <td className="px-5 py-3">{creator.market}</td>
                      <td className="px-5 py-3">{creator.platform}</td>
                      <td className="px-5 py-3 text-end">{creator.views}</td>
                      <td className="px-5 py-3 text-end">{creator.engagements}</td>
                      <td className="px-5 py-3 text-end">{creator.er}</td>
                      <td className="px-5 py-3 text-end">{creator.cpe}</td>
                      <td className="px-5 py-3 text-end">{creator.spent}</td>
                      <td className="px-5 py-3 text-end">{creator.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null;
        break;
      default:
        return null;
    }

    if (!content) return null;

    return (
      <section key={blockId} data-testid="shared-report-block" data-block-id={blockId}>
        {blockTitle ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              {blockTitle}
            </h2>
          </div>
        ) : null}
        {content}
      </section>
    );
  };

  return (
    <main
      data-testid="shared-report-view"
      className="min-h-svh bg-slate-50 text-slate-900"
    >
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div>
            <p className="text-2xl font-semibold">PopsDrops</p>
            <p className="mt-1 text-sm text-slate-300">{t("share.sharedEyebrow")}</p>
          </div>
          <div className="space-y-1 font-mono text-[11px] font-medium leading-5 text-slate-300 sm:text-end">
            <p>
              {t("share.generated", {
                date: formatReportCompactDate(data.generatedAt),
              })}
            </p>
            <p data-testid="shared-report-access-expiry">
              {t("share.accessExpires", {
                date: formatSharedReportAccessDate(share.expiresAt),
              })}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <SharedReportExecutiveCover
          campaignImageAlt={data.campaignImageAlt}
          campaignImageUrl={data.campaignImageUrl}
          dateRange={data.dateRange}
          executiveQuestion={sharedReportExecutiveQuestion}
          headline={reportDisplayTitle}
          leadershipGate={leadershipGate}
          metrics={sharedReportCoverMetrics}
          nextAction={sharedReportNextAction}
          presentation={sharedReportPresentation}
          proofBasis={sharedReportProofBasis}
        />

        <SharedReportStoryPanel
          leadershipGate={leadershipGate}
          story={sharedReportStory}
        />

        {leadershipGate.state === "hold" ? (
          <SharedReportLeadershipHoldPanel
            data={data}
            leadershipGate={leadershipGate}
            nextAction={sharedReportNextAction}
          />
        ) : null}

        <div data-testid="shared-report-block-region">
          {visibleSharedReportBlockOrder.map((blockId) =>
            renderSharedReportBlock(
              blockId,
              data.blocks?.find((block) => block.id === blockId)?.title,
            ),
          )}
        </div>
      </div>
    </main>
  );
}
