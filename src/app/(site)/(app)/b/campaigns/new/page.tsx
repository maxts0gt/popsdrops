"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Check,
  DollarSign,
  FileCheck2,
  Image as ImageIcon,
  Languages,
  Search,
  Minus,
  Package,
  UserPlus,
  Plus,
  Trash2,
  Truck,
  Users,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { CampaignMarketPicker } from "@/components/campaigns/campaign-market-picker";
import {
  getLocaleDisplayName,
  SUPPORTED_LOCALES,
  useTranslation,
} from "@/lib/i18n";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  MARKETS,
  MARKET_SCOPE_OPTIONS,
  NICHES,
  CONTENT_FORMATS,
  NICHE_KEYS,
  FORMAT_KEYS,
  getPlatformLabel,
  getMarketLabel,
  isMarketScope,
} from "@/lib/constants";
import {
  CAMPAIGN_SERVICE_PACKAGES,
  PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS,
  formatCampaignServiceFee,
  getCampaignServiceEstimate,
  getCampaignServicePricingDays,
  type CampaignMode,
} from "@/lib/campaign-service-packages";
import type { CampaignRecruitmentVisibility } from "@/lib/campaigns/recruitment-visibility";
import {
  buildCampaignPlatformDeliverables,
  getCampaignDeliverablePlatforms,
} from "@/lib/campaigns/platform-deliverables";
import { buildDefaultAgreementRules } from "@/lib/agreements/campaign-agreement";
import {
  buildMeasurementContractReportingRequirements,
  getMeasurementContractMetricKeys,
} from "@/lib/reporting/requirements";
import {
  REPORT_BUILDER_BLOCKS,
  REPORT_BUILDER_CHART_MODES,
  REPORT_BUILDER_DEFAULT_PRESET_ID,
  REPORT_BUILDER_PRESETS,
  getReportBuilderPresetBlockIds,
  normalizeReportCompositionSelection,
  type ReportBuilderBlockId,
  type ReportBuilderChartModeId,
  type ReportBuilderPresetSelectionId,
} from "@/lib/reporting/report-builder";
import {
  getReportingMetricTemplate,
  getReportingPlatformLabel,
  isReportingPlatform,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import { useI18n } from "@/lib/i18n/context";
import {
  createCampaign,
  publishCampaign,
  requestEnterpriseConcierge,
} from "@/app/actions/campaigns";
import {
  publishCampaignAgreement,
  upsertCampaignAgreementDraft,
} from "@/app/actions/campaign-agreements";
import {
  createCampaignAssetUpload,
  markCampaignAssetReady,
} from "@/app/actions/campaign-assets";
import {
  listReportCompositionTemplates,
  type ReportCompositionTemplateSummary,
} from "@/app/actions/report-composition-templates";
import { getCampaignAssetFileValidationError } from "@/lib/campaigns/creative-kit-upload";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { CampaignMarket, Niche, ContentFormat, Market } from "@/lib/constants";

const campaignModes = Object.values(CAMPAIGN_SERVICE_PACKAGES);

const campaignModeIcons = {
  private: UserPlus,
  sourced: Search,
} satisfies Record<CampaignMode, typeof UserPlus>;

const recruitmentVisibilityOptions = [
  {
    value: "private_invite",
    titleKey: "recruitment.private.title",
    detailKey: "recruitment.private.detail",
    icon: UserPlus,
  },
  {
    value: "shortlist_invite",
    titleKey: "recruitment.shortlist.title",
    detailKey: "recruitment.shortlist.detail",
    icon: Search,
  },
  {
    value: "open_applications",
    titleKey: "recruitment.open.title",
    detailKey: "recruitment.open.detail",
    icon: Users,
  },
] satisfies Array<{
  value: CampaignRecruitmentVisibility;
  titleKey: string;
  detailKey: string;
  icon: typeof UserPlus;
}>;

const STEP_KEYS = [
  "step.basics",
  "step.brief",
  "step.budgetTimeline",
  "step.settings",
  "step.reviewPublish",
] as const;

const FINAL_STEP = STEP_KEYS.length;

const DEFAULT_DELIVERABLE = { format: "short_video", quantity: 1 } as const;
const creatorCapacityPresets = [10, 50, 100] as const;

type ReportingCadence = "final_only" | "weekly" | "daily_launch_window";

type MeasurementContractGoal = "awareness" | "engagement_quality" | "traffic_actions" | "luxury_proof";
type AdditionalProofPlatform = Extract<ReportingPlatform, "x" | "generic">;
type AdditionalProofChannel = {
  platform: AdditionalProofPlatform;
  platformLabel?: string;
};

const reportingCadenceOptions = [
  {
    value: "final_only",
    titleKey: "reporting.final.title",
    detailKey: "reporting.final.detail",
    icon: FileCheck2,
  },
  {
    value: "weekly",
    titleKey: "reporting.keyReads.title",
    detailKey: "reporting.keyReads.detail",
    icon: BarChart3,
  },
  {
    value: "daily_launch_window",
    titleKey: "reporting.daily.title",
    detailKey: "reporting.daily.detail",
    icon: Upload,
  },
] satisfies Array<{
  value: ReportingCadence;
  titleKey: string;
  detailKey: string;
  icon: typeof FileCheck2;
}>;

const measurementContractOptions = [
  {
    value: "luxury_proof",
    titleKey: "measurement.luxury.title",
    detailKey: "measurement.luxury.detail",
    icon: FileCheck2,
  },
  {
    value: "awareness",
    titleKey: "measurement.awareness.title",
    detailKey: "measurement.awareness.detail",
    icon: BarChart3,
  },
  {
    value: "engagement_quality",
    titleKey: "measurement.engagement.title",
    detailKey: "measurement.engagement.detail",
    icon: Users,
  },
  {
    value: "traffic_actions",
    titleKey: "measurement.traffic.title",
    detailKey: "measurement.traffic.detail",
    icon: Truck,
  },
] satisfies Array<{
  value: MeasurementContractGoal;
  titleKey: string;
  detailKey: string;
  icon: typeof FileCheck2;
}>;

const additionalProofChannelOptions = [
  {
    platform: "x",
    titleKey: "measurement.additionalProof.x",
    detailKey: "measurement.additionalProof.x.detail",
  },
  {
    platform: "generic",
    titleKey: "measurement.additionalProof.generic",
    detailKey: "measurement.additionalProof.generic.detail",
  },
] satisfies Array<{
  platform: AdditionalProofPlatform;
  titleKey: string;
  detailKey: string;
}>;

const CREATOR_LANGUAGE_OPTIONS = SUPPORTED_LOCALES.map((localeCode) => ({
  value: localeCode,
  label: getLocaleDisplayName(localeCode),
}));

const MARKET_CREATOR_LOCALES: Partial<Record<Market, string>> = {
  ae: "ar",
  ar: "es",
  bh: "ar",
  br: "pt",
  cn: "zh",
  co: "es",
  de: "de",
  eg: "ar",
  es: "es",
  fr: "fr",
  hk: "zh",
  id: "id",
  in: "hi",
  iq: "ar",
  it: "it",
  jo: "ar",
  jp: "ja",
  ke: "sw",
  kr: "ko",
  kw: "ar",
  kz: "kk",
  ma: "fr",
  mx: "es",
  my: "ms",
  ng: "en",
  nl: "nl",
  om: "ar",
  ph: "tl",
  pl: "pl",
  qa: "ar",
  ro: "ro",
  ru: "ru",
  sa: "ar",
  th: "th",
  tr: "tr",
  tw: "zh",
  ua: "uk",
  uz: "uz",
  vn: "vi",
  za: "en",
};

function getPrimaryCreatorLocaleForMarkets(markets: CampaignMarket[]): string {
  for (const market of markets) {
    if (isMarketScope(market)) continue;

    const localeCode = MARKET_CREATOR_LOCALES[market];
    if (localeCode) return localeCode;
  }

  return "en";
}

function getCreatorLanguageLabel(value: string): string {
  return getLocaleDisplayName(value);
}

function getMarketPricingScopeCount(markets: CampaignMarket[]): number {
  return Math.max(
    1,
    markets.filter((market) => !isMarketScope(market)).length || markets.length,
  );
}

function toMoneyCents(value: number): number {
  return Math.round(value * 100);
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addCalendarMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addCalendarDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}

function getCalendarCells(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstCell = new Date(firstOfMonth);
  firstCell.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return {
      date,
      value: toDateValue(date),
      inMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function getWeekdayLabels(locale: string): string[] {
  const firstSunday = new Date(2026, 0, 4);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstSunday);
    date.setDate(firstSunday.getDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });
}

function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

type TimelineField = "start" | "end" | "application" | "content" | "performance";

type CreatorLanguageDraftFields = {
  description?: string;
  requirements?: string;
  dos?: string;
  donts?: string;
};

type CreatorLanguageDraftResponse = {
  status?: string;
  translation?: CreatorLanguageDraftFields;
};

type TimelineDates = {
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  contentDeadline: string;
  performanceDeadline: string;
};

type TimelineMilestoneLabels = {
  application: string;
  content: string;
  performance: string;
};

type TimelineMilestoneTone = "application" | "content" | "performance";

const timelineMilestoneMarkerClassName = "timeline-milestone-marker";
const timelineRailOutsideLabelClassName = "timeline-rail-outside-label";
const timelineRailOutsideDotClassName = "timeline-rail-outside-dot";
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const timelineRailStartPosition = 12;
const timelineRailEndPosition = 80;
const timelineRailOutsideBeforePosition = 4;
const timelineRailOutsideAfterPosition = 92;
const timelineRailOutsideBoundaryGap = "14px";
const timelineMilestoneToneClassNames: Record<
  TimelineMilestoneTone,
  {
    day: string;
    marker: string;
    railLabel: string;
    railText: string;
    stem: string;
    dot: string;
    dashedExtension: string;
  }
> = {
  application: {
    day: "bg-sky-50 text-sky-900 ring-1 ring-sky-200 hover:bg-sky-50",
    marker: "bg-sky-700 text-white",
    railLabel: "bg-sky-50 text-sky-700 ring-sky-200",
    railText: "text-sky-700",
    stem: "bg-sky-600",
    dot: "bg-sky-600",
    dashedExtension:
      "repeating-linear-gradient(to right, rgb(2 132 199) 0 8px, transparent 8px 14px)",
  },
  content: {
    day: "bg-amber-50 text-amber-950 ring-1 ring-amber-200 hover:bg-amber-50",
    marker: "bg-amber-600 text-white",
    railLabel: "bg-amber-50 text-amber-800 ring-amber-200",
    railText: "text-amber-800",
    stem: "bg-amber-500",
    dot: "bg-amber-500",
    dashedExtension:
      "repeating-linear-gradient(to right, rgb(245 158 11) 0 8px, transparent 8px 14px)",
  },
  performance: {
    day: "bg-teal-50 text-teal-950 ring-1 ring-teal-200 hover:bg-teal-50",
    marker: "bg-teal-700 text-white",
    railLabel: "bg-teal-50 text-teal-800 ring-teal-200",
    railText: "text-teal-800",
    stem: "bg-teal-600",
    dot: "bg-teal-600",
    dashedExtension:
      "repeating-linear-gradient(to right, rgb(13 148 136) 0 8px, transparent 8px 14px)",
  },
};

function getTimelineFieldValue(field: TimelineField, dates: TimelineDates): string {
  if (field === "start") return dates.startDate;
  if (field === "end") return dates.endDate;
  if (field === "application") return dates.applicationDeadline;
  if (field === "content") return dates.contentDeadline;
  return dates.performanceDeadline;
}

function formatCompactTimelineDate(value: string): string {
  return value.replaceAll("-", "/");
}

function formatTimelineDate(value: string, fallback: string): string {
  return formatCompactTimelineDate(value) || fallback;
}

function formatTimelineRange(dates: TimelineDates, copy: {
  notSet: string;
  rangeTo: string;
}) {
  if (!dates.startDate && !dates.endDate) return copy.notSet;

  const start = formatTimelineDate(dates.startDate, copy.notSet);
  const end = formatTimelineDate(dates.endDate, copy.notSet);
  return `${start} ${copy.rangeTo} ${end}`;
}

function isDateInsideCampaignWindow(value: string, dates: TimelineDates): boolean {
  return Boolean(
    dates.startDate &&
      dates.endDate &&
      compareDateStrings(value, dates.startDate) >= 0 &&
      compareDateStrings(value, dates.endDate) <= 0,
  );
}

function getTimelineMilestoneMarker(
  value: string,
  dates: TimelineDates,
  copy: { milestoneLabels: TimelineMilestoneLabels },
): string | null {
  const labels: string[] = [];

  if (value === dates.applicationDeadline) labels.push(copy.milestoneLabels.application);
  if (value === dates.contentDeadline) labels.push(copy.milestoneLabels.content);
  if (value === dates.performanceDeadline) labels.push(copy.milestoneLabels.performance);

  return labels.length > 0 ? labels.join(", ") : null;
}

function getTimelineMilestoneTone(
  value: string,
  dates: TimelineDates,
): TimelineMilestoneTone | null {
  if (value === dates.performanceDeadline) return "performance";
  if (value === dates.contentDeadline) return "content";
  if (value === dates.applicationDeadline) return "application";
  return null;
}

function isPerformanceMilestonePostCampaign(value: string, dates: TimelineDates): boolean {
  return Boolean(
    value &&
      value === dates.performanceDeadline &&
      dates.endDate &&
      compareDateStrings(value, dates.endDate) > 0,
  );
}

function getDefaultPerformanceDueDate(endDateValue: string): string {
  const endDate = parseDateValue(endDateValue);
  if (!endDate) return "";

  return toDateValue(addCalendarDays(endDate, 3));
}

function getDefaultApplicationDeadline(startDateValue: string, endDateValue: string): string {
  const startDate = parseDateValue(startDateValue);
  const endDate = parseDateValue(endDateValue);
  if (!startDate || !endDate) return "";

  const durationDays = getDateDayNumber(endDate) - getDateDayNumber(startDate);
  if (durationDays <= 1) return toDateValue(startDate);

  return toDateValue(addCalendarDays(startDate, 1));
}

function getDefaultContentDeadline(startDateValue: string, endDateValue: string): string {
  const startDate = parseDateValue(startDateValue);
  const endDate = parseDateValue(endDateValue);
  if (!startDate || !endDate) return "";

  const durationDays = getDateDayNumber(endDate) - getDateDayNumber(startDate);
  if (durationDays <= 1) return toDateValue(endDate);

  return toDateValue(addCalendarDays(endDate, -1));
}

function getDateDayNumber(date: Date): number {
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / dayInMilliseconds,
  );
}

