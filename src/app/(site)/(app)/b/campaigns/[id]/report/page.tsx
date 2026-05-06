"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe2,
  Download,
  Link2,
  Presentation,
  Share2,
  ShieldCheck,
  Table2,
} from "lucide-react";
import {
  createReportShareLink,
  listReportShareLinks,
  revokeReportShareLink,
  type ReportShareLinkSummary,
} from "@/app/actions/report-shares";
import {
  exportReportCSV,
  exportReportHTML,
  exportReportJSON,
  exportReportPDF,
  exportReportPPTX,
  type ReportExportData,
  type ReportExportMetric,
  type ReportExportSection,
} from "@/lib/export-report-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PLATFORM_LABELS,
  getMarketLabel,
  formatCurrency,
} from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import type { Platform } from "@/lib/constants";
import {
  buildAllPlatformReportMetrics,
  buildPlatformReportMetrics,
  buildReportEvidenceMetric,
  buildReportCompletionMetric,
  getAvailableReportPlatforms,
  type ReportEvidenceMetric,
  type CampaignReportRead,
  type CampaignReportTask,
  type ReportCompletionMetric,
  type PlatformReportMetrics,
} from "@/lib/reporting/campaign-report-metrics";
import { createClient } from "@/lib/supabase/client";

interface CampaignRow {
  id: string;
  title: string;
  total_spend: number | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  report_data: Record<string, unknown> | null;
}

interface MemberPerformance {
  row_id: string;
  member_id: string;
  name: string;
  avatar_url: string | null;
  market: string | null;
  platform: string | null;
  rate: number | null;
  views: number;
  engagements: number;
  er: number;
  cpe: number;
  rating: number;
  topPerformer: boolean;
}

type ReportMetricKey = "views" | "engagements" | "engagementRate" | "cpe" | "reports";

interface ReportMetricCardProps {
  label: string;
  value: string;
  detail: string;
}

interface ReportShareDialogProps {
  creating: boolean;
  copied: boolean;
  error: string | null;
  locale: string;
  onCopy: (url: string) => Promise<void> | void;
  onCreate: () => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  onRevoke: (shareLinkId: string) => Promise<void> | void;
  open: boolean;
  revokingId: string | null;
  shareLinks: ReportShareLinkSummary[];
  shareUrl: string;
  t: ReportTranslation;
}

interface ReportMetricPoint {
  date: string;
  value: number;
  label: string;
}

interface ReportMetricConfig extends ReportMetricCardProps {
  key: ReportMetricKey;
  points: ReportMetricPoint[];
  formatTick: (value: number) => string;
}

interface PositionedMetricPoint extends ReportMetricPoint {
  x: number;
  y: number;
}

interface ReportComparisonLine {
  platform: string;
  label: string;
  color: string;
  points: ReportMetricPoint[];
}

interface ReportChartHoverPoint {
  x: number;
  y: number;
  label: string;
  date: string;
  context?: string;
}

interface ReportChartMovementValue {
  start: string;
  end: string;
  direction: "up" | "down" | "flat";
  tone: "positive" | "negative" | "neutral";
}

interface ChartDomain {
  min: number;
  max: number;
}

interface ChartTick {
  value: number;
  y: number;
}

type ReportTranslation = (key: string, vars?: Record<string, string>) => string;

interface TrustWindowRange {
  value: string;
  detail: string;
}

