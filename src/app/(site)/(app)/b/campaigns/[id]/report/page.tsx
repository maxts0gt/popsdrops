"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ArrowUpDown,
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
  reviewPerformanceEvidence,
  reviewPerformanceProofLink,
  type PerformanceEvidenceReviewDecision,
} from "@/app/actions/reporting-evidence";
import { getBrandTeamSettings } from "@/app/actions/brand-team";
import {
  createReportShareLink,
  listReportShareLinks,
  revokeReportShareLink,
  type ReportShareLinkSummary,
} from "@/app/actions/report-shares";
import {
  requestReportExport,
  type ReportExportJobFormat,
} from "@/app/actions/report-export-jobs";
import {
  listReportCompositionTemplates,
  saveCampaignReportComposition,
  saveReportCompositionTemplate,
  type ReportCompositionTemplateSummary,
} from "@/app/actions/report-composition-templates";
import {
  REPORT_BUILDER_BLOCKS,
  REPORT_BUILDER_CHART_MODES,
  REPORT_BUILDER_CUSTOM_PRESET,
  REPORT_BUILDER_DEFAULT_BLOCK_IDS,
  REPORT_BUILDER_DEFAULT_PRESENTATION,
  REPORT_BUILDER_DEFAULT_PRESET_ID,
  REPORT_BUILDER_PRESETS,
  buildReportCompositionExportData,
  getReportBuilderPresetBlockIds,
  isReportBuilderBlockSelected,
  moveReportBuilderBlockSelection,
  normalizeReportBuilderPresentation,
  normalizeReportCompositionSelection,
  type ReportBuilderBlockId,
  type ReportBuilderChartMetricKey,
  type ReportBuilderChartModeId,
  type ReportBuilderPresentation,
  type ReportBuilderPresetId,
  type ReportBuilderPresetSelectionId,
} from "@/lib/reporting/report-builder";
import {
  type ReportExportData,
  type ReportExportMetric,
  type ReportExportSection,
  type ReportExportTrustItem,
  type ReportLeadershipHandoff,
  buildReportLeadershipHandoff,
  buildReportExportStory,
  buildReportProofOperations,
  buildReportProofReviewProvenance,
  getReportTrustDecision,
} from "@/lib/reporting/report-export";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  getMarketLabel,
  formatCurrency,
  getPlatformLabel,
} from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import {
  expandReportReadByMetricPlatforms,
  buildAllPlatformReportMetrics,
  buildPlatformReportMetrics,
  buildProofRoomScaleReadiness,
  buildReportEvidenceMetric,
  buildReportCompletionMetric,
  getAcceptedReportReads,
  getAvailableReportPlatforms,
  getCurrentReportReadsWithHistory,
  getMetricValueSourceType,
  partitionReportPlatforms,
  type ProofRoomScaleReadiness,
  type ReportEvidenceMetric,
  type CampaignReportRead,
  type CampaignReportTask,
  type ReportCompletionMetric,
  type PlatformReportMetrics,
} from "@/lib/reporting/campaign-report-metrics";
import {
  formatReportCompactDate,
  formatReportCompactDateRange,
} from "@/lib/reporting/report-date-format";
import {
  getExternalEvidenceUrl,
  hasEvidenceProofReference,
  parseEvidenceStorageReference,
} from "@/lib/reporting/evidence-upload";
import { hasBrandWorkspacePermission } from "@/lib/brand-permissions";
import {
  mapCampaignAssetRow,
  pickCreatorFacingHeroAsset,
  type CampaignCreativeAsset,
} from "@/lib/campaigns/creative-kit";
import { ReportBuilderPanel } from "./report-builder-panel";
import { ReportOutputContractPanel } from "./report-output-contract-panel";
import { createClient } from "@/lib/supabase/client";
import type {
  BrandTeamRole,
  PerformanceAiExtractionStatus,
  PerformanceEvidenceVerificationStatus,
} from "@/types/database";

interface CampaignRow {
  id: string;
  title: string;
  platforms: string[] | null;
  total_spend: number | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  report_data: Record<string, unknown> | null;
}

interface CampaignReportPlanGoalRow {
  report_template_id: string | null;
  report_preset_id: string | null;
  report_chart_mode_id: string | null;
  report_block_ids: string[] | null;
  report_presentation: ReportBuilderPresentation | null;
}

interface CampaignAssetRecord {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  asset_type: CampaignCreativeAsset["assetType"];
  bucket_id: "campaign-assets";
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  visibility: CampaignCreativeAsset["visibility"];
  status: CampaignCreativeAsset["status"];
  created_at: string;
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
  presentation?: ReportBuilderPresentation;
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
  leadershipState: ReportLeadershipHandoff["state"];
  t: ReportTranslation;
  trustDecision: string;
}

interface ReportExecutiveCoverProps {
  campaignImageAlt?: string | null;
  campaignImageUrl?: string | null;
  dateRange: string;
  executiveQuestion?: string | null;
  headline: string;
  metrics: ReportExecutiveCoverMetric[];
  presentation: ReportBuilderPresentation;
  t: ReportTranslation;
}