function getTimelineMilestonePosition(
  value: string,
  dates: TimelineDates,
): {
  position: number;
  isOutsideWindow: boolean;
  outsideDirection: "before" | "after" | null;
} | null {
  const startDate = parseDateValue(dates.startDate);
  const endDate = parseDateValue(dates.endDate);
  const milestoneDate = parseDateValue(value);
  if (!startDate || !endDate || !milestoneDate) return null;

  const startDay = getDateDayNumber(startDate);
  const endDay = getDateDayNumber(endDate);
  if (endDay < startDay) return null;

  const milestoneDay = getDateDayNumber(milestoneDate);
  const durationDays = Math.max(1, endDay - startDay);
  const rawPosition = ((milestoneDay - startDay) / durationDays) * 100;
  const scaledPosition =
    timelineRailStartPosition +
    (rawPosition / 100) * (timelineRailEndPosition - timelineRailStartPosition);

  if (rawPosition < 0) {
    return {
      position: timelineRailOutsideBeforePosition,
      isOutsideWindow: true,
      outsideDirection: "before",
    };
  }

  if (rawPosition > 100) {
    return {
      position: timelineRailOutsideAfterPosition,
      isOutsideWindow: true,
      outsideDirection: "after",
    };
  }

  return {
    position: scaledPosition,
    isOutsideWindow: false,
    outsideDirection: null,
  };
}

function formatTimelineMilestoneDate(value: string): string {
  const compactDate = formatCompactTimelineDate(value);
  return compactDate ? compactDate.slice(5) : "";
}

function parseMoneyAmount(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount;
}

function isInvalidMoneyAmount(value: string): boolean {
  if (!value.trim()) return false;
  const amount = Number(value);
  return !Number.isFinite(amount) || amount < 0;
}

function formatMoneyAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Usage rights config (labels resolved via t())
// ---------------------------------------------------------------------------

const usageRightsOptions = [
  { value: "brand_channels", labelKey: "usage.brandChannels", descKey: "usage.brandChannels.desc" },
  { value: "paid_ads", labelKey: "usage.paidAds", descKey: "usage.paidAds.desc" },
  { value: "full_rights", labelKey: "usage.fullRights", descKey: "usage.fullRights.desc" },
] as const;