function formatShareDate(value: string | null, locale: string): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDate(dateStr: string | null, locale = "en"): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatChartDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "-";

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${month}/${day}`;
}

function formatCompactDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "-";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

function parseChartDate(dateStr: string): Date | null {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonthDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTrustWindowRange({
  start,
  end,
  locale,
  t,
}: {
  start: string;
  end: string;
  locale: string;
  t: ReportTranslation;
}): TrustWindowRange {
  const startDate = parseChartDate(start);
  const endDate = parseChartDate(end);

  if (!startDate || !endDate) {
    return {
      value: t("trust.windowValue", {
        start: formatCompactDate(start),
        end: formatCompactDate(end),
      }),
      detail: t("trust.platformReads"),
    };
  }

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const sameYear = startYear === endYear;
  const value = `${formatMonthDay(startDate, locale)} ~ ${formatMonthDay(endDate, locale)}`;

  return {
    value: sameYear
      ? value
      : t("trust.windowValue", {
          start: formatCompactDate(start),
          end: formatCompactDate(end),
        }),
    detail: sameYear
      ? t("trust.windowYearDetail", { year: String(startYear) })
      : t("trust.platformReads"),
  };
}

function formatPlatformName(platform: string | null): string {
  if (!platform) return "-";
  return PLATFORM_LABELS[platform as Platform] || platform;
}

const COMPARISON_LINE_COLORS = [
  "#0F172A",
  "#0D9488",
  "#F59E0B",
  "#475569",
  "#94A3B8",
];

function engagementCount(row: Record<string, number | null>): number {
  return (
    (row.likes || 0) +
    (row.comments || 0) +
    (row.shares || 0) +
    (row.saves || 0) +
    (row.clicks || 0)
  );
}

function buildMetricPoints<T>(
  series: T[],
  getDate: (point: T) => string,
  getValue: (point: T) => number,
  getLabel: (value: number) => string,
): ReportMetricPoint[] {
  return series.map((point) => {
    const value = getValue(point);

    return {
      date: getDate(point),
      value: Number.isFinite(value) ? value : 0,
      label: getLabel(Number.isFinite(value) ? value : 0),
    };
  });
}

function buildChartDomain(points: ReportMetricPoint[]): ChartDomain {
  if (points.length === 0) return { min: 0, max: 1 };

  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = rawMin > 0 ? 0 : rawMin;
  const range = rawMax - min;
  const padding = range > 0 ? range * 0.08 : Math.max(Math.abs(rawMax) * 0.2, 1);

  return {
    min,
    max: rawMax + padding,
  };
}

function buildTrendCoordinates(
  points: ReportMetricPoint[],
  width = 720,
  height = 280,
  domain = buildChartDomain(points),
  dates = points.map((point) => point.date),
): PositionedMetricPoint[] {
  if (points.length === 0) return [];

  const xStart = 64;
  const xEnd = width - 28;
  const yTop = 28;
  const yBottom = 46;
  const usableWidth = xEnd - xStart;
  const usableHeight = height - yTop - yBottom;
  const dateIndex = new Map(dates.map((date, index) => [date, index]));

  return points.map((point, index) => {
    const currentDateIndex = dateIndex.get(point.date) ?? index;
    const x = dates.length === 1
      ? width / 2
      : xStart + (currentDateIndex / (dates.length - 1)) * usableWidth;
    const y = domain.max === domain.min
      ? yTop + usableHeight / 2
      : yTop + ((domain.max - point.value) / (domain.max - domain.min)) * usableHeight;

    return { ...point, x, y };
  });
}

function buildChartTicks(
  points: ReportMetricPoint[],
  domain = buildChartDomain(points),
): ChartTick[] {
  const yTop = 28;
  const yBottom = 46;
  const height = 280;
  const usableHeight = height - yTop - yBottom;

  return [domain.max, (domain.max + domain.min) / 2, domain.min].map((value) => {
    const y = domain.max === domain.min
      ? yTop + usableHeight / 2
      : yTop + ((domain.max - value) / (domain.max - domain.min)) * usableHeight;

    return { value, y };
  });
}

function buildTrendPath(points: PositionedMetricPoint[]): string {
  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}

function buildChartMovement(metric: ReportMetricConfig): ReportChartMovementValue | null {
  const points = metric.points;

  if (points.length === 0) {
    return null;
  }

  if (points.length === 1) {
    return {
      start: points[0].label,
      end: points[0].label,
      direction: "flat",
      tone: "neutral",
    };
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const delta = lastPoint.value - firstPoint.value;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const lowerIsBetter = metric.key === "cpe";
  const isPositive = lowerIsBetter ? delta < 0 : delta > 0;

  return {
    start: firstPoint.label,
    end: lastPoint.label,
    direction,
    tone: direction === "flat" ? "neutral" : isPositive ? "positive" : "negative",
  };
}

function buildReportMetricConfigs({
  metrics,
  completionMetric,
  locale,
  t,
  readDetail,
  completionDetail,
  platformDetail,
}: {
  metrics: PlatformReportMetrics;
  completionMetric: ReportCompletionMetric;
  locale: string;
  t: ReportTranslation;
  readDetail: string;
  completionDetail: string;
  platformDetail: string;
}): ReportMetricConfig[] {
  return [
    {
      key: "views",
      label: t("kpi.views"),
      value: formatNumber(metrics.views),
      detail: readDetail,
      points: buildMetricPoints(
        metrics.series,
        (point) => point.date,
        (point) => point.views,
        formatNumber,
      ),
      formatTick: formatNumber,
    },
    {
      key: "engagements",
      label: t("kpi.engagements"),
      value: formatNumber(metrics.engagements),
      detail: readDetail,
      points: buildMetricPoints(
        metrics.series,
        (point) => point.date,
        (point) => point.engagements,
        formatNumber,
      ),
      formatTick: formatNumber,
    },
    {
      key: "engagementRate",
      label: t("kpi.engagementRate"),
      value: `${metrics.engagementRate.toFixed(1)}%`,
      detail: platformDetail,
      points: buildMetricPoints(
        metrics.series,
        (point) => point.date,
        (point) => (point.views > 0 ? (point.engagements / point.views) * 100 : 0),
        (pointValue) => `${pointValue.toFixed(1)}%`,
      ),
      formatTick: (pointValue) => `${pointValue.toFixed(1)}%`,
    },
    {
      key: "cpe",
      label: t("kpi.cpe"),
      value: metrics.cpe > 0
        ? formatCurrency(metrics.cpe, locale, "USD", 2)
        : "-",
      detail: t("metric.spendDetail", {
        value: formatCurrency(metrics.spend, locale),
      }),
      points: buildMetricPoints(
        metrics.series,
        (point) => point.date,
        (point) => (point.engagements > 0 ? metrics.spend / point.engagements : 0),
        (pointValue) =>
          pointValue > 0 ? formatCurrency(pointValue, locale, "USD", 2) : "-",
      ),
      formatTick: (pointValue) =>
        pointValue > 0 ? formatCurrency(pointValue, locale, "USD", 2) : "-",
    },
    {
      key: "reports",
      label: t("kpi.reports"),
      value: completionMetric.total > 0
        ? `${completionMetric.submitted}/${completionMetric.total}`
        : "-",
      detail: completionDetail,
      points: buildMetricPoints(
        completionMetric.series,
        (point) => point.date,
        (point) => point.submitted,
        (pointValue) => String(pointValue),
      ),
      formatTick: (pointValue) => String(Math.round(pointValue)),
    },
  ];
}

function buildComparisonLines({
  platformMetricItems,
  selectedMetricKey,
  locale,
}: {
  platformMetricItems: Array<{ platform: string; metrics: PlatformReportMetrics }>;
  selectedMetricKey: ReportMetricKey;
  locale: string;
}): ReportComparisonLine[] {
  return platformMetricItems.map((item, index) => {
    let points: ReportMetricPoint[] = [];

    if (selectedMetricKey === "views") {
      points = buildMetricPoints(
        item.metrics.series,
        (point) => point.date,
        (point) => point.views,
        formatNumber,
      );
    } else if (selectedMetricKey === "engagements") {
      points = buildMetricPoints(
        item.metrics.series,
        (point) => point.date,
        (point) => point.engagements,
        formatNumber,
      );
    } else if (selectedMetricKey === "engagementRate") {
      points = buildMetricPoints(
        item.metrics.series,
        (point) => point.date,
        (point) => (point.views > 0 ? (point.engagements / point.views) * 100 : 0),
        (pointValue) => `${pointValue.toFixed(1)}%`,
      );
    } else if (selectedMetricKey === "cpe") {
      points = buildMetricPoints(
        item.metrics.series,
        (point) => point.date,
        (point) => (point.engagements > 0 ? item.metrics.spend / point.engagements : 0),
        (pointValue) =>
          pointValue > 0 ? formatCurrency(pointValue, locale, "USD", 2) : "-",
      );
    }

    return {
      platform: item.platform,
      label: formatPlatformName(item.platform),
      color: COMPARISON_LINE_COLORS[index % COMPARISON_LINE_COLORS.length],
      points,
    };
  });
}

function toExportMetric(metric: ReportMetricConfig): ReportExportMetric {
  return {
    key: metric.key,
    label: metric.label,
    value: metric.value,
    detail: metric.detail,
    points: metric.points.map((point) => ({
      date: point.date,
      label: point.label,
      value: point.value,
    })),
  };
}

function buildReportExportData({
  campaignTitle,
  dateRange,
  kpis,
  trust,
  sections,
  creators,
}: {
  campaignTitle: string;
  dateRange: string;
  kpis: ReportMetricConfig[];
  trust: ReportExportData["trust"];
  sections: ReportExportSection[];
  creators: ReportExportData["creators"];
}): ReportExportData {
  return {
    campaignTitle,
    dateRange,
    generatedAt: new Date().toISOString(),
    kpis: kpis.map((metric) => ({
      label: metric.label,
      value: metric.value,
      detail: metric.detail,
    })),
    trust,
    sections,
    creators,
  };
}

function ReportChartMovement({
  movement,
  t,
}: {
  movement: ReportChartMovementValue | null;
  t: ReportTranslation;
}) {
  if (!movement) return null;

  const Icon = movement.direction === "up"
    ? ArrowUpRight
    : movement.direction === "down"
      ? ArrowDownRight
      : ArrowRight;
  const toneClass = movement.tone === "positive"
    ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
    : movement.tone === "negative"
      ? "bg-red-50 text-red-600 ring-red-100"
      : "bg-slate-50 text-slate-500 ring-slate-100";

  return (
    <div
      data-testid="report-chart-movement"
      aria-label={t("chart.movementLabel", {
        start: movement.start,
        end: movement.end,
      })}
      className="flex items-center gap-2 pt-1"
    >
      <span className="text-sm font-semibold text-muted-foreground">{movement.start}</span>
      <span
        className={`inline-flex size-7 items-center justify-center rounded-full ring-1 ${toneClass}`}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="text-sm font-semibold text-foreground">{movement.end}</span>
    </div>
  );
}

function ReportChartTooltip({
  hoveredPoint,
  width,
}: {
  hoveredPoint: ReportChartHoverPoint | null;
  width: number;
}) {
  if (!hoveredPoint) return null;

  const tooltipWidth = 116;
  const tooltipHeight = hoveredPoint.context ? 46 : 34;
  const x = Math.min(Math.max(hoveredPoint.x - tooltipWidth / 2, 66), width - tooltipWidth - 12);
  const y = Math.max(hoveredPoint.y - tooltipHeight - 12, 8);

  return (
    <g data-testid="report-chart-tooltip" pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={tooltipWidth}
        height={tooltipHeight}
        rx="8"
        fill="white"
        stroke="#E2E8F0"
        strokeWidth="1"
        filter="drop-shadow(0 8px 16px rgba(15, 23, 42, 0.12))"
      />
      {hoveredPoint.context && (
        <text x={x + 10} y={y + 15} fill="#64748B" fontSize="10" fontWeight="600">
          {hoveredPoint.context}
        </text>
      )}
      <text
        x={x + 10}
        y={y + (hoveredPoint.context ? 29 : 15)}
        fill="#0F172A"
        fontSize="12"
        fontWeight="650"
      >
        {hoveredPoint.label}
      </text>
      <text
        x={x + 10}
        y={y + (hoveredPoint.context ? 41 : 29)}
        fill="#64748B"
        fontSize="10"
        fontWeight="560"
      >
        {formatChartDate(hoveredPoint.date)}
      </text>
    </g>
  );
}

function ReportStoryChart({
  metrics,
  selectedMetricKey,
  onSelectMetric,
  t,
}: {
  metrics: ReportMetricConfig[];
  selectedMetricKey: ReportMetricKey;
  onSelectMetric: (key: ReportMetricKey) => void;
  t: ReportTranslation;
}) {
  const metric = metrics.find((item) => item.key === selectedMetricKey) ?? metrics[0];
  let points = [] as ReportMetricPoint[];
  if (metric) points = metric.points;
  const positionedPoints = buildTrendCoordinates(points);
  const path = buildTrendPath(positionedPoints);
  const chartTicks = buildChartTicks(points);
  const showValueLabels = positionedPoints.length <= 5;
  const movement = metric ? buildChartMovement(metric) : null;
  const [hoveredPoint, setHoveredPoint] = useState<ReportChartHoverPoint | null>(null);

  return (
    <Card data-testid="report-story-chart" className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>{metric ? metric.label : t("section.platformMetrics")}</CardTitle>
            <ReportChartMovement movement={movement} t={t} />
          </div>
          <div
            className="inline-flex w-full flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1 lg:w-auto"
            aria-label={t("chart.metric")}
          >
            {metrics.map((item) => (
              <button
                key={item.key}
                type="button"
                data-testid="report-metric-tab"
                aria-pressed={item.key === selectedMetricKey}
                onClick={() => onSelectMetric(item.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  item.key === selectedMetricKey
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <svg
          aria-label={metric ? metric.label : t("section.platformMetrics")}
          className="h-72 w-full overflow-visible text-slate-900"
          role="img"
          viewBox="0 0 720 280"
        >
          {chartTicks.map((tick, index) => (
            <g key={`${tick.value}-${index}`}>
              <line
                x1="64"
                x2="692"
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                strokeWidth="1"
                opacity={index === chartTicks.length - 1 ? 0.16 : 0.08}
              />
              <text
                x="50"
                y={tick.y + 4}
                fill="#64748B"
                fontSize="11"
                fontWeight="500"
                textAnchor="end"
              >
                {metric ? metric.formatTick(tick.value) : ""}
              </text>
            </g>
          ))}

          {path && (
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.75"
            />
          )}

          {positionedPoints.map((point, index) => {
            const isFinalPoint = index === positionedPoints.length - 1;

            return (
              <g key={`${point.date}-${index}`}>
                {showValueLabels && (
                  <text
                    x={point.x}
                    y={Math.max(15, point.y - 12)}
                    data-testid={isFinalPoint ? "report-story-final-value" : undefined}
                    fill={isFinalPoint ? "#0F172A" : "#64748B"}
                    fontSize={isFinalPoint ? "13" : "11"}
                    fontWeight={isFinalPoint ? "650" : "560"}
                    textAnchor="middle"
                  >
                    {point.label}
                  </text>
                )}
                {!showValueLabels && isFinalPoint && (
                  <text
                    x={Math.min(point.x + 8, 690)}
                    y={point.y - 10}
                    data-testid="report-story-final-value"
                    fill="#0F172A"
                    fontSize="13"
                    fontWeight="650"
                    textAnchor="end"
                  >
                    {point.label}
                  </text>
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isFinalPoint ? "5" : "4.25"}
                  data-testid="report-story-point"
                  tabIndex={0}
                  aria-label={`${metric?.label || t("section.platformMetrics")} ${point.label} ${formatChartDate(point.date)}`}
                  fill="white"
                  stroke="currentColor"
                  strokeWidth={isFinalPoint ? "2.5" : "2"}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onFocus={() => setHoveredPoint(point)}
                  onBlur={() => setHoveredPoint(null)}
                />
                <text
                  x={point.x}
                  y="264"
                  data-testid="report-story-axis-date"
                  fill="#64748B"
                  fontSize="12"
                  fontWeight="560"
                  textAnchor="middle"
                >
                  {formatChartDate(point.date)}
                </text>
              </g>
            );
          })}

          <ReportChartTooltip hoveredPoint={hoveredPoint} width={720} />

          {positionedPoints.length === 0 && (
            <text
              x="360"
              y="145"
              fill="#64748B"
              fontSize="14"
              fontWeight="560"
              textAnchor="middle"
            >
              {t("metric.noReads")}
            </text>
          )}
        </svg>
      </CardContent>
    </Card>
  );
}

function buildDateAxisPositions(dates: string[], width = 640): Array<{ date: string; x: number }> {
  const xStart = 64;
  const xEnd = width - 28;
  const usableWidth = xEnd - xStart;

  return dates.map((date, index) => ({
    date,
    x: dates.length === 1 ? width / 2 : xStart + (index / (dates.length - 1)) * usableWidth,
  }));
}

function buildComparisonLabelPositions(
  positionedLines: Array<{
    line: ReportComparisonLine;
    points: PositionedMetricPoint[];
  }>,
): Array<{ line: ReportComparisonLine; point: PositionedMetricPoint; y: number }> {
  const labels = positionedLines
    .map((item) => {
      const point = item.points.at(-1);
      return point ? { line: item.line, point, y: point.y } : null;
    })
    .filter((item): item is { line: ReportComparisonLine; point: PositionedMetricPoint; y: number } =>
      Boolean(item),
    )
    .sort((a, b) => a.y - b.y);

  let previousY = 0;
  for (const label of labels) {
    label.y = Math.max(label.y, previousY + 18, 24);
    previousY = label.y;
  }

  const overflow = labels.at(-1) ? Math.max(labels.at(-1)!.y - 238, 0) : 0;
  if (overflow > 0) {
    for (const label of labels) label.y -= overflow;
  }

  return labels;
}

function ReportComparisonChart({
  metrics,
  selectedMetricKey,
  onSelectMetric,
  lines,
  t,
}: {
  metrics: ReportMetricConfig[];
  selectedMetricKey: ReportMetricKey;
  onSelectMetric: (key: ReportMetricKey) => void;
  lines: ReportComparisonLine[];
  t: ReportTranslation;
}) {
  const comparisonMetrics = metrics.filter((item) => item.key !== "reports");
  const metric =
    comparisonMetrics.find((item) => item.key === selectedMetricKey) ??
    comparisonMetrics[0];
  const allPoints = lines.flatMap((line) => line.points);
  const dates = Array.from(new Set(allPoints.map((point) => point.date))).sort((a, b) =>
    a.localeCompare(b),
  );
  const domain = buildChartDomain(allPoints);
  const chartTicks = buildChartTicks(allPoints, domain);
  const positionedLines = lines.map((line) => ({
    line,
    points: buildTrendCoordinates(line.points, 640, 280, domain, dates),
  }));
  const labels = buildComparisonLabelPositions(positionedLines);
  const axisDates = buildDateAxisPositions(dates, 640);
  const [hoveredPoint, setHoveredPoint] = useState<ReportChartHoverPoint | null>(null);

  return (
    <Card data-testid="report-comparison-chart" className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("filter.allChannels")}
            </p>
            <CardTitle>
              {metric ? t("chart.allChannelsTitle", { metric: metric.label }) : t("section.platformMetrics")}
            </CardTitle>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {metric
                ? t("chart.allChannelsDetail")
                : t("metric.noReads")}
            </p>
          </div>
          <div
            className="inline-flex w-full flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1 lg:w-auto"
            aria-label={t("chart.metric")}
          >
            {comparisonMetrics.map((item) => (
              <button
                key={item.key}
                type="button"
                data-testid="report-metric-tab"
                aria-pressed={item.key === metric?.key}
                onClick={() => onSelectMetric(item.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  item.key === metric?.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <svg
          aria-label={metric ? t("chart.allChannelsTitle", { metric: metric.label }) : t("section.platformMetrics")}
          className="h-72 w-full overflow-visible"
          role="img"
          viewBox="0 0 760 280"
        >
          {chartTicks.map((tick, index) => (
            <g key={`${tick.value}-${index}`}>
              <line
                x1="64"
                x2="612"
                y1={tick.y}
                y2={tick.y}
                stroke="#0F172A"
                strokeWidth="1"
                opacity={index === chartTicks.length - 1 ? 0.16 : 0.08}
              />
              <text
                x="50"
                y={tick.y + 4}
                fill="#64748B"
                fontSize="11"
                fontWeight="500"
                textAnchor="end"
              >
                {metric ? metric.formatTick(tick.value) : ""}
              </text>
            </g>
          ))}

          {positionedLines.map((item) => {
            const path = buildTrendPath(item.points);

            return (
              <g key={item.line.platform}>
                {path && (
                  <path
                    d={path}
                    data-testid="report-comparison-line"
                    fill="none"
                    stroke={item.line.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                  />
                )}
                {item.points.map((point, index) => (
                  <circle
                    key={`${item.line.platform}-${point.date}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={index === item.points.length - 1 ? "4.5" : "3.75"}
                    tabIndex={0}
                    aria-label={`${item.line.label} ${point.label} ${formatChartDate(point.date)}`}
                    fill="white"
                    stroke={item.line.color}
                    strokeWidth="2"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        ...point,
                        context: item.line.label,
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                    onFocus={() =>
                      setHoveredPoint({
                        ...point,
                        context: item.line.label,
                      })
                    }
                    onBlur={() => setHoveredPoint(null)}
                  />
                ))}
              </g>
            );
          })}

          {labels.map((label) => (
            <g key={`${label.line.platform}-label`}>
              <path
                d={`M${label.point.x + 5} ${label.point.y} L626 ${label.y}`}
                fill="none"
                stroke={label.line.color}
                strokeWidth="1"
                opacity="0.45"
              />
              <text
                x="634"
                y={label.y - 2}
                data-testid="report-comparison-label"
                fill={label.line.color}
                fontSize="12"
                fontWeight="650"
              >
                {label.line.label}
              </text>
              <text
                x="634"
                y={label.y + 13}
                fill="#64748B"
                fontSize="11"
                fontWeight="500"
              >
                {label.point.label}
              </text>
            </g>
          ))}

          {axisDates.map((point) => (
            <text
              key={point.date}
              x={point.x}
              y="264"
              data-testid="report-story-axis-date"
              fill="#64748B"
              fontSize="12"
              fontWeight="560"
              textAnchor="middle"
            >
              {formatChartDate(point.date)}
            </text>
          ))}

          <ReportChartTooltip hoveredPoint={hoveredPoint} width={760} />

          {lines.length === 0 && (
            <text
              x="360"
              y="145"
              fill="#64748B"
              fontSize="14"
              fontWeight="560"
              textAnchor="middle"
            >
              {t("metric.noReads")}
            </text>
          )}
        </svg>
      </CardContent>
    </Card>
  );
}