interface ReportExecutiveCoverMetric {
  detail: string;
  key: string;
  label: string;
  source: "kpi" | "trust";
  value: string;
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

interface ReportTileOption {
  id: string;
  label: string;
  detail: string;
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

interface ReportRecommendation {
  key: string;
  title: string;
  value: string;
  detail: string;
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

function formatLiveReportChannelCount(
  count: number,
  t: ReportTranslation,
): string {
  return count === 1
    ? t("metric.channel")
    : t("metric.channels", { count: String(count) });
}

interface ProofRoomScaleReadinessPanelProps {
  readiness: ProofRoomScaleReadiness;
  t: ReportTranslation;
}

async function downloadClientPdfReport(data: ReportExportData): Promise<void> {
  const { exportReportPDF } = await import("@/lib/export-report-pdf");
  await exportReportPDF(data);
}

async function downloadClientPptxReport(data: ReportExportData): Promise<void> {
  const { exportReportPPTX } = await import("@/lib/export-report-pdf");
  await exportReportPPTX(data);
}

interface TrustWindowRange {
  value: string;
  detail: string;
}

interface EvidenceStatusMeta {
  label: string;
  className: string;
}

interface EvidenceSourceMeta {
  label: string;
  className: string;
}

interface EvidenceImpactMeta {
  label: string;
  className: string;
}

interface EvidenceReviewProvenanceMeta {
  label: string;
  detail?: string;
  className: string;
}

interface EvidenceReviewCommand {
  action: string;
  detail: string;
  status: string;
  title: string;
  tone: "ready" | "hold";
}

interface ProofImpactSummary {
  included: number;
  pendingReview: number;
  corrections: number;
  missingProof: number;
}

interface EvidenceReportRead extends CampaignReportRead {
  performanceId?: string | null;
  evidenceId?: string | null;
  aiExtractionStatus?: PerformanceAiExtractionStatus | null;
  evidenceVerificationStatus?: PerformanceEvidenceVerificationStatus | null;
  evidenceReviewNote?: string | null;
  evidenceReviewedAt?: string | null;
  evidenceReviewedBy?: string | null;
  reportTaskDueAt?: string | null;
  reportTaskStatus?: string | null;
  reportTaskSubmittedAt?: string | null;
}

interface EvidenceTrailProps {
  canReview: boolean;
  error: string | null;
  focusedEvidenceId: string | null;
  focusedReportTaskId: string | null;
  locale: string;
  onOpenEvidence: (read: EvidenceReportRead) => Promise<void> | void;
  onRequestCorrection: (read: EvidenceReportRead) => void;
  onReviewEvidence: (
    read: EvidenceReportRead,
    decision: PerformanceEvidenceReviewDecision,
  ) => Promise<unknown> | unknown;
  performers: MemberPerformance[];
  reads: EvidenceReportRead[];
  reviewingId: string | null;
  t: ReportTranslation;
}

interface EvidenceCorrectionDialogProps {
  error: string | null;
  note: string;
  onNoteChange: (note: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void> | void;
  open: boolean;
  saving: boolean;
  t: ReportTranslation;
}

type SortDirection = "asc" | "desc";
type EvidenceSortKey =
  | "creator"
  | "platform"
  | "reported"
  | "status"
  | "source"
  | "impact"
  | "proof"
  | "review";
type PerformerSortKey =
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

interface SortableTableHeadProps<T extends string> {
  activeSort: SortState<T>;
  align?: "start" | "end";
  defaultDirection?: SortDirection;
  label: string;
  onSort: (key: T, defaultDirection: SortDirection) => void;
  sortKey: T;
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

function formatChartDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "-";

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${month}/${day}`;
}

function formatCompactDate(dateStr: string | null): string {
  return formatReportCompactDate(dateStr);
}

function formatCompactDateRange({
  end,
  start,
  t,
}: {
  end: string | null;
  start: string | null;
  t: ReportTranslation;
}): string {
  return formatReportCompactDateRange({
    end,
    pendingLabel: t("cover.windowPending"),
    start,
  });
}

function parseChartDate(dateStr: string): Date | null {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTrustWindowRange({
  start,
  end,
  t,
}: {
  start: string;
  end: string;
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
  const compactStart = formatCompactDate(start);
  const compactEnd = formatCompactDate(end);
  const value = compactStart === compactEnd
    ? compactStart
    : `${compactStart} - ${compactEnd}`;

  return {
    value: sameYear ? value : `${compactStart} - ${compactEnd}`,
    detail: sameYear
      ? t("trust.windowYearDetail", { year: String(startYear) })
      : t("trust.platformReads"),
  };
}

function formatPlatformName(platform: string | null): string {
  if (!platform) return "-";
  return getPlatformLabel(platform);
}

function formatReportSourceName(
  platform: string | null,
  reportingPlatformLabels: Map<string, string>,
): string {
  if (!platform) return "-";

  return reportingPlatformLabels.get(platform) || formatPlatformName(platform);
}

function getNextSortState<T extends string>(
  current: SortState<T>,
  key: T,
  defaultDirection: SortDirection,
): SortState<T> {
  if (current.key !== key) {
    return { key, direction: defaultDirection };
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

function compareSortValues(
  first: string | number | null | undefined,
  second: string | number | null | undefined,
): number {
  if (first == null && second == null) return 0;
  if (first == null) return 1;
  if (second == null) return -1;

  if (typeof first === "number" && typeof second === "number") {
    return first - second;
  }

  return String(first).localeCompare(String(second), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function applySortDirection(value: number, direction: SortDirection): number {
  return direction === "asc" ? value : -value;
}

function SortableTableHead<T extends string>({
  activeSort,
  align = "start",
  defaultDirection = "asc",
  label,
  onSort,
  sortKey,
}: SortableTableHeadProps<T>) {
  const isActive = activeSort.key === sortKey;
  const ariaSort = isActive
    ? activeSort.direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <TableHead
      aria-sort={ariaSort}
      className={align === "end" ? "text-end" : undefined}
    >
      <button
        type="button"
        data-testid="report-sort-header"
        data-sort-key={sortKey}
        onClick={() => onSort(sortKey, defaultDirection)}
        className={`inline-flex w-full items-center gap-1 text-xs font-medium transition hover:text-foreground ${
          align === "end" ? "justify-end" : "justify-start"
        }`}
      >
        <span>{label}</span>
        <ArrowUpDown
          className={`size-3 ${
            isActive ? "text-foreground" : "text-muted-foreground/60"
          }`}
        />
      </button>
    </TableHead>
  );
}

function getEvidenceStatusMeta(
  read: EvidenceReportRead,
  t: ReportTranslation,
): EvidenceStatusMeta {
  const hasProof = hasEvidenceProofReference(read.screenshotUrl);
  const submittedTime = read.reportTaskSubmittedAt
    ? new Date(read.reportTaskSubmittedAt).getTime()
    : new Date(read.reportedAt).getTime();
  const dueTime = read.reportTaskDueAt
    ? new Date(read.reportTaskDueAt).getTime()
    : Number.NaN;
  const isLate =
    read.reportTaskStatus === "submitted_late" ||
    (Number.isFinite(dueTime) &&
      Number.isFinite(submittedTime) &&
      submittedTime > dueTime);

  if (!hasProof) {
    return {
      label: t("evidence.missingProof"),
      className: "border-slate-200 bg-white text-muted-foreground",
    };
  }

  if (
    read.evidenceVerificationStatus === "verified" ||
    read.verificationStatus === "brand_verified" ||
    read.verificationStatus === "screenshot_verified"
  ) {
    return {
      label: isLate ? t("evidence.verifiedLate") : t("evidence.verified"),
      className: "border-slate-200 bg-slate-50 text-muted-foreground",
    };
  }

  if (
    read.evidenceVerificationStatus === "rejected" ||
    read.verificationStatus === "rejected"
  ) {
    return {
      label: t("evidence.correctionRequested"),
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (read.hasReturnedCorrection) {
    return {
      label: t("evidence.correctionReturned"),
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  return {
    label: isLate ? t("evidence.submittedLate") : t("evidence.needsReview"),
    className: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

function getEvidenceSourceMeta(
  read: EvidenceReportRead,
  t: ReportTranslation,
): EvidenceSourceMeta {
  if (read.sourceType === "creator_confirmed") {
    if (read.aiExtractionStatus === "edited_by_creator") {
      return {
        label: t("evidence.source.aiEdited"),
        className: "border-slate-200 bg-white text-foreground",
      };
    }

    if (read.aiExtractionStatus === "accepted_by_creator") {
      return {
        label: t("evidence.source.aiAccepted"),
        className: "border-slate-200 bg-white text-foreground",
      };
    }
  }

  if (read.sourceType === "brand_verified") {
    return {
      label: t("evidence.source.brandVerified"),
      className: "border-slate-200 bg-slate-50 text-muted-foreground",
    };
  }

  if (read.sourceType === "ai_extracted") {
    return {
      label: t("evidence.source.aiPending"),
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (
    read.evidenceVerificationStatus === "verified" ||
    read.verificationStatus === "brand_verified" ||
    read.verificationStatus === "screenshot_verified"
  ) {
    return {
      label: t("evidence.source.brandVerified"),
      className: "border-slate-200 bg-slate-50 text-muted-foreground",
    };
  }

  return {
    label: t("evidence.source.manual"),
    className: "border-slate-200 bg-white text-muted-foreground",
  };
}

function getEvidenceImpactMeta(
  read: EvidenceReportRead,
  t: ReportTranslation,
): EvidenceImpactMeta {
  const hasProof = hasEvidenceProofReference(read.screenshotUrl);

  if (!hasProof) {
    return {
      label: t("evidence.impact.missing"),
      className: "border-slate-200 bg-white text-muted-foreground",
    };
  }

  if (
    read.evidenceVerificationStatus === "verified" ||
    read.verificationStatus === "brand_verified" ||
    read.verificationStatus === "screenshot_verified"
  ) {
    return {
      label: t("evidence.impact.included"),
      className: "border-slate-200 bg-slate-50 text-muted-foreground",
    };
  }

  if (
    read.evidenceVerificationStatus === "rejected" ||
    read.verificationStatus === "rejected"
  ) {
    return {
      label: t("evidence.impact.rejected"),
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (read.hasReturnedCorrection) {
    return {
      label: t("evidence.impact.returned"),
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  return {
    label: t("evidence.impact.pending"),
    className: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

function getEvidenceReviewProvenance(
  read: EvidenceReportRead,
  t: ReportTranslation,
  locale: string,
): EvidenceReviewProvenanceMeta {
  const hasProof = hasEvidenceProofReference(read.screenshotUrl);
  const hasDecision =
    read.evidenceVerificationStatus === "verified" ||
    read.evidenceVerificationStatus === "rejected" ||
    read.verificationStatus === "brand_verified" ||
    read.verificationStatus === "screenshot_verified" ||
    read.verificationStatus === "rejected";

  if (!hasProof) {
    return {
      label: t("evidence.awaitingProof"),
      className: "text-muted-foreground",
    };
  }

  if (hasDecision) {
    const compactReviewedDate = formatReportCompactDate(read.evidenceReviewedAt ?? null);
    const reviewedDate = compactReviewedDate === "-"
      ? formatShareDate(read.evidenceReviewedAt ?? null, locale)
      : compactReviewedDate;

    return {
      label: reviewedDate === "-"
        ? t("evidence.reviewedBy")
        : t("evidence.reviewedAt", { date: reviewedDate }),
      detail: read.evidenceReviewedBy ? t("evidence.reviewedBy") : undefined,
      className: "text-slate-500",
    };
  }

  return {
    label: t("evidence.awaitingDecision"),
    className: "text-amber-900",
  };
}

function buildEvidenceTrailSummary(reads: EvidenceReportRead[]): ProofImpactSummary {
  return reads.reduce<ProofImpactSummary>(
    (summary, read) => {
      const hasProof = hasEvidenceProofReference(read.screenshotUrl);

      if (!hasProof) {
        summary.missingProof += 1;
      } else if (
        read.evidenceVerificationStatus === "verified" ||
        read.verificationStatus === "brand_verified" ||
        read.verificationStatus === "screenshot_verified"
      ) {
        summary.included += 1;
      } else if (
        read.evidenceVerificationStatus === "rejected" ||
        read.verificationStatus === "rejected" ||
        read.hasReturnedCorrection
      ) {
        summary.corrections += 1;
      } else {
        summary.pendingReview += 1;
      }

      return summary;
    },
    {
      included: 0,
      pendingReview: 0,
      corrections: 0,
      missingProof: 0,
    },
  );
}

function buildEvidenceReviewCommand({
  summary,
  t,
}: {
  summary: ProofImpactSummary;
  t: ReportTranslation;
}): EvidenceReviewCommand {
  if (summary.corrections > 0) {
    return {
      action: t("evidence.command.corrections.action"),
      detail: t("evidence.command.corrections.detail"),
      status: t("evidence.command.corrections.status"),
      title: t("evidence.command.corrections.title"),
      tone: "hold",
    };
  }

  if (summary.missingProof > 0) {
    return {
      action: t("evidence.command.missing.action"),
      detail: t("evidence.command.missing.detail"),
      status: t("evidence.command.missing.status"),
      title: t("evidence.command.missing.title"),
      tone: "hold",
    };
  }

  if (summary.pendingReview > 0) {
    return {
      action: t("evidence.command.review.action"),
      detail: t("evidence.command.review.detail"),
      status: t("evidence.command.review.status"),
      title: t("evidence.command.review.title"),
      tone: "hold",
    };
  }

  return {
    action: t("evidence.command.ready.action"),
    detail: t("evidence.command.ready.detail"),
    status: t("evidence.command.ready.status"),
    title: t("evidence.command.ready.title"),
    tone: "ready",
  };
}

function canReviewEvidence(read: EvidenceReportRead): boolean {
  return Boolean(getEvidenceReviewTargetId(read)) &&
    read.evidenceVerificationStatus !== "verified" &&
    read.evidenceVerificationStatus !== "rejected" &&
    read.verificationStatus !== "brand_verified" &&
    read.verificationStatus !== "screenshot_verified" &&
    read.verificationStatus !== "rejected";
}

function getEvidenceReviewTargetId(read: EvidenceReportRead): string | null {
  if (read.evidenceId) return read.evidenceId;
  if (read.performanceId && getExternalEvidenceUrl(read.screenshotUrl)) {
    return read.performanceId;
  }

  return null;
}

function getEvidenceSortValue(
  read: EvidenceReportRead,
  key: EvidenceSortKey,
  creatorName: string,
  statusLabel: string,
  sourceLabel: string,
  impactLabel: string,
): string | number {
  if (key === "creator") return creatorName;
  if (key === "platform") return formatPlatformName(read.platform);
  if (key === "reported") return new Date(read.reportedAt).getTime();
  if (key === "status") return statusLabel;
  if (key === "source") return sourceLabel;
  if (key === "impact") return impactLabel;
  if (key === "proof") {
    return hasEvidenceProofReference(read.screenshotUrl) ? 1 : 0;
  }

  return read.evidenceVerificationStatus || read.verificationStatus || "";
}

function getPerformerSortValue(
  creator: MemberPerformance,
  key: PerformerSortKey,
  locale: string,
): string | number | null {
  if (key === "creator") return creator.name;
  if (key === "market") {
    return creator.market ? getMarketLabel(creator.market, locale) : null;
  }
  if (key === "platform") return formatPlatformName(creator.platform);
  if (key === "views") return creator.views;
  if (key === "engagements") return creator.engagements;
  if (key === "er") return creator.er;
  if (key === "cpe") return creator.cpe;
  if (key === "spent") return creator.rate;
  return creator.rating;
}

const COMPARISON_LINE_COLORS = [
  "#0F172A",
  "#0D9488",
  "#F59E0B",
  "#475569",
  "#94A3B8",
];

function readEngagementCount(read: CampaignReportRead): number {
  return (
    (read.likes || 0) +
    (read.comments || 0) +
    (read.shares || 0) +
    (read.saves || 0) +
    (read.clicks || 0)
  );
}

function buildMemberPerformanceRows({
  creatorProfiles,
  members,
  reads,
}: {
  creatorProfiles: Map<string, Record<string, unknown>>;
  members: Record<string, unknown>[];
  reads: EvidenceReportRead[];
}): MemberPerformance[] {
  const latestAcceptedReadBySubmission = new Map<string, EvidenceReportRead>();

  for (const read of getAcceptedReportReads(reads)) {
    const key =
      read.submissionId ||
      `${read.campaignMemberId}:${read.platform || "unknown"}:${read.reportedAt}`;
    const current = latestAcceptedReadBySubmission.get(key);

    if (
      !current ||
      new Date(read.reportedAt).getTime() >= new Date(current.reportedAt).getTime()
    ) {
      latestAcceptedReadBySubmission.set(key, read);
    }
  }

  const performanceByMemberPlatform = new Map<
    string,
    { views: number; engagements: number; platform: string | null }
  >();

  for (const read of latestAcceptedReadBySubmission.values()) {
    const key = `${read.campaignMemberId}:${read.platform || "unknown"}`;
    const existing = performanceByMemberPlatform.get(key) ?? {
      views: 0,
      engagements: 0,
      platform: read.platform,
    };

    performanceByMemberPlatform.set(key, {
      views: existing.views + (read.views || 0),
      engagements: existing.engagements + readEngagementCount(read),
      platform: read.platform || existing.platform,
    });
  }

  const result: MemberPerformance[] = [];

  for (const member of members) {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;
    const creatorProfile = creatorProfiles.get(member.creator_id as string) ?? null;
    const name = (profile as Record<string, string> | null)?.full_name || "";
    const avatarUrl = (profile as Record<string, string | null> | null)?.avatar_url || null;
    const market =
      (creatorProfile as Record<string, string | null> | null)?.primary_market || null;
    const rating = (creatorProfile as Record<string, number> | null)?.rating || 0;
    const rate = member.accepted_rate as number | null;
    const memberPerfEntries = Array.from(performanceByMemberPlatform.entries()).filter(
      ([key]) => key.startsWith(`${member.id}:`),
    );

    if (memberPerfEntries.length === 0) {
      let platform: string | null = null;
      if (creatorProfile) {
        const keys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
        for (const key of keys) {
          if ((creatorProfile as Record<string, unknown>)[key]) {
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

    for (const [rowId, performance] of memberPerfEntries) {
      const er = performance.views > 0
        ? (performance.engagements / performance.views) * 100
        : 0;
      const cpe = performance.engagements > 0 && rate
        ? rate / performance.engagements
        : 0;

      result.push({
        row_id: rowId,
        member_id: member.id as string,
        name,
        avatar_url: avatarUrl,
        market,
        platform: performance.platform,
        rate,
        views: performance.views,
        engagements: performance.engagements,
        er,
        cpe,
        rating,
        topPerformer: false,
      });
    }
  }

  if (result.length > 0) {
    const topIndex = result.reduce((best, current, index) =>
      current.views > result[best].views ? index : best, 0);
    result[topIndex].topPerformer = true;
  }

  return result;
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

function getActiveReportTileIds(
  options: ReportTileOption[],
  selectedIds?: readonly string[] | null,
): string[] {
  const optionIds = options.map((option) => option.id);
  if (optionIds.length === 0) return [];

  const selected = new Set(selectedIds ?? []);
  const activeIds = optionIds.filter((id) => selected.has(id));

  return activeIds.length > 0 ? activeIds : optionIds;
}

function filterReportItemsByTileIds<Item extends { key?: string | null }>(
  items: Item[],
  selectedIds?: readonly string[] | null,
): Item[] {
  if (!selectedIds?.length) return items;

  const selected = new Set(selectedIds);
  const filtered = items.filter((item) =>
    typeof item.key === "string" && selected.has(item.key),
  );

  return filtered.length > 0 ? filtered : items;
}

function applyReportTileLabels<Item extends { key?: string | null; label: string }>(
  items: Item[],
  labels?: Record<string, string> | null,
): Item[] {
  if (!labels) return items;

  return items.map((item) => {
    const itemId = typeof item.key === "string" && item.key.trim()
      ? item.key.trim()
      : item.label;
    const label = labels[itemId]?.trim();

    return label ? { ...item, label } : item;
  });
}

function formatReportTileLabelList(items: Array<{ label: string }>): string {
  return items.map((item) => item.label).join(" / ") || "-";
}

function isReportBuilderChartMetricKey(
  value: ReportMetricKey,
): value is ReportBuilderChartMetricKey {
  return (
    value === "views" ||
    value === "engagements" ||
    value === "engagementRate" ||
    value === "cpe"
  );
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

function buildReportRecommendations({
  allPlatformMetrics,
  locale,
  performers,
  platformMetricItems,
  t,
}: {
  allPlatformMetrics: PlatformReportMetrics;
  locale: string;
  performers: MemberPerformance[];
  platformMetricItems: Array<{ platform: string; metrics: PlatformReportMetrics }>;
  t: ReportTranslation;
}): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = [];
  const topCreator = performers
    .filter((creator) => creator.views > 0)
    .toSorted((first, second) => second.views - first.views)[0];

  if (topCreator) {
    recommendations.push({
      key: "topCreator",
      title: t("rec.topCreator"),
      value: topCreator.name || t("trust.none"),
      detail: t("rec.topCreatorDetail", {
        platform: formatPlatformName(topCreator.platform),
        views: formatNumber(topCreator.views),
      }),
    });
  }

  const bestChannel = platformMetricItems
    .filter((item) => item.metrics.readCount > 0 && item.metrics.views > 0)
    .toSorted(
      (first, second) =>
        second.metrics.engagementRate - first.metrics.engagementRate ||
        second.metrics.views - first.metrics.views,
    )[0];

  if (bestChannel) {
    recommendations.push({
      key: "bestChannel",
      title: t("rec.bestChannel"),
      value: formatPlatformName(bestChannel.platform),
      detail: t("rec.bestChannelDetail", {
        rate: `${bestChannel.metrics.engagementRate.toFixed(1)}%`,
        reads: bestChannel.metrics.readCount === 1
          ? t("metric.read")
          : t("metric.reads", { count: String(bestChannel.metrics.readCount) }),
      }),
    });
  }

  if (allPlatformMetrics.cpe > 0) {
    recommendations.push({
      key: "efficiency",
      title: t("rec.efficiency"),
      value: formatCurrency(allPlatformMetrics.cpe, locale, "USD", 2),
      detail: t("rec.efficiencyDetail", {
        spend: formatCurrency(allPlatformMetrics.spend, locale),
      }),
    });
  }

  return recommendations.slice(0, 3);
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
  campaignImageAlt,
  campaignImageUrl,
  campaignTitle,
  dateRange,
  kpis,
  recommendations,
  proofReview,
  trust,
  sections,
  creators,
}: {
  campaignImageAlt?: string | null;
  campaignImageUrl?: string | null;
  campaignTitle: string;
  dateRange: string;
  kpis: ReportMetricConfig[];
  recommendations: ReportRecommendation[];
  proofReview?: ReportExportData["proofReview"];
  trust: ReportExportData["trust"];
  sections: ReportExportSection[];
  creators: ReportExportData["creators"];
}): ReportExportData {
  return {
    campaignTitle,
    campaignImageAlt: campaignImageAlt ?? null,
    campaignImageUrl: campaignImageUrl ?? null,
    dateRange,
    generatedAt: new Date().toISOString(),
    proofReview: proofReview ?? null,
    kpis: kpis.map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      detail: metric.detail,
    })),
    recommendations: recommendations.map((recommendation) => ({
      title: recommendation.title,
      value: recommendation.value,
      detail: recommendation.detail,
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

  if (metric && points.length === 1) {
    return (
      <ReportSnapshotReadout
        metric={metric}
        metrics={metrics}
        onSelectMetric={onSelectMetric}
        selectedMetricKey={selectedMetricKey}
        t={t}
      />
    );
  }

  return (
    <Card data-testid="report-story-chart" data-chart-recipe="trend" className="overflow-hidden">
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

function ReportSnapshotReadout({
  metric,
  metrics,
  selectedMetricKey,
  onSelectMetric,
  t,
}: {
  metric: ReportMetricConfig;
  metrics: ReportMetricConfig[];
  selectedMetricKey: ReportMetricKey;
  onSelectMetric: (key: ReportMetricKey) => void;
  t: ReportTranslation;
}) {
  const point = metric.points[0];

  return (
    <Card
      data-testid="report-story-snapshot"
      data-chart-recipe="snapshot"
      className="overflow-hidden"
    >
      <CardHeader className="gap-4 border-b border-border/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("chart.snapshot.title")}
            </p>
            <CardTitle className="text-xl font-semibold text-slate-900">{metric.label}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("chart.snapshot.detail")}
            </p>
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
      <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,auto)] sm:items-end">
        <div className="rounded-xl border border-border/70 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
            {metric.label}
          </p>
          <p
            data-testid="report-story-final-value"
            className="mt-2 font-mono text-base font-semibold leading-tight text-slate-800"
          >
            {point?.label ?? metric.value}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.detail}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
            {t("cover.window")}
          </p>
          <p
            data-testid="report-story-axis-date"
            className="mt-2 font-mono text-[13px] font-medium leading-tight text-slate-700"
          >
            {point ? formatCompactDate(point.date) : "-"}
          </p>
        </div>
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
  presentation = REPORT_BUILDER_DEFAULT_PRESENTATION,
  value,
  detail,
}: ReportMetricCardProps) {
  const compactTypography = presentation.typography === "compact";
  const compactDensity = presentation.density === "compact";

  return (
    <article
      data-testid="report-metric-card"
      className={[
        "min-w-0 border-b border-slate-200 bg-white last:border-b-0 lg:border-b-0 lg:border-e lg:last:border-e-0",
        compactDensity ? "min-h-[76px] px-3 py-3" : "min-h-[88px] px-4 py-3.5",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-full min-w-0 flex-col justify-between",
          compactDensity ? "gap-2" : "gap-3",
        ].join(" ")}
      >
        <p
          data-testid="report-metric-card-label"
          className="line-clamp-2 text-[11px] font-semibold uppercase tracking-normal text-slate-500"
        >
          {label}
        </p>
        <div className="min-w-0">
          <p
            data-testid="report-metric-card-value"
            className={[
              "font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere]",
              compactTypography ? "tracking-normal" : "tracking-[0.01em]",
            ].join(" ")}
          >
            {value}
          </p>
          <p
            data-testid="report-metric-card-detail"
            className={[
              "mt-1 line-clamp-2 leading-tight text-slate-500",
              compactTypography ? "text-[11px]" : "text-xs",
            ].join(" ")}
          >
            {detail}
          </p>
        </div>
      </div>
    </article>
  );
}

function ReportExecutiveCover({
  campaignImageAlt,
  campaignImageUrl,
  dateRange,
  executiveQuestion,
  headline,
  metrics,
  presentation,
  t,
}: ReportExecutiveCoverProps) {
  const [campaignImageFailed, setCampaignImageFailed] = useState(false);
  const shouldUseCampaignImage =
    presentation.coverMode !== "proof_room" && Boolean(campaignImageUrl);
  const shouldRenderCampaignImage = shouldUseCampaignImage && !campaignImageFailed;
  const coverSource = shouldRenderCampaignImage
    ? "campaign-image"
    : presentation.coverMode === "proof_room" ? "proof-room" : "fallback";
  const compactTypography = presentation.typography === "compact";
  const compactDensity = presentation.density === "compact";
  const coverMetrics = metrics.length > 0 ? metrics : [];

  useEffect(() => {
    setCampaignImageFailed(false);
  }, [campaignImageUrl]);

  return (
    <section
      data-testid="report-executive-cover"
      data-cover-mode={presentation.coverMode}
      data-typography={presentation.typography}
      data-density={presentation.density}
      className={[
        "overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm",
        compactDensity ? "mb-4" : "mb-5",
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
          <h2
            className={[
              "max-w-3xl text-pretty font-semibold leading-tight text-slate-800",
              compactTypography
                ? "mt-3 text-xl sm:text-2xl"
                : "mt-4 text-2xl sm:text-3xl",
            ].join(" ")}
          >
            {headline}
          </h2>
          <div
            data-testid="report-executive-cover-window"
            className="mt-4 flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 border-s border-slate-200 ps-3 text-[11px] font-medium text-slate-500"
          >
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="shrink-0">{t("cover.window")}</span>
            <span
              data-testid="report-executive-cover-date-range"
              className="font-mono text-[11px] font-medium text-slate-600 [overflow-wrap:anywhere]"
            >
              {dateRange}
            </span>
          </div>
          {executiveQuestion ? (
            <p
              data-testid="report-executive-cover-question"
              className={[
                "max-w-3xl border-s-2 border-slate-900 ps-3 text-pretty leading-6 text-slate-700",
                compactDensity ? "mt-4 text-sm" : "mt-5 text-[15px]",
              ].join(" ")}
            >
              <span className="mb-1 block text-[10px] font-semibold uppercase leading-none tracking-normal text-slate-500">
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
            data-testid="report-executive-cover-evidence-strip"
          >
            {coverMetrics.map((metric) => {
              const Icon = getReportExecutiveCoverMetricIcon(metric);

              return (
                <article
                  key={`${metric.source}:${metric.key}`}
                  data-testid="report-executive-cover-metric"
                  data-cover-metric-source={metric.source}
                  data-cover-metric-key={metric.key}
                  className={[
                    "min-w-0 bg-white/80 px-3.5",
                    compactDensity ? "py-3" : "py-3.5",
                  ].join(" ")}
                >
                  <div data-testid="report-executive-cover-evidence-item">
                    <div
                      className={[
                        "flex items-start gap-2 text-slate-500",
                        compactDensity ? "mb-2" : "mb-3",
                      ].join(" ")}
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0" />
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
                    <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-slate-500">
                      {metric.detail}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div
          data-testid="report-executive-cover-visual"
          data-cover-source={coverSource}
          className={[
            "relative overflow-hidden border-t border-slate-200 bg-slate-950 text-white lg:border-s lg:border-t-0",
            compactDensity ? "min-h-[220px]" : "min-h-[260px]",
          ].join(" ")}
        >
          <div
            aria-hidden="true"
            data-testid="report-executive-cover-visual-backdrop"
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(13,148,136,0.18),transparent_28%),radial-gradient(circle_at_78%_82%,rgba(245,158,11,0.14),transparent_30%)]" />
            <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:36px_36px]" />
            <div
              data-testid="report-executive-cover-proof-card"
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
              <NextImage
                src={campaignImageUrl!}
                alt={campaignImageAlt ?? t("cover.visualDetail")}
                fill
                sizes="(max-width: 1024px) 100vw, 360px"
                className="object-contain p-4"
                data-testid="report-executive-cover-image"
                onError={() => setCampaignImageFailed(true)}
                unoptimized
                priority
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
              data-testid="report-executive-cover-fallback"
              className={[
                "relative flex h-full flex-col justify-between",
                compactDensity ? "min-h-[220px] p-5" : "min-h-[260px] p-6",
              ].join(" ")}
            >
              <div className="pointer-events-none absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:36px_36px]" />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-white/55">
                  {t("cover.fallbackTitle")}
                </p>
                <h3 className="mt-3 max-w-[18rem] text-pretty text-xl font-semibold leading-tight text-white">
                  {headline}
                </h3>
                <p className="mt-3 max-w-[18rem] text-xs leading-5 text-slate-300">
                  {t("cover.fallbackDetail")}
                </p>
              </div>
              <div className="relative space-y-2">
                {coverMetrics.slice(0, 3).map((metric) => (
                  <div
                    key={`${metric.source}:${metric.key}:fallback`}
                    data-testid="report-executive-cover-fallback-signal"
                    data-cover-metric-source={metric.source}
                    data-cover-metric-key={metric.key}
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
                <div
                  data-testid="report-executive-cover-fallback-window"
                  className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-[11px] text-slate-400"
                >
                  <span className="font-medium uppercase tracking-normal">
                    {t("cover.window")}
                  </span>
                  <span className="font-mono text-slate-200">{dateRange}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getReportExecutiveCoverMetricIcon(metric: ReportExecutiveCoverMetric) {
  if (metric.source === "trust") return ShieldCheck;
  if (metric.key === "cpe" || metric.key === "engagementRate") return BarChart3;

  return FileText;
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
  leadershipState,
  t,
  trustDecision,
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
          <div
            data-testid="report-share-trust-gate"
            data-leadership-state={leadershipState}
            className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("share.trustGate")}
                </p>
                <p
                  data-testid="report-share-trust-decision"
                  className="mt-1 text-sm font-semibold leading-5 text-slate-900"
                >
                  {trustDecision}
                </p>
              </div>
              <span className="inline-flex w-fit shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {leadershipState === "ready"
                  ? t("proofOps.ready")
                  : t("proofOps.review")}
              </span>
            </div>
            <p
              data-testid="report-share-trust-detail"
              className="mt-2 text-xs leading-5 text-muted-foreground"
            >
              {t("share.trustGateDetail")}
            </p>
          </div>
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

function ReportProofAuditPanel({
  evidence,
  proofSourceItems,
  reportingPlatformLabels,
  t,
}: {
  evidence: ReportEvidenceMetric;
  proofSourceItems: Array<{ platform: string; metrics: PlatformReportMetrics }>;
  reportingPlatformLabels: Map<string, string>;
  t: ReportTranslation;
}) {
  const trustItems = buildReportTrustExportItems({ evidence, t });
  const reportStatus = buildReportStatusValue({ evidence, t });
  const proofSourceLabel = proofSourceItems.length > 0
    ? t("builder.chartStory.proofSourceCount", {
        count: String(proofSourceItems.length),
      })
    : t("builder.chartStory.proofSources");

  return (
    <Card data-testid="report-proof-audit-panel" className="overflow-hidden">
      <CardHeader className="border-b border-border/60">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("builder.chartStory.evidenceStatus")}
            </p>
            <CardTitle className="mt-1 text-lg">{reportStatus.value}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {reportStatus.detail}
            </p>
          </div>
          <span className="w-fit rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">
            {proofSourceLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 md:grid-cols-2">
        {trustItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/70 bg-slate-50 px-4 py-3"
          >
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-sm font-medium leading-snug text-slate-700">
              {item.value}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-slate-500">
              {item.detail}
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-border/70 bg-white px-4 py-3 md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("builder.chartStory.proofSources")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {proofSourceItems.length > 0 ? (
              proofSourceItems.map((item) => (
                <span
                  key={item.platform}
                  className="rounded-full border border-border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {formatReportSourceName(item.platform, reportingPlatformLabels)}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("builder.chartStory.noProofSources")}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportChartModeStory({
  chartModeId,
  chartModeLabel,
  comparisonLines,
  evidence,
  executiveQuestion,
  isAllChannels,
  layoutDetail,
  layoutTitle,
  metrics,
  nextAction,
  onSelectMetric,
  proofSourceItems,
  reportingPlatformLabels,
  selectedMetricKey,
  t,
  trustDecision,
}: {
  chartModeId: ReportBuilderChartModeId;
  chartModeLabel: string;
  comparisonLines: ReportComparisonLine[];
  evidence: ReportEvidenceMetric;
  executiveQuestion: string;
  isAllChannels: boolean;
  layoutDetail: string;
  layoutTitle: string;
  metrics: ReportMetricConfig[];
  nextAction: ReportRecommendation | null;
  onSelectMetric: (key: ReportMetricKey) => void;
  proofSourceItems: Array<{ platform: string; metrics: PlatformReportMetrics }>;
  reportingPlatformLabels: Map<string, string>;
  selectedMetricKey: ReportMetricKey;
  t: ReportTranslation;
  trustDecision: string;
}) {
  const reportStatus = buildReportStatusValue({ evidence, t });
  const selectedMetricLabel =
    metrics.find((item) => item.key === selectedMetricKey)?.label ??
    t("metric.noReads");
  const evidenceGateDetail = reportStatus.detail
    ? `${reportStatus.value} / ${reportStatus.detail}`
    : reportStatus.value;
  const nextActionValue = nextAction
    ? `${nextAction.title}: ${nextAction.value}`
    : t("builder.chartStory.noNextAction");
  const decisionSpineItems = [
    {
      key: "question",
      label: t("builder.output.recipeQuestion"),
      value: executiveQuestion,
      detail: layoutTitle,
    },
    {
      key: "visual",
      label: t("builder.output.recipeVisualJob"),
      value: layoutTitle,
      detail:
        chartModeId === "proof"
          ? chartModeLabel
          : `${chartModeLabel} / ${selectedMetricLabel}`,
    },
    {
      key: "evidence",
      label: t("builder.output.recipeEvidenceGate"),
      value: trustDecision,
      detail: evidenceGateDetail,
    },
    {
      key: "action",
      label: t("builder.output.recipeNextAction"),
      value: nextActionValue,
      detail: nextAction?.detail ?? layoutDetail,
    },
  ];

  return (
    <section
      data-testid="report-chart-layout-story"
      data-chart-mode={chartModeId}
      className="space-y-3"
      aria-label={t("builder.chartStory.title")}
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("builder.chartStory.title")}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-normal text-foreground">
              {layoutTitle}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {layoutDetail}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-slate-50 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {t("builder.chartStory.mode")}: {chartModeLabel}
            </span>
            {chartModeId !== "proof" && (
              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">
                {t("builder.chartStory.selectedMetric")}:{" "}
                {metrics.find((item) => item.key === selectedMetricKey)?.label ??
                  t("metric.noReads")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        data-testid="report-story-decision-rail"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="grid divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
        {decisionSpineItems.map((item, index) => (
          <article
            key={item.key}
            data-testid="report-story-decision-step"
            data-story-step={item.key}
            data-decision-step={item.key}
            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 p-4"
          >
            <span className="pt-0.5 font-mono text-[10px] font-medium text-slate-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                {item.label}
              </span>
              <span className="mt-1.5 block line-clamp-2 text-sm font-medium leading-snug text-slate-800">
                {item.value}
              </span>
              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                {item.detail}
              </span>
            </span>
          </article>
        ))}
        </div>
      </div>

      {chartModeId === "proof" ? (
        <ReportProofAuditPanel
          evidence={evidence}
          proofSourceItems={proofSourceItems}
          reportingPlatformLabels={reportingPlatformLabels}
          t={t}
        />
      ) : chartModeId === "comparison" && isAllChannels ? (
        <ReportComparisonChart
          metrics={metrics}
          selectedMetricKey={selectedMetricKey}
          onSelectMetric={onSelectMetric}
          lines={comparisonLines}
          t={t}
        />
      ) : (
        <ReportStoryChart
          metrics={metrics}
          selectedMetricKey={selectedMetricKey}
          onSelectMetric={onSelectMetric}
          t={t}
        />
      )}
    </section>
  );
}

function buildReportTrustExportItems({
  evidence,
  t,
}: {
  evidence: ReportEvidenceMetric;
  t: ReportTranslation;
}): ReportExportData["trust"] {
  const dataWindow = evidence.dataWindow
    ? formatTrustWindowRange({
        start: evidence.dataWindow.start,
        end: evidence.dataWindow.end,
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
      : buildReportStatusValue({ evidence, t }).value;
  const sourceValue = evidence.sourceLabels.length > 0
    ? evidence.sourceLabels.join(", ")
    : t("trust.none");
  const sourceDetail = buildReportSourceDetail({ evidence, sourceValue, t });

  return [
    {
      key: "evidence_backed_reads",
      label: t("trust.evidenceBacked"),
      value: `${evidence.evidenceBackedReads}/${evidence.totalReads}`,
      detail: t("trust.nativeScreenshots"),
    },
    {
      key: "verified_reads",
      label: t("trust.verifiedReads"),
      value: `${evidence.verifiedReads}/${evidence.totalReads}`,
      detail: t(`trust.confidence.${evidence.confidence}`),
    },
    {
      key: "data_window",
      label: t("trust.dataWindow"),
      value: dataWindow.value,
      detail: dataWindow.detail,
    },
    {
      key: "report_status",
      label: t("trust.reportStatus"),
      value: reportStatus,
      detail: t("trust.creatorObligations"),
    },
    {
      key: "data_source",
      label: t("trust.dataSource"),
      value: sourceValue,
      detail: sourceDetail,
    },
  ];
}

function buildReportSourceDetail({
  evidence,
  sourceValue,
  t,
}: {
  evidence: ReportEvidenceMetric;
  sourceValue: string;
  t: ReportTranslation;
}): string {
  const sourceText = sourceValue.toLowerCase();
  const reviewedLabel = t("evidence.source.brandVerified").toLowerCase();
  const pendingLabel = t("evidence.source.manual").toLowerCase();

  if (
    sourceText.includes(reviewedLabel) ||
    (evidence.totalReads > 0 && evidence.verifiedReads >= evidence.totalReads)
  ) {
    return t("trust.sourceReviewedDetail");
  }

  if (
    sourceText.includes(pendingLabel) ||
    (evidence.totalReads > 0 && evidence.verifiedReads < evidence.totalReads)
  ) {
    return t("trust.sourcePendingDetail");
  }

  return t("trust.sourceDetail");
}

function buildReportStatusValue({
  evidence,
  t,
}: {
  evidence: ReportEvidenceMetric;
  t: ReportTranslation;
}): TrustWindowRange {
  const submittedDetail = evidence.totalTasks === 0
    ? t("trust.creatorObligations")
    : t("trust.submittedStatus", {
        submitted: String(evidence.submittedTasks),
        total: String(evidence.totalTasks),
      });

  if (evidence.totalTasks === 0) {
    return {
      value: t("trust.none"),
      detail: t("trust.creatorObligations"),
    };
  }

  if (evidence.missedTasks > 0) {
    return {
      value: t("trust.missedStatus", { count: String(evidence.missedTasks) }),
      detail: submittedDetail,
    };
  }

  if (evidence.correctionRequestedReads > 0) {
    return {
      value: t("trust.correctionStatus", {
        count: String(evidence.correctionRequestedReads),
      }),
      detail: submittedDetail,
    };
  }

  if (evidence.missingEvidenceReads > 0) {
    return {
      value: t("trust.missingProofStatus", {
        count: String(evidence.missingEvidenceReads),
      }),
      detail: submittedDetail,
    };
  }

  if (evidence.pendingReviewReads > 0) {
    return {
      value: t("trust.reviewStatus", {
        count: String(evidence.pendingReviewReads),
      }),
      detail: submittedDetail,
    };
  }

  return {
    value: t("trust.readyStatus"),
    detail: submittedDetail,
  };
}

function getReportTrustTileIcon(key: string | null | undefined, index: number) {
  switch (key) {
    case "evidence_backed_reads":
      return FileCheck2;
    case "verified_reads":
      return ShieldCheck;
    case "data_window":
      return CalendarDays;
    case "report_status":
      return BadgeCheck;
    case "data_source":
      return Globe2;
    default:
      return [FileCheck2, ShieldCheck, CalendarDays, BadgeCheck, Globe2][index % 5] ??
        FileCheck2;
  }
}

function ReportTrustStrip({
  evidence,
  items,
  t,
}: {
  evidence: ReportEvidenceMetric;
  items?: ReportExportTrustItem[];
  t: ReportTranslation;
}) {
  const trustExportItems = items ?? buildReportTrustExportItems({ evidence, t });
  const reportStatus = buildReportStatusValue({ evidence, t });
  const trustItems = trustExportItems.map((item, index) => ({
    icon: getReportTrustTileIcon(item.key, index),
    ...item,
    ...(item.key === "report_status" ? reportStatus : {}),
  }));

  return (
    <Card data-testid="report-trust-strip" className="overflow-hidden">
      <CardContent className="grid divide-y divide-border/60 p-0 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        {trustItems.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="min-w-0 p-4">
              <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4 shrink-0" />
                <p
                  data-testid="report-trust-label"
                  className="truncate text-xs font-medium"
                >
                  {item.label}
                </p>
              </div>
              <p
                data-testid="report-trust-value"
                className="font-mono text-[13px] font-medium leading-tight text-slate-700 [overflow-wrap:anywhere]"
              >
                {item.value}
              </p>
              <p
                data-testid="report-trust-detail"
                className="mt-1 line-clamp-2 text-[11px] leading-tight text-slate-500"
              >
                {item.detail}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ProofSourceLanes({
  items,
  reportingPlatformLabels,
  t,
}: {
  items: Array<{ platform: string; metrics: PlatformReportMetrics }>;
  reportingPlatformLabels: Map<string, string>;
  t: ReportTranslation;
}) {
  if (items.length === 0) return null;

  return (
    <section
      data-testid="report-proof-source-lanes"
      className="mb-8"
      aria-label={t("section.proofSources")}
    >
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("section.proofSources")}</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("proofSources.detail")}
              </p>
            </div>
            <span className="w-fit rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground">
              {t("proofSources.badge")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          {items.map((item) => {
            const readLabel = item.metrics.readCount === 1
              ? t("metric.read")
              : t("metric.reads", { count: String(item.metrics.readCount) });

            return (
              <div
                key={item.platform}
                data-testid="report-proof-source-lane"
                className="rounded-xl border border-border/70 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatReportSourceName(item.platform, reportingPlatformLabels)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{readLabel}</p>
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    {t("proofSources.badge")}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {t("proofSources.views")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {formatNumber(item.metrics.views)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {t("proofSources.engagements")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {formatNumber(item.metrics.engagements)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

function EvidenceCorrectionDialog({
  error,
  note,
  onNoteChange,
  onOpenChange,
  onSubmit,
  open,
  saving,
  t,
}: EvidenceCorrectionDialogProps) {
  const trimmedNote = note.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="report-correction-dialog"
        className="max-w-md gap-4 p-5"
      >
        <DialogHeader>
          <DialogTitle>{t("evidence.requestCorrection")}</DialogTitle>
          <DialogDescription>{t("evidence.correctionPlaceholder")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="report-correction-note"
            className="text-xs font-medium text-muted-foreground"
          >
            {t("evidence.correctionReason")}
          </label>
          <Textarea
            id="report-correction-note"
            data-testid="report-correction-note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            maxLength={280}
            rows={4}
            placeholder={t("evidence.correctionPlaceholder")}
            className="min-h-24 resize-none bg-white text-sm"
          />
          <div className="flex items-center justify-between gap-3">
            {error ? (
              <p className="text-xs font-medium text-red-700">{error}</p>
            ) : (
              <span />
            )}
            <p className="text-xs text-muted-foreground">{trimmedNote.length}/280</p>
          </div>
        </div>

        <DialogFooter className="-mx-5 -mb-5 px-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            {t("evidence.cancelCorrection")}
          </button>
          <button
            type="button"
            data-testid="report-correction-submit"
            onClick={() => void onSubmit()}
            disabled={saving || !trimmedNote}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {t("evidence.sendCorrection")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceProofAction({
  onOpenEvidence,
  read,
  t,
}: {
  onOpenEvidence: (read: EvidenceReportRead) => Promise<void> | void;
  read: EvidenceReportRead;
  t: ReportTranslation;
}) {
  const reviewTargetId = getEvidenceReviewTargetId(read);

  if (!hasEvidenceProofReference(read.screenshotUrl)) {
    return (
      <span className="inline-flex h-8 items-center text-xs text-muted-foreground">
        {t("evidence.noProof")}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid="report-evidence-open"
      data-evidence-id={reviewTargetId ?? undefined}
      onClick={() => void onOpenEvidence(read)}
      className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {t("evidence.open")}
      <ExternalLink className="size-3" />
    </button>
  );
}

function EvidenceReviewActions({
  canReview: canReviewReportEvidence,
  onRequestCorrection,
  onReviewEvidence,
  read,
  reviewingId,
  t,
}: {
  canReview: boolean;
  onRequestCorrection: (read: EvidenceReportRead) => void;
  onReviewEvidence: (
    read: EvidenceReportRead,
    decision: PerformanceEvidenceReviewDecision,
  ) => Promise<unknown> | unknown;
  read: EvidenceReportRead;
  reviewingId: string | null;
  t: ReportTranslation;
}) {
  const canReview = canReviewEvidence(read);
  const reviewTargetId = getEvidenceReviewTargetId(read);

  if (!canReviewReportEvidence) {
    return (
      <span className="inline-flex h-8 items-center text-xs text-muted-foreground">
        -
      </span>
    );
  }

  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      {canReview && (
        <button
          type="button"
          data-testid="report-evidence-verify"
          data-evidence-id={reviewTargetId ?? undefined}
          disabled={reviewingId === reviewTargetId}
          onClick={() => void onReviewEvidence(read, "verified")}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
        >
          <Check className="size-3" />
          {t("evidence.verify")}
        </button>
      )}
      {canReview && (
        <button
          type="button"
          data-testid="report-evidence-correction"
          data-evidence-id={reviewTargetId ?? undefined}
          disabled={reviewingId === reviewTargetId}
          onClick={() => onRequestCorrection(read)}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-border bg-white px-2.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
        >
          <ArrowRight className="size-3" />
          {t("evidence.requestCorrection")}
        </button>
      )}
      {!reviewTargetId && (
        <span className="inline-flex h-8 items-center text-xs text-muted-foreground">
          -
        </span>
      )}
    </div>
  );
}

function CreatorPerformanceIdentity({ creator }: { creator: MemberPerformance }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-7 shrink-0">
        {creator.avatar_url && <AvatarImage src={creator.avatar_url} />}
        <AvatarFallback className="text-xs">
          {getInitials(creator.name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-medium">
        {creator.name}
        {creator.topPerformer && (
          <BadgeCheck className="ms-1 inline size-3 text-slate-500" />
        )}
      </span>
    </div>
  );
}

function CreatorPerformanceMobileRow({
  creator,
  locale,
  t,
}: {
  creator: MemberPerformance;
  locale: string;
  t: ReportTranslation;
}) {
  const marketLabel = creator.market ? getMarketLabel(creator.market, locale) : "-";
  const cpeLabel = creator.cpe > 0
    ? formatCurrency(creator.cpe, locale, "USD", 2)
    : "-";
  const spentLabel = creator.rate != null ? formatCurrency(creator.rate, locale) : "-";
  const ratingLabel = creator.rating > 0 ? creator.rating.toFixed(1) : "-";

  return (
    <div
      data-testid="report-creators-mobile-row"
      className="rounded-lg border border-border/70 bg-white p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CreatorPerformanceIdentity creator={creator} />
          <p className="mt-1 truncate text-xs leading-snug text-muted-foreground">
            {formatPlatformName(creator.platform)} &middot; {marketLabel}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t("table.views")}
          </p>
          <p className="tabular-nums text-sm font-semibold text-foreground">
            {formatNumber(creator.views)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            {t("table.engagements")}
          </p>
          <p className="tabular-nums text-sm font-semibold text-foreground">
            {formatNumber(creator.engagements)}
          </p>
        </div>
        <div className="text-end">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t("table.er")}
          </p>
          <p className="tabular-nums text-sm font-semibold text-foreground">
            {creator.er.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            {t("table.cpe")}
          </p>
          <p className="tabular-nums text-sm font-semibold text-foreground">
            {cpeLabel}
          </p>
        </div>
        <div className="text-end">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t("table.spent")}
          </p>
          <p className="tabular-nums text-sm font-semibold text-foreground">
            {spentLabel}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-xs text-muted-foreground">
        <span>{t("table.rating")}</span>
        <span className="tabular-nums">{ratingLabel}</span>
      </div>
    </div>
  );
}

function CreatorPerformanceDesktopTable({
  activeSort,
  creators,
  locale,
  onSort,
  t,
}: {
  activeSort: SortState<PerformerSortKey>;
  creators: MemberPerformance[];
  locale: string;
  onSort: (key: PerformerSortKey, defaultDirection: SortDirection) => void;
  t: ReportTranslation;
}) {
  return (
    <div data-testid="report-creators-desktop-table" className="hidden overflow-x-auto md:block">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <SortableTableHead
              activeSort={activeSort}
              label={t("table.creator")}
              onSort={onSort}
              sortKey="creator"
            />
            <SortableTableHead
              activeSort={activeSort}
              label={t("table.market")}
              onSort={onSort}
              sortKey="market"
            />
            <SortableTableHead
              activeSort={activeSort}
              label={t("table.platform")}
              onSort={onSort}
              sortKey="platform"
            />
            <SortableTableHead
              activeSort={activeSort}
              align="end"
              defaultDirection="desc"
              label={t("table.views")}
              onSort={onSort}
              sortKey="views"
            />
            <SortableTableHead
              activeSort={activeSort}
              align="end"
              defaultDirection="desc"
              label={t("table.engagements")}
              onSort={onSort}
              sortKey="engagements"
            />
            <SortableTableHead
              activeSort={activeSort}
              align="end"
              defaultDirection="desc"
              label={t("table.er")}
              onSort={onSort}
              sortKey="er"
            />
            <SortableTableHead
              activeSort={activeSort}
              align="end"
              defaultDirection="asc"
              label={t("table.cpe")}
              onSort={onSort}
              sortKey="cpe"
            />
            <SortableTableHead
              activeSort={activeSort}
              align="end"
              defaultDirection="desc"
              label={t("table.spent")}
              onSort={onSort}
              sortKey="spent"
            />
            <SortableTableHead
              activeSort={activeSort}
              align="end"
              defaultDirection="desc"
              label={t("table.rating")}
              onSort={onSort}
              sortKey="rating"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {creators.map((creator) => (
            <TableRow key={creator.row_id}>
              <TableCell>
                <CreatorPerformanceIdentity creator={creator} />
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
    </div>
  );
}

const PROOF_ROOM_READINESS_LABEL_KEYS: Record<
  ProofRoomScaleReadiness["action"],
  string
> = {
  share: "proofOps.ready",
  review_pending: "proofOps.review",
  request_corrections: "proofOps.correction",
  collect_missing_proof: "proofOps.missingProof",
  recover_missed_tasks: "proofOps.missed",
  wait_for_submissions: "proofOps.waiting",
};

const PROOF_ROOM_LANE_LABEL_KEYS: Record<
  ProofRoomScaleReadiness["lanes"][number]["id"],
  string
> = {
  correction: "proofOps.lane.correction",
  missed: "proofOps.lane.missed",
  missing_proof: "proofOps.lane.missing_proof",
  review: "proofOps.lane.review",
};

function getProofRoomReadinessTone(
  severity: ProofRoomScaleReadiness["severity"],
): string {
  if (severity === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (severity === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (severity === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function ProofRoomScaleReadinessPanel({
  readiness,
  t,
}: ProofRoomScaleReadinessPanelProps) {
  if (readiness.severity === "empty") return null;

  const scopeKey =
    readiness.scaleScope === "scale"
      ? "proofOps.scope.scale"
      : "proofOps.scope.single";
  const detailKey =
    readiness.scaleScope === "scale"
      ? "proofOps.detail.scale"
      : "proofOps.detail.single";

  return (
    <Card
      data-testid="proof-room-scale-readiness"
      data-proof-readiness-action={readiness.action}
      className="mb-8 border-slate-200/80 bg-white shadow-sm"
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
              <ShieldCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {t("proofOps.title")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getProofRoomReadinessTone(readiness.severity)}`}
                >
                  {t(PROOF_ROOM_READINESS_LABEL_KEYS[readiness.action])}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {t(scopeKey)}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {t(detailKey)}
              </p>
            </div>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-3 rounded-lg border border-slate-200/70 bg-slate-50/60 p-3">
            <div>
              <p className="text-xs font-medium text-slate-500">
                {t("proofOps.verifiedCoverage", {
                  total: String(readiness.totalReads),
                  verified: String(readiness.verifiedReads),
                })}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {readiness.verifiedCoveragePercent}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">
                {t("proofOps.attentionCount", {
                  count: String(readiness.attentionCount),
                })}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {readiness.attentionCount}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200/70 pt-4">
          {readiness.lanes.length > 0 ? (
            readiness.lanes.map((lane) => (
              <span
                key={lane.id}
                data-testid="proof-room-scale-lane"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <span className="font-semibold text-slate-950">{lane.count}</span>
                {t(PROOF_ROOM_LANE_LABEL_KEYS[lane.id])}
              </span>
            ))
          ) : (
            <span className="text-xs font-medium text-slate-500">
              {t("proofOps.noOpenLanes")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceTrail({
  canReview,
  error,
  focusedEvidenceId,
  focusedReportTaskId,
  locale,
  onOpenEvidence,
  onRequestCorrection,
  onReviewEvidence,
  performers,
  reads,
  reviewingId,
  t,
}: EvidenceTrailProps) {
  const creatorNameByMemberId = useMemo(() => {
    const names = new Map<string, string>();
    for (const performer of performers) {
      if (!names.has(performer.member_id)) {
        names.set(performer.member_id, performer.name);
      }
    }
    return names;
  }, [performers]);
  const [evidenceSort, setEvidenceSort] = useState<SortState<EvidenceSortKey>>({
    key: "reported",
    direction: "desc",
  });
  const handleEvidenceSort = useCallback(
    (key: EvidenceSortKey, defaultDirection: SortDirection) => {
      setEvidenceSort((current) =>
        getNextSortState(current, key, defaultDirection),
      );
    },
    [],
  );

  const auditReads = useMemo(
    () =>
      getCurrentReportReadsWithHistory(reads).toSorted((first, second) => {
        const firstCreator = creatorNameByMemberId.get(first.campaignMemberId) || "";
        const secondCreator = creatorNameByMemberId.get(second.campaignMemberId) || "";
        const firstStatus = getEvidenceStatusMeta(first, t).label;
        const secondStatus = getEvidenceStatusMeta(second, t).label;
        const firstSource = getEvidenceSourceMeta(first, t).label;
        const secondSource = getEvidenceSourceMeta(second, t).label;
        const firstImpact = getEvidenceImpactMeta(first, t).label;
        const secondImpact = getEvidenceImpactMeta(second, t).label;
        const result = compareSortValues(
          getEvidenceSortValue(
            first,
            evidenceSort.key,
            firstCreator,
            firstStatus,
            firstSource,
            firstImpact,
          ),
          getEvidenceSortValue(
            second,
            evidenceSort.key,
            secondCreator,
            secondStatus,
            secondSource,
            secondImpact,
          ),
        );

        return applySortDirection(result, evidenceSort.direction);
      }),
    [creatorNameByMemberId, evidenceSort, reads, t],
  );
  const resolvedFocusedEvidenceId = useMemo(() => {
    if (
      focusedEvidenceId &&
      auditReads.some((read) => read.evidenceId === focusedEvidenceId)
    ) {
      return focusedEvidenceId;
    }

    if (!focusedReportTaskId) return focusedEvidenceId;

    return (
      auditReads.find(
        (read) =>
          read.reportTaskId === focusedReportTaskId &&
          read.evidenceId &&
          read.evidenceVerificationStatus === "rejected",
      )?.evidenceId ??
      auditReads.find(
        (read) => read.reportTaskId === focusedReportTaskId && read.evidenceId,
      )?.evidenceId ??
      focusedEvidenceId
    );
  }, [auditReads, focusedEvidenceId, focusedReportTaskId]);
  const summary = useMemo(
    () => buildEvidenceTrailSummary(auditReads),
    [auditReads],
  );
  const reviewCommand = buildEvidenceReviewCommand({ summary, t });
  const issueCountClassName = "border-slate-200 bg-white text-slate-500";
  const summaryItems = [
    {
      key: "included",
      label: t("evidence.summary.included"),
      value: summary.included,
      className: "border-slate-200 bg-slate-50 text-slate-700",
    },
    {
      key: "review",
      label: t("evidence.summary.review"),
      value: summary.pendingReview,
      className:
        summary.pendingReview > 0
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : issueCountClassName,
    },
    {
      key: "corrections",
      label: t("evidence.summary.corrections"),
      value: summary.corrections,
      className:
        summary.corrections > 0
          ? "border-red-200 bg-red-50 text-red-700"
          : issueCountClassName,
    },
    {
      key: "missing",
      label: t("evidence.summary.missing"),
      value: summary.missingProof,
      className:
        summary.missingProof > 0
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : issueCountClassName,
    },
  ];

  if (auditReads.length === 0) return null;

  return (
    <Card id="report-evidence-trail" data-testid="report-evidence-trail" className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-muted-foreground" />
          <CardTitle>{t("section.evidenceTrail")}</CardTitle>
        </div>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </CardHeader>
      <CardContent>
        <div
          data-testid="report-evidence-summary"
          className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                {t("evidence.summary.title")}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {t("evidence.summary.detail")}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {summaryItems.map((item) => (
              <div
                key={item.key}
                data-testid="report-evidence-summary-item"
                className={`rounded-lg border px-3 py-2 ${item.className}`}
              >
                <p className="font-mono text-sm font-medium leading-tight">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-tight">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          data-testid="report-evidence-command"
          className={`mb-4 overflow-hidden rounded-xl border ${
            reviewCommand.tone === "ready"
              ? "border-slate-200 bg-white"
              : "border-amber-200 bg-amber-50/60"
          }`}
        >
          <div
            data-testid="report-evidence-handoff-gate"
            data-report-handoff-state={reviewCommand.tone}
            className={`flex flex-col gap-3 border-b border-inherit p-4 sm:flex-row sm:items-center sm:justify-between ${
              reviewCommand.tone === "ready" ? "bg-slate-50/80" : "bg-white/70"
            }`}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {t("evidence.command.handoffLabel")}
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight text-slate-900">
                {reviewCommand.tone === "ready"
                  ? t("evidence.command.handoffReady")
                  : t("evidence.command.handoffHold")}
              </p>
            </div>
            <div
              data-testid="report-evidence-handoff-counts"
              className="flex flex-wrap gap-1.5 text-[11px] font-medium text-slate-600"
            >
              <span className="me-1 font-semibold uppercase tracking-[0.08em] text-slate-500">
                {t("evidence.command.countsLabel")}
              </span>
              {summaryItems.map((item) => (
                <span
                  key={item.key}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700"
                >
                  {item.value} {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px_230px]">
          <div
            data-testid="report-evidence-command-primary"
            className="border-b border-inherit p-4 md:border-b-0 md:border-e"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {t("evidence.command.title")}
            </p>
            <p className="mt-2 text-base font-semibold leading-tight text-slate-900">
              {reviewCommand.title}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {reviewCommand.detail}
            </p>
          </div>
          <div className="border-b border-inherit p-4 md:border-b-0 md:border-e">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {t("evidence.command.statusLabel")}
            </p>
            <p
              data-testid="report-evidence-command-status"
              className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                reviewCommand.tone === "ready"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-amber-200 bg-white text-amber-900"
              }`}
            >
              {reviewCommand.status}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {t("evidence.command.actionLabel")}
            </p>
            <p
              data-testid="report-evidence-command-action"
              className="mt-2 text-sm font-semibold leading-5 text-slate-900"
            >
              {reviewCommand.action}
            </p>
          </div>
          </div>
        </div>

        <div data-testid="report-evidence-mobile-list" className="space-y-2 md:hidden">
          {auditReads.map((read) => {
            const creatorName = creatorNameByMemberId.get(read.campaignMemberId) || "-";
            const status = getEvidenceStatusMeta(read, t);
            const source = getEvidenceSourceMeta(read, t);
            const impact = getEvidenceImpactMeta(read, t);
            const provenance = getEvidenceReviewProvenance(read, t, locale);
            const isFocused = read.evidenceId === resolvedFocusedEvidenceId;

            return (
              <div
                key={`${read.submissionId || read.campaignMemberId}:${read.platform || "unknown"}:${read.reportedAt}:${read.screenshotUrl || "missing-proof"}:mobile`}
                data-evidence-id={read.evidenceId ?? undefined}
                data-report-task-id={read.reportTaskId ?? undefined}
                data-focused={isFocused ? "true" : undefined}
                data-testid="report-evidence-mobile-row"
                className={`rounded-lg border p-3 ${
                  isFocused
                    ? "border-slate-900 bg-slate-50/80 shadow-[inset_3px_0_0_#0f172a]"
                    : "border-border/70 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {creatorName}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      {formatPlatformName(read.platform)} &middot; {formatShareDate(read.reportedAt, locale)}
                    </p>
                  </div>
                  <span
                    data-testid="report-evidence-status"
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="mt-3">
                  <span
                    data-testid="report-evidence-source"
                    className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${source.className}`}
                  >
                    {source.label}
                  </span>
                </div>
                <div className="mt-2">
                  <span
                    data-testid="report-evidence-impact"
                    className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${impact.className}`}
                  >
                    {impact.label}
                  </span>
                </div>
                <p
                  data-testid="report-evidence-review-provenance"
                  className={`mt-2 text-[11px] leading-tight ${provenance.className}`}
                >
                  {provenance.label}
                  {provenance.detail ? ` · ${provenance.detail}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <EvidenceProofAction
                    onOpenEvidence={onOpenEvidence}
                    read={read}
                    t={t}
                  />
                  <EvidenceReviewActions
                    canReview={canReview}
                    onRequestCorrection={onRequestCorrection}
                    onReviewEvidence={onReviewEvidence}
                    read={read}
                    reviewingId={reviewingId}
                    t={t}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-[1160px]">
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  activeSort={evidenceSort}
                  label={t("table.creator")}
                  onSort={handleEvidenceSort}
                  sortKey="creator"
                />
                <SortableTableHead
                  activeSort={evidenceSort}
                  label={t("table.platform")}
                  onSort={handleEvidenceSort}
                  sortKey="platform"
                />
                <SortableTableHead
                  activeSort={evidenceSort}
                  defaultDirection="desc"
                  label={t("table.reported")}
                  onSort={handleEvidenceSort}
                  sortKey="reported"
                />
                <SortableTableHead
                  activeSort={evidenceSort}
                  label={t("table.status")}
                  onSort={handleEvidenceSort}
                  sortKey="status"
                />
                <SortableTableHead
                  activeSort={evidenceSort}
                  label={t("table.source")}
                  onSort={handleEvidenceSort}
                  sortKey="source"
                />
                <SortableTableHead
                  activeSort={evidenceSort}
                  label={t("table.impact")}
                  onSort={handleEvidenceSort}
                  sortKey="impact"
                />
                <SortableTableHead
                  activeSort={evidenceSort}
                  defaultDirection="desc"
                  label={t("table.proof")}
                  onSort={handleEvidenceSort}
                  sortKey="proof"
                />
                <SortableTableHead
                  activeSort={evidenceSort}
                  label={t("table.review")}
                  onSort={handleEvidenceSort}
                  sortKey="review"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditReads.map((read) => {
                const status = getEvidenceStatusMeta(read, t);
                const source = getEvidenceSourceMeta(read, t);
                const impact = getEvidenceImpactMeta(read, t);
                const provenance = getEvidenceReviewProvenance(read, t, locale);
                const isFocused = read.evidenceId === resolvedFocusedEvidenceId;

                return (
                  <TableRow
                    key={`${read.submissionId || read.campaignMemberId}:${read.platform || "unknown"}:${read.reportedAt}:${read.screenshotUrl || "missing-proof"}`}
                    data-evidence-id={read.evidenceId ?? undefined}
                    data-report-task-id={read.reportTaskId ?? undefined}
                    data-focused={isFocused ? "true" : undefined}
                    className={isFocused ? "bg-slate-50/80 shadow-[inset_3px_0_0_#0f172a]" : undefined}
                  >
                    <TableCell className="font-medium">
                      {creatorNameByMemberId.get(read.campaignMemberId) || "-"}
                      {isFocused && (
                        <span data-testid="report-evidence-focused-row" className="sr-only">
                          Focused proof
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatPlatformName(read.platform)}</TableCell>
                    <TableCell>{formatShareDate(read.reportedAt, locale)}</TableCell>
                    <TableCell>
                      <span
                        data-testid="report-evidence-status"
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        data-testid="report-evidence-source"
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${source.className}`}
                      >
                        {source.label}
                      </span>
                    </TableCell>
                    <TableCell data-testid="report-evidence-impact-cell">
                      <div className="space-y-1.5">
                        <span
                          data-testid="report-evidence-impact"
                          className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${impact.className}`}
                        >
                          {impact.label}
                        </span>
                        <p
                          data-testid="report-evidence-review-provenance"
                          className={`text-[11px] leading-tight ${provenance.className}`}
                        >
                          {provenance.label}
                          {provenance.detail ? ` · ${provenance.detail}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="w-[112px]" data-testid="report-evidence-proof-cell">
                      <div className="flex items-center justify-start">
                        <EvidenceProofAction
                          onOpenEvidence={onOpenEvidence}
                          read={read}
                          t={t}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="w-[230px]" data-testid="report-evidence-review-cell">
                      <div className="space-y-1.5">
                        <EvidenceReviewActions
                          canReview={canReview}
                          onRequestCorrection={onRequestCorrection}
                          onReviewEvidence={onReviewEvidence}
                          read={read}
                          reviewingId={reviewingId}
                          t={t}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportRecommendations({
  recommendations,
  t,
}: {
  recommendations: ReportRecommendation[];
  t: ReportTranslation;
}) {
  if (recommendations.length === 0) return null;

  return (
    <section
      aria-label={t("section.recommendations")}
      className="mb-8"
      data-testid="report-recommendations"
    >
      <div className="mb-3 flex items-center gap-2">
        <BadgeCheck className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          {t("section.recommendations")}
        </h2>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.key}
            data-testid="report-recommendation-card"
            className="grid min-h-[112px] grid-rows-[1.25rem_auto_1fr] rounded-xl border border-border/70 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {recommendation.title}
            </p>
            <p className="self-end truncate text-lg font-semibold text-foreground">
              {recommendation.value}
            </p>
            <p className="self-end text-xs leading-5 text-muted-foreground">
              {recommendation.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CampaignReportPage() {
  const { t } = useTranslation("brand.report");
  const { locale } = useI18n();
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const focusedEvidenceId = searchParams.get("evidence");
  const focusedReportTaskId = searchParams.get("reportTask");

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [campaignCoverAsset, setCampaignCoverAsset] =
    useState<CampaignCreativeAsset | null>(null);
  const [performers, setPerformers] = useState<MemberPerformance[]>([]);
  const [reportReads, setReportReads] = useState<EvidenceReportRead[]>([]);
  const [reportingPlatformLabels, setReportingPlatformLabels] = useState<Map<string, string>>(
    new Map(),
  );
  const [reportTasks, setReportTasks] = useState<CampaignReportTask[]>([]);
  const [memberRates, setMemberRates] = useState<Map<string, number>>(new Map());
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedMetricKey, setSelectedMetricKey] = useState<ReportMetricKey>("views");
  const [selectedReportBlockIds, setSelectedReportBlockIds] = useState<ReportBuilderBlockId[]>(
    REPORT_BUILDER_DEFAULT_BLOCK_IDS,
  );
  const [selectedReportPresetId, setSelectedReportPresetId] =
    useState<ReportBuilderPresetSelectionId>(REPORT_BUILDER_DEFAULT_PRESET_ID);
  const [selectedReportChartModeId, setSelectedReportChartModeId] =
    useState<ReportBuilderChartModeId>("comparison");
  const [selectedReportPresentation, setSelectedReportPresentation] =
    useState<ReportBuilderPresentation>(REPORT_BUILDER_DEFAULT_PRESENTATION);
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState<string | null>(null);
  const [reportTemplates, setReportTemplates] = useState<ReportCompositionTemplateSummary[]>([]);
  const [defaultReportTemplateApplied, setDefaultReportTemplateApplied] = useState(false);
  const [campaignReportGoalApplied, setCampaignReportGoalApplied] = useState(false);
  const [campaignReportGoalSaving, setCampaignReportGoalSaving] = useState(false);
  const [campaignReportGoalSaved, setCampaignReportGoalSaved] = useState(false);
  const [campaignReportGoalError, setCampaignReportGoalError] = useState<string | null>(null);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSetDefault, setTemplateSetDefault] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [performerSort, setPerformerSort] = useState<SortState<PerformerSortKey>>({
    key: "views",
    direction: "desc",
  });
  const [loading, setLoading] = useState(true);
  const [reportReloadKey, setReportReloadKey] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLinks, setShareLinks] = useState<ReportShareLinkSummary[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [shareCreating, setShareCreating] = useState(false);
  const [shareRevokingId, setShareRevokingId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ReportExportJobFormat | null>(null);
  const [evidenceOpenError, setEvidenceOpenError] = useState<string | null>(null);
  const [evidenceReviewError, setEvidenceReviewError] = useState<string | null>(null);
  const [evidenceReviewingId, setEvidenceReviewingId] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<EvidenceReportRead | null>(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionInputError, setCorrectionInputError] = useState<string | null>(null);
  const [currentBrandRole, setCurrentBrandRole] = useState<BrandTeamRole | null>(null);
  const canShareReports = hasBrandWorkspacePermission(
    currentBrandRole,
    "share_reports",
  );
  const canReviewReportEvidence = hasBrandWorkspacePermission(
    currentBrandRole,
    "review_content",
  );
  const shareErrorMessage = t("share.error");
  const shareCopyErrorMessage = t("share.copyError");
  const exportErrorMessage = t("export.error");
  const evidenceOpenErrorMessage = t("evidence.openError");
  const evidenceReviewErrorMessage = t("evidence.reviewError");
  const correctionReasonRequiredMessage = t("evidence.reasonRequired");

  const isReportBlockSelected = useCallback(
    (blockId: ReportBuilderBlockId) =>
      isReportBuilderBlockSelected(selectedReportBlockIds, blockId),
    [selectedReportBlockIds],
  );

  const markCampaignReportGoalDirty = useCallback(() => {
    setCampaignReportGoalSaved(false);
    setCampaignReportGoalError(null);
  }, []);

  const toggleReportBlock = useCallback((blockId: ReportBuilderBlockId) => {
    const block = REPORT_BUILDER_BLOCKS.find((item) => item.id === blockId);
    if (block?.required) return;

    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(null);
    setSelectedReportPresetId("custom");
    setSelectedReportBlockIds((current) =>
      normalizeReportCompositionSelection({
        presetId: "custom",
        chartModeId: selectedReportChartModeId,
        blockIds: current.includes(blockId)
          ? current.filter((id) => id !== blockId)
          : [...current, blockId],
      }).blockIds,
    );
  }, [markCampaignReportGoalDirty, selectedReportChartModeId]);

  const selectReportPreset = useCallback((presetId: ReportBuilderPresetId) => {
    const preset = REPORT_BUILDER_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(null);
    setSelectedReportPresetId(presetId);
    setSelectedReportChartModeId(preset.chartModeId);
    setSelectedReportBlockIds(getReportBuilderPresetBlockIds(presetId));
  }, [markCampaignReportGoalDirty]);

  const selectReportChartMode = useCallback((chartModeId: ReportBuilderChartModeId) => {
    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(null);
    setSelectedReportChartModeId(chartModeId);
    setSelectedReportBlockIds((current) =>
      normalizeReportCompositionSelection({
        presetId: "custom",
        chartModeId,
        blockIds: current,
      }).blockIds,
    );
    setSelectedReportPresetId((current) => {
      if (current === "custom") return current;

      const preset = REPORT_BUILDER_PRESETS.find((item) => item.id === current);
      return preset?.chartModeId === chartModeId ? current : "custom";
    });
  }, [markCampaignReportGoalDirty]);

  const selectReportPresentation = useCallback((presentation: ReportBuilderPresentation) => {
    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(null);
    const normalized = normalizeReportBuilderPresentation(presentation);
    setSelectedReportPresentation(normalized);
    if (normalized.chartMetricKey) {
      setSelectedMetricKey(normalized.chartMetricKey);
    }
  }, [markCampaignReportGoalDirty]);

  const selectReportChartMetric = useCallback((metricKey: ReportBuilderChartMetricKey) => {
    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(null);
    setSelectedMetricKey(metricKey);
    setSelectedReportPresentation((current) =>
      normalizeReportBuilderPresentation({
        ...current,
        chartMetricKey: metricKey,
      }),
    );
  }, [markCampaignReportGoalDirty]);

  const selectLiveReportMetric = useCallback((metricKey: ReportMetricKey) => {
    setSelectedMetricKey(metricKey);

    if (!isReportBuilderChartMetricKey(metricKey)) return;

    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(null);
    setSelectedReportPresentation((current) =>
      normalizeReportBuilderPresentation({
        ...current,
        chartMetricKey: metricKey,
      }),
    );
  }, [markCampaignReportGoalDirty]);

  const moveReportBlock = useCallback((
    blockId: ReportBuilderBlockId,
    direction: "earlier" | "later",
  ) => {
    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(null);
    setSelectedReportBlockIds((current) =>
      moveReportBuilderBlockSelection(current, blockId, direction),
    );
  }, [markCampaignReportGoalDirty]);

  const applyReportTemplate = useCallback((template: ReportCompositionTemplateSummary) => {
    markCampaignReportGoalDirty();
    setSelectedReportTemplateId(template.id);
    setSelectedReportPresetId(template.presetId);
    setSelectedReportChartModeId(template.chartModeId);
    setSelectedReportBlockIds(
      normalizeReportCompositionSelection({
        presetId: template.presetId,
        chartModeId: template.chartModeId,
        blockIds: template.blockIds,
        presentation: template.presentation,
      }).blockIds,
    );
    const presentation = normalizeReportBuilderPresentation(template.presentation);
    setSelectedReportPresentation(presentation);
    if (presentation.chartMetricKey) {
      setSelectedMetricKey(presentation.chartMetricKey);
    }
  }, [markCampaignReportGoalDirty]);

  const refreshReportTemplates = useCallback(async () => {
    if (!canShareReports) return;

    try {
      const templates = await listReportCompositionTemplates();
      setReportTemplates(templates);

      if (!defaultReportTemplateApplied && !campaignReportGoalApplied) {
        const defaultTemplate = templates.find((template) => template.isDefault);
        if (defaultTemplate) applyReportTemplate(defaultTemplate);
        setDefaultReportTemplateApplied(true);
      }
    } catch {
      setReportTemplates([]);
    }
  }, [
    applyReportTemplate,
    canShareReports,
    campaignReportGoalApplied,
    defaultReportTemplateApplied,
  ]);

  useEffect(() => {
    void refreshReportTemplates();
  }, [refreshReportTemplates]);

  const openSaveTemplateDialog = useCallback(() => {
    const activePreset = REPORT_BUILDER_PRESETS.find(
      (preset) => preset.id === selectedReportPresetId,
    );
    const activeTemplate = reportTemplates.find(
      (template) => template.id === selectedReportTemplateId,
    );

    setTemplateName(
      activeTemplate?.name || `${activePreset?.title ?? "Custom"} team template`,
    );
    setTemplateDescription(activeTemplate?.description ?? "");
    setTemplateSetDefault(reportTemplates.length === 0);
    setTemplateError(null);
    setSaveTemplateDialogOpen(true);
  }, [reportTemplates, selectedReportPresetId, selectedReportTemplateId]);

  const saveReportTemplateFromBuilder = useCallback(async () => {
    setTemplateSaving(true);
    setTemplateError(null);

    try {
      const saved = await saveReportCompositionTemplate({
        name: templateName,
        description: templateDescription,
        presetId: selectedReportPresetId,
        chartModeId: selectedReportChartModeId,
        blockIds: selectedReportBlockIds,
        presentation: selectedReportPresentation,
        setDefault: templateSetDefault,
      });

      setSaveTemplateDialogOpen(false);
      setReportTemplates((current) => [
        saved,
        ...current
          .filter((template) => template.id !== saved.id)
          .map((template) =>
            saved.isDefault ? { ...template, isDefault: false } : template,
          ),
      ]);
      applyReportTemplate(saved);
      toast.success(t("builder.saveTemplate.saved"));
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : t("builder.saveTemplate.error"),
      );
    } finally {
      setTemplateSaving(false);
    }
  }, [
    applyReportTemplate,
    selectedReportBlockIds,
    selectedReportChartModeId,
    selectedReportPresentation,
    selectedReportPresetId,
    t,
    templateDescription,
    templateName,
    templateSetDefault,
  ]);

  const saveCampaignReportGoalFromBuilder = useCallback(async () => {
    setCampaignReportGoalSaving(true);
    setCampaignReportGoalError(null);

    try {
      const saved = await saveCampaignReportComposition({
        campaignId,
        templateId: selectedReportTemplateId,
        presetId: selectedReportPresetId,
        chartModeId: selectedReportChartModeId,
        blockIds: selectedReportBlockIds,
        presentation: selectedReportPresentation,
      });

      setSelectedReportTemplateId(saved.templateId);
      setSelectedReportPresetId(saved.presetId);
      setSelectedReportChartModeId(saved.chartModeId);
      setSelectedReportBlockIds(saved.blockIds);
      setSelectedReportPresentation(saved.presentation);
      setCampaignReportGoalApplied(true);
      setDefaultReportTemplateApplied(true);
      setCampaignReportGoalSaved(true);
      toast.success(t("builder.saveCampaign.saved"));
    } catch (error) {
      setCampaignReportGoalError(
        error instanceof Error ? error.message : t("builder.saveCampaign.error"),
      );
    } finally {
      setCampaignReportGoalSaving(false);
    }
  }, [
    campaignId,
    selectedReportBlockIds,
    selectedReportChartModeId,
    selectedReportPresentation,
    selectedReportPresetId,
    selectedReportTemplateId,
    t,
  ]);

  const trustedReportReads = useMemo(() => getAcceptedReportReads(reportReads), [reportReads]);
  const availableReportPlatforms = useMemo(
    () => getAvailableReportPlatforms(trustedReportReads),
    [trustedReportReads],
  );
  const configuredCampaignPlatforms = useMemo(
    () => (campaign ? campaign.platforms ?? [] : []),
    [campaign],
  );
  const { campaignPlatforms: campaignChannelPlatforms, proofSourcePlatforms } = useMemo(
    () =>
      partitionReportPlatforms({
        availablePlatforms: availableReportPlatforms,
        campaignPlatforms: configuredCampaignPlatforms,
      }),
    [availableReportPlatforms, configuredCampaignPlatforms],
  );
  const campaignChannelReads = useMemo(
    () =>
      trustedReportReads.filter(
        (read) => read.platform && campaignChannelPlatforms.includes(read.platform),
      ),
    [campaignChannelPlatforms, trustedReportReads],
  );

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadCampaignCoverAsset() {
      const { data: campaignAssets } = await supabase
        .from("campaign_assets")
        .select(
          "id, campaign_id, title, description, asset_type, bucket_id, storage_path, file_name, mime_type, size_bytes, visibility, status, created_at",
        )
        .eq("campaign_id", campaignId)
        .neq("status", "archived")
        .order("created_at", { ascending: false });

      if (!active) return;

      const assetRows = (campaignAssets ?? []) as CampaignAssetRecord[];
      const assetPaths = assetRows.map((asset) => asset.storage_path);
      const signedAssetUrls =
        assetPaths.length > 0
          ? await supabase.storage
              .from("campaign-assets")
              .createSignedUrls(assetPaths, 600)
          : { data: [] };

      if (!active) return;

      const creativeAssets = assetRows.map((asset, index) =>
        mapCampaignAssetRow(
          asset,
          signedAssetUrls.data?.[index]?.signedUrl ?? null,
        ),
      );

      setCampaignCoverAsset(pickCreatorFacingHeroAsset(creativeAssets));
    }

    void loadCampaignCoverAsset();

    return () => {
      active = false;
    };
  }, [campaignId]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadReport() {
      const { data: camp } = await supabase
        .from("campaigns")
        .select("id, title, platforms, total_spend, posting_window_start, posting_window_end, report_data")
        .eq("id", campaignId)
        .single();

      if (!active) return;
      if (camp) setCampaign(camp as CampaignRow);

      const { data: reportPlan } = await supabase
        .from("campaign_reporting_plans")
        .select("report_template_id, report_preset_id, report_chart_mode_id, report_block_ids, report_presentation")
        .eq("campaign_id", campaignId)
        .maybeSingle();

      if (!active) return;
      if (reportPlan && !campaignReportGoalApplied) {
        const plan = reportPlan as CampaignReportPlanGoalRow;
        const selection = normalizeReportCompositionSelection({
          presetId: plan.report_preset_id,
          chartModeId: plan.report_chart_mode_id,
          blockIds: plan.report_block_ids,
          presentation: plan.report_presentation,
        });

        setSelectedReportTemplateId(plan.report_template_id ?? null);
        setSelectedReportPresetId(selection.presetId);
        setSelectedReportChartModeId(selection.chartModeId);
        setSelectedReportBlockIds(selection.blockIds);
        setSelectedReportPresentation(selection.presentation);
        if (selection.presentation.chartMetricKey) {
          setSelectedMetricKey(selection.presentation.chartMetricKey);
        }
        setCampaignReportGoalApplied(true);
        setDefaultReportTemplateApplied(true);
        setCampaignReportGoalSaved(true);
        setCampaignReportGoalError(null);
      }

      const { data: members } = await supabase
        .from("campaign_members")
        .select(
          `id, accepted_rate, creator_id,
           profiles!campaign_members_creator_id_fkey ( full_name, avatar_url )`,
        )
        .eq("campaign_id", campaignId);

      const { data: tasks } = await supabase
        .from("campaign_report_tasks")
        .select("id, due_at, status, submitted_at")
        .eq("campaign_id", campaignId);
      const { data: reportingRequirements } = await supabase
        .from("campaign_reporting_requirements")
        .select("platform, platform_label")
        .eq("campaign_id", campaignId);

      if (!active) return;
      setReportingPlatformLabels(
        new Map(
          (reportingRequirements || [])
            .filter((row) => row.platform && row.platform_label)
            .map((row) => [row.platform as string, row.platform_label as string]),
        ),
      );
      const reportTaskById = new Map(
        (tasks || []).map((task: Record<string, string | null>) => [
          task.id,
          {
            id: task.id,
            dueAt: task.due_at,
            status: task.status,
            submittedAt: task.submitted_at,
          },
        ]),
      );
      setReportTasks(
        (tasks || []).map((task: Record<string, string | null>) => ({
          id: task.id,
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
                   id,
                   report_task_id,
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
                 content_performance_metric_values (
                   platform,
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

        const evidenceByPerformanceId = new Map<
          string,
          {
            id: string;
            ai_extraction_status: PerformanceAiExtractionStatus | null;
            verification_status: PerformanceEvidenceVerificationStatus | null;
            review_note: string | null;
            reviewed_by: string | null;
            reviewed_at: string | null;
            created_at: string;
          }
        >();

        if (submissions) {
          const performanceIds = submissions.flatMap((sub) => {
            const performanceRows = Array.isArray(sub.content_performance)
              ? sub.content_performance
              : sub.content_performance
                ? [sub.content_performance]
                : [];

            return performanceRows
              .map((row) => (row as Record<string, unknown>).id as string | null)
              .filter(Boolean) as string[];
          });

          if (performanceIds.length > 0) {
            const { data: evidences } = await supabase
              .from("content_performance_evidence")
              .select("id, performance_id, verification_status, review_note, reviewed_by, reviewed_at, created_at")
              .in("performance_id", performanceIds)
              .order("created_at", { ascending: false });

            for (const evidence of evidences || []) {
              if (
                evidence.performance_id &&
                !evidenceByPerformanceId.has(evidence.performance_id)
              ) {
                evidenceByPerformanceId.set(evidence.performance_id, {
                  id: evidence.id,
                  ai_extraction_status: null,
                  verification_status:
                    evidence.verification_status as PerformanceEvidenceVerificationStatus | null,
                  review_note: evidence.review_note,
                  reviewed_by: evidence.reviewed_by,
                  reviewed_at: evidence.reviewed_at,
                  created_at: evidence.created_at,
                });
              }
            }

            const evidenceIds = Array.from(evidenceByPerformanceId.values())
              .map((evidence) => evidence.id)
              .filter(Boolean);

            if (evidenceIds.length > 0) {
              const { data: aiExtractions } = await supabase
                .from("content_performance_ai_extractions")
                .select("evidence_id, status, created_at")
                .in("evidence_id", evidenceIds)
                .order("created_at", { ascending: false });

              const aiStatusByEvidenceId = new Map<
                string,
                PerformanceAiExtractionStatus
              >();

              for (const extraction of aiExtractions || []) {
                const evidenceId = extraction.evidence_id;
                if (evidenceId && !aiStatusByEvidenceId.has(evidenceId)) {
                  aiStatusByEvidenceId.set(
                    evidenceId,
                    extraction.status as PerformanceAiExtractionStatus,
                  );
                }
              }

              for (const evidence of evidenceByPerformanceId.values()) {
                evidence.ai_extraction_status =
                  aiStatusByEvidenceId.get(evidence.id) ?? null;
              }
            }
          }
        }

        const reads: EvidenceReportRead[] = [];

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
              const performanceId = row.id as string | null;
              const evidence = performanceId
                ? evidenceByPerformanceId.get(performanceId)
                : null;
              const reportTaskId = row.report_task_id as string | null;
              const reportTask = reportTaskId
                ? reportTaskById.get(reportTaskId)
                : null;
              const reportedAt = (row.reported_at as string | null) || new Date().toISOString();
              const metricValues = Array.isArray(row.content_performance_metric_values)
                ? row.content_performance_metric_values
                : [];

              const read: EvidenceReportRead = {
                campaignMemberId: memberId,
                submissionId,
                reportTaskId,
                performanceId,
                platform,
                reportedAt,
                views: row.views as number | null,
                likes: row.likes as number | null,
                comments: row.comments as number | null,
                shares: row.shares as number | null,
                saves: row.saves as number | null,
                clicks: row.clicks as number | null,
                screenshotUrl: row.screenshot_url as string | null,
                evidenceId: evidence?.id ?? null,
                aiExtractionStatus: evidence?.ai_extraction_status ?? null,
                evidenceVerificationStatus: evidence?.verification_status ?? null,
                evidenceReviewNote: evidence?.review_note ?? null,
                evidenceReviewedAt: evidence?.reviewed_at ?? null,
                evidenceReviewedBy: evidence?.reviewed_by ?? null,
                reportTaskDueAt: reportTask?.dueAt ?? null,
                reportTaskStatus: reportTask?.status ?? null,
                reportTaskSubmittedAt: reportTask?.submittedAt ?? null,
                verificationStatus: row.verification_status as string | null,
                sourceType: getMetricValueSourceType(metricValues),
              };

              reads.push(...expandReportReadByMetricPlatforms(read, metricValues));
            }
          }
        }

        if (!active) return;
        setReportReads(reads);
        setPerformers(buildMemberPerformanceRows({
          creatorProfiles: cpMap,
          members: members as Record<string, unknown>[],
          reads,
        }));
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
  }, [campaignId, campaignReportGoalApplied, reportReloadKey]);

  useEffect(() => {
    let active = true;

    async function loadTeamSettings() {
      try {
        const teamSettings = await getBrandTeamSettings();
        if (active) setCurrentBrandRole(teamSettings.currentUserRole);
      } catch {
        if (active) setCurrentBrandRole(null);
      }
    }

    void loadTeamSettings();

    return () => {
      active = false;
    };
  }, []);

  const refreshShareLinks = useCallback(async () => {
    if (!canShareReports) return;
    setShareError(null);

    try {
      const links = await listReportShareLinks(campaignId);
      setShareLinks(links);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : shareErrorMessage);
    }
  }, [campaignId, canShareReports, shareErrorMessage]);

  useEffect(() => {
    if (!shareDialogOpen) return;

    void refreshShareLinks();
  }, [refreshShareLinks, shareDialogOpen]);

  const handleCreateShareLink = useCallback(async () => {
    if (!canShareReports) return;
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
  }, [campaignId, canShareReports, shareErrorMessage]);

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
      if (!canShareReports) return;
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
    [campaignId, canShareReports, shareErrorMessage],
  );

  const handleDurableReportExport = useCallback(
    async (format: ReportExportJobFormat) => {
      if (!canShareReports) return;

      setExportingFormat(format);

      try {
        const exported = await requestReportExport({
          blockIds: selectedReportBlockIds,
          campaignId,
          chartModeId: selectedReportChartModeId,
          format,
          presentation: selectedReportPresentation,
          presetId: selectedReportPresetId,
          templateId: selectedReportTemplateId,
        });
        const link = document.createElement("a");
        link.href = exported.signedUrl;
        link.download = exported.fileName;
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : exportErrorMessage);
      } finally {
        setExportingFormat(null);
      }
    },
    [
      campaignId,
      canShareReports,
      exportErrorMessage,
      selectedReportBlockIds,
      selectedReportChartModeId,
      selectedReportPresentation,
      selectedReportPresetId,
      selectedReportTemplateId,
    ],
  );

  const handleOpenEvidence = useCallback(
    async (read: EvidenceReportRead) => {
      setEvidenceOpenError(null);

      const reference = parseEvidenceStorageReference(read.screenshotUrl);
      if (reference) {
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from(reference.bucket)
          .createSignedUrl(reference.path, 300);

        if (error || !data?.signedUrl) {
          setEvidenceOpenError(evidenceOpenErrorMessage);
          return;
        }

        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const externalUrl = getExternalEvidenceUrl(read.screenshotUrl);
      if (!externalUrl) {
        setEvidenceOpenError(evidenceOpenErrorMessage);
        return;
      }

      window.open(externalUrl, "_blank", "noopener,noreferrer");
    },
    [evidenceOpenErrorMessage],
  );

  const handleReviewEvidence = useCallback(
    async (
      read: EvidenceReportRead,
      decision: PerformanceEvidenceReviewDecision,
      correctionNote?: string,
    ): Promise<boolean> => {
      if (!canReviewReportEvidence) return false;
      const reviewTargetId = getEvidenceReviewTargetId(read);
      if (!reviewTargetId) return false;

      setEvidenceReviewingId(reviewTargetId);
      setEvidenceReviewError(null);

      try {
        if (read.evidenceId) {
          await reviewPerformanceEvidence({
            evidenceId: read.evidenceId,
            decision,
            correctionNote,
          });
        } else if (read.performanceId && getExternalEvidenceUrl(read.screenshotUrl)) {
          await reviewPerformanceProofLink({
            performanceId: read.performanceId,
            decision,
            correctionNote,
          });
        } else {
          return false;
        }

        setReportReloadKey((current) => current + 1);
        return true;
      } catch {
        setEvidenceReviewError(evidenceReviewErrorMessage);
        return false;
      } finally {
        setEvidenceReviewingId(null);
      }
    },
    [canReviewReportEvidence, evidenceReviewErrorMessage],
  );

  const openCorrectionDialog = useCallback((read: EvidenceReportRead) => {
    if (!canReviewReportEvidence) return;
    setCorrectionTarget(read);
    setCorrectionNote(read.evidenceReviewNote?.trim() ?? "");
    setCorrectionInputError(null);
    setEvidenceReviewError(null);
  }, [canReviewReportEvidence]);

  const handleCorrectionDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      const correctionTargetId = correctionTarget
        ? getEvidenceReviewTargetId(correctionTarget)
        : null;
      if (correctionTargetId && evidenceReviewingId === correctionTargetId) {
        return;
      }

      setCorrectionTarget(null);
      setCorrectionNote("");
      setCorrectionInputError(null);
    },
    [correctionTarget, evidenceReviewingId],
  );

  const handleSubmitCorrection = useCallback(async () => {
    if (!correctionTarget) return;

    const nextCorrectionNote = correctionNote.trim();
    if (!nextCorrectionNote) {
      setCorrectionInputError(correctionReasonRequiredMessage);
      return;
    }

    setCorrectionInputError(null);
    const saved = await handleReviewEvidence(
      correctionTarget,
      "needs_revision",
      nextCorrectionNote,
    );

    if (saved) {
      setCorrectionTarget(null);
      setCorrectionNote("");
    }
  }, [
    correctionNote,
    correctionReasonRequiredMessage,
    correctionTarget,
    handleReviewEvidence,
  ]);

  const activePlatform = selectedPlatform === "all" || !campaignChannelPlatforms.includes(selectedPlatform)
    ? "all"
    : selectedPlatform;
  const isAllChannels = activePlatform === "all";
  const hasPlatformData = !isAllChannels && campaignChannelPlatforms.includes(activePlatform);

  const platformMetricItems = useMemo(
    () =>
      campaignChannelPlatforms.map((platform) => ({
        platform,
        metrics: buildPlatformReportMetrics({
          reads: campaignChannelReads,
          memberRates,
          platform,
        }),
      })),
    [campaignChannelPlatforms, campaignChannelReads, memberRates],
  );

  const allPlatformMetrics = useMemo(
    () => buildAllPlatformReportMetrics({ reads: campaignChannelReads, memberRates }),
    [campaignChannelReads, memberRates],
  );

  const proofSourceMetricItems = useMemo(
    () =>
      proofSourcePlatforms.map((platform) => ({
        platform,
        metrics: buildPlatformReportMetrics({
          reads: trustedReportReads,
          memberRates,
          platform,
        }),
      })),
    [memberRates, proofSourcePlatforms, trustedReportReads],
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
  const proofRoomScaleReadiness = useMemo(
    () => buildProofRoomScaleReadiness(evidenceMetric),
    [evidenceMetric],
  );
  const handlePerformerSort = useCallback(
    (key: PerformerSortKey, defaultDirection: SortDirection) => {
      setPerformerSort((current) =>
        getNextSortState(current, key, defaultDirection),
      );
    },
    [],
  );
  const sortedPerformers = useMemo(
    () =>
      performers.toSorted((first, second) => {
        const result = compareSortValues(
          getPerformerSortValue(first, performerSort.key, locale),
          getPerformerSortValue(second, performerSort.key, locale),
        );

        return applySortDirection(result, performerSort.direction);
      }),
    [locale, performerSort, performers],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-7 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
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

  if (!campaign) {
    return (
      <div
        data-testid="campaign-report-unavailable"
        className="mx-auto flex min-h-[calc(100svh-96px)] max-w-3xl items-center px-4 py-10 sm:px-6 lg:px-8"
      >
        <Card className="w-full border-border/60 shadow-sm">
          <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
            <Link
              href="/b/campaigns"
              className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t("unavailable.cta")}
            </Link>
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-slate-50 text-muted-foreground">
                <FileText className="size-5" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {t("unavailable.title")}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  {t("unavailable.body")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const readDetail = isAllChannels
    ? formatLiveReportChannelCount(campaignChannelPlatforms.length, t)
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
  const recommendations = buildReportRecommendations({
    allPlatformMetrics,
    locale,
    performers,
    platformMetricItems,
    t,
  });
  const compactDateRangeLabel = formatCompactDateRange({
    start: campaign.posting_window_start,
    end: campaign.posting_window_end,
    t,
  });
  const allReportCards = buildReportMetricConfigs({
    metrics: allPlatformMetrics,
    completionMetric,
    locale,
    t,
    readDetail: formatLiveReportChannelCount(campaignChannelPlatforms.length, t),
    completionDetail,
    platformDetail: t("filter.allChannels"),
  });
  const exportSections = [
    {
      title: t("filter.allChannels"),
      detail: t("chart.allChannelsDetail"),
      sourceGroup: "campaign_channel" as const,
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
        sourceGroup: "campaign_channel" as const,
        metrics: platformCards.filter((metric) => metric.key !== "reports").map(toExportMetric),
      };
    }),
    ...proofSourceMetricItems.map((item) => {
      const sourceCards = buildReportMetricConfigs({
        metrics: item.metrics,
        completionMetric,
        locale,
        t,
        readDetail: item.metrics.readCount === 1
          ? t("metric.read")
          : t("metric.reads", { count: String(item.metrics.readCount) }),
        completionDetail,
        platformDetail: formatReportSourceName(item.platform, reportingPlatformLabels),
      });

      return {
        title: formatReportSourceName(item.platform, reportingPlatformLabels),
        detail: t("proofSources.exportDetail"),
        sourceGroup: "proof_source" as const,
        metrics: sourceCards
          .filter((metric) => metric.key !== "reports" && metric.key !== "cpe")
          .map(toExportMetric),
      };
    }),
  ];
  const creatorExportRows = sortedPerformers.map((creator) => ({
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
  const selectedReportTemplate = reportTemplates.find(
    (template) => template.id === selectedReportTemplateId,
  );
  const selectedReportPreset = REPORT_BUILDER_PRESETS.find(
    (preset) => preset.id === selectedReportPresetId,
  );
  const selectedReportChartMode = REPORT_BUILDER_CHART_MODES.find(
    (mode) => mode.id === selectedReportChartModeId,
  );
  const selectedReportOutputTitle = selectedReportPreset
    ? t(selectedReportPreset.titleKey)
    : t("builder.preset.custom.title");
  const selectedReportBestFor = selectedReportPreset
    ? t(selectedReportPreset.bestForKey)
    : t(REPORT_BUILDER_CUSTOM_PRESET.bestForKey);
  const selectedReportDefaultExecutiveQuestion = selectedReportPreset
    ? t(selectedReportPreset.executiveQuestionKey)
    : t(REPORT_BUILDER_CUSTOM_PRESET.executiveQuestionKey);
  const selectedReportExecutiveQuestion =
    selectedReportPresentation.executiveQuestion?.trim() ||
    selectedReportDefaultExecutiveQuestion;
  const selectedReportDisplayTitle =
    selectedReportPresentation.headline?.trim() ||
    t("titleForCampaign", { title: campaign.title });
  const selectedReportChartModeLabel = selectedReportChartMode
    ? t(selectedReportChartMode.titleKey)
    : t("builder.chartMode.comparison.title");
  const selectedReportChartLayoutTitle = selectedReportChartMode
    ? t(selectedReportChartMode.layoutTitleKey)
    : t("builder.chartMode.comparison.layoutTitle");
  const selectedReportChartLayoutDetail = selectedReportChartMode
    ? t(selectedReportChartMode.layoutDetailKey)
    : t("builder.chartMode.comparison.layoutDetail");
  const selectedReportPresentationLabel = [
    selectedReportPresentation.coverMode === "proof_room"
      ? t("builder.presentation.cover.proofRoom")
      : t("builder.presentation.cover.campaignVisual"),
    selectedReportPresentation.typography === "compact"
      ? t("builder.presentation.typography.compact")
      : t("builder.presentation.typography.quiet"),
    selectedReportPresentation.density === "compact"
      ? t("builder.presentation.density.compact")
      : t("builder.presentation.density.editorial"),
  ].join(" / ");
  const selectedReportChartMetricKey =
    selectedReportPresentation.chartMetricKey ??
    (isReportBuilderChartMetricKey(selectedMetricKey) ? selectedMetricKey : "views");
  const selectedReportChartMetricLabel =
    reportCards.find((card) => card.key === selectedReportChartMetricKey)?.label ??
    t("kpi.views");
  const selectedReportBlockLabels = selectedReportBlockIds.map((blockId) => {
    const block = REPORT_BUILDER_BLOCKS.find((item) => item.id === blockId);
    return (
      selectedReportPresentation.sectionLabels?.[blockId]?.trim() ||
      (block ? t(block.titleKey) : blockId)
    );
  });
  const reportTrustItems = buildReportTrustExportItems({
    evidence: evidenceMetric,
    t,
  });
  const reportProofReview = buildReportProofReviewProvenance({
    reviewedAt: evidenceMetric.latestReviewedAt,
    reviewerRecorded: evidenceMetric.reviewerRecorded,
  });
  const metricTileOptions = reportCards.map((card) => ({
    id: card.key,
    label: card.label,
    detail: card.detail,
  }));
  const trustTileOptions = reportTrustItems.map((item) => ({
    id: item.key ?? item.label,
    label: item.label,
    detail: item.detail,
  }));
  const visibleReportCards = applyReportTileLabels(
    filterReportItemsByTileIds(
      reportCards,
      selectedReportPresentation.kpiIds,
    ),
    selectedReportPresentation.kpiLabels,
  );
  const visibleReportTrustItems = applyReportTileLabels(
    filterReportItemsByTileIds(
      reportTrustItems,
      selectedReportPresentation.trustIds,
    ),
    selectedReportPresentation.trustLabels,
  );
  const selectedReportCoverMetrics = [
    ...visibleReportCards.slice(0, 2).map((card) => ({
      detail: card.detail,
      key: card.key,
      label: card.label,
      source: "kpi" as const,
      value: card.value,
    })),
    ...visibleReportTrustItems.slice(0, 1).map((item) => ({
      detail: item.detail,
      key: item.key ?? item.label,
      label: item.label,
      source: "trust" as const,
      value: item.value,
    })),
  ] satisfies ReportExecutiveCoverMetric[];
  const selectedReportMetricTileLabel = formatReportTileLabelList(visibleReportCards);
  const selectedReportTrustTileLabel = formatReportTileLabelList(visibleReportTrustItems);
  const fullReportExportData = buildReportExportData({
    campaignImageAlt: campaignCoverAsset?.title ?? null,
    campaignImageUrl: campaignCoverAsset?.signedUrl ?? null,
    campaignTitle: campaign.title,
    dateRange: compactDateRangeLabel,
    kpis: reportCards,
    recommendations,
    proofReview: reportProofReview,
    trust: reportTrustItems,
    sections: exportSections,
    creators: creatorExportRows,
  });
  const selectedReportLeadershipHandoff = buildReportLeadershipHandoff(fullReportExportData);
  const reportExportDataWithoutProofOperations = {
    ...buildReportCompositionExportData(fullReportExportData, {
      blockIds: selectedReportBlockIds,
      chartModeId: selectedReportChartModeId,
      presentation: selectedReportPresentation,
      presetId: selectedReportPresetId,
      template: selectedReportTemplate
          ? {
              id: selectedReportTemplate.id,
              name: selectedReportTemplate.name,
              description: selectedReportTemplate.description,
              presentation: selectedReportTemplate.presentation,
            }
          : null,
    }),
    leadershipHandoff: selectedReportLeadershipHandoff,
  };
  const reportExportData = {
    ...reportExportDataWithoutProofOperations,
    proofOperations: buildReportProofOperations(reportExportDataWithoutProofOperations),
  };
  const selectedReportTrustDecision = getReportTrustDecision(reportExportData);
  const selectedReportStory = buildReportExportStory(reportExportData);

  return (
    <div
      data-testid="campaign-report-page"
      data-report-role={currentBrandRole ?? "loading"}
      className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="mb-6">
        <Link
          href={`/b/campaigns/${campaign.id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {t("back")}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-pretty text-xl font-bold leading-tight text-foreground sm:text-2xl">
              {t("titleForCampaign", { title: campaign.title })}
            </h1>
            <p
              data-testid="report-page-date-range"
              className="text-pretty font-mono text-[11px] font-medium leading-snug text-muted-foreground [overflow-wrap:anywhere]"
            >
              {t("cover.window")} &middot; {compactDateRangeLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5">
            {canShareReports && (
              <>
                <button
                  type="button"
                  aria-label={t("share")}
                  data-testid="report-share-button"
                  onClick={() => setShareDialogOpen(true)}
                  className="inline-flex size-8 shrink-0 items-center justify-center gap-0 rounded-lg border border-border bg-white px-0 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground lg:w-auto lg:gap-1.5 lg:px-2.5"
                >
                  <Share2 className="size-3.5" />
                  <span className="hidden lg:inline">{t("share")}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-testid="report-export-menu"
                    render={
                      <button
                        type="button"
                        aria-label={t("export")}
                        className="inline-flex size-8 shrink-0 items-center justify-center gap-0 rounded-lg border border-border bg-white px-0 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground lg:w-auto lg:gap-1.5 lg:px-2.5"
                      />
                    }
                  >
                    <Download className="size-3.5" />
                    <span className="hidden lg:inline">{t("export")}</span>
                    <ChevronDown className="hidden size-3 lg:block" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => void downloadClientPdfReport(reportExportData)}>
                      <FileText className="size-4" />
                      {t("export.pdf")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={exportingFormat !== null}
                      onClick={() => void handleDurableReportExport("html")}
                    >
                      <Globe2 className="size-4" />
                      {t("export.html")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={exportingFormat !== null}
                      onClick={() => void handleDurableReportExport("json")}
                    >
                      <Code2 className="size-4" />
                      {t("export.json")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={exportingFormat !== null}
                      onClick={() => void handleDurableReportExport("csv")}
                    >
                      <Table2 className="size-4" />
                      {t("export.csv")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void downloadClientPptxReport(reportExportData)}>
                      <Presentation className="size-4" />
                      {t("export.pptx")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      <ReportExecutiveCover
        campaignImageAlt={campaignCoverAsset?.title ?? null}
        campaignImageUrl={campaignCoverAsset?.signedUrl ?? null}
        dateRange={compactDateRangeLabel}
        executiveQuestion={selectedReportExecutiveQuestion}
        headline={selectedReportDisplayTitle}
        metrics={selectedReportCoverMetrics}
        presentation={selectedReportPresentation}
        t={t}
      />

      {canShareReports && (
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
          leadershipState={selectedReportLeadershipHandoff.state}
          t={t}
          trustDecision={selectedReportTrustDecision}
        />
      )}

      {canShareReports && (
        <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
          <DialogContent
            data-testid="report-builder-save-template-dialog"
            className="sm:max-w-lg"
          >
            <DialogHeader>
              <DialogTitle>{t("builder.saveTemplate.title")}</DialogTitle>
              <DialogDescription>
                {t("builder.saveTemplate.detail")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-template-name">
                  {t("builder.saveTemplate.name")}
                </Label>
                <Input
                  id="report-template-name"
                  value={templateName}
                  maxLength={80}
                  onChange={(event) => setTemplateName(event.target.value)}
                  data-testid="report-builder-save-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-template-description">
                  {t("builder.saveTemplate.description")}
                </Label>
                <Textarea
                  id="report-template-description"
                  value={templateDescription}
                  maxLength={160}
                  rows={3}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  data-testid="report-builder-save-template-description"
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={templateSetDefault}
                  onChange={(event) => setTemplateSetDefault(event.target.checked)}
                  className="size-4 rounded border-border"
                />
                {t("builder.saveTemplate.default")}
              </label>
              {templateError && (
                <p className="text-sm font-medium text-destructive">{templateError}</p>
              )}
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setSaveTemplateDialogOpen(false)}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                data-testid="report-builder-save-template-submit"
                disabled={templateSaving || templateName.trim().length < 2}
                onClick={() => void saveReportTemplateFromBuilder()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {templateSaving
                  ? t("builder.saveTemplate.saving")
                  : t("builder.saveTemplate.submit")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canShareReports && (
        <>
          <ReportOutputContractPanel
            bestFor={selectedReportBestFor}
            blocks={selectedReportBlockLabels}
            chart={selectedReportChartModeLabel}
            chartMetric={selectedReportChartMetricLabel}
            chartModeId={selectedReportChartModeId}
            chartLayoutTitle={selectedReportChartLayoutTitle}
            chartLayoutDetail={selectedReportChartLayoutDetail}
            decisionRead={selectedReportStory.decisionRead}
            evidenceTrail={selectedReportStory.evidenceTrail}
            executiveQuestion={selectedReportExecutiveQuestion}
            leadershipHandoff={selectedReportLeadershipHandoff}
            metricTiles={selectedReportMetricTileLabel}
            nextAction={selectedReportStory.nextAction}
            onSaveCampaignShape={saveCampaignReportGoalFromBuilder}
            presentation={selectedReportPresentationLabel}
            readinessDecision={selectedReportTrustDecision}
            saveCampaignShapeError={campaignReportGoalError}
            saveCampaignShapeSaved={campaignReportGoalSaved}
            saveCampaignShapeSaving={campaignReportGoalSaving}
            shape={selectedReportOutputTitle}
            trustTiles={selectedReportTrustTileLabel}
            t={t}
          />
          <ReportBuilderPanel
            activeChartModeId={selectedReportChartModeId}
            activeChartMetricKey={selectedReportChartMetricKey}
            activePresentation={selectedReportPresentation}
            activePresetId={selectedReportPresetId}
            activeTemplateId={selectedReportTemplateId}
            campaignTitle={campaign.title}
            metricTileOptions={metricTileOptions}
            nextAction={selectedReportStory.nextAction}
            onChartModeChange={selectReportChartMode}
            onChartMetricChange={selectReportChartMetric}
            onMoveBlock={moveReportBlock}
            onPresentationChange={selectReportPresentation}
            onPresetSelect={selectReportPreset}
            onSaveTemplateClick={openSaveTemplateDialog}
            onTemplateSelect={applyReportTemplate}
            onToggle={toggleReportBlock}
            selectedBlockIds={selectedReportBlockIds}
            templates={reportTemplates}
            trustDecision={selectedReportTrustDecision}
            trustTileOptions={trustTileOptions}
            t={t}
          />
        </>
      )}

      {isReportBlockSelected("executive_summary") && (
        <div
          data-testid="report-metric-strip"
          data-report-typography={selectedReportPresentation.typography}
          data-report-density={selectedReportPresentation.density}
          className={[
            "grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-5",
            selectedReportPresentation.density === "compact" ? "mb-6" : "mb-8",
          ].join(" ")}
        >
          {visibleReportCards.map((card) => (
            <ReportMetricCard
              key={card.key}
              label={card.label}
              presentation={selectedReportPresentation}
              value={card.value}
              detail={card.detail}
            />
          ))}
        </div>
      )}

      {isReportBlockSelected("channel_story") && (
        <section className="mb-8 space-y-4" aria-label={t("section.platformMetrics")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("filter.platform")}
            </span>
            {campaignChannelPlatforms.length > 0 ? (
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
                {campaignChannelPlatforms.map((platform) => (
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

          <ReportChartModeStory
            chartModeId={selectedReportChartModeId}
            chartModeLabel={selectedReportChartModeLabel}
            comparisonLines={comparisonLines}
            evidence={evidenceMetric}
            executiveQuestion={selectedReportExecutiveQuestion}
            isAllChannels={isAllChannels}
            layoutTitle={selectedReportChartLayoutTitle}
            layoutDetail={selectedReportChartLayoutDetail}
            metrics={reportCards}
            nextAction={recommendations[0] ?? null}
            onSelectMetric={selectLiveReportMetric}
            proofSourceItems={proofSourceMetricItems}
            reportingPlatformLabels={reportingPlatformLabels}
            selectedMetricKey={selectedMetricKey}
            t={t}
            trustDecision={selectedReportTrustDecision}
          />
        </section>
      )}

      {isReportBlockSelected("proof_sources") && (
        selectedReportChartModeId === "proof" ? (
          <section className="mb-8 space-y-4" aria-label={t("section.proofSources")}>
            <ReportChartModeStory
              chartModeId={selectedReportChartModeId}
              chartModeLabel={selectedReportChartModeLabel}
              comparisonLines={comparisonLines}
              evidence={evidenceMetric}
              executiveQuestion={selectedReportExecutiveQuestion}
              isAllChannels={isAllChannels}
              layoutTitle={selectedReportChartLayoutTitle}
              layoutDetail={selectedReportChartLayoutDetail}
              metrics={reportCards}
              nextAction={recommendations[0] ?? null}
              onSelectMetric={selectLiveReportMetric}
              proofSourceItems={proofSourceMetricItems}
              reportingPlatformLabels={reportingPlatformLabels}
              selectedMetricKey={selectedMetricKey}
              t={t}
              trustDecision={selectedReportTrustDecision}
            />
          </section>
        ) : (
          <ProofSourceLanes
            items={proofSourceMetricItems}
            reportingPlatformLabels={reportingPlatformLabels}
            t={t}
          />
        )
      )}

      {isReportBlockSelected("report_trust") && (
        <section className="mb-8" aria-label={t("section.reportTrust")}>
          <ReportTrustStrip
            evidence={evidenceMetric}
            items={visibleReportTrustItems}
            t={t}
          />
        </section>
      )}

      <EvidenceCorrectionDialog
        error={correctionInputError || evidenceReviewError}
        note={correctionNote}
        onNoteChange={(nextNote) => {
          setCorrectionNote(nextNote);
          if (correctionInputError) setCorrectionInputError(null);
        }}
        onOpenChange={handleCorrectionDialogOpenChange}
        onSubmit={handleSubmitCorrection}
        open={correctionTarget !== null}
        saving={
          correctionTarget
            ? evidenceReviewingId === getEvidenceReviewTargetId(correctionTarget)
            : false
        }
        t={t}
      />

      <ProofRoomScaleReadinessPanel
        readiness={proofRoomScaleReadiness}
        t={t}
      />

      <EvidenceTrail
        canReview={canReviewReportEvidence}
        error={evidenceOpenError || evidenceReviewError}
        focusedEvidenceId={focusedEvidenceId}
        focusedReportTaskId={focusedReportTaskId}
        locale={locale}
        onOpenEvidence={handleOpenEvidence}
        onRequestCorrection={openCorrectionDialog}
        onReviewEvidence={handleReviewEvidence}
        performers={performers}
        reads={reportReads}
        reviewingId={evidenceReviewingId}
        t={t}
      />

      {isReportBlockSelected("creator_table") && (
        performers.length > 0 ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t("section.creatorPerformance")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div data-testid="report-creators-mobile-list" className="space-y-2 md:hidden">
                {sortedPerformers.map((creator) => (
                  <CreatorPerformanceMobileRow
                    key={`${creator.row_id}:mobile`}
                    creator={creator}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>

              <CreatorPerformanceDesktopTable
                activeSort={performerSort}
                creators={sortedPerformers}
                locale={locale}
                onSort={handlePerformerSort}
                t={t}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="mb-8 rounded-lg border border-dashed border-border py-12 text-center">
            <BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        )
      )}

      {isReportBlockSelected("recommendations") && (
        <ReportRecommendations recommendations={recommendations} t={t} />
      )}
    </div>
  );
}