// ---------------------------------------------------------------------------
// MultiSelect
// ---------------------------------------------------------------------------

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: Record<string, string>;
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([key, label]) => {
        const isSelected = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() =>
              onChange(isSelected ? selected.filter((s) => s !== key) : [...selected, key])
            }
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border text-muted-foreground hover:border-border hover:bg-muted/50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PlatformPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  function togglePlatform(platform: string) {
    onChange(
      selected.includes(platform)
        ? selected.filter((item) => item !== platform)
        : [...selected, platform],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((platform) => {
        const isSelected = selected.includes(platform);
        return (
          <button
            key={platform}
            type="button"
            onClick={() => togglePlatform(platform)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border text-muted-foreground hover:border-border hover:bg-muted/50"
            }`}
          >
            {PLATFORM_LABELS[platform]}
          </button>
        );
      })}
    </div>
  );
}

function CampaignCreatorPreviewPicker({
  fileName,
  previewUrl,
  error,
  onSelectFile,
  onClear,
  onValidationError,
  copy,
}: {
  fileName: string;
  previewUrl: string;
  error?: string;
  onSelectFile: (file: File) => void;
  onClear: () => void;
  onValidationError: (message: string) => void;
  copy: {
    label: string;
    empty: string;
    add: string;
    change: string;
    remove: string;
  };
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasPreview = Boolean(previewUrl);

  function handleFile(file: File | null) {
    if (!file) return;

    const validationError = getCampaignAssetFileValidationError({
      mimeType: file.type,
      sizeBytes: file.size,
      assetType: "product_image",
    });
    if (validationError) {
      onValidationError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    onSelectFile(file);
  }

  return (
    <div
      data-testid="campaign-creator-preview-image-picker"
      className={`rounded-xl border bg-muted/30 p-3 ${
        error ? "border-red-500" : "border-border"
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div
            role={hasPreview ? "img" : undefined}
            aria-label={hasPreview ? fileName : undefined}
            className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background bg-cover bg-center text-muted-foreground shadow-sm"
            style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
          >
            {!hasPreview && <ImageIcon className="size-5" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <Label htmlFor="campaign-image">{copy.label}</Label>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {fileName || copy.empty}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={inputRef}
            id="campaign-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant={hasPreview ? "outline" : "default"}
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            {hasPreview ? copy.change : copy.add}
          </Button>
          {hasPreview && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={copy.remove}
              onClick={onClear}
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function CampaignCreatorLivePreview({
  title,
  description,
  previewUrl,
  platforms,
  markets,
  creatorLanguageLabel,
  previewCopy,
}: {
  title: string;
  description: string;
  previewUrl: string;
  platforms: string[];
  markets: string[];
  creatorLanguageLabel: string;
  previewCopy: {
    title: string;
    untitled: string;
    imageFallback: string;
    platformFallback: string;
    marketFallback: string;
    languageLabel: string;
    descriptionFallback: string;
  };
}) {
  const visibleTitle = title.trim() || previewCopy.untitled;
  const visibleDescription = description.trim() || previewCopy.descriptionFallback;
  const visiblePlatforms = platforms.length ? platforms : [previewCopy.platformFallback];
  const visibleMarkets = markets.length ? markets : [previewCopy.marketFallback];

  return (
    <aside
      data-testid="campaign-creator-live-preview"
      className="rounded-xl border border-border bg-background p-4 lg:sticky lg:top-6"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {previewCopy.title}
        </p>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          {creatorLanguageLabel}
        </span>
      </div>
      <div
        data-testid="campaign-creator-live-preview-image"
        role={previewUrl ? "img" : undefined}
        aria-label={previewUrl ? visibleTitle : undefined}
        className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted bg-cover bg-center text-muted-foreground"
        style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
      >
        {!previewUrl && (
          <div className="text-center">
            <ImageIcon className="mx-auto size-5" aria-hidden="true" />
            <p className="mt-2 text-xs">{previewCopy.imageFallback}</p>
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-base font-semibold leading-6 text-foreground">
          {visibleTitle}
        </h3>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">
          {visibleDescription}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {visiblePlatforms.map((platform) => (
          <span
            key={`platform-${platform}`}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
          >
            {platform}
          </span>
        ))}
        {visibleMarkets.map((market) => (
          <span
            key={`market-${market}`}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
          >
            {market}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {previewCopy.languageLabel}: {creatorLanguageLabel}
      </p>
    </aside>
  );
}

function CreatorLanguagePlanner({
  language,
  onLanguageChange,
  onGenerateDraft,
  generatingDraft,
  canGenerateDraft,
  translatedDescription,
  onTranslatedDescriptionChange,
  translatedRequirements,
  onTranslatedRequirementsChange,
  translatedDos,
  onTranslatedDosChange,
  translatedDonts,
  onTranslatedDontsChange,
  copy,
}: {
  language: string;
  onLanguageChange: (value: string) => void;
  onGenerateDraft: () => void;
  generatingDraft: boolean;
  canGenerateDraft: boolean;
  translatedDescription: string;
  onTranslatedDescriptionChange: (value: string) => void;
  translatedRequirements: string;
  onTranslatedRequirementsChange: (value: string) => void;
  translatedDos: string;
  onTranslatedDosChange: (value: string) => void;
  translatedDonts: string;
  onTranslatedDontsChange: (value: string) => void;
  copy: {
    languageLabel: string;
    languageHint: string;
    previewLabel: string;
    previewHint: string;
    briefDescriptionLabel: string;
    requirements: string;
    dos: string;
    donts: string;
    briefDescriptionPlaceholder: string;
    requirementsPlaceholder: string;
    dosPlaceholder: string;
    dontsPlaceholder: string;
    generateDraft: string;
    generatingDraft: string;
  };
}) {
  const shouldShowTranslationFields = language !== "en";

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
        <div>
          <Label htmlFor="creator-language">{copy.languageLabel}</Label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copy.languageHint}
          </p>
        </div>
        <Select
          value={language}
          onValueChange={(value) => {
            if (value) onLanguageChange(value);
          }}
        >
          <SelectTrigger id="creator-language" className="h-10">
            <span className="truncate">{getCreatorLanguageLabel(language)}</span>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {CREATOR_LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shouldShowTranslationFields && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {copy.previewLabel}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy.previewHint}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-3 text-xs"
              onClick={onGenerateDraft}
              disabled={!canGenerateDraft || generatingDraft}
            >
              {generatingDraft ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Languages className="size-3.5" aria-hidden="true" />
              )}
              {generatingDraft ? copy.generatingDraft : copy.generateDraft}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="translated-description" className="text-xs">
                {copy.briefDescriptionLabel}
              </Label>
              <Textarea
                id="translated-description"
                rows={3}
                value={translatedDescription}
                onChange={(event) =>
                  onTranslatedDescriptionChange(event.target.value)
                }
                placeholder={copy.briefDescriptionPlaceholder}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="translated-requirements" className="text-xs">
                {copy.requirements}
              </Label>
              <Textarea
                id="translated-requirements"
                rows={2}
                value={translatedRequirements}
                onChange={(event) =>
                  onTranslatedRequirementsChange(event.target.value)
                }
                placeholder={copy.requirementsPlaceholder}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="translated-dos" className="text-xs">
                {copy.dos}
              </Label>
              <Textarea
                id="translated-dos"
                rows={2}
                value={translatedDos}
                onChange={(event) => onTranslatedDosChange(event.target.value)}
                placeholder={copy.dosPlaceholder}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="translated-donts" className="text-xs">
                {copy.donts}
              </Label>
              <Textarea
                id="translated-donts"
                rows={2}
                value={translatedDonts}
                onChange={(event) => onTranslatedDontsChange(event.target.value)}
                placeholder={copy.dontsPlaceholder}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvestmentInputRow({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: typeof Users;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="investment-input-row"
      className="grid gap-3 rounded-lg border border-border bg-background p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </Label>
        </div>
      </div>
      <div data-testid="investment-input-control" className="sm:w-auto">
        {children}
      </div>
    </div>
  );
}

function CampaignInvestmentPlanner({
  locale,
  serviceFeeCents,
  serviceFeeDisplay,
  serviceFeeScopeSummary,
  serviceFeeScopeDetail,
  requiresCustomPricing,
  creatorCapacityOptions,
  creatorsCount,
  creatorCapacityMax,
  onCreatorsCountChange,
  creatorBudget,
  onCreatorBudgetChange,
  productValue,
  onProductValueChange,
  fulfillmentBudget,
  onFulfillmentBudgetChange,
  creatorBudgetPerCreator,
  campaignInvestmentTotal,
  campaignInvestmentTotalDisplay,
  copy,
}: {
  locale: string;
  serviceFeeCents: number;
  serviceFeeDisplay: string;
  serviceFeeScopeSummary: string;
  serviceFeeScopeDetail: string;
  requiresCustomPricing: boolean;
  creatorCapacityOptions: { count: number; feeDisplay: string }[];
  creatorsCount: string;
  creatorCapacityMax: number;
  onCreatorsCountChange: (value: string) => void;
  creatorBudget: string;
  onCreatorBudgetChange: (value: string) => void;
  productValue: string;
  onProductValueChange: (value: string) => void;
  fulfillmentBudget: string;
  onFulfillmentBudgetChange: (value: string) => void;
  creatorBudgetPerCreator: number;
  campaignInvestmentTotal: number;
  campaignInvestmentTotalDisplay: string;
  copy: {
    creatorsCount: string;
    creatorBudget: string;
    productValue: string;
    fulfillment: string;
    decreaseCreators: string;
    increaseCreators: string;
    setCreatorCapacity: string;
    serviceFee: string;
    total: string;
  };
}) {
  const parsedCreatorsCount = Number.parseInt(creatorsCount, 10);
  const creatorCountNumber = Number.isFinite(parsedCreatorsCount)
    ? Math.max(1, parsedCreatorsCount)
    : 1;
  const creatorBudgetAmount = parseMoneyAmount(creatorBudget);
  const productValueAmount = parseMoneyAmount(productValue);
  const fulfillmentBudgetAmount = parseMoneyAmount(fulfillmentBudget);
  const resolvedServiceFeeDisplay =
    serviceFeeDisplay || formatMoneyAmount(serviceFeeCents / 100, locale);
  const resolvedInvestmentTotalDisplay =
    campaignInvestmentTotalDisplay || formatMoneyAmount(campaignInvestmentTotal, locale);
  const creatorCashFormula =
    `${creatorCountNumber} x ${formatMoneyAmount(creatorBudgetPerCreator, locale)}`;
  const investmentInputItems = [
    {
      id: "creatorsCount",
      label: copy.creatorsCount,
      value: creatorsCount,
      onChange: onCreatorsCountChange,
      min: 1,
      max: creatorCapacityMax,
      inputMode: "numeric",
      icon: Users,
      prefix: undefined,
      control: "stepper",
    },
    {
      id: "creatorBudget",
      label: copy.creatorBudget,
      value: creatorBudget,
      onChange: onCreatorBudgetChange,
      min: 0,
      inputMode: "decimal",
      icon: DollarSign,
      prefix: "$",
      control: "money",
    },
    {
      id: "productValue",
      label: copy.productValue,
      value: productValue,
      onChange: onProductValueChange,
      min: 0,
      inputMode: "decimal",
      icon: Package,
      prefix: "$",
      control: "money",
    },
    {
      id: "fulfillmentBudget",
      label: copy.fulfillment,
      value: fulfillmentBudget,
      onChange: onFulfillmentBudgetChange,
      min: 0,
      inputMode: "decimal",
      icon: Truck,
      prefix: "$",
      control: "money",
    },
  ] as const;

  function changeCreatorsCount(delta: number) {
    onCreatorsCountChange(
      String(Math.min(creatorCapacityMax, Math.max(1, creatorCountNumber + delta))),
    );
  }

  return (
    <div
      data-testid="campaign-investment-planner-panel"
      data-custom-pricing={requiresCustomPricing ? "true" : "false"}
      className="rounded-xl border border-border bg-muted/30 p-4"
    >
      <div className="space-y-4">
        <div data-testid="investment-input-list" className="space-y-2">
          {investmentInputItems.map((item) => (
            <InvestmentInputRow
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
            >
              {item.control === "stepper" ? (
                <div className="grid gap-2">
                  <div className="inline-flex h-11 w-full items-center overflow-hidden rounded-lg border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring sm:w-44">
                    <button
                      type="button"
                      aria-label={copy.decreaseCreators}
                      onClick={() => changeCreatorsCount(-1)}
                      disabled={creatorCountNumber <= 1}
                      className="flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <Input
                      id={item.id}
                      type="number"
                      min={item.min}
                      max={item.max}
                      inputMode={item.inputMode}
                      value={item.value}
                      onChange={(event) => item.onChange(event.target.value)}
                      className="h-10 min-w-0 border-0 bg-transparent px-0 text-center text-base font-semibold shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      aria-label={copy.increaseCreators}
                      onClick={() => changeCreatorsCount(1)}
                      disabled={creatorCountNumber >= creatorCapacityMax}
                      className="flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {creatorCapacityOptions.map((option) => (
                      <div key={option.count} data-testid="creator-capacity-preset">
                        <button
                          type="button"
                          data-testid={`creator-capacity-preset-${option.count}`}
                          aria-label={copy.setCreatorCapacity.replace(
                            "{count}",
                            String(option.count),
                          )}
                          onClick={() => onCreatorsCountChange(String(option.count))}
                          className={`h-full w-full rounded-lg border px-2.5 py-2 text-center transition-colors ${
                            creatorCountNumber === option.count
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                          }`}
                        >
                          <span className="block text-sm font-semibold leading-none">
                            {option.count}
                          </span>
                          <span className="mt-1 block text-[11px] font-medium leading-none opacity-80">
                            {option.feeDisplay}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-11 w-full items-center rounded-lg border border-border bg-background px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring sm:w-44">
                  {item.prefix && (
                    <span className="pe-2 text-base font-semibold leading-none text-muted-foreground">
                      {item.prefix}
                    </span>
                  )}
                  <Input
                    id={item.id}
                    type="number"
                    min={item.min}
                    inputMode={item.inputMode}
                    value={item.value}
                    onChange={(event) => item.onChange(event.target.value)}
                    className="h-10 min-w-0 border-0 bg-transparent px-0 text-end text-base font-semibold shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              )}
            </InvestmentInputRow>
          ))}
        </div>
        <div
          data-testid="campaign-investment-summary"
          className="rounded-lg border border-border bg-background p-4 shadow-sm"
        >
          <dl data-testid="investment-cost-breakdown" className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt>
                <p className="font-medium text-foreground">{copy.creatorBudget}</p>
                <p
                  data-testid="creator-cash-formula"
                  className="mt-0.5 text-xs text-muted-foreground"
                >
                  {creatorCashFormula}
                </p>
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMoneyAmount(creatorBudgetAmount, locale)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{copy.productValue}</dt>
              <dd className="font-medium text-foreground">
                {formatMoneyAmount(productValueAmount, locale)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{copy.fulfillment}</dt>
              <dd className="font-medium text-foreground">
                {formatMoneyAmount(fulfillmentBudgetAmount, locale)}
              </dd>
            </div>
            <div
              data-testid="popsdrops-fee-summary-row"
              className="flex justify-between gap-4 text-xs text-muted-foreground sm:items-start"
            >
              <dt>
                <p>{copy.serviceFee}</p>
                <p
                  data-testid="service-fee-capacity-summary"
                  className="mt-0.5 font-medium text-foreground"
                >
                  {serviceFeeScopeSummary}
                </p>
                <p data-testid="service-fee-scope" className="mt-0.5">
                  {serviceFeeScopeDetail}
                </p>
              </dt>
              <dd>{resolvedServiceFeeDisplay}</dd>
            </div>
            <Separator />
            <div
              data-testid="campaign-total-summary-row"
              className="flex items-end justify-between gap-4"
            >
              <dt className="font-medium text-foreground">{copy.total}</dt>
              <dd
                data-testid="campaign-investment-total"
                className="text-xl font-semibold text-foreground"
              >
                {resolvedInvestmentTotalDisplay}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function EnterpriseConciergePanel({
  creatorCount,
  marketCount,
  platformCount,
  requesting,
  requested,
  trackingHref,
  onRequest,
  copy,
}: {
  creatorCount: number;
  marketCount: number;
  platformCount: number;
  requesting: boolean;
  requested: boolean;
  trackingHref: string;
  onRequest: () => void;
  copy: {
    heading: string;
    detail: string;
    followUp: string;
    creators: string;
    markets: string;
    platforms: string;
    action: string;
    requesting: string;
    requested: string;
  };
}) {
  return (
    <div
      data-testid="enterprise-concierge-panel"
      className="rounded-xl border border-primary bg-background p-4 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{copy.heading}</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy.detail}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">{copy.creators}</dt>
              <dd className="font-semibold text-foreground">{creatorCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.markets}</dt>
              <dd className="font-semibold text-foreground">{marketCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy.platforms}</dt>
              <dd className="font-semibold text-foreground">{platformCount}</dd>
            </div>
          </dl>
        </div>
        <Button
          type="button"
          size="sm"
          variant={requested ? "outline" : "default"}
          onClick={onRequest}
          disabled={requesting || requested}
          className="w-full sm:w-auto"
        >
          {requesting && <Loader2 className="size-4 animate-spin" />}
          {requested ? copy.requested : requesting ? copy.requesting : copy.action}
        </Button>
        {requested && (
          <Link
            href={trackingHref}
            data-testid="enterprise-concierge-follow-up"
            className="text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:text-end"
          >
            {copy.followUp}
          </Link>
        )}
      </div>
    </div>
  );
}

function ReportingCadenceSelector({
  value,
  onChange,
  copy,
}: {
  value: ReportingCadence;
  onChange: (value: ReportingCadence) => void;
  copy: {
    heading: string;
    options: Record<
      ReportingCadence,
      {
        title: string;
        detail: string;
      }
    >;
  };
}) {
  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <h3 className="text-sm font-medium text-foreground">{copy.heading}</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {reportingCadenceOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          const optionCopy = copy.options[option.value];

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={`min-h-28 rounded-lg border p-3 text-start transition-colors ${
                isSelected
                  ? "border-primary bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-foreground">
                  {optionCopy.title}
                </span>
              </span>
              <span className="mt-2 block text-xs leading-5">
                {optionCopy.detail}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReportGoalSelector({
  activePresetId,
  activeTemplateId,
  onPresetSelect,
  onTemplateSelect,
  templates,
  copy,
}: {
  activePresetId: ReportBuilderPresetSelectionId;
  activeTemplateId: string | null;
  onPresetSelect: (presetId: ReportBuilderPresetSelectionId) => void;
  onTemplateSelect: (template: ReportCompositionTemplateSummary) => void;
  templates: ReportCompositionTemplateSummary[];
  copy: {
    heading: string;
    detail: string;
    templates: string;
    presets: string;
    defaultLabel: string;
    empty: string;
    translate: (key: string) => string;
  };
}) {
  return (
    <section
      data-testid="campaign-report-goal"
      className="rounded-xl border border-border bg-background p-4"
    >
      <div>
        <h3 className="text-sm font-medium text-foreground">{copy.heading}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {copy.detail}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {copy.templates}
          </p>
          {templates.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {templates.map((template) => {
                const isSelected = activeTemplateId === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    data-testid="campaign-report-goal-template"
                    data-template-id={template.id}
                    aria-pressed={isSelected}
                    onClick={() => onTemplateSelect(template)}
                    className={`min-h-24 rounded-lg border p-3 text-start transition-colors ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-border bg-white text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold">{template.name}</span>
                      {template.isDefault && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            isSelected
                              ? "bg-white/15 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {copy.defaultLabel}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-xs leading-5">
                      {template.description || template.chartModeId}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs leading-5 text-muted-foreground">
              {copy.empty}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {copy.presets}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {REPORT_BUILDER_PRESETS.map((preset) => {
              const isSelected =
                activeTemplateId === null && activePresetId === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid="campaign-report-goal-preset"
                  data-preset-id={preset.id}
                  aria-pressed={isSelected}
                  onClick={() => onPresetSelect(preset.id)}
                  className={`min-h-28 rounded-lg border p-3 text-start transition-colors ${
                    isSelected
                      ? "border-primary bg-muted/50 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="text-sm font-medium text-foreground">
                    {copy.translate(preset.titleKey)}
                  </span>
                  <span className="mt-2 block text-xs leading-5">
                    {copy.translate(preset.detailKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportGoalOutputPreview({
  title,
  chartLabel,
  blockLabels,
  copy,
}: {
  title: string;
  chartLabel: string;
  blockLabels: string[];
  copy: {
    eyebrow: string;
    outputTitle: string;
    detail: string;
    blocksLabel: string;
    chartLabel: string;
    creatorProofLabel: string;
    creatorProofDetail: string;
  };
}) {
  return (
    <section
      data-testid="campaign-report-output-preview"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">
            {copy.outputTitle}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copy.detail}
          </p>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {title}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2 text-start sm:min-w-40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {copy.chartLabel}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {chartLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {copy.blocksLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {blockLabels.map((label) => (
              <span
                key={label}
                data-testid="campaign-report-output-block"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            {copy.creatorProofLabel}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {copy.creatorProofDetail}
          </p>
        </div>
      </div>
    </section>
  );
}

function getCampaignReportingPlatforms(platforms: string[]): ReportingPlatform[] {
  return platforms.filter(isReportingPlatform);
}

function getSelectedMeasurementMetricKeys(input: {
  goal: MeasurementContractGoal;
  platform: ReportingPlatform;
  selectedMetricKeysByPlatform: Partial<Record<ReportingPlatform, string[]>>;
}): string[] {
  return input.selectedMetricKeysByPlatform[input.platform]?.length
    ? input.selectedMetricKeysByPlatform[input.platform]!
    : getMeasurementContractMetricKeys(input.goal, input.platform);
}

function MeasurementContractSelector({
  value,
  platforms,
  selectedMetricKeysByPlatform,
  additionalProofChannels,
  onChange,
  onToggleMetric,
  onToggleAdditionalProofChannel,
  onGenericProofLabelChange,
  additionalProofError,
  copy,
}: {
  value: MeasurementContractGoal;
  platforms: ReportingPlatform[];
  selectedMetricKeysByPlatform: Partial<Record<ReportingPlatform, string[]>>;
  additionalProofChannels: AdditionalProofChannel[];
  onChange: (value: MeasurementContractGoal) => void;
  onToggleMetric: (platform: ReportingPlatform, metricKey: string) => void;
  onToggleAdditionalProofChannel: (platform: AdditionalProofPlatform) => void;
  onGenericProofLabelChange: (value: string) => void;
  additionalProofError?: string;
  copy: {
    heading: string;
    detail: string;
    fields: string;
    additionalProofTitle: string;
    additionalProofDetail: string;
    genericProofLabel: string;
    genericProofPlaceholder: string;
    options: Record<
      MeasurementContractGoal,
      {
        title: string;
        detail: string;
      }
    >;
    additionalProofOptions: Record<
      AdditionalProofPlatform,
      {
        title: string;
        detail: string;
      }
    >;
  };
}) {
  const visiblePlatforms: ReportingPlatform[] =
    platforms.length > 0 ? platforms : ["instagram"];
  const genericProofChannel = additionalProofChannels.find(
    (channel) => channel.platform === "generic",
  );

  return (
    <section className="rounded-xl border border-border bg-background p-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{copy.heading}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.detail}</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {measurementContractOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          const optionCopy = copy.options[option.value];

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={`min-h-24 rounded-lg border p-3 text-start transition-colors ${
                isSelected
                  ? "border-primary bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-foreground">
                  {optionCopy.title}
                </span>
              </span>
              <span className="mt-2 block text-xs leading-5">
                {optionCopy.detail}
              </span>
            </button>
          );
        })}
      </div>
      <div
        data-testid="additional-proof-channel-selector"
        className="mt-4 rounded-lg border border-border bg-muted/30 p-3"
      >
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground/75">
            {copy.additionalProofTitle}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copy.additionalProofDetail}
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {additionalProofChannelOptions.map((option) => {
            const isSelected = additionalProofChannels.some(
              (channel) => channel.platform === option.platform,
            );
            const optionCopy = copy.additionalProofOptions[option.platform];

            return (
              <button
                key={option.platform}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggleAdditionalProofChannel(option.platform)}
                className={`rounded-lg border bg-background p-3 text-start transition-colors ${
                  isSelected
                    ? "border-slate-900 text-foreground shadow-sm"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-border"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {optionCopy.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5">
                      {optionCopy.detail}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {genericProofChannel && (
          <div className="mt-3">
            <Label htmlFor="generic-proof-channel-label" className="text-xs">
              {copy.genericProofLabel}
            </Label>
            <Input
              id="generic-proof-channel-label"
              value={genericProofChannel.platformLabel ?? ""}
              onChange={(event) => onGenericProofLabelChange(event.target.value)}
              placeholder={copy.genericProofPlaceholder}
              className={`mt-1.5 ${
                additionalProofError ? "border-red-500" : ""
              }`}
            />
          </div>
        )}
        {additionalProofError && (
          <p className="mt-2 text-xs text-red-500">{additionalProofError}</p>
        )}
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground/75">
          {copy.fields}
        </p>
        {visiblePlatforms.map((platform) => {
          const selectedMetricKeys = new Set(
            getSelectedMeasurementMetricKeys({
              goal: value,
              platform,
              selectedMetricKeysByPlatform,
            }),
          );

          return (
            <div key={platform} className="rounded-lg bg-muted/35 p-3 ring-1 ring-border/50">
              <p className="text-xs font-semibold text-foreground">
                {getReportingPlatformLabel(platform)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {getReportingMetricTemplate(platform).map((metric) => {
                  const isSelected = selectedMetricKeys.has(metric.metricKey);

                  return (
                    <button
                      key={metric.metricKey}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onToggleMetric(platform, metric.metricKey)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {metric.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TimelineMilestoneRail({
  dates,
  activeTimelineField,
  onSelectField,
  copy,
}: {
  dates: TimelineDates;
  activeTimelineField: TimelineField;
  onSelectField: (field: TimelineField) => void;
  copy: {
    railLabel: string;
    notSet: string;
    fieldLabels: Record<TimelineField, string>;
    milestoneLabels: TimelineMilestoneLabels;
  };
}) {
  const hasCampaignWindow = Boolean(dates.startDate && dates.endDate);
  const milestoneItems = [
    {
      key: "application",
      value: dates.applicationDeadline,
      label: copy.fieldLabels.application,
      marker: copy.milestoneLabels.application,
    },
    {
      key: "content",
      value: dates.contentDeadline,
      label: copy.fieldLabels.content,
      marker: copy.milestoneLabels.content,
    },
    {
      key: "performance",
      value: dates.performanceDeadline,
      label: copy.fieldLabels.performance,
      marker: copy.milestoneLabels.performance,
    },
  ] as const;
  const isStartSelected = activeTimelineField === "start";
  const isEndSelected = activeTimelineField === "end";
  const selectedBoundaryClassName = "bg-primary text-primary-foreground shadow-sm";
  const idleBoundaryClassName = "text-foreground hover:bg-background";
  const selectedBoundaryDateClassName = "text-primary-foreground/75";
  const idleBoundaryDateClassName = "text-muted-foreground";

  return (
    <div
      data-testid="timeline-milestone-rail"
      aria-label={copy.railLabel}
      className="rounded-xl border border-border bg-muted/30 p-3"
    >
      <div className="relative h-8 text-xs">
        <button
          type="button"
          data-testid="timeline-rail-selector-button"
          data-timeline-boundary-label="start"
          aria-pressed={isStartSelected}
          onClick={() => onSelectField("start")}
          className={`absolute max-w-28 rounded-lg px-2 py-1 text-start transition-colors ${
            isStartSelected ? selectedBoundaryClassName : idleBoundaryClassName
          }`}
          style={{ insetInlineStart: `${timelineRailStartPosition}%` }}
        >
          <p className={`font-medium ${isStartSelected ? "" : "text-foreground"}`}>
            {copy.fieldLabels.start}
          </p>
          <p
            className={`mt-0.5 ${
              isStartSelected ? selectedBoundaryDateClassName : idleBoundaryDateClassName
            }`}
          >
            {formatTimelineDate(dates.startDate, copy.notSet)}
          </p>
        </button>
        <button
          type="button"
          data-testid="timeline-rail-selector-button"
          data-timeline-boundary-label="end"
          aria-pressed={isEndSelected}
          onClick={() => onSelectField("end")}
          className={`absolute max-w-28 -translate-x-full rounded-lg px-2 py-1 text-end transition-colors rtl:translate-x-full ${
            isEndSelected ? selectedBoundaryClassName : idleBoundaryClassName
          }`}
          style={{ insetInlineStart: `${timelineRailEndPosition}%` }}
        >
          <p className={`font-medium ${isEndSelected ? "" : "text-foreground"}`}>
            {copy.fieldLabels.end}
          </p>
          <p
            className={`mt-0.5 ${
              isEndSelected ? selectedBoundaryDateClassName : idleBoundaryDateClassName
            }`}
          >
            {formatTimelineDate(dates.endDate, copy.notSet)}
          </p>
        </button>
      </div>
      <div className="relative mt-3 h-24 overflow-visible px-2">
        <div
          className="absolute top-10 h-px bg-border"
          style={{
            insetInlineStart: `${timelineRailStartPosition}%`,
            insetInlineEnd: `${100 - timelineRailEndPosition}%`,
          }}
        />
        {hasCampaignWindow && (
          <div
            className="absolute top-10 h-1 -translate-y-1/2 rounded-full bg-primary"
            style={{
              insetInlineStart: `${timelineRailStartPosition}%`,
              insetInlineEnd: `${100 - timelineRailEndPosition}%`,
            }}
          />
        )}
        <div
          data-timeline-rail-tone="timeline-boundary"
          className="absolute top-[2.125rem] size-3 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background rtl:translate-x-1/2"
          style={{ insetInlineStart: `${timelineRailStartPosition}%` }}
        />
        <div
          data-timeline-rail-tone="timeline-boundary"
          className="absolute top-[2.125rem] size-3 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background rtl:translate-x-1/2"
          style={{ insetInlineStart: `${timelineRailEndPosition}%` }}
        />
        {milestoneItems.map((item) => {
          const timelineRailPoint = getTimelineMilestonePosition(item.value, dates);
          if (!timelineRailPoint?.isOutsideWindow) return null;

          const isPostCampaignMilestone =
            item.key === "performance" && timelineRailPoint.outsideDirection === "after";
          const milestoneTone = getTimelineMilestoneTone(item.value, dates) ?? item.key;
          const milestoneToneClassNames = timelineMilestoneToneClassNames[milestoneTone];
          const extensionStyle =
            timelineRailPoint.outsideDirection === "after"
              ? {
                  insetInlineStart: `calc(${timelineRailEndPosition}% + ${timelineRailOutsideBoundaryGap})`,
                  insetInlineEnd: `${100 - timelineRailPoint.position}%`,
                }
              : {
                  insetInlineStart: `${timelineRailPoint.position}%`,
                  insetInlineEnd: `calc(${100 - timelineRailStartPosition}% + ${timelineRailOutsideBoundaryGap})`,
                };

          return (
            <div key={`${item.key}-outside-rail`}>
              {isPostCampaignMilestone ? (
                <div
                  data-timeline-rail-tone="timeline-post-campaign-extension"
                  className="absolute top-10 h-1 -translate-y-1/2 rounded-full"
                  style={{
                    ...extensionStyle,
                    backgroundImage: milestoneToneClassNames.dashedExtension,
                  }}
                />
              ) : (
                <div
                  data-timeline-rail-tone="timeline-outside-extension"
                  className="absolute top-10 h-1 -translate-y-1/2 rounded-full"
                  style={{
                    ...extensionStyle,
                    backgroundImage:
                      "repeating-linear-gradient(to right, rgb(252 165 165) 0 8px, transparent 8px 14px)",
                  }}
                />
              )}
              <div
                className={`${timelineRailOutsideDotClassName} absolute top-[2.125rem] size-2.5 -translate-x-1/2 rounded-full ring-4 ring-background rtl:translate-x-1/2 ${
                  isPostCampaignMilestone ? milestoneToneClassNames.dot : "bg-red-600"
                }`}
                style={{ insetInlineStart: `${timelineRailPoint.position}%` }}
              />
            </div>
          );
        })}
        {milestoneItems.map((item) => {
          const value = item.value;
          const timelineRailPoint = getTimelineMilestonePosition(value, dates);
          if (!timelineRailPoint) return null;

          const isApplicationMilestone = item.key === "application";
          const isPostCampaignMilestone =
            item.key === "performance" && timelineRailPoint.outsideDirection === "after";
          const milestoneTone = getTimelineMilestoneTone(value, dates) ?? item.key;
          const milestoneToneClassNames = timelineMilestoneToneClassNames[milestoneTone];
          const timelineRailDate = formatTimelineMilestoneDate(value);
          const fullTimelineRailDate = formatTimelineDate(value, copy.notSet);
          const isSelected = activeTimelineField === item.key;
          const timelineRailTone = isPostCampaignMilestone
            ? "timeline-milestone-post-campaign"
            : timelineRailPoint.isOutsideWindow
            ? "timeline-milestone-outside"
            : "timeline-milestone-inside";
          const outsideMarkerPlacement =
            timelineRailPoint.outsideDirection === "after"
              ? "-translate-x-1/2 items-center text-center rtl:translate-x-1/2"
              : "translate-x-0 items-start text-start rtl:translate-x-0";

          return (
            <button
              key={item.key}
              type="button"
              data-testid="timeline-rail-selector-button"
              data-timeline-field={item.key}
              data-timeline-rail-tone={timelineRailTone}
              data-timeline-outside-direction={timelineRailPoint.outsideDirection}
              aria-label={`${item.label} ${fullTimelineRailDate}`}
              aria-pressed={isSelected}
              onClick={() => onSelectField(item.key)}
              className={`absolute flex max-w-20 flex-col rounded-lg px-1 py-1 text-[10px] font-medium transition ${
                timelineRailPoint.isOutsideWindow
                  ? `top-0 ${outsideMarkerPlacement}`
                  : `-translate-x-1/2 items-center text-center rtl:translate-x-1/2 ${
                      isApplicationMilestone ? "top-0" : "top-10"
                    }`
              } ${
                timelineRailPoint.isOutsideWindow
                  ? isPostCampaignMilestone
                    ? milestoneToneClassNames.railText
                    : "text-red-700"
                  : "text-foreground"
              } ${
                isSelected ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : ""
              }`}
              style={{ insetInlineStart: `${timelineRailPoint.position}%` }}
            >
              {timelineRailPoint.isOutsideWindow ? (
                <>
                  <span
                    className={`${timelineRailOutsideLabelClassName} rounded-full px-1.5 py-0.5 leading-none ring-1 ${
                      isPostCampaignMilestone
                        ? milestoneToneClassNames.railLabel
                        : "bg-red-50 text-red-700 ring-red-200"
                    }`}
                    title={`${item.label} ${timelineRailDate}`}
                  >
                    {item.marker}
                  </span>
                  <span className="mt-0.5 whitespace-nowrap text-muted-foreground">
                    {timelineRailDate}
                  </span>
                </>
              ) : isApplicationMilestone ? (
                <span
                  title={`${item.label} ${timelineRailDate}`}
                  className={`rounded-full px-1.5 py-0.5 leading-none ${milestoneToneClassNames.marker}`}
                >
                  {item.marker}
                </span>
              ) : null}
              {!timelineRailPoint.isOutsideWindow && isApplicationMilestone && (
                <span className="mt-0.5 whitespace-nowrap text-muted-foreground">
                  {timelineRailDate}
                </span>
              )}
              {!timelineRailPoint.isOutsideWindow && (
                <span className={`h-4 w-px ${milestoneToneClassNames.stem}`} />
              )}
              {!timelineRailPoint.isOutsideWindow && !isApplicationMilestone && (
                <span
                  title={`${item.label} ${timelineRailDate}`}
                  className={`rounded-full px-1.5 py-0.5 leading-none ${milestoneToneClassNames.marker}`}
                >
                  {item.marker}
                </span>
              )}
              {!timelineRailPoint.isOutsideWindow && !isApplicationMilestone && (
                <span className="mt-0.5 whitespace-nowrap text-muted-foreground">
                  {timelineRailDate}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimelineCalendar({
  dates,
  activeTimelineField,
  visibleMonth,
  onMonthChange,
  onSelectDate,
  locale,
  copy,
}: {
  dates: TimelineDates;
  activeTimelineField: TimelineField;
  visibleMonth: Date;
  onMonthChange: (date: Date) => void;
  onSelectDate: (value: string) => void;
  locale: string;
  copy: {
    previousMonth: string;
    nextMonth: string;
    fieldLabels: Record<TimelineField, string>;
    milestoneLabels: TimelineMilestoneLabels;
  };
}) {
  const month = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(month);
  const weekdayLabels = getWeekdayLabels(locale);
  const cells = getCalendarCells(month);
  const activeValue = getTimelineFieldValue(activeTimelineField, dates);

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copy.previousMonth}
          onClick={() => onMonthChange(addCalendarMonths(month, -1))}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <p className="text-sm font-medium text-foreground">{monthLabel}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copy.nextMonth}
          onClick={() => onMonthChange(addCalendarMonths(month, 1))}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdayLabels.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div data-testid="timeline-calendar-grid" className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const milestoneMarker = getTimelineMilestoneMarker(cell.value, dates, copy);
          const milestoneTone = getTimelineMilestoneTone(cell.value, dates);
          const milestoneToneClassNames = milestoneTone
            ? timelineMilestoneToneClassNames[milestoneTone]
            : null;
          const isTimelineBoundary =
            cell.value === dates.startDate || cell.value === dates.endDate;
          const isTimelineRange = isDateInsideCampaignWindow(cell.value, dates);
          const isPostCampaignMilestone = isPerformanceMilestonePostCampaign(cell.value, dates);
          const isMilestoneOutsideWindow = Boolean(
            milestoneMarker &&
              dates.startDate &&
              dates.endDate &&
              !isTimelineRange &&
              !isPostCampaignMilestone,
          );
          const isActiveTimelineDate = cell.value === activeValue;
          const timelineTone = isTimelineBoundary
            ? "timeline-boundary"
            : isPostCampaignMilestone
              ? "timeline-milestone-post-campaign"
              : isMilestoneOutsideWindow
              ? "timeline-milestone-outside"
              : isTimelineRange
                ? "timeline-range"
                : "timeline-neutral";
          return (
            <button
              key={cell.value}
              type="button"
              data-timeline-tone={timelineTone}
              data-timeline-milestone-tone={milestoneTone ?? undefined}
              onClick={() => onSelectDate(cell.value)}
              className={`flex h-14 flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                timelineTone === "timeline-boundary"
                  ? "bg-primary font-medium text-primary-foreground shadow-sm"
                  : milestoneToneClassNames && !isMilestoneOutsideWindow
                    ? milestoneToneClassNames.day
                  : timelineTone === "timeline-milestone-outside"
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                    : timelineTone === "timeline-range"
                      ? "bg-muted text-foreground hover:bg-muted"
                      : cell.inMonth
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground/45 hover:bg-muted/60"
              } ${
                isActiveTimelineDate && timelineTone !== "timeline-boundary"
                  ? "ring-2 ring-primary/35 ring-offset-1 ring-offset-background"
                  : ""
              }`}
            >
              <span>{cell.date.getDate()}</span>
              {milestoneMarker && timelineTone !== "timeline-boundary" && (
                <span
                  className={`${timelineMilestoneMarkerClassName} mt-1 max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                    timelineTone === "timeline-milestone-outside"
                      ? "bg-red-600 text-white"
                      : milestoneToneClassNames
                        ? milestoneToneClassNames.marker
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {milestoneMarker}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CampaignTimelineSelector({
  dates,
  onChange,
  locale,
  copy,
}: {
  dates: TimelineDates;
  onChange: (dates: TimelineDates) => void;
  locale: string;
  copy: {
    railLabel: string;
    notSet: string;
    previousMonth: string;
    nextMonth: string;
    fieldLabels: Record<TimelineField, string>;
    milestoneLabels: TimelineMilestoneLabels;
  };
}) {
  const firstVisibleDate =
    parseDateValue(dates.startDate) ??
    parseDateValue(dates.applicationDeadline) ??
    parseDateValue(dates.performanceDeadline) ??
    new Date();
  const [activeTimelineField, setActiveTimelineField] =
    useState<TimelineField>(dates.startDate ? "end" : "start");
  const [visibleMonth, setVisibleMonth] = useState(firstVisibleDate);

  function updateDate(field: TimelineField, value: string) {
    const nextDates = { ...dates };

    if (field === "start") {
      nextDates.startDate = value;
      if (nextDates.endDate && compareDateStrings(nextDates.endDate, value) < 0) {
        nextDates.endDate = "";
        nextDates.applicationDeadline = "";
        nextDates.contentDeadline = "";
        nextDates.performanceDeadline = "";
      }
    } else if (field === "end") {
      if (nextDates.startDate && compareDateStrings(value, nextDates.startDate) < 0) {
        nextDates.endDate = nextDates.startDate;
        nextDates.startDate = value;
      } else {
        nextDates.endDate = value;
      }
      if (
        !nextDates.performanceDeadline ||
        compareDateStrings(nextDates.performanceDeadline, nextDates.endDate) < 0
      ) {
          nextDates.performanceDeadline = getDefaultPerformanceDueDate(nextDates.endDate);
      }
    } else if (field === "application") {
      nextDates.applicationDeadline = value;
    } else if (field === "content") {
      nextDates.contentDeadline = value;
    } else {
      nextDates.performanceDeadline = value;
    }

    if ((field === "start" || field === "end") && nextDates.startDate && nextDates.endDate) {
      const shouldResetApplicationDeadline =
        !nextDates.applicationDeadline ||
        compareDateStrings(nextDates.applicationDeadline, nextDates.startDate) < 0 ||
        compareDateStrings(nextDates.applicationDeadline, nextDates.endDate) > 0;
      const shouldResetContentDeadline =
        !nextDates.contentDeadline ||
        compareDateStrings(nextDates.contentDeadline, nextDates.startDate) < 0 ||
        compareDateStrings(nextDates.contentDeadline, nextDates.endDate) > 0;

      if (shouldResetApplicationDeadline) {
        nextDates.applicationDeadline = getDefaultApplicationDeadline(
          nextDates.startDate,
          nextDates.endDate,
        );
      }
      if (shouldResetContentDeadline) {
        nextDates.contentDeadline = getDefaultContentDeadline(
          nextDates.startDate,
          nextDates.endDate,
        );
      }
      if (
        nextDates.applicationDeadline &&
        nextDates.contentDeadline &&
        compareDateStrings(nextDates.applicationDeadline, nextDates.contentDeadline) > 0
      ) {
        nextDates.applicationDeadline = getDefaultApplicationDeadline(
          nextDates.startDate,
          nextDates.endDate,
        );
        nextDates.contentDeadline = getDefaultContentDeadline(
          nextDates.startDate,
          nextDates.endDate,
        );
      }
    }

    onChange(nextDates);
  }

  function moveToNextField(field: TimelineField) {
    if (field === "start") setActiveTimelineField("end");
    if (field === "end") setActiveTimelineField("application");
    if (field === "application") setActiveTimelineField("content");
    if (field === "content") setActiveTimelineField("performance");
  }

  function selectTimelineField(field: TimelineField) {
    setActiveTimelineField(field);
    const value = getTimelineFieldValue(field, dates);
    const date = parseDateValue(value);
    if (date) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function handleSelectDate(value: string) {
    updateDate(activeTimelineField, value);
    moveToNextField(activeTimelineField);
  }

  return (
    <div
      data-testid="campaign-timeline-selector"
      data-timeline-selected-field={activeTimelineField}
      className="space-y-4"
    >
      <div data-testid="campaign-timeline-milestone-overview">
        <TimelineMilestoneRail
          dates={dates}
          activeTimelineField={activeTimelineField}
          onSelectField={selectTimelineField}
          copy={{
            railLabel: copy.railLabel,
            notSet: copy.notSet,
            fieldLabels: copy.fieldLabels,
            milestoneLabels: copy.milestoneLabels,
          }}
        />
      </div>
      <TimelineCalendar
        dates={dates}
        activeTimelineField={activeTimelineField}
        visibleMonth={visibleMonth}
        onMonthChange={setVisibleMonth}
        onSelectDate={handleSelectDate}
        locale={locale}
        copy={{
          previousMonth: copy.previousMonth,
          nextMonth: copy.nextMonth,
          fieldLabels: copy.fieldLabels,
          milestoneLabels: copy.milestoneLabels,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateCampaignPage() {
  const { t } = useTranslation("brand.newCampaign");
  const { locale, t: tc } = useI18n();
  const router = useRouter();

  // Build locale-aware label maps
  const marketOptions = MARKETS.map((m) => ({
    value: m,
    label: getMarketLabel(m, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, locale));
  const marketScopeOptions = MARKET_SCOPE_OPTIONS.map((scope) => ({
    value: scope.value,
    label: getMarketLabel(scope.value, locale),
  }));
  const nicheLabels = Object.fromEntries(
    NICHES.map((n) => [n, tc("ui.common", NICHE_KEYS[n])])
  );
  const formatLabels = Object.fromEntries(
    CONTENT_FORMATS.map((f) => [f, tc("ui.common", FORMAT_KEYS[f])])
  );
  const [step, setStep] = useState(0);
  const [campaignMode, setCampaignMode] = useState<CampaignMode>("private");
  const [recruitmentVisibility, setRecruitmentVisibility] =
    useState<CampaignRecruitmentVisibility>("private_invite");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const campaignImagePreviewUrlRef = useRef("");
  const [campaignImageFile, setCampaignImageFile] = useState<File | null>(null);
  const [campaignImagePreviewUrl, setCampaignImagePreviewUrl] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [markets, setMarkets] = useState<CampaignMarket[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [dos, setDos] = useState("");
  const [donts, setDonts] = useState("");
  const [creatorLanguage, setCreatorLanguage] = useState("en");
  const [creatorLanguageTouched, setCreatorLanguageTouched] = useState(false);
  const [generatingCreatorDraft, setGeneratingCreatorDraft] = useState(false);
  const [translatedDescription, setTranslatedDescription] = useState("");
  const [translatedRequirements, setTranslatedRequirements] = useState("");
  const [translatedDos, setTranslatedDos] = useState("");
  const [translatedDonts, setTranslatedDonts] = useState("");
  const [deliverables, setDeliverables] = useState<{ format: string; quantity: number }[]>([
    { ...DEFAULT_DELIVERABLE },
  ]);
  const [creatorBudget, setCreatorBudget] = useState("");
  const [productValue, setProductValue] = useState("");
  const [fulfillmentBudget, setFulfillmentBudget] = useState("");
  const [creatorsCount, setCreatorsCount] = useState("5");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contentDeadline, setContentDeadline] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [performanceDeadline, setPerformanceDeadline] = useState("");
  const [reportingCadence, setReportingCadence] = useState<ReportingCadence>("final_only");
  const [reportGoalTemplates, setReportGoalTemplates] = useState<
    ReportCompositionTemplateSummary[]
  >([]);
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState<string | null>(null);
  const [selectedReportPresetId, setSelectedReportPresetId] =
    useState<ReportBuilderPresetSelectionId>(REPORT_BUILDER_DEFAULT_PRESET_ID);
  const [selectedReportChartModeId, setSelectedReportChartModeId] =
    useState<ReportBuilderChartModeId>("comparison");
  const [selectedReportBlockIds, setSelectedReportBlockIds] = useState<
    ReportBuilderBlockId[]
  >(getReportBuilderPresetBlockIds(REPORT_BUILDER_DEFAULT_PRESET_ID));
  const [defaultReportGoalApplied, setDefaultReportGoalApplied] = useState(false);
  const reportGoalUserSelectionRef = useRef(false);
  const [measurementContractGoal, setMeasurementContractGoal] =
    useState<MeasurementContractGoal>("luxury_proof");
  const [selectedMetricKeysByPlatform, setSelectedMetricKeysByPlatform] =
    useState<Partial<Record<ReportingPlatform, string[]>>>({});
  const [additionalProofChannels, setAdditionalProofChannels] = useState<
    AdditionalProofChannel[]
  >([]);
  const [usageRights, setUsageRights] = useState("brand_channels");
  const [maxRevisions, setMaxRevisions] = useState("2");
  const [complianceNotes, setComplianceNotes] = useState("");
  const [agreementGateEnabled, setAgreementGateEnabled] = useState(false);
  const [requestingEnterpriseReview, setRequestingEnterpriseReview] = useState(false);
  const [enterpriseRequestId, setEnterpriseRequestId] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  useEffect(() => {
    return () => {
      if (campaignImagePreviewUrlRef.current) {
        URL.revokeObjectURL(campaignImagePreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (creatorLanguageTouched) return;
    setCreatorLanguage(getPrimaryCreatorLocaleForMarkets(markets));
  }, [creatorLanguageTouched, markets]);

  useEffect(() => {
    let active = true;

    async function loadReportGoalTemplates() {
      try {
        const templates = await listReportCompositionTemplates();
        if (!active) return;
        setReportGoalTemplates(templates);

        if (!defaultReportGoalApplied) {
          const defaultTemplate = templates.find((template) => template.isDefault);
          if (defaultTemplate && !reportGoalUserSelectionRef.current) {
            applyCampaignReportTemplate(defaultTemplate, { markUserSelection: false });
          }
          setDefaultReportGoalApplied(true);
        }
      } catch {
        if (active) setReportGoalTemplates([]);
      }
    }

    void loadReportGoalTemplates();

    return () => {
      active = false;
    };
  }, [defaultReportGoalApplied]);

  function clearBudgetError() {
    setErrors((prev) => {
      const next = { ...prev };
      delete next.budget;
      return next;
    });
  }

  function clearEnterpriseReview() {
    setEnterpriseRequestId("");
  }

  function handleMeasurementContractGoalChange(value: MeasurementContractGoal) {
    setMeasurementContractGoal(value);
    setSelectedMetricKeysByPlatform({});
  }

  function applyCampaignReportTemplate(
    template: ReportCompositionTemplateSummary,
    { markUserSelection = true }: { markUserSelection?: boolean } = {},
  ) {
    if (markUserSelection) reportGoalUserSelectionRef.current = true;
    setSelectedReportTemplateId(template.id);
    setSelectedReportPresetId(template.presetId);
    setSelectedReportChartModeId(template.chartModeId);
    setSelectedReportBlockIds(template.blockIds);
  }

  function selectCampaignReportPreset(presetId: ReportBuilderPresetSelectionId) {
    const selection = normalizeReportCompositionSelection({ presetId });

    reportGoalUserSelectionRef.current = true;
    setSelectedReportTemplateId(null);
    setSelectedReportPresetId(selection.presetId);
    setSelectedReportChartModeId(selection.chartModeId);
    setSelectedReportBlockIds(selection.blockIds);
  }

  function toggleMeasurementMetric(platform: ReportingPlatform, metricKey: string) {
    setSelectedMetricKeysByPlatform((current) => {
      const currentKeys =
        current[platform] ??
        getMeasurementContractMetricKeys(measurementContractGoal, platform);
      const nextKeys = currentKeys.includes(metricKey)
        ? currentKeys.filter((key) => key !== metricKey)
        : [...currentKeys, metricKey];

      return {
        ...current,
        [platform]: nextKeys.length
          ? nextKeys
          : getMeasurementContractMetricKeys(measurementContractGoal, platform),
      };
    });
  }

  function toggleAdditionalProofChannel(platform: AdditionalProofPlatform) {
    setAdditionalProofChannels((current) => {
      const isSelected = current.some((channel) => channel.platform === platform);

      if (isSelected) {
        return current.filter((channel) => channel.platform !== platform);
      }

      return [...current, { platform }];
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.additionalProofChannels;
      return next;
    });
  }

  function updateGenericProofLabel(value: string) {
    setAdditionalProofChannels((current) =>
      current.map((channel) =>
        channel.platform === "generic"
          ? { ...channel, platformLabel: value }
          : channel,
      ),
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next.additionalProofChannels;
      return next;
    });
  }

  function handleCreatorsCountChange(value: string) {
    setCreatorsCount(value);
    clearEnterpriseReview();
    setErrors((prev) => {
      const next = { ...prev };
      delete next.creatorsCount;
      return next;
    });
  }

  function setCampaignImageError(message: string) {
    setErrors((prev) => ({
      ...prev,
      campaignImage: message,
    }));
  }

  function clearCampaignImageError() {
    setErrors((prev) => {
      const next = { ...prev };
      delete next.campaignImage;
      return next;
    });
  }

  function handleCampaignImageSelect(file: File) {
    if (campaignImagePreviewUrlRef.current) {
      URL.revokeObjectURL(campaignImagePreviewUrlRef.current);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    campaignImagePreviewUrlRef.current = nextPreviewUrl;
    setCampaignImageFile(file);
    setCampaignImagePreviewUrl(nextPreviewUrl);
    clearCampaignImageError();
  }

  function clearCampaignImage() {
    if (campaignImagePreviewUrlRef.current) {
      URL.revokeObjectURL(campaignImagePreviewUrlRef.current);
    }

    campaignImagePreviewUrlRef.current = "";
    setCampaignImageFile(null);
    setCampaignImagePreviewUrl("");
  }

  // Step validation
  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!title.trim()) errs.title = t("error.titleRequired");
      if (!description.trim()) errs.description = t("error.descriptionRequired");
      if (!campaignImageFile) errs.campaignImage = t("error.campaignImageRequired");
      if (platforms.length === 0) errs.platforms = t("error.platformRequired");
      else if (getCampaignDeliverablePlatforms(platforms).length === 0) {
        errs.platforms = t("error.standardPlatformRequired");
      }
      if (markets.length === 0) errs.markets = t("error.marketRequired");
    }
    if (s === 2) {
      if (niches.length === 0) errs.niches = t("error.nicheRequired");
    }
    if (s === 3) {
      const requestedCreatorsCount = Number(creatorsCount);
      const genericProofChannel = additionalProofChannels.find(
        (channel) => channel.platform === "generic",
      );
      const hasInvalidInvestmentValue =
        isInvalidMoneyAmount(creatorBudget) ||
        isInvalidMoneyAmount(productValue) ||
        isInvalidMoneyAmount(fulfillmentBudget);
      const hasCampaignInvestment =
        parseMoneyAmount(creatorBudget) > 0 ||
        parseMoneyAmount(productValue) > 0 ||
        parseMoneyAmount(fulfillmentBudget) > 0;

      if (hasInvalidInvestmentValue) {
        errs.budget = t("error.investmentInvalid");
      } else if (!hasCampaignInvestment) {
        errs.budget = t("error.investmentRequired");
      }
      if (
        !Number.isFinite(requestedCreatorsCount) ||
        requestedCreatorsCount < 1
      ) {
        errs.creatorsCount = t("error.creatorsCountRequired");
      } else if (
        campaignMode === "private" &&
        requestedCreatorsCount > PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS
      ) {
        errs.creatorsCount = t("error.creatorsCountMax");
      }
      if (!startDate || !endDate || !performanceDeadline) {
        errs.dates = t("error.dateRequired");
      } else if (
        compareDateStrings(startDate, endDate) > 0 ||
        (applicationDeadline && compareDateStrings(applicationDeadline, startDate) < 0) ||
        (contentDeadline && compareDateStrings(contentDeadline, endDate) > 0) ||
        compareDateStrings(performanceDeadline, endDate) < 0 ||
        (contentDeadline && compareDateStrings(contentDeadline, performanceDeadline) > 0) ||
        (applicationDeadline &&
          contentDeadline &&
          compareDateStrings(applicationDeadline, contentDeadline) > 0)
      ) {
        errs.dates = t("error.dateOrder");
      }
      if (genericProofChannel && !genericProofChannel.platformLabel?.trim()) {
        errs.additionalProofChannels = t("error.additionalProofLabelRequired");
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    const requestedCreatorsCount = Math.max(1, Number(creatorsCount) || 1);
    const currentEstimate = getCampaignServiceEstimate(campaignMode, {
      maxCreators: requestedCreatorsCount,
      marketCount: getMarketPricingScopeCount(markets),
      activeDays: activeDaysForPricing,
      reportingDays: reportingDaysForPricing,
    });
    const privateCapacityRequiresReview =
      campaignMode === "private" &&
      requestedCreatorsCount > PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS;
    const requiresEnterpriseConcierge =
      privateCapacityRequiresReview || currentEstimate.requiresCustomPricing;

    if (step === 3 && requiresEnterpriseConcierge) {
      if (!enterpriseRequestId) {
        setErrors((prev) => ({
          ...prev,
          creatorsCount: t("error.enterpriseRequired"),
        }));
      }
      return;
    }

    if (validateStep(step)) setStep(step + 1);
  }

  function buildBriefTranslations() {
    const reviewedTranslation = {
      description: translatedDescription.trim(),
      requirements: translatedRequirements.trim(),
      dos: translatedDos.trim(),
      donts: translatedDonts.trim(),
    };
    const hasReviewedTranslation = Object.values(reviewedTranslation).some(Boolean);

    if (creatorLanguage === "en" || !hasReviewedTranslation) {
      return undefined;
    }

    return {
      [creatorLanguage]: {
        description: reviewedTranslation.description,
        requirements: reviewedTranslation.requirements,
        dos: reviewedTranslation.dos,
        donts: reviewedTranslation.donts,
      },
    };
  }

  function buildCampaignInput() {
    const mappedDeliverables = buildCampaignPlatformDeliverables({
      platforms,
      deliverables,
    });

    return {
      title: title.trim(),
      campaign_mode: campaignMode,
      recruitment_visibility: recruitmentVisibility,
      brief_description: description.trim(),
      brief_requirements: requirements.trim() || undefined,
      brief_dos: dos.trim() || undefined,
      brief_donts: donts.trim() || undefined,
      brief_translated: buildBriefTranslations(),
      compliance_notes: complianceNotes.trim() || undefined,
      platforms,
      markets,
      niches: niches as Niche[],
      budget_min: creatorBudgetAmount,
      budget_max: creatorBudgetAmount,
      max_creators: maxCreatorsForPricing,
      application_deadline: applicationDeadline || contentDeadline || endDate,
      content_due_date: contentDeadline || endDate,
      performance_due_date: performanceDeadline || undefined,
      posting_window_start: startDate || undefined,
      posting_window_end: endDate || undefined,
      usage_rights_duration: usageRights,
      usage_rights_territory: "worldwide",
      usage_rights_paid_ads: usageRights === "paid_ads" || usageRights === "full_rights",
      max_revisions: Number(maxRevisions) || 2,
      reporting_cadence: reportingCadence,
      report_template_id: selectedReportTemplateId,
      report_preset_id: selectedReportPresetId,
      report_chart_mode_id: selectedReportChartModeId,
      report_block_ids: selectedReportBlockIds,
      reporting_requirements:
        buildMeasurementContractReportingRequirements({
          deliverables: mappedDeliverables,
          goal: measurementContractGoal,
          additionalProofChannels,
          selectedMetricKeysByPlatform,
        }),
      deliverables: mappedDeliverables,
    };
  }

  function buildAgreementDraftInput(campaignId: string) {
    return {
      campaignId,
      gateMode: "typed_signature" as const,
      title: "Campaign Rules",
      rules: buildDefaultAgreementRules({
        campaignTitle: title.trim() || t("review.untitled"),
        platforms,
        usageRightsDuration: usageRights,
        usageRightsTerritory: "worldwide",
        usageRightsPaidAds: usageRights === "paid_ads" || usageRights === "full_rights",
        applicationDeadline: applicationDeadline || null,
        contentDueDate: contentDeadline || null,
        postingWindowStart: startDate || null,
        postingWindowEnd: endDate || null,
        performanceDueDate: performanceDeadline || null,
        requiredEvidence: ["public_url", "screenshot", "manual_metrics"],
      }),
      agreementBody: null,
      previewEnabled: true,
      previewSummary: agreementPreviewSummary,
      requiresTypedName: true,
    };
  }

  async function generateCreatorLanguageDraft() {
    if (creatorLanguage === "en") return;

    if (!description.trim()) {
      toast.error(t("error.creatorDraftUnavailable"));
      return;
    }

    setGeneratingCreatorDraft(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("translate-brief", {
        body: {
          targetLocale: creatorLanguage,
          briefFields: {
            description: description.trim(),
            requirements: requirements.trim(),
            dos: dos.trim(),
            donts: donts.trim(),
          },
        },
      }) as {
        data: CreatorLanguageDraftResponse | null;
        error: { message: string } | null;
      };

      if (error) throw new Error(error.message);

      const translatedFields = data?.translation;
      if (
        !translatedFields ||
        !Object.values(translatedFields).some((value) => value?.trim())
      ) {
        throw new Error(t("error.creatorDraftFailed"));
      }

      setTranslatedDescription(translatedFields.description ?? "");
      setTranslatedRequirements(translatedFields.requirements ?? "");
      setTranslatedDos(translatedFields.dos ?? "");
      setTranslatedDonts(translatedFields.donts ?? "");
      toast.success(t("success.creatorDraftGenerated"));
    } catch {
      toast.error(t("error.creatorDraftFailed"));
    } finally {
      setGeneratingCreatorDraft(false);
    }
  }

  async function requestEnterpriseReview() {
    setRequestingEnterpriseReview(true);
    try {
      const request = await requestEnterpriseConcierge({
        campaign_title: title.trim() || t("review.untitled"),
        campaign_mode: campaignMode,
        requestReason: privateCapacityExceedsSelfServe ? "private_capacity" : "sourcing",
        requested_creator_count: maxCreatorsForPricing,
        market_count: marketPricingScopeCount,
        markets,
        platforms,
        creator_budget_cents: toMoneyCents(creatorBudgetAmount),
        product_value_cents: toMoneyCents(productValueAmount),
        fulfillment_budget_cents: toMoneyCents(fulfillmentBudgetAmount),
        note: description.trim() || undefined,
      });

      setEnterpriseRequestId(request.id);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.creatorsCount;
        return next;
      });
      toast.success(t("success.enterpriseRequested"));
    } catch {
      toast.error(t("error.enterpriseRequestFailed"));
    } finally {
      setRequestingEnterpriseReview(false);
    }
  }

  async function uploadCampaignImage(campaignId: string) {
    if (!campaignImageFile) throw new Error(t("error.campaignImageRequired"));

    const validationError = getCampaignAssetFileValidationError({
      mimeType: campaignImageFile.type,
      sizeBytes: campaignImageFile.size,
      assetType: "product_image",
    });
    if (validationError) throw new Error(validationError);

    const imageTitle =
      title.trim() ||
      campaignImageFile.name.replace(/\.[^.]+$/, "") ||
      t("field.campaignImage");
    const upload = await createCampaignAssetUpload({
      campaignId,
      title: imageTitle,
      description: null,
      assetType: "product_image",
      visibility: "public",
      fileName: campaignImageFile.name,
      mimeType: campaignImageFile.type,
      sizeBytes: campaignImageFile.size,
    });
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(upload.bucket)
      .upload(upload.storagePath, campaignImageFile, {
        contentType: campaignImageFile.type,
        upsert: true,
      });
    if (error) throw new Error(error.message);

    await markCampaignAssetReady({
      campaignId,
      assetId: upload.assetId,
    });
  }

  async function handleSaveDraft() {
    if (requiresEnterpriseConcierge) {
      setStep(3);
      setErrors((prev) => ({
        ...prev,
        creatorsCount: t("error.enterpriseRequired"),
      }));
      return;
    }

    if (!title.trim()) {
      setErrors({ title: t("error.titleRequired") });
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const { id } = await createCampaign(buildCampaignInput());
      await uploadCampaignImage(id);
      if (agreementGateEnabled) {
        await upsertCampaignAgreementDraft(buildAgreementDraftInput(id));
      }
      toast.success(t("success.saved"));
      router.push(`/b/campaigns/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish() {
    if (requiresEnterpriseConcierge) {
      setStep(3);
      setErrors((prev) => ({
        ...prev,
        creatorsCount: t("error.enterpriseRequired"),
      }));
      return;
    }

    // Validate all steps
    for (let s = 1; s <= 3; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    setSubmitting(true);
    try {
      const { id } = await createCampaign(buildCampaignInput());
      await uploadCampaignImage(id);
      if (agreementGateEnabled) {
        const agreement = await upsertCampaignAgreementDraft(buildAgreementDraftInput(id));
        await publishCampaignAgreement({ agreementId: agreement.id });
      }
      await publishCampaign(id);
      toast.success(t("success.published"));
      router.push(`/b/campaigns/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  function addDeliverable() {
    setDeliverables([...deliverables, { format: "short_video", quantity: 1 }]);
  }

  function removeDeliverable(index: number) {
    setDeliverables(deliverables.filter((_, i) => i !== index));
  }

  const selectedCampaignPackage = CAMPAIGN_SERVICE_PACKAGES[campaignMode];
  const maxCreatorsForPricing = Math.max(1, Number(creatorsCount) || 1);
  const marketPricingScopeCount = getMarketPricingScopeCount(markets);
  const { activeDays: activeDaysForPricing, reportingDays: reportingDaysForPricing } =
    getCampaignServicePricingDays({
      postingWindowStart: startDate,
      postingWindowEnd: endDate,
      performanceDueDate: performanceDeadline,
    });
  const serviceFeeEstimate = getCampaignServiceEstimate(campaignMode, {
    maxCreators: maxCreatorsForPricing,
    marketCount: marketPricingScopeCount,
    activeDays: activeDaysForPricing,
    reportingDays: reportingDaysForPricing,
  });
  const privateCapacityExceedsSelfServe =
    campaignMode === "private" && maxCreatorsForPricing > PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS;
  const requiresEnterpriseConcierge = privateCapacityExceedsSelfServe ||
    (campaignMode === "sourced" && serviceFeeEstimate.requiresCustomPricing);
  const navigationNextDisabled = step === 3 && requiresEnterpriseConcierge;
  const creatorBudgetAmount = parseMoneyAmount(creatorBudget);
  const productValueAmount = parseMoneyAmount(productValue);
  const fulfillmentBudgetAmount = parseMoneyAmount(fulfillmentBudget);
  const serviceFeeAmount = requiresEnterpriseConcierge
    ? 0
    : serviceFeeEstimate.feeCents / 100;
  const campaignInvestmentTotal =
    creatorBudgetAmount + productValueAmount + fulfillmentBudgetAmount + serviceFeeAmount;
  const serviceFeeDisplay = privateCapacityExceedsSelfServe ? t("investment.serviceFee.custom") :
    requiresEnterpriseConcierge
    ? t("investment.serviceFee.custom")
    : formatMoneyAmount(serviceFeeAmount, locale);
  const campaignInvestmentTotalDisplay = privateCapacityExceedsSelfServe ? t("investment.total.custom") :
    requiresEnterpriseConcierge
    ? t("investment.total.custom")
    : formatMoneyAmount(campaignInvestmentTotal, locale);
  const creatorCapacityOptions = creatorCapacityPresets.map((count) => {
    const estimate = getCampaignServiceEstimate(campaignMode, {
      maxCreators: count,
      marketCount: marketPricingScopeCount,
      activeDays: activeDaysForPricing,
      reportingDays: reportingDaysForPricing,
    });

    return {
      count,
      feeDisplay: estimate.requiresCustomPricing
        ? t("investment.serviceFee.custom")
        : formatMoneyAmount(estimate.feeCents / 100, locale),
    };
  });
  const creatorCountNumber = Math.max(1, Number(creatorsCount) || 1);
  const creatorBudgetPerCreator = creatorBudgetAmount / creatorCountNumber;
  const creatorLanguageLabel = getCreatorLanguageLabel(creatorLanguage);
  const timelineDates = {
    startDate,
    endDate,
    applicationDeadline,
    contentDeadline,
    performanceDeadline,
  };
  const timelineCopy = {
    notSet: t("timeline.notSet"),
    previousMonth: t("field.date.previousMonth"),
    nextMonth: t("field.date.nextMonth"),
    railLabel: t("timeline.rail.label"),
    fieldLabels: {
      start: t("timeline.start"),
      end: t("timeline.end"),
      application: t("timeline.application"),
      content: t("timeline.content"),
      performance: t("timeline.performance"),
    },
    milestoneLabels: {
      application: t("timeline.application.marker"),
      content: t("timeline.content.marker"),
      performance: t("timeline.performance.marker"),
    },
  };
  const selectedReportingCadence =
    reportingCadenceOptions.find((option) => option.value === reportingCadence) ??
    reportingCadenceOptions[0];
  const selectedReportingCadenceLabel = t(selectedReportingCadence.titleKey);
  const selectedReportGoalTemplate = reportGoalTemplates.find(
    (template) => template.id === selectedReportTemplateId,
  );
  const selectedReportGoalPreset = REPORT_BUILDER_PRESETS.find(
    (preset) => preset.id === selectedReportPresetId,
  );
  const selectedReportGoalTitle =
    selectedReportGoalTemplate?.name ||
    (selectedReportGoalPreset ? t(selectedReportGoalPreset.titleKey) : t("reportGoal.custom"));
  const selectedReportGoalChart =
    REPORT_BUILDER_CHART_MODES.find(
      (chartMode) => chartMode.id === selectedReportChartModeId,
    ) ?? REPORT_BUILDER_CHART_MODES[0];
  const selectedReportGoalChartLabel = t(selectedReportGoalChart.titleKey);
  const selectedReportGoalBlockLabels = selectedReportBlockIds.map((blockId) => {
    const block = REPORT_BUILDER_BLOCKS.find((item) => item.id === blockId);
    return block ? t(block.titleKey) : blockId;
  });
  const reportingPlatforms = getCampaignReportingPlatforms(
    getCampaignDeliverablePlatforms(platforms),
  );
  const additionalProofPlatforms = additionalProofChannels.map(
    (channel) => channel.platform,
  );
  const measurementPlatforms = Array.from(
    new Set<ReportingPlatform>([
      ...reportingPlatforms,
      ...additionalProofPlatforms,
    ]),
  );
  const selectedMeasurementContract =
    measurementContractOptions.find((option) => option.value === measurementContractGoal) ??
    measurementContractOptions[0];
  const selectedMeasurementContractLabel = t(selectedMeasurementContract.titleKey);
  const agreementPreviewSummary = {
    disclosure: t("agreement.previewSummary.disclosure"),
    reporting: t("agreement.previewSummary.reporting"),
    assets: t("agreement.previewSummary.assets"),
  };

  return (
    <div
      className={`mx-auto px-4 pt-6 pb-28 sm:px-6 lg:px-8 ${
        step === 1 ? "max-w-5xl" : "max-w-3xl"
      }`}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {step === 0
            ? t("mode.subtitle")
            : t("step.of", { step: String(step), total: String(FINAL_STEP) })}
        </p>
      </div>

      {/* Progress bar */}
      {step > 0 && (
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            {STEP_KEYS.map((key, i) => (
              <span key={key} className={i + 1 <= step ? "font-medium text-foreground" : ""}>
                {t(key)}
              </span>
            ))}
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${(step / FINAL_STEP) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 0: Campaign Model */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-foreground">{t("mode.title")}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {campaignModes.map((mode) => {
              const ModeIcon = campaignModeIcons[mode.mode];

              return (
                <button
                  key={mode.mode}
                  type="button"
                  data-testid="campaign-mode-card"
                  onClick={() => {
                    setCampaignMode(mode.mode);
                    if (
                      mode.mode === "sourced" &&
                      recruitmentVisibility === "open_applications"
                    ) {
                      setRecruitmentVisibility("shortlist_invite");
                    }
                    clearEnterpriseReview();
                  }}
                  className={`flex h-full flex-col rounded-xl border-2 p-5 text-start transition-all hover:shadow-md ${
                    campaignMode === mode.mode
                      ? "border-primary bg-muted/50"
                      : "border-border hover:border-border"
                  }`}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <span className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ModeIcon className="size-5" />
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground">{t(mode.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t(mode.descKey)}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {t(mode.scopeDetailKey)}
                  </p>
                  <div
                    data-testid="campaign-mode-price-footer"
                    className="mt-auto flex items-end justify-between gap-4 border-t border-border/70 pt-4"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {t(mode.pricePrefixKey)}
                    </p>
                    <p
                      data-testid="campaign-mode-price"
                      className="text-lg font-semibold text-foreground"
                    >
                      {mode.mode === "sourced"
                        ? t("investment.serviceFee.custom")
                        : formatCampaignServiceFee(mode.feeCents)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div
            data-testid="campaign-recruitment-visibility"
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("recruitment.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("recruitment.detail")}
              </p>
            </div>
            <div className="grid gap-2 lg:grid-cols-3">
              {recruitmentVisibilityOptions.map((option) => {
                const VisibilityIcon = option.icon;
                const disabled =
                  campaignMode === "sourced" &&
                  option.value === "open_applications";

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={recruitmentVisibility === option.value}
                    onClick={() => setRecruitmentVisibility(option.value)}
                    className={`rounded-lg border p-3 text-start transition-colors ${
                      recruitmentVisibility === option.value
                        ? "border-primary bg-muted/60"
                        : "border-border bg-background hover:bg-muted/40"
                    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <VisibilityIcon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {t(option.titleKey)}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {t(option.detailKey)}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Basics */}
      {step === 1 && (
        <div
          data-testid="campaign-details-and-preview"
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
        >
        <Card>
          <CardHeader>
            <CardTitle>{t("step.basics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="title">{t("field.name")}</Label>
              <Input
                id="title"
                placeholder={t("field.name.placeholder")}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearEnterpriseReview();
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }}
                className={`mt-1.5 ${errors.title ? "border-red-500" : ""}`}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
            </div>
            <div>
              <Label htmlFor="description">{t("field.briefDescription")}</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder={t("field.briefDescription.placeholder")}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearEnterpriseReview();
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.description;
                    return next;
                  });
                }}
                className={`mt-1.5 ${errors.description ? "border-red-500" : ""}`}
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
            </div>
            <CampaignCreatorPreviewPicker
              fileName={campaignImageFile?.name ?? ""}
              previewUrl={campaignImagePreviewUrl}
              error={errors.campaignImage}
              onSelectFile={handleCampaignImageSelect}
              onClear={clearCampaignImage}
              onValidationError={setCampaignImageError}
              copy={{
                label: t("field.campaignImage"),
                empty: t("field.campaignImage.empty"),
                add: t("field.campaignImage.add"),
                change: t("field.campaignImage.change"),
                remove: t("field.campaignImage.remove"),
              }}
            />
            <div>
              <Label>{t("field.platforms")}</Label>
              <div className="mt-1.5">
                <PlatformPicker
                  selected={platforms}
                  onChange={(v) => {
                    setPlatforms(v);
                    clearEnterpriseReview();
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.platforms;
                      return next;
                    });
                  }}
                />
              </div>
              {errors.platforms && <p className="mt-1 text-xs text-red-500">{errors.platforms}</p>}
            </div>
            <div>
              <Label>{t("field.markets")}</Label>
              <div className="mt-1.5">
                <CampaignMarketPicker
                  options={marketOptions}
                  scopeOptions={marketScopeOptions}
                  selected={markets}
                  onChange={(v) => {
                    setMarkets(v);
                    clearEnterpriseReview();
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.markets;
                      return next;
                    });
                  }}
                  copy={{
                    placeholder: t("field.markets.placeholder"),
                    selectedCount: t("field.markets.selected", {
                      count: String(markets.length),
                    }),
                    scopeLabel: t("field.markets.scope"),
                    searchPlaceholder: t("field.markets.search"),
                    empty: t("field.markets.empty"),
                  }}
                />
              </div>
              {errors.markets && <p className="mt-1 text-xs text-red-500">{errors.markets}</p>}
            </div>
            <div data-testid="campaign-creator-language-planner">
              <CreatorLanguagePlanner
                language={creatorLanguage}
                onLanguageChange={(value) => {
                  setCreatorLanguage(value);
                  setCreatorLanguageTouched(true);
                }}
                onGenerateDraft={generateCreatorLanguageDraft}
                generatingDraft={generatingCreatorDraft}
                canGenerateDraft={
                  creatorLanguage !== "en" &&
                  Boolean(description.trim()) &&
                  !generatingCreatorDraft
                }
                translatedDescription={translatedDescription}
                onTranslatedDescriptionChange={setTranslatedDescription}
                translatedRequirements={translatedRequirements}
                onTranslatedRequirementsChange={setTranslatedRequirements}
                translatedDos={translatedDos}
                onTranslatedDosChange={setTranslatedDos}
                translatedDonts={translatedDonts}
                onTranslatedDontsChange={setTranslatedDonts}
                copy={{
                  languageLabel: t("field.creatorLanguage"),
                  languageHint: t("field.creatorLanguage.hint"),
                  previewLabel: t("field.creatorLanguagePreview"),
                  previewHint: t("field.creatorLanguagePreview.hint"),
                  briefDescriptionLabel: t("field.creatorLanguage.description"),
                  requirements: t("field.creatorLanguage.requirements"),
                  dos: t("field.creatorLanguage.dos"),
                  donts: t("field.creatorLanguage.donts"),
                  briefDescriptionPlaceholder: t(
                    "field.creatorLanguage.description.placeholder",
                  ),
                  requirementsPlaceholder: t(
                    "field.creatorLanguage.requirements.placeholder",
                  ),
                  dosPlaceholder: t("field.creatorLanguage.dos.placeholder"),
                  dontsPlaceholder: t("field.creatorLanguage.donts.placeholder"),
                  generateDraft: t("action.generateCreatorDraft"),
                  generatingDraft: t("action.generatingCreatorDraft"),
                }}
              />
            </div>
          </CardContent>
        </Card>
          <CampaignCreatorLivePreview
            title={title}
            description={translatedDescription || description}
            previewUrl={campaignImagePreviewUrl}
            platforms={platforms.map((platform) => getPlatformLabel(platform))}
            markets={markets.map((market) => getMarketLabel(market, locale))}
            creatorLanguageLabel={creatorLanguageLabel}
            previewCopy={{
              title: t("creatorPreview.title"),
              untitled: t("creatorPreview.untitled"),
              imageFallback: t("creatorPreview.imageFallback"),
              platformFallback: t("creatorPreview.platformFallback"),
              marketFallback: t("creatorPreview.marketFallback"),
              languageLabel: t("creatorPreview.language"),
              descriptionFallback: t("creatorPreview.descriptionFallback"),
            }}
          />
        </div>
      )}

      {/* Step 2: Brief */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.brief")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="requirements">{t("field.briefRequirements")}</Label>
              <Textarea
                id="requirements"
                rows={3}
                placeholder={t("field.briefRequirements.placeholder")}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div data-testid="creator-criteria-section" className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  {t("field.creatorCriteria")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("field.creatorCriteria.hint")}
                </p>
              </div>
              <div>
                <Label>{t("field.niches")}</Label>
                <div className="mt-1.5">
                  <MultiSelect
                    options={nicheLabels}
                    selected={niches}
                    onChange={(v) => {
                      setNiches(v);
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.niches;
                        return next;
                      });
                    }}
                  />
                </div>
                {errors.niches && <p className="mt-1 text-xs text-red-500">{errors.niches}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dos">{t("field.dos")}</Label>
                <Textarea
                  id="dos"
                  rows={3}
                  placeholder={t("field.briefDos.placeholder")}
                  value={dos}
                  onChange={(e) => setDos(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="donts">{t("field.donts")}</Label>
                <Textarea
                  id="donts"
                  rows={3}
                  placeholder={t("field.briefDonts.placeholder")}
                  value={donts}
                  onChange={(e) => setDonts(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <Separator />
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>{t("label.deliverables")}</Label>
                <Button variant="outline" size="sm" onClick={addDeliverable}>
                  <Plus className="size-3.5" /> {t("action.add")}
                </Button>
              </div>
              <div className="space-y-3">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Select
                      value={d.format}
                      onValueChange={(v) => {
                        if (!v) return;
                        const updated = [...deliverables];
                        updated[i] = { ...updated[i], format: v };
                        setDeliverables(updated);
                      }}
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <span className="truncate">
                          {formatLabels[d.format as ContentFormat]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(formatLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={d.quantity}
                      onChange={(e) => {
                        const updated = [...deliverables];
                        updated[i] = { ...updated[i], quantity: Number(e.target.value) };
                        setDeliverables(updated);
                      }}
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">{t("label.perCreator")}</span>
                    {deliverables.length > 1 && (
                      <Button variant="ghost" size="icon-sm" onClick={() => removeDeliverable(i)}>
                        <Trash2 className="size-3.5 text-muted-foreground/70" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Budget & Timeline */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.budgetTimeline")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div data-testid="campaign-investment-planner">
              <CampaignInvestmentPlanner
                locale={locale}
                serviceFeeCents={serviceFeeEstimate.feeCents}
                serviceFeeDisplay={serviceFeeDisplay}
                serviceFeeScopeSummary={t("investment.serviceFee.capacitySummary", {
                  count: String(maxCreatorsForPricing),
                })}
                serviceFeeScopeDetail={t(serviceFeeEstimate.scopeDetailKey)}
                requiresCustomPricing={serviceFeeEstimate.requiresCustomPricing}
                creatorCapacityOptions={creatorCapacityOptions}
                creatorsCount={creatorsCount}
                creatorCapacityMax={
                  campaignMode === "private"
                    ? PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS
                    : 5000
                }
                onCreatorsCountChange={handleCreatorsCountChange}
                creatorBudget={creatorBudget}
                onCreatorBudgetChange={(value) => {
                  setCreatorBudget(value);
                  clearEnterpriseReview();
                  clearBudgetError();
                }}
                productValue={productValue}
                onProductValueChange={(value) => {
                  setProductValue(value);
                  clearEnterpriseReview();
                  clearBudgetError();
                }}
                fulfillmentBudget={fulfillmentBudget}
                onFulfillmentBudgetChange={(value) => {
                  setFulfillmentBudget(value);
                  clearEnterpriseReview();
                  clearBudgetError();
                }}
                creatorBudgetPerCreator={creatorBudgetPerCreator}
                campaignInvestmentTotal={campaignInvestmentTotal}
                campaignInvestmentTotalDisplay={campaignInvestmentTotalDisplay}
                copy={{
                  creatorsCount: t("field.creatorsCount"),
                  creatorBudget: t("investment.creatorBudget"),
                  productValue: t("investment.productValue"),
                  fulfillment: t("investment.fulfillment"),
                  decreaseCreators: t("investment.creators.decrease"),
                  increaseCreators: t("investment.creators.increase"),
                  setCreatorCapacity: t("investment.creators.setCapacity"),
                  serviceFee: t("investment.serviceFee"),
                  total: t("investment.total"),
                }}
              />
            </div>
            {requiresEnterpriseConcierge && (
              <EnterpriseConciergePanel
                creatorCount={maxCreatorsForPricing}
                marketCount={marketPricingScopeCount}
                platformCount={platforms.length}
                requesting={requestingEnterpriseReview}
                requested={Boolean(enterpriseRequestId)}
                trackingHref="/b/campaigns#enterprise-concierge-requests"
                onRequest={requestEnterpriseReview}
                copy={{
                  heading: t("enterprise.title"),
                  detail: t(
                    privateCapacityExceedsSelfServe
                      ? "enterprise.detail.privateCapacity"
                      : "enterprise.detail",
                  ),
                  followUp: t("enterprise.followUp"),
                  creators: t("enterprise.creators"),
                  markets: t("enterprise.markets"),
                  platforms: t("enterprise.platforms"),
                  action: t("enterprise.action"),
                  requesting: t("enterprise.requesting"),
                  requested: t("enterprise.requested"),
                }}
              />
            )}
            {errors.budget && <p className="mt-1 text-xs text-red-500">{errors.budget}</p>}
            {errors.creatorsCount && (
              <p className="mt-1 text-xs text-red-500">{errors.creatorsCount}</p>
            )}
            <Separator />
            <div
              data-testid="campaign-timeline-summary"
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {t("timeline.title")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatTimelineRange(
                      timelineDates,
                      {
                        notSet: t("timeline.notSet"),
                        rangeTo: t("timeline.range.to"),
                      },
                    )}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("timeline.description")}
                </p>
              </div>
              <div className="mt-4">
                <CampaignTimelineSelector
                  dates={timelineDates}
                  onChange={(nextDates) => {
                    setStartDate(nextDates.startDate);
                    setEndDate(nextDates.endDate);
                    setApplicationDeadline(nextDates.applicationDeadline);
                    setContentDeadline(nextDates.contentDeadline);
                    setPerformanceDeadline(nextDates.performanceDeadline);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.dates;
                      return next;
                    });
                  }}
                  locale={locale}
                  copy={timelineCopy}
                />
              </div>
            </div>
            {errors.dates && <p className="mt-1 text-xs text-red-500">{errors.dates}</p>}
            <div data-testid="campaign-reporting-cadence">
              <ReportingCadenceSelector
                value={reportingCadence}
                onChange={setReportingCadence}
                copy={{
                  heading: t("reporting.title"),
                  options: {
                    final_only: {
                      title: t("reporting.final.title"),
                      detail: t("reporting.final.detail"),
                    },
                    weekly: {
                      title: t("reporting.keyReads.title"),
                      detail: t("reporting.keyReads.detail"),
                    },
                    daily_launch_window: {
                      title: t("reporting.daily.title"),
                      detail: t("reporting.daily.detail"),
                    },
                  },
                }}
              />
            </div>
            <ReportGoalSelector
              activePresetId={selectedReportPresetId}
              activeTemplateId={selectedReportTemplateId}
              templates={reportGoalTemplates}
              onPresetSelect={selectCampaignReportPreset}
              onTemplateSelect={applyCampaignReportTemplate}
              copy={{
                heading: t("reportGoal.title"),
                detail: t("reportGoal.detail"),
                templates: t("reportGoal.templates"),
                presets: t("reportGoal.presets"),
                defaultLabel: t("reportGoal.default"),
                empty: t("reportGoal.empty"),
                translate: t,
              }}
            />
            <ReportGoalOutputPreview
              title={selectedReportGoalTitle}
              chartLabel={selectedReportGoalChartLabel}
              blockLabels={selectedReportGoalBlockLabels}
              copy={{
                eyebrow: t("reportGoal.outputEyebrow"),
                outputTitle: t("reportGoal.outputTitle"),
                detail: t("reportGoal.outputDetail"),
                blocksLabel: t("reportGoal.blocksLabel"),
                chartLabel: t("reportGoal.chartLabel"),
                creatorProofLabel: t("reportGoal.creatorProofLabel"),
                creatorProofDetail: t("reportGoal.creatorProofDetail"),
              }}
            />
            <div data-testid="campaign-measurement-contract">
              <MeasurementContractSelector
                value={measurementContractGoal}
                platforms={measurementPlatforms}
                selectedMetricKeysByPlatform={selectedMetricKeysByPlatform}
                additionalProofChannels={additionalProofChannels}
                onChange={handleMeasurementContractGoalChange}
                onToggleMetric={toggleMeasurementMetric}
                onToggleAdditionalProofChannel={toggleAdditionalProofChannel}
                onGenericProofLabelChange={updateGenericProofLabel}
                additionalProofError={errors.additionalProofChannels}
                copy={{
                  heading: t("measurement.title"),
                  detail: t("measurement.detail"),
                  fields: t("measurement.requiredFields"),
                  additionalProofTitle: t("measurement.additionalProof.title"),
                  additionalProofDetail: t("measurement.additionalProof.detail"),
                  genericProofLabel: t("measurement.additionalProof.generic.label"),
                  genericProofPlaceholder: t(
                    "measurement.additionalProof.generic.placeholder",
                  ),
                  options: {
                    awareness: {
                      title: t("measurement.awareness.title"),
                      detail: t("measurement.awareness.detail"),
                    },
                    engagement_quality: {
                      title: t("measurement.engagement.title"),
                      detail: t("measurement.engagement.detail"),
                    },
                    traffic_actions: {
                      title: t("measurement.traffic.title"),
                      detail: t("measurement.traffic.detail"),
                    },
                    luxury_proof: {
                      title: t("measurement.luxury.title"),
                      detail: t("measurement.luxury.detail"),
                    },
                  },
                  additionalProofOptions: {
                    x: {
                      title: t("measurement.additionalProof.x"),
                      detail: t("measurement.additionalProof.x.detail"),
                    },
                    generic: {
                      title: t("measurement.additionalProof.generic"),
                      detail: t("measurement.additionalProof.generic.detail"),
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Settings */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.settings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>{t("field.usageRights")}</Label>
              <div className="mt-2 space-y-2">
                {usageRightsOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      usageRights === opt.value
                        ? "border-primary bg-muted/50"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="usageRights"
                      value={opt.value}
                      checked={usageRights === opt.value}
                      onChange={(e) => setUsageRights(e.target.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t(opt.labelKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(opt.descKey)}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="maxRevisions">{t("field.maxRevisions")}</Label>
              <Input
                id="maxRevisions"
                type="number"
                min={1}
                max={10}
                value={maxRevisions}
                onChange={(e) => setMaxRevisions(e.target.value)}
                className="mt-1.5 w-32"
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("field.maxRevisions.hint")}</p>
            </div>
            <div>
              <Label htmlFor="complianceNotes">{t("field.complianceNotes")}</Label>
              <Textarea
                id="complianceNotes"
                rows={3}
                placeholder={t("field.complianceNotes.placeholder")}
                value={complianceNotes}
                onChange={(e) => setComplianceNotes(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review & Publish */}
      {step === FINAL_STEP && (
        <Card>
          <CardHeader>
            <CardTitle>{t("step.reviewPublish")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="mb-3 font-medium text-foreground">{t("review.summary")}</h3>
              <div
                data-testid="campaign-review-creator-preview-image"
                className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-background p-2"
              >
                <div
                  role={campaignImagePreviewUrl ? "img" : undefined}
                  aria-label={campaignImageFile?.name ?? undefined}
                  className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted bg-cover bg-center text-muted-foreground"
                  style={
                    campaignImagePreviewUrl
                      ? { backgroundImage: `url(${campaignImagePreviewUrl})` }
                      : undefined
                  }
                >
                  {!campaignImagePreviewUrl && (
                    <ImageIcon className="size-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {t("review.label.campaignImage")}
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {campaignImageFile?.name ?? t("review.tbd")}
                  </p>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.title")}</dt>
                  <dd className="font-medium text-foreground">{title || t("review.untitled")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.mode")}</dt>
                  <dd className="text-foreground">
                    {t(selectedCampaignPackage.titleKey)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("review.label.creatorLanguage")}
                  </dt>
                  <dd className="text-foreground">{creatorLanguageLabel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.platforms")}</dt>
                  <dd className="text-foreground">
                    {platforms.map((p) => getPlatformLabel(p)).join(", ") || t("review.none")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.markets")}</dt>
                  <dd className="text-foreground">
                    {markets.map((m) => getMarketLabel(m, locale)).join(", ") || t("review.none")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.niches")}</dt>
                  <dd className="text-foreground">
                    {niches.map((n) => nicheLabels[n as Niche]).join(", ") || t("review.none")}
                  </dd>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.creatorBudget")}</dt>
                  <dd className="text-foreground">
                    {formatMoneyAmount(creatorBudgetAmount, locale)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("review.label.productFulfillment")}
                  </dt>
                  <dd className="text-foreground">
                    {formatMoneyAmount(productValueAmount + fulfillmentBudgetAmount, locale)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.serviceFee")}</dt>
                  <dd className="text-foreground">{serviceFeeDisplay}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {t("review.label.investmentTotal")}
                  </dt>
                  <dd className="text-foreground">{campaignInvestmentTotalDisplay}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.creators")}</dt>
                  <dd className="text-foreground">{creatorsCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.deliverables")}</dt>
                  <dd className="text-foreground">
                    {deliverables.map((d) => `${d.quantity}x ${formatLabels[d.format as ContentFormat]}`).join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.timeline")}</dt>
                  <dd className="text-foreground">
                    {startDate || t("review.tbd")} - {endDate || t("review.tbd")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.reporting")}</dt>
                  <dd className="text-foreground">{selectedReportingCadenceLabel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.reportGoal")}</dt>
                  <dd className="text-foreground">{selectedReportGoalTitle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.reportChart")}</dt>
                  <dd className="text-foreground">{selectedReportGoalChartLabel}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="shrink-0 text-muted-foreground">
                    {t("review.label.reportBlocks")}
                  </dt>
                  <dd className="max-w-[24rem] text-end text-foreground">
                    {selectedReportGoalBlockLabels.join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.measurement")}</dt>
                  <dd className="text-foreground">{selectedMeasurementContractLabel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("review.label.maxRevisions")}</dt>
                  <dd className="text-foreground">{maxRevisions}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="shrink-0 text-muted-foreground">
                    {t("review.label.complianceNotes")}
                  </dt>
                  <dd className="max-w-[24rem] text-end text-foreground">
                    {complianceNotes.trim() || t("review.none")}
                  </dd>
                </div>
              </dl>
            </div>
            <div
              data-testid="campaign-review-billing-scope"
              className="rounded-lg border border-border bg-background p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {t("review.billingScope.title")}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(selectedCampaignPackage.titleKey)}
                  </p>
                </div>
                <div className="text-start sm:text-end">
                  <p className="text-xs text-muted-foreground">
                    {t("review.label.serviceFee")}
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {serviceFeeDisplay}
                  </p>
                </div>
              </div>
              {!requiresEnterpriseConcierge && (
                <div
                  data-testid="campaign-review-billing-included"
                  className="mt-4 grid gap-2 text-xs sm:grid-cols-3"
                >
                  <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                    <p className="text-muted-foreground">
                      {t("review.billingScope.creatorCapacity")}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {maxCreatorsForPricing}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                    <p className="text-muted-foreground">
                      {t("review.billingScope.activeDays")}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {serviceFeeEstimate.includedActiveDays}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                    <p className="text-muted-foreground">
                      {t("review.billingScope.reportingDays")}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {serviceFeeEstimate.includedReportingDays}
                    </p>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {t(serviceFeeEstimate.scopeDetailKey)}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("review.billingScope.separateCosts")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreementGateEnabled}
                  onChange={(event) => setAgreementGateEnabled(event.target.checked)}
                  className="mt-1 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {t("agreement.title")}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t("agreement.detail")}
                  </span>
                </span>
              </label>
              {agreementGateEnabled && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.values(agreementPreviewSummary).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                {t(
                  campaignMode === "private"
                    ? "review.publishWarning.private"
                    : "review.publishWarning.sourced"
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className={`mx-auto flex max-w-3xl items-center ${step === 0 ? "justify-end" : "justify-between"}`}>
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {step === 1 ? t("action.backToModel") : t("action.back")}
            </Button>
          )}
          {step < FINAL_STEP ? (
            <Button onClick={goNext} disabled={navigationNextDisabled}>
              {t("action.next")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {t("action.saveDraft")}
              </Button>
              <Button onClick={handlePublish} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {t("action.publish")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