function ReportMetricCard({
  label,
  value,
  detail,
}: ReportMetricCardProps) {
  return (
    <Card size="sm" className="min-h-[104px] min-w-0">
      <CardContent className="grid h-full min-w-0 grid-rows-[2.5rem_auto_1fr] gap-1.5">
        <p className="line-clamp-2 text-[11px] font-medium leading-tight text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-semibold leading-none text-foreground">{value}</p>
        <p className="self-end truncate text-[11px] leading-tight text-muted-foreground">
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function ReportShareDialog({
  creating,
  copied,
  error,
  locale,
  onCopy,
  onCreate,
  onOpenChange,
  onRevoke,
  open,
  revokingId,
  shareLinks,
  shareUrl,
  t,
}: ReportShareDialogProps) {
  const activeShareLinks = shareLinks.filter((link) => !link.revokedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-5 p-5">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex">
            <button
              type="button"
              onClick={() => void onCreate()}
              disabled={creating}
              className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
            >
              <Link2 className="size-4" />
              {creating ? t("share.generating") : t("share.create")}
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          {shareUrl && (
            <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">{t("share.linkLabel")}</p>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  data-testid="report-share-url"
                  readOnly
                  value={shareUrl}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-xs text-foreground outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onCopy(shareUrl)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? t("share.copied") : t("share.copy")}
                  </button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                    aria-label={t("share.open")}
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("share.activeLinks")}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeShareLinks.length === 1
                ? t("share.linkCount.one")
                : t("share.linkCount.many", { count: String(activeShareLinks.length) })}
            </p>
          </div>

          {activeShareLinks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {t("share.noLinks")}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {activeShareLinks.map((link) => (
                <div
                  key={link.id}
                  className="grid gap-3 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{link.label}</p>
                      <span className="max-w-full truncate rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {link.tokenPrefix}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {t("share.expires", {
                          date: formatShareDate(link.expiresAt, locale),
                        })}
                      </span>
                      <span>{t("share.views", { count: String(link.viewCount) })}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRevoke(link.id)}
                    disabled={Boolean(revokingId)}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {t("share.revoke")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildReportTrustExportItems({
  evidence,
  locale,
  t,
}: {
  evidence: ReportEvidenceMetric;
  locale: string;
  t: ReportTranslation;
}): ReportExportData["trust"] {
  const dataWindow = evidence.dataWindow
    ? formatTrustWindowRange({
        start: evidence.dataWindow.start,
        end: evidence.dataWindow.end,
        locale,
        t,
      })
    : {
        value: t("trust.none"),
        detail: t("trust.platformReads"),
      };
  const reportStatus = evidence.totalTasks === 0
    ? t("trust.none")
    : evidence.missedTasks > 0
      ? t("trust.missedStatus", { count: String(evidence.missedTasks) })
      : t("trust.submittedStatus", {
          submitted: String(evidence.submittedTasks),
          total: String(evidence.totalTasks),
        });

  return [
    {
      label: t("trust.evidenceBacked"),
      value: `${evidence.evidenceBackedReads}/${evidence.totalReads}`,
      detail: t("trust.nativeScreenshots"),
    },
    {
      label: t("trust.verifiedReads"),
      value: `${evidence.verifiedReads}/${evidence.totalReads}`,
      detail: t(`trust.confidence.${evidence.confidence}`),
    },
    {
      label: t("trust.dataWindow"),
      value: dataWindow.value,
      detail: dataWindow.detail,
    },
    {
      label: t("trust.reportStatus"),
      value: reportStatus,
      detail: t("trust.creatorObligations"),
    },
  ];
}

function ReportTrustStrip({
  evidence,
  locale,
  t,
}: {
  evidence: ReportEvidenceMetric;
  locale: string;
  t: ReportTranslation;
}) {
  const trustExportItems = buildReportTrustExportItems({ evidence, locale, t });
  const trustItems = [
    {
      icon: FileCheck2,
      ...trustExportItems[0],
    },
    {
      icon: ShieldCheck,
      ...trustExportItems[1],
    },
    {
      icon: CalendarDays,
      ...trustExportItems[2],
    },
    {
      icon: BadgeCheck,
      ...trustExportItems[3],
    },
  ];

  return (
    <Card data-testid="report-trust-strip" className="overflow-hidden">
      <CardContent className="grid divide-y divide-border/60 p-0 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {trustItems.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="min-w-0 p-4">
              <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4 shrink-0" />
                <p className="truncate text-xs font-medium">{item.label}</p>
              </div>
              <p className="truncate text-lg font-semibold leading-tight text-foreground">
                {item.value}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function CampaignReportPage() {
  const { t } = useTranslation("brand.report");
  const { locale } = useI18n();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [performers, setPerformers] = useState<MemberPerformance[]>([]);
  const [reportReads, setReportReads] = useState<CampaignReportRead[]>([]);
  const [reportTasks, setReportTasks] = useState<CampaignReportTask[]>([]);
  const [memberRates, setMemberRates] = useState<Map<string, number>>(new Map());
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedMetricKey, setSelectedMetricKey] = useState<ReportMetricKey>("views");
  const [loading, setLoading] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLinks, setShareLinks] = useState<ReportShareLinkSummary[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [shareCreating, setShareCreating] = useState(false);
  const [shareRevokingId, setShareRevokingId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const shareErrorMessage = t("share.error");
  const shareCopyErrorMessage = t("share.copyError");

  const availablePlatforms = useMemo(
    () => getAvailableReportPlatforms(reportReads),
    [reportReads],
  );

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadReport() {
      const { data: camp } = await supabase
        .from("campaigns")
        .select("id, title, total_spend, posting_window_start, posting_window_end, report_data")
        .eq("id", campaignId)
        .single();

      if (!active) return;
      if (camp) setCampaign(camp as CampaignRow);

      const { data: members } = await supabase
        .from("campaign_members")
        .select(
          `id, accepted_rate, creator_id,
           profiles!campaign_members_creator_id_fkey ( full_name, avatar_url )`,
        )
        .eq("campaign_id", campaignId);

      const { data: tasks } = await supabase
        .from("campaign_report_tasks")
        .select("due_at, status, submitted_at")
        .eq("campaign_id", campaignId);

      if (!active) return;
      setReportTasks(
        (tasks || []).map((task: Record<string, string | null>) => ({
          dueAt: task.due_at || new Date().toISOString(),
          status: task.status || "pending",
          submittedAt: task.submitted_at,
        })),
      );

      if (members) {
        const creatorIds = members
          .map((m: Record<string, unknown>) => m.creator_id as string)
          .filter(Boolean);
        const memberIds = members.map((m: Record<string, unknown>) => m.id as string);
        const cpMap = new Map<string, Record<string, unknown>>();
        const memberRateMap = new Map<string, number>();

        for (const member of members) {
          const rate = member.accepted_rate as number | null;
          if (rate != null) memberRateMap.set(member.id as string, rate);
        }

        if (!active) return;
        setMemberRates(memberRateMap);

        if (creatorIds.length > 0) {
          const { data: cps } = await supabase
            .from("creator_profiles")
            .select("profile_id, primary_market, rating, tiktok, instagram, snapchat, youtube, facebook")
            .in("profile_id", creatorIds);

          if (cps) {
            for (const cp of cps) cpMap.set(cp.profile_id, cp);
          }
        }

        let submissions: Record<string, unknown>[] | null = null;
        if (memberIds.length > 0) {
          const { data } = await supabase
            .from("content_submissions")
            .select(
              `id, campaign_member_id, platform,
               content_performance (
                 measurement_type,
                 reported_at,
                 views,
                 likes,
                 comments,
                 shares,
                 saves,
                 clicks,
                 screenshot_url,
                 verification_status,
                 data_source,
                 content_performance_metric_values (
                   source_type,
                   metric_key,
                   metric_label,
                   metric_value,
                   confirmed_by_creator
                 )
               )`,
            )
            .in("campaign_member_id", memberIds);
          submissions = data as Record<string, unknown>[] | null;
        }

        const reads: CampaignReportRead[] = [];
        const latestPerformanceBySubmission = new Map<
          string,
          {
            submissionId: string;
            memberId: string;
            platform: string | null;
            row: Record<string, unknown>;
          }
        >();

        if (submissions) {
          for (const sub of submissions) {
            const performanceRows = Array.isArray(sub.content_performance)
              ? sub.content_performance
              : sub.content_performance
                ? [sub.content_performance]
                : [];
            const submissionId = sub.id as string;
            const memberId = sub.campaign_member_id as string;
            const platform = sub.platform as string | null;

            for (const row of performanceRows as Array<Record<string, unknown>>) {
              const reportedAt = (row.reported_at as string | null) || new Date().toISOString();
              const metricValues = Array.isArray(row.content_performance_metric_values)
                ? row.content_performance_metric_values
                : [];
              const hasCreatorConfirmedValues = metricValues.some(
                (value) =>
                  (value as Record<string, unknown>).source_type === "creator_confirmed",
              );

              reads.push({
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
                sourceType: hasCreatorConfirmedValues
                  ? "creator_confirmed"
                  : row.data_source as string | null,
              });

              const current = latestPerformanceBySubmission.get(submissionId);
              if (
                !current ||
                new Date(reportedAt).getTime() >
                  new Date(current.row.reported_at as string).getTime()
              ) {
                latestPerformanceBySubmission.set(submissionId, {
                  submissionId,
                  memberId,
                  platform,
                  row,
                });
              }
            }
          }
        }

        if (!active) return;
        setReportReads(reads);

        const perfMap = new Map<
          string,
          { views: number; engagements: number; platform: string | null }
        >();

        for (const performance of latestPerformanceBySubmission.values()) {
          const key = `${performance.memberId}:${performance.platform || "unknown"}`;
          const existing = perfMap.get(key) || {
            views: 0,
            engagements: 0,
            platform: performance.platform,
          };

          perfMap.set(key, {
            views: existing.views + ((performance.row.views as number | null) || 0),
            engagements:
              existing.engagements +
              engagementCount(performance.row as Record<string, number | null>),
            platform: performance.platform || existing.platform,
          });
        }

        const result: MemberPerformance[] = [];

        for (const member of members) {
          const prof = Array.isArray(member.profiles)
            ? member.profiles[0]
            : member.profiles;
          const cp = cpMap.get(member.creator_id as string) ?? null;
          const name = (prof as Record<string, string> | null)?.full_name || "";
          const avatarUrl = (prof as Record<string, string | null> | null)?.avatar_url || null;
          const market = (cp as Record<string, string | null> | null)?.primary_market || null;
          const rating = (cp as Record<string, number> | null)?.rating || 0;
          const rate = member.accepted_rate as number | null;
          const memberPerfEntries = Array.from(perfMap.entries()).filter(([key]) =>
            key.startsWith(`${member.id}:`),
          );

          if (memberPerfEntries.length === 0) {
            let platform: string | null = null;
            if (cp) {
              const keys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
              for (const key of keys) {
                if ((cp as Record<string, unknown>)[key]) {
                  platform = key;
                  break;
                }
              }
            }

            memberPerfEntries.push([
              `${member.id}:${platform || "unknown"}`,
              { views: 0, engagements: 0, platform },
            ]);
          }

          for (const [rowId, perf] of memberPerfEntries) {
            const er = perf.views > 0 ? (perf.engagements / perf.views) * 100 : 0;
            const cpe = perf.engagements > 0 && rate ? rate / perf.engagements : 0;

            result.push({
              row_id: rowId,
              member_id: member.id as string,
              name,
              avatar_url: avatarUrl,
              market,
              platform: perf.platform,
              rate,
              views: perf.views,
              engagements: perf.engagements,
              er,
              cpe,
              rating,
              topPerformer: false,
            });
          }
        }

        if (result.length > 0) {
          const topIdx = result.reduce((best, cur, index) =>
            cur.views > result[best].views ? index : best, 0);
          result[topIdx].topPerformer = true;
        }

        setPerformers(result);
      }

      if (!active) return;
      setLoading(false);
    }

    const channel = supabase.channel(`campaign-report:${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_performance" },
        () => {
          void loadReport();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_report_tasks",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          void loadReport();
        },
      )
      .subscribe();

    const refreshInterval = window.setInterval(() => {
      void loadReport();
    }, 5000);

    void loadReport();

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      void channel.unsubscribe();
    };
  }, [campaignId]);

  const refreshShareLinks = useCallback(async () => {
    setShareError(null);

    try {
      const links = await listReportShareLinks(campaignId);
      setShareLinks(links);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : shareErrorMessage);
    }
  }, [campaignId, shareErrorMessage]);

  useEffect(() => {
    if (!shareDialogOpen) return;

    void refreshShareLinks();
  }, [refreshShareLinks, shareDialogOpen]);

  const handleCreateShareLink = useCallback(async () => {
    setShareCreating(true);
    setShareCopied(false);
    setShareError(null);

    try {
      const created = await createReportShareLink(campaignId);
      setShareUrl(created.url);
      setShareLinks((current) => [created, ...current.filter((link) => link.id !== created.id)]);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : shareErrorMessage);
    } finally {
      setShareCreating(false);
    }
  }, [campaignId, shareErrorMessage]);

  const handleCopyShareLink = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1400);
      } catch {
        setShareError(shareCopyErrorMessage);
      }
    },
    [shareCopyErrorMessage],
  );

  const handleRevokeShareLink = useCallback(
    async (shareLinkId: string) => {
      setShareRevokingId(shareLinkId);
      setShareError(null);

      try {
        await revokeReportShareLink({ campaignId, shareLinkId });
        setShareLinks((current) =>
          current.map((link) =>
            link.id === shareLinkId
              ? { ...link, revokedAt: new Date().toISOString() }
              : link,
          ),
        );
      } catch (error) {
        setShareError(error instanceof Error ? error.message : shareErrorMessage);
      } finally {
        setShareRevokingId(null);
      }
    },
    [campaignId, shareErrorMessage],
  );

  const activePlatform = selectedPlatform === "all" || !availablePlatforms.includes(selectedPlatform)
    ? "all"
    : selectedPlatform;
  const isAllChannels = activePlatform === "all";
  const hasPlatformData = !isAllChannels && availablePlatforms.includes(activePlatform);

  const platformMetricItems = useMemo(
    () =>
      availablePlatforms.map((platform) => ({
        platform,
        metrics: buildPlatformReportMetrics({
          reads: reportReads,
          memberRates,
          platform,
        }),
      })),
    [availablePlatforms, memberRates, reportReads],
  );

  const allPlatformMetrics = useMemo(
    () => buildAllPlatformReportMetrics({ reads: reportReads, memberRates }),
    [memberRates, reportReads],
  );

  const platformMetrics = useMemo(
    () =>
      hasPlatformData
        ? platformMetricItems.find((item) => item.platform === activePlatform)?.metrics ??
          allPlatformMetrics
        : allPlatformMetrics,
    [activePlatform, allPlatformMetrics, hasPlatformData, platformMetricItems],
  );

  const completionMetric = useMemo(
    () => buildReportCompletionMetric(reportTasks),
    [reportTasks],
  );
  const evidenceMetric = useMemo(
    () => buildReportEvidenceMetric({ reads: reportReads, tasks: reportTasks }),
    [reportReads, reportTasks],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-7 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[88px] rounded-xl border border-border/60 bg-card p-3">
              <div className="flex h-full flex-col justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                  <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="flex flex-col gap-4 border-b border-border/50 px-6 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              <div className="h-3 w-72 animate-pulse rounded bg-muted/60" />
            </div>
            <div className="flex gap-2 rounded-lg border border-border bg-muted/20 p-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-7 w-24 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
          <div className="px-6 py-8">
            <div className="space-y-14">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-px animate-pulse bg-muted" />
              ))}
            </div>
            <div className="mt-8 flex items-end justify-between gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  <div className="size-3 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-12 animate-pulse rounded bg-muted/60" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="flex gap-4 border-b border-border/50 px-6 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 flex-1 animate-pulse rounded bg-muted" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/30 px-6 py-4 last:border-0">
              <div className="size-7 animate-pulse rounded-full bg-muted" />
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-3 flex-1 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const readDetail = isAllChannels
    ? t("metric.channels", { count: String(availablePlatforms.length) })
    : platformMetrics.readCount === 1
      ? t("metric.read")
      : t("metric.reads", { count: String(platformMetrics.readCount) });
  const completionDetail = completionMetric.total === 0
    ? t("metric.noReports")
    : completionMetric.missed > 0
      ? t("metric.missed", { count: String(completionMetric.missed) })
      : t("metric.onTrack");
  const platformDetail = isAllChannels
    ? t("filter.allChannels")
    : hasPlatformData
      ? formatPlatformName(activePlatform)
      : t("metric.noReads");
  const reportCards = buildReportMetricConfigs({
    metrics: platformMetrics,
    completionMetric,
    locale,
    t,
    readDetail,
    completionDetail,
    platformDetail,
  });
  const comparisonLines = buildComparisonLines({
    platformMetricItems,
    selectedMetricKey: selectedMetricKey === "reports" ? "views" : selectedMetricKey,
    locale,
  });
  const dateRangeLabel = `${formatDate(campaign.posting_window_start, locale)} ${t("dateRange.to")} ${formatDate(campaign.posting_window_end, locale)}`;
  const allReportCards = buildReportMetricConfigs({
    metrics: allPlatformMetrics,
    completionMetric,
    locale,
    t,
    readDetail: t("metric.channels", { count: String(availablePlatforms.length) }),
    completionDetail,
    platformDetail: t("filter.allChannels"),
  });
  const exportSections = [
    {
      title: t("filter.allChannels"),
      detail: t("chart.allChannelsDetail"),
      metrics: allReportCards.filter((metric) => metric.key !== "reports").map(toExportMetric),
    },
    ...platformMetricItems.map((item) => {
      const platformCards = buildReportMetricConfigs({
        metrics: item.metrics,
        completionMetric,
        locale,
        t,
        readDetail: item.metrics.readCount === 1
          ? t("metric.read")
          : t("metric.reads", { count: String(item.metrics.readCount) }),
        completionDetail,
        platformDetail: formatPlatformName(item.platform),
      });

      return {
        title: formatPlatformName(item.platform),
        detail: t("metric.platformNative"),
        metrics: platformCards.filter((metric) => metric.key !== "reports").map(toExportMetric),
      };
    }),
  ];
  const creatorExportRows = performers.map((creator) => ({
    name: creator.name,
    market: creator.market ? getMarketLabel(creator.market, locale) : "-",
    platform: formatPlatformName(creator.platform),
    views: formatNumber(creator.views),
    engagements: formatNumber(creator.engagements),
    er: `${creator.er.toFixed(1)}%`,
    cpe: creator.cpe > 0 ? formatCurrency(creator.cpe, locale, "USD", 2) : "-",
    spent: creator.rate != null ? formatCurrency(creator.rate, locale) : "-",
    rating: creator.rating > 0 ? creator.rating.toFixed(1) : "-",
  }));
  const reportExportData = buildReportExportData({
    campaignTitle: campaign.title,
    dateRange: dateRangeLabel,
    kpis: reportCards,
    trust: buildReportTrustExportItems({ evidence: evidenceMetric, locale, t }),
    sections: exportSections,
    creators: creatorExportRows,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href={`/b/campaigns/${campaign.id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {t("back")}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("titleForCampaign", { title: campaign.title })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {campaign.title} &middot; {formatDate(campaign.posting_window_start, locale)} {t("dateRange.to")} {formatDate(campaign.posting_window_end, locale)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="report-share-button"
              onClick={() => setShareDialogOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <Share2 className="size-4" />
              {t("share")}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="report-export-menu"
                render={
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
                  />
                }
              >
                <Download className="size-4" />
                {t("export")}
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => exportReportPDF(reportExportData)}>
                  <FileText className="size-4" />
                  {t("export.pdf")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportReportHTML(reportExportData)}
                >
                  <Globe2 className="size-4" />
                  {t("export.html")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportReportJSON(reportExportData)}>
                  <Code2 className="size-4" />
                  {t("export.json")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportReportCSV(reportExportData)}>
                  <Table2 className="size-4" />
                  {t("export.csv")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportReportPPTX(reportExportData)}>
                  <Presentation className="size-4" />
                  {t("export.pptx")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ReportShareDialog
        creating={shareCreating}
        copied={shareCopied}
        error={shareError}
        locale={locale}
        onCopy={handleCopyShareLink}
        onCreate={handleCreateShareLink}
        onOpenChange={setShareDialogOpen}
        onRevoke={handleRevokeShareLink}
        open={shareDialogOpen}
        revokingId={shareRevokingId}
        shareLinks={shareLinks}
        shareUrl={shareUrl}
        t={t}
      />

      <section className="mb-8 space-y-4" aria-label={t("section.platformMetrics")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {t("filter.platform")}
          </span>
          {availablePlatforms.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedPlatform("all")}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  selectedPlatform === "all"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-border bg-white text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("filter.allChannels")}
              </button>
              {availablePlatforms.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setSelectedPlatform(platform)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    activePlatform === platform
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-border bg-white text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {formatPlatformName(platform)}
                </button>
              ))}
            </>
          ) : (
            <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
              {t("filter.noReads")}
            </span>
          )}
          <span className="ms-auto text-xs text-muted-foreground">
            {t("metric.platformNative")}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {reportCards.map((card) => (
            <ReportMetricCard
              key={card.key}
              label={card.label}
              value={card.value}
              detail={card.detail}
            />
          ))}
        </div>

        {isAllChannels ? (
          <ReportComparisonChart
            metrics={reportCards}
            selectedMetricKey={selectedMetricKey}
            onSelectMetric={setSelectedMetricKey}
            lines={comparisonLines}
            t={t}
          />
        ) : (
          <ReportStoryChart
            metrics={reportCards}
            selectedMetricKey={selectedMetricKey}
            onSelectMetric={setSelectedMetricKey}
            t={t}
          />
        )}
      </section>

      <section className="mb-8" aria-label={t("section.reportTrust")}>
        <ReportTrustStrip evidence={evidenceMetric} locale={locale} t={t} />
      </section>

      {performers.length > 0 ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t("section.creatorPerformance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.creator")}</TableHead>
                  <TableHead>{t("table.market")}</TableHead>
                  <TableHead>{t("table.platform")}</TableHead>
                  <TableHead className="text-end">{t("table.views")}</TableHead>
                  <TableHead className="text-end">{t("table.engagements")}</TableHead>
                  <TableHead className="text-end">{t("table.er")}</TableHead>
                  <TableHead className="text-end">{t("table.cpe")}</TableHead>
                  <TableHead className="text-end">{t("table.spent")}</TableHead>
                  <TableHead className="text-end">{t("table.rating")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performers.map((creator) => (
                  <TableRow key={creator.row_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          {creator.avatar_url && <AvatarImage src={creator.avatar_url} />}
                          <AvatarFallback className="text-xs">
                            {getInitials(creator.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {creator.name}
                          {creator.topPerformer && (
                            <BadgeCheck className="ms-1 inline size-3 text-slate-500" />
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {creator.market ? getMarketLabel(creator.market, locale) : "-"}
                    </TableCell>
                    <TableCell>{formatPlatformName(creator.platform)}</TableCell>
                    <TableCell className="text-end">{formatNumber(creator.views)}</TableCell>
                    <TableCell className="text-end">
                      {formatNumber(creator.engagements)}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {creator.er.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-end">
                      {creator.cpe > 0
                        ? formatCurrency(creator.cpe, locale, "USD", 2)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-end">
                      {creator.rate != null ? formatCurrency(creator.rate, locale) : "-"}
                    </TableCell>
                    <TableCell className="text-end">
                      {creator.rating > 0 ? creator.rating.toFixed(1) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-8 rounded-lg border border-dashed border-border py-12 text-center">
          <BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      )}
    </div>
  );
}
