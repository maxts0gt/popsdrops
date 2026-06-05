"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  FileUp,
  ExternalLink,
  Shield,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_LABELS,
  FORMAT_KEYS,
  type Platform,
  type ContentFormat,
} from "@/lib/constants";
import {
  getReportingPlatformLabel,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import { useI18n, useTranslation } from "@/lib/i18n";
import { getCurrentUserId } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { ReviewDialog } from "@/components/shared/review-dialog";
import { ContentSubmitForm } from "@/components/shared/content-submit-form";
import { PerformanceForm } from "@/components/shared/performance-form";
import { getSingleRelation } from "@/lib/supabase/relations";
import { publishContent } from "@/app/actions/content";
import { createExtraPerformanceReportTask } from "@/app/actions/reporting-evidence";
import {
  AgreementGate,
  type CampaignAgreementGateRow,
} from "@/components/campaigns/agreement-gate";
import type { AgreementStatus } from "@/lib/agreements/campaign-agreement";
import {
  getActiveCreatorRoomSubmissions,
  getCreatorRoomNextAction,
  type CreatorRoomNextAction,
  type CreatorRoomTab,
} from "@/lib/campaigns/creator-room-next-action";
import { getCreatorReportSubmissionState } from "@/lib/campaigns/creator-report-submission-state";
import {
  getPlatformPostUrlExample,
  isPlatformPostUrl,
} from "@/lib/platform-url";
import {
  mapCampaignAssetRow,
  type CampaignCreativeAsset,
} from "@/lib/campaigns/creative-kit";
import {
  getCreatorReportGoalContext,
  type CreatorReportGoalContext,
} from "@/lib/reporting/creator-report-goal-context";
import type {
  CampaignAssetStatus,
  CampaignAssetType,
  CampaignAssetVisibility,
  CampaignReportTaskStatus,
  PaymentStatusType,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRoom {
  id: string;
  title: string;
  brand_id: string;
  brand_name: string;
  brand_description: string | null;
  brand_website: string | null;
  brand_rating: number;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  platforms: Platform[];
  markets: string[];
  status: string;
  content_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  max_revisions: number;
  compliance_notes: string | null;
  accepted_rate: number;
  payment_status: PaymentStatusType;
  member_id: string;
  joined_at: string;
}

interface Deliverable {
  id: string;
  platform: Platform;
  content_type: string;
  quantity: number;
  notes: string | null;
}

interface Submission {
  id: string;
  platform: Platform | null;
  content_type: string | null;
  status: string;
  caption: string | null;
  feedback: string | null;
  parent_submission_id: string | null;
  version: number;
  revision_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_url: string | null;
  content_performance?:
    | {
        id?: string | null;
        report_task_id: string | null;
        reported_at?: string | null;
        verification_status: string | null;
        evidence_review_note?: string | null;
      }[]
    | {
        id?: string | null;
        report_task_id: string | null;
        reported_at?: string | null;
        verification_status: string | null;
        evidence_review_note?: string | null;
      }
    | null;
}

interface ReportTask {
  id: string;
  task_key: string;
  period_start: string | null;
  period_end: string | null;
  due_at: string;
  status: CampaignReportTaskStatus;
  submitted_at: string | null;
  review_note: string | null;
}

interface ReportingRequirement {
  id: string;
  platform: ReportingPlatform;
  platform_label: string | null;
  content_format: string;
  required_metric_keys: string[];
}

interface CampaignAssetRecord {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  asset_type: CampaignAssetType;
  bucket_id: "campaign-assets";
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  visibility: CampaignAssetVisibility;
  status: CampaignAssetStatus;
  created_at: string;
}

interface AgreementStatusRow {
  campaign_id: string;
  campaign_member_id: string;
  creator_id: string;
  agreement_id: string | null;
  agreement_version: number | null;
  status: AgreementStatus;
  accepted_at: string | null;
  typed_name: string | null;
}

interface BrandProfileRecord {
  company_name: string | null;
  description: string | null;
  website: string | null;
  rating: number | null;
}

interface CampaignBrandRecord {
  full_name: string | null;
  brand_profiles: BrandProfileRecord | BrandProfileRecord[] | null;
}

interface CampaignRecord {
  id: string;
  title: string;
  status: string;
  brand_id: string;
  platforms: Platform[] | null;
  markets: string[] | null;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  content_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  max_revisions: number | null;
  compliance_notes: string | null;
  profiles: CampaignBrandRecord | CampaignBrandRecord[] | null;
}

interface CampaignMemberRecord {
  id: string;
  accepted_rate: number | null;
  payment_status: PaymentStatusType;
  joined_at: string;
  campaigns: CampaignRecord | CampaignRecord[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null, locale = "en"): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string | null, locale = "en"): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function brandInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function splitLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n|(?<=\.)(?:\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const GENERIC_CORRECTION_REVIEW_NOTES = new Set([
  "Correction requested",
  "Evidence values need creator correction.",
]);

function getReportCorrectionDetail(task: ReportTask, fallback: string): string {
  const note = task.review_note?.trim();
  if (!note || GENERIC_CORRECTION_REVIEW_NOTES.has(note)) return fallback;
  return note;
}

function getReportCorrectionPriority(task: ReportTask): number {
  const note = task.review_note?.trim();
  return note && !GENERIC_CORRECTION_REVIEW_NOTES.has(note) ? 0 : 1;
}

const submissionStatusStyles: Record<string, string> = {
  draft: "bg-muted/50 text-muted-foreground",
  submitted: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  revision_requested: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  published: "bg-primary text-primary-foreground",
};

const submissionStatusKeys: Record<string, string> = {
  draft: "status.draft",
  submitted: "status.submitted",
  approved: "status.approved",
  revision_requested: "status.revisionRequested",
  published: "status.published",
};

const reportSubmittedStatuses = new Set([
  "submitted",
  "submitted_late",
  "verified",
  "excused",
]);

function getCreatorReportTaskLabelKey(taskKey: string): string {
  if (taskKey.startsWith("daily:")) return "task.reportKind.daily";
  if (taskKey.startsWith("weekly:")) return "task.reportKind.weekly";
  if (taskKey.startsWith("custom:")) return "task.reportKind.custom";
  if (taskKey.startsWith("post:")) return "task.reportKind.post";
  if (taskKey.startsWith("extra:")) return "task.reportKind.extra";
  if (taskKey === "final") return "task.reportKind.final";

  return "task.reportKind.default";
}

function getCreatorReportTaskStatusKey(
  status: CampaignReportTaskStatus,
): string {
  const statusKeyByStatus = {
    pending: "task.reportStatus.pending",
    submitted: "task.reportStatus.submitted",
    submitted_late: "task.reportStatus.submittedLate",
    verified: "task.reportStatus.verified",
    needs_revision: "task.reportStatus.needsRevision",
    missed: "task.reportStatus.missed",
    excused: "task.reportStatus.excused",
  } satisfies Record<CampaignReportTaskStatus, string>;

  return statusKeyByStatus[status];
}

function getCreatorReportTaskStyle(status: CampaignReportTaskStatus): string {
  if (status === "verified" || status === "submitted") {
    return "border-emerald-200 bg-emerald-50/60 text-emerald-950";
  }

  if (status === "submitted_late") {
    return "border-amber-200 bg-amber-50/70 text-amber-950";
  }

  if (status === "needs_revision") {
    return "border-amber-200 bg-amber-50/70 text-amber-950";
  }

  if (status === "missed") {
    return "border-red-200 bg-red-50/70 text-red-950";
  }

  if (status === "excused") {
    return "border-border bg-muted/40 text-muted-foreground";
  }

  return "border-border bg-background text-foreground";
}

function formatReportTaskWindow(
  task: Pick<ReportTask, "period_start" | "period_end" | "due_at">,
  locale: string,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  if (!task.period_start || !task.period_end) {
    return formatShortDate(task.due_at, locale);
  }

  const start = formatShortDate(task.period_start, locale);
  const end = formatShortDate(task.period_end, locale);

  if (start === end) {
    return t("task.reportWindow.single", { date: start });
  }

  return t("task.reportWindow.range", { start, end });
}

function formatReportTaskCount(
  count: number,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  if (count === 1) return t("task.reportCountSingular");

  return t("task.reportCountPlural", { count: String(count) });
}

function sortReportTasksByDueAt(tasks: ReportTask[]): ReportTask[] {
  return tasks.toSorted(
    (first, second) =>
      new Date(first.due_at).getTime() - new Date(second.due_at).getTime(),
  );
}

function getReportingRequirementForSubmission(
  reportingRequirements: ReportingRequirement[],
  submission: Submission,
): ReportingRequirement | undefined {
  if (!submission.platform) return undefined;

  return reportingRequirements.find(
    (requirement) =>
      requirement.platform === submission.platform &&
      (!submission.content_type || requirement.content_format === submission.content_type),
  );
}

function getAdditionalReportingRequirementsForSubmission(
  reportingRequirements: ReportingRequirement[],
  submission: Submission,
  campaignPlatforms: Platform[],
): ReportingRequirement[] {
  if (!submission.platform) return [];

  const campaignPlatformSet = new Set(campaignPlatforms);

  return reportingRequirements.filter(
    (requirement) =>
      requirement.platform !== submission.platform &&
      !campaignPlatformSet.has(requirement.platform as Platform) &&
      (!submission.content_type || requirement.content_format === submission.content_type),
  );
}

function getRequestedCreatorRoomTab(tab: string | null): CreatorRoomTab | null {
  return tab === "brief" || tab === "tasks" || tab === "submit" ? tab : null;
}

function buildCreatorRoomTabUrl(
  pathname: string,
  currentSearchParams: { toString(): string },
  tab: CreatorRoomTab,
): string {
  const nextSearchParams = new URLSearchParams(currentSearchParams.toString());
  nextSearchParams.set("tab", tab);
  const query = nextSearchParams.toString();

  return query ? `${pathname}?${query}` : pathname;
}

const creatorRoomStatusOnlyActions = new Set<CreatorRoomNextAction["key"]>([
  "brandReview",
  "proofReview",
  "onTrack",
]);

function CampaignRoomActionStrip({
  action,
  label,
  title,
  detail,
  due,
  actionLabel,
  onClick,
}: {
  action: CreatorRoomNextAction;
  label: string;
  title: string;
  detail: string;
  due: string | null;
  actionLabel: string;
  onClick: () => void;
}) {
  const styleByKey: Record<CreatorRoomNextAction["key"], string> = {
    reportCorrection: "border-amber-200 bg-card text-foreground",
    contentRevision: "border-amber-200 bg-card text-foreground",
    firstDraft: "border-border bg-card text-foreground",
    brandReview: "border-border bg-card text-foreground",
    publishUrl: "border-border bg-card text-foreground",
    performanceProof: "border-border bg-card text-foreground",
    performanceOverdue: "border-red-200 bg-card text-foreground",
    proofReview: "border-border bg-card text-foreground",
    onTrack: "border-border bg-card text-foreground",
  };
  const iconByKey = {
    reportCorrection: AlertCircle,
    contentRevision: FileUp,
    firstDraft: FileUp,
    brandReview: Clock,
    publishUrl: ExternalLink,
    performanceProof: FileUp,
    performanceOverdue: AlertCircle,
    proofReview: Clock,
    onTrack: CheckCircle2,
  } satisfies Record<CreatorRoomNextAction["key"], typeof FileUp>;
  const Icon = iconByKey[action.key];
  const showActionButton = !creatorRoomStatusOnlyActions.has(action.key);

  return (
    <div
      className={`rounded-xl border px-3 py-3 ${styleByKey[action.key]}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground ring-1 ring-black/[0.04]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground/70">
              {label}
            </span>
            {due && (
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-black/[0.04]">
                {due}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold leading-snug">{title}</p>
          <p className="text-xs leading-snug text-muted-foreground">{detail}</p>
        </div>
        {showActionButton && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onClick}
            className="h-8 shrink-0 px-2.5 text-xs"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function CampaignBriefWorkspace({
  room,
  deliverables,
  locale,
  t,
  getContentFormatLabel,
}: {
  room: CampaignRoom;
  deliverables: Deliverable[];
  locale: string;
  t: (key: string, values?: Record<string, string>) => string;
  getContentFormatLabel: (contentType: string) => string;
}) {
  const timelineItems = [
    { label: t("timeline.contentDue"), date: room.content_due_date },
    { label: t("timeline.postingWindow"), date: room.posting_window_start },
    { label: t("timeline.postingEnds"), date: room.posting_window_end },
  ].filter((item) => item.date);
  const hasGuidance =
    Boolean(room.brief_requirements) ||
    Boolean(room.brief_dos) ||
    Boolean(room.brief_donts) ||
    Boolean(room.compliance_notes);

  return (
    <div
      className="space-y-3 rounded-xl border border-border bg-card p-3"
      data-testid="creator-brief-workspace"
    >
      {room.brief_description && (
        <section>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground/70">
            {t("brief.overview")}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {room.brief_description}
          </p>
        </section>
      )}

      {(deliverables.length > 0 || timelineItems.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
          {deliverables.length > 0 && (
            <section
              className="rounded-xl bg-muted/35 p-3 ring-1 ring-border/50"
              data-testid="creator-brief-deliverables"
            >
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground/70">
                {t("brief.deliverables")}
              </p>
              <div className="space-y-2">
                {deliverables.map((deliverable) => {
                  const Icon = PlatformIcon[deliverable.platform];
                  const formatLabel = getContentFormatLabel(
                    deliverable.content_type,
                  );

                  return (
                    <div
                      key={deliverable.id}
                      className="flex min-w-0 items-center gap-2 rounded-lg bg-card px-2.5 py-2 ring-1 ring-border/60"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {deliverable.quantity} x {formatLabel}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {PLATFORM_LABELS[deliverable.platform]}
                          {deliverable.notes ? `, ${deliverable.notes}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {timelineItems.length > 0 && (
            <section
              className="rounded-xl bg-muted/35 p-3 ring-1 ring-border/50"
              data-testid="creator-brief-timeline"
            >
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground/70">
                {t("brief.keyDates")}
              </p>
              <div className="space-y-2">
                {timelineItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {item.label}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-foreground">
                      {formatShortDate(item.date, locale)}
                    </span>
                  </div>
                ))}
                <div className="pt-1 text-xs text-muted-foreground">
                  {t("brief.maxRevisions", {
                    count: String(room.max_revisions),
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {hasGuidance && (
        <section
          className="space-y-3 rounded-xl bg-muted/25 p-3 ring-1 ring-border/50"
          data-testid="creator-brief-guidance"
        >
          <p className="text-xs font-semibold uppercase text-muted-foreground/70">
            {t("brief.guidance")}
          </p>

          {room.brief_requirements && (
            <ul className="space-y-1.5">
              {splitLines(room.brief_requirements).map((requirement, index) => (
                <li
                  key={`${requirement}-${index}`}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          )}

          {(room.brief_dos || room.brief_donts) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {room.brief_dos && (
                <div className="rounded-lg bg-card p-2.5 ring-1 ring-border/60">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ThumbsUp className="size-3.5" />
                    {t("brief.dos")}
                  </div>
                  <ul className="space-y-1">
                    {splitLines(room.brief_dos).map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {room.brief_donts && (
                <div className="rounded-lg bg-card p-2.5 ring-1 ring-border/60">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ThumbsDown className="size-3.5" />
                    {t("brief.donts")}
                  </div>
                  <ul className="space-y-1">
                    {splitLines(room.brief_donts).map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {room.compliance_notes && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50/50 p-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-500/10 dark:bg-amber-950/30 dark:text-amber-300">
              <Shield className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p>{room.compliance_notes}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CampaignSubmitWorkspace({
  room,
  creativeAssets,
  submissions,
  hasRevisionNeeded,
  showContentSubmitForm,
  creatorWorkIsOpen,
  correctionReportTask,
  activeReportTask,
  isReportCorrection,
  reportingRequirements,
  reportGoalContext,
  locale,
  t,
  tc,
  onReload,
}: {
  room: CampaignRoom;
  creativeAssets: CampaignCreativeAsset[];
  submissions: Submission[];
  hasRevisionNeeded: boolean;
  showContentSubmitForm: boolean;
  creatorWorkIsOpen: boolean;
  correctionReportTask: ReportTask | undefined;
  activeReportTask: ReportTask | null;
  isReportCorrection: boolean;
  reportingRequirements: ReportingRequirement[];
  reportGoalContext: CreatorReportGoalContext | null;
  locale: string;
  t: (key: string, values?: Record<string, string>) => string;
  tc: (key: string, values?: Record<string, string>) => string;
  onReload: () => void;
}) {
  const activeSubmissionStates = getActiveCreatorRoomSubmissions(
    submissions.map((submission) => ({
      id: submission.id,
      parentSubmissionId: submission.parent_submission_id,
    })),
  );
  const activeSubmissionIds = new Set(
    activeSubmissionStates.map((submission) => submission.id),
  );
  const activeSubmissions = submissions.filter((submission) =>
    activeSubmissionIds.has(submission.id),
  );
  const publishedSubmissions = activeSubmissions.filter(
    (submission) => submission.status === "published",
  );
  const savedLiveUrlCount = activeSubmissions.filter(
    (submission) => Boolean(submission.published_url),
  ).length;
  const hasLiveUrlWork = activeSubmissions.some(
    (submission) =>
      submission.status === "approved" && !submission.published_url,
  );
  const reportIsComplete =
    activeReportTask != null && reportSubmittedStatuses.has(activeReportTask.status);
  const acceptedCreatorAssets = creativeAssets.filter(
    (asset) =>
      asset.status === "ready" &&
      (asset.visibility === "public" || asset.visibility === "member"),
  );
  const submissionsNeedingPerformanceProof = activeSubmissions
    .filter((submission) =>
      getCreatorReportSubmissionState({
        activeReportTask,
        isReportCorrection,
        submission,
      }).shouldShowForm,
    );
  const performanceStageDetailKey = reportIsComplete
    ? "submit.stage.performance.done"
    : submissionsNeedingPerformanceProof.length > 0 || isReportCorrection
      ? "submit.stage.performance.proofFirst"
      : publishedSubmissions.length > 0
        ? "submit.stage.performance.active"
        : "submit.stage.performance.pending";
  const workflowStages = [
    {
      key: "content",
      label: t("submit.stage.content"),
      detail: t(
        activeSubmissions.length === 0
          ? "submit.stage.content.pending"
          : showContentSubmitForm
            ? "submit.stage.content.active"
            : "submit.stage.content.done",
        { count: String(activeSubmissions.length) },
      ),
      done: activeSubmissions.length > 0 && !showContentSubmitForm,
      active:
        creatorWorkIsOpen &&
        (showContentSubmitForm || activeSubmissions.length === 0),
    },
    {
      key: "live-url",
      label: t("submit.stage.liveUrl"),
      detail: t(
        savedLiveUrlCount > 0
          ? "submit.stage.liveUrl.done"
          : hasLiveUrlWork
            ? "submit.stage.liveUrl.active"
            : "submit.stage.liveUrl.pending",
        { count: String(savedLiveUrlCount) },
      ),
      done: savedLiveUrlCount > 0,
      active: creatorWorkIsOpen && hasLiveUrlWork,
    },
    {
      key: "performance",
      label: t("submit.stage.performance"),
      detail: t(performanceStageDetailKey),
      done: reportIsComplete,
      active:
        creatorWorkIsOpen && publishedSubmissions.length > 0 && !reportIsComplete,
    },
  ];

  return (
    <div className="space-y-3" data-testid="creator-submit-workspace">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("submit.workflowTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("submit.workflowDetail")}
            </p>
          </div>
        </div>
        <div
          className="grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-muted/30"
          data-testid="creator-submit-stage-rail"
        >
          {workflowStages.map((stage) => (
            <div
              key={stage.key}
              aria-current={stage.active ? "step" : undefined}
              data-stage-state={
                stage.done ? "done" : stage.active ? "active" : "waiting"
              }
              data-testid="creator-submit-stage-item"
              className="border-e border-border px-2.5 py-2 last:border-e-0"
            >
              <div className="flex items-center gap-1.5">
                {stage.done ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle
                    className={`size-3.5 shrink-0 ${
                      stage.active ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  />
                )}
                <p
                  className={`truncate text-xs font-semibold ${
                    stage.active || stage.done
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {stage.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {!creatorWorkIsOpen && (
        <div
          className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground"
          data-testid="creator-work-read-only-stage"
        >
          {t("submit.readOnlyStage")}
        </div>
      )}

      {acceptedCreatorAssets.length > 0 && (
        <section
          className="rounded-xl border border-border bg-card p-3"
          data-testid="creator-room-creative-kit"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("creativeKit.title")}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("creativeKit.detail")}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {t("creativeKit.assets", {
                count: String(acceptedCreatorAssets.length),
              })}
            </span>
          </div>
          <div className="space-y-2">
            {acceptedCreatorAssets.slice(0, 6).map((asset) => {
              const content =
                asset.signedUrl && asset.mimeType.startsWith("image/") ? (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(13,148,136,0.24),transparent_36%),radial-gradient(circle_at_20%_80%,rgba(245,158,11,0.16),transparent_34%)]" />
                    <NextImage
                      src={asset.signedUrl}
                      alt={asset.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                      loading="eager"
                    />
                  </div>
                ) : (
                  <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-950 text-xs font-semibold text-white/80">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(13,148,136,0.24),transparent_36%),radial-gradient(circle_at_20%_80%,rgba(245,158,11,0.16),transparent_34%)]" />
                    <span className="relative">{brandInitials(room.brand_name)}</span>
                  </div>
                );

              return (
                <a
                  key={asset.id}
                  href={asset.signedUrl ?? undefined}
                  target={asset.signedUrl ? "_blank" : undefined}
                  rel={asset.signedUrl ? "noopener noreferrer" : undefined}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-2 transition hover:border-slate-300"
                  data-testid="creator-room-creative-kit-asset"
                >
                  {content}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {asset.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="truncate">
                        {room.platforms[0]
                          ? PLATFORM_LABELS[room.platforms[0]]
                          : room.brand_name}
                      </span>
                    </span>
                  </span>
                  {asset.signedUrl && (
                    <ExternalLink
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section
        className="overflow-hidden rounded-xl border border-border bg-card"
        data-testid="creator-handoff-list"
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t("submit.handoffSectionTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("submit.handoffSectionDetail")}
          </p>
        </div>
        {submissions.length > 0 && (
          <div className="space-y-3 p-3">
            {submissions.map((submission) => {
              const reportingRequirement = getReportingRequirementForSubmission(
                reportingRequirements,
                submission,
              );
              const additionalReportingRequirements =
                getAdditionalReportingRequirementsForSubmission(
                  reportingRequirements,
                  submission,
                  room.platforms,
                );
              const statusStyle =
                submissionStatusStyles[submission.status] ||
                submissionStatusStyles.draft;
              const statusKey =
                submissionStatusKeys[submission.status] || "status.draft";
              const reportState = getCreatorReportSubmissionState({
                activeReportTask,
                isReportCorrection,
                submission,
              });
              const shouldShowForm =
                submissionsNeedingPerformanceProof.includes(submission) &&
                reportState.shouldShowForm;
              const proofStatusLabel =
                submission.status !== "published"
                  ? t("submit.stage.performance.pending")
                  : reportState.statusKey === "submitted"
                    ? t("submit.reportSubmitted")
                    : reportState.statusKey === "correction"
                      ? t("submit.reportCorrectionStatus")
                      : t("submit.reportWaiting");
              const proofDetail =
                submission.status !== "published"
                  ? t("submit.handoff.proofAfterPost")
                  : reportState.dueAt
                    ? t("submit.performanceCorrectionDue", {
                        date: formatShortDate(reportState.dueAt, locale),
                      })
                    : t("submit.handoff.proofComplete");
              const liveUrlLabel = submission.published_url
                ? t("submit.handoff.liveSaved")
                : submission.status === "approved"
                  ? t("submit.handoff.liveNeeded")
                  : t("submit.handoff.liveWaiting");
              const liveUrlDetail = submission.published_url
                ? t("submit.handoff.liveReady")
                : submission.status === "approved"
                  ? t("submit.handoff.liveAdd")
                  : t("submit.handoff.liveAfterApproval");
              const correctionNote =
                reportState.statusKey === "correction"
                  ? reportState.correctionNote ??
                    (correctionReportTask
                      ? getReportCorrectionDetail(
                          correctionReportTask,
                          t("submit.performanceCorrectionDetail"),
                        )
                      : null)
                  : null;

              return (
                <div
                  key={submission.id}
                  className="rounded-xl border border-border bg-background p-3"
                  data-testid="creator-handoff-row"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {submission.platform
                          ? PLATFORM_LABELS[submission.platform]
                          : t("label.content")}{" "}
                        - v{submission.version}
                      </p>
                      {submission.submitted_at && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("room.submitted", {
                            date: formatDate(submission.submitted_at, locale),
                          })}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      v{submission.version}
                    </span>
                  </div>
                  <div
                    className="mt-3 grid gap-2 sm:grid-cols-3"
                    data-testid="creator-handoff-status-grid"
                  >
                    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {t("submit.handoff.content")}
                      </p>
                      <p
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}
                      >
                        {tc(statusKey)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {t("submit.handoff.liveUrl")}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {liveUrlLabel}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {liveUrlDetail}
                      </p>
                    </div>
                    <div
                      className="rounded-lg border border-border bg-card px-2.5 py-2"
                      data-testid="creator-report-status-row"
                    >
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {t("submit.handoff.proof")}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {proofStatusLabel}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {proofDetail}
                      </p>
                    </div>
                  </div>
                  {submission.caption && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {submission.caption}
                    </p>
                  )}
                  {submission.status === "revision_requested" && submission.feedback && (
                    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-500/10">
                      <span className="font-medium">{t("room.brandFeedback")} </span>
                      {submission.feedback}
                    </div>
                  )}
                  {creatorWorkIsOpen && submission.status === "approved" && !submission.published_url && (
                    <>
                      <p className="mt-2 text-xs font-medium text-emerald-700">
                        {t("room.approvedPublish")}
                      </p>
                      <PublishUrlForm
                        submissionId={submission.id}
                        platform={submission.platform}
                        labels={{
                          label: t("submit.publishedUrl"),
                          placeholder: getPlatformPostUrlExample(submission.platform),
                          submit: t("submit.publishUrl"),
                          submitting: t("submit.publishingUrl"),
                          required: t("submit.publishedUrlRequired"),
                          invalid: t("submit.publishedUrlInvalid", {
                            platform: submission.platform
                              ? PLATFORM_LABELS[submission.platform]
                              : t("label.content"),
                          }),
                        }}
                        onSuccess={onReload}
                      />
                    </>
                  )}
                  {submission.published_url && (
                    <a
                      href={submission.published_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                      {t("room.viewPublished")}
                    </a>
                  )}
                  {correctionNote && (
                    <div
                      data-testid="creator-report-correction-note"
                      className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900"
                    >
                      <span className="font-semibold">{t("room.brandFeedback")} </span>
                      {correctionNote}
                    </div>
                  )}
                  {creatorWorkIsOpen && shouldShowForm && (
                    <div className="mt-3 rounded-xl border border-border bg-card p-3">
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-foreground">
                          {t("submit.performanceSectionTitle")}
                        </h4>
                        {!correctionReportTask && !reportIsComplete && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("submit.reportPerformanceDetail")}
                          </p>
                        )}
                      </div>
                      <PerformanceForm
                        submissionId={submission.id}
                        reportTaskId={activeReportTask?.id}
                        reportTaskDueAt={activeReportTask?.due_at}
                        reportTaskStatus={activeReportTask?.status}
                        isSubmitted={reportState.isSubmitted}
                        platform={submission.platform!}
                        platformLabel={
                          submission.platform
                            ? PLATFORM_LABELS[submission.platform]
                            : null
                        }
                        requiredMetricKeys={reportingRequirement?.required_metric_keys ?? undefined}
                        additionalMetricGroups={additionalReportingRequirements.map(
                          (requirement) => ({
                            platform: requirement.platform,
                            platformLabel:
                              requirement.platform_label?.trim() ||
                              getReportingPlatformLabel(requirement.platform),
                            requiredMetricKeys: requirement.required_metric_keys,
                          }),
                        )}
                        reportGoalContext={reportGoalContext}
                        measurementType="final_7d"
                        onSuccess={onReload}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {creatorWorkIsOpen && showContentSubmitForm && (
          <div className="border-t border-border p-4">
            <h4 className="mb-4 text-sm font-semibold text-foreground">
              {hasRevisionNeeded ? t("submit.titleRevised") : t("submit.title")}
            </h4>
            <ContentSubmitForm
              campaignMemberId={room.member_id}
              platforms={room.platforms}
              onSuccess={onReload}
            />
          </div>
        )}
        {submissions.length === 0 && (
          <p className="px-4 py-3 text-center text-xs text-muted-foreground">
            {t("room.noSubmissions")}
          </p>
        )}
      </section>

      {correctionReportTask && (
        <div
          data-testid="creator-report-correction"
          className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900 ring-1 ring-amber-500/10"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {t("submit.performanceCorrection")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800/80">
                {t("submit.performanceCorrectionDetail")}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-amber-900/80">
            {t("submit.performanceCorrectionDue", {
              date: formatShortDate(correctionReportTask.due_at, locale),
            })}
          </span>
        </div>
      )}
    </div>
  );
}

function PublishUrlForm({
  submissionId,
  platform,
  labels,
  onSuccess,
}: {
  submissionId: string;
  platform: Platform | null;
  labels: {
    label: string;
    placeholder: string;
    submit: string;
    submitting: string;
    required: string;
    invalid: string;
  };
  onSuccess: () => void;
}) {
  const [publishedUrl, setPublishedUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);

    if (!publishedUrl.trim()) {
      setError(labels.required);
      return;
    }

    if (platform && !isPlatformPostUrl(platform, publishedUrl.trim())) {
      setError(labels.invalid);
      return;
    }

    startTransition(async () => {
      try {
        await publishContent(submissionId, publishedUrl.trim());
        onSuccess();
      } catch (e) {
        setError(e instanceof Error ? e.message : labels.required);
      }
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <label className="text-xs font-medium text-foreground">
        {labels.label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={publishedUrl}
          onChange={(e) => setPublishedUrl(e.target.value)}
          placeholder={labels.placeholder}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="sm:w-auto"
        >
          {isPending ? labels.submitting : labels.submit}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignRoomPage() {
  const { t } = useTranslation("creator.campaign");
  const { t: tc } = useTranslation("ui.common");
  const { locale, t: tGlobal } = useI18n();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;

  const [room, setRoom] = useState<CampaignRoom | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [creativeAssets, setCreativeAssets] = useState<CampaignCreativeAsset[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reportTasks, setReportTasks] = useState<ReportTask[]>([]);
  const [reportingRequirements, setReportingRequirements] = useState<
    ReportingRequirement[]
  >([]);
  const [reportGoalContext, setReportGoalContext] =
    useState<CreatorReportGoalContext | null>(null);
  const [agreement, setAgreement] = useState<CampaignAgreementGateRow | null>(null);
  const [agreementStatus, setAgreementStatus] = useState<AgreementStatusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [extraReportReadError, setExtraReportReadError] = useState<string | null>(
    null,
  );
  const [isAddingExtraReportRead, startAddingExtraReportRead] = useTransition();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const userId = await getCurrentUserId().catch(() => null);
      if (!userId) return;

      // Fetch membership + campaign + brand in one query
      const { data: memberData } = await supabase
        .from("campaign_members")
        .select(
          `id, accepted_rate, payment_status, joined_at,
           campaigns (
             id, title, status, brand_id, platforms, markets,
             brief_description, brief_requirements, brief_dos, brief_donts,
             content_due_date, posting_window_start, posting_window_end,
             max_revisions, compliance_notes,
             profiles!campaigns_brand_id_fkey (
               full_name,
               brand_profiles (
                 company_name, description, website, rating
               )
             )
           )`
        )
        .eq("campaign_id", campaignId)
        .eq("creator_id", userId)
        .single();

      const member = memberData as CampaignMemberRecord | null;
      if (member) {
        const c = getSingleRelation(member.campaigns);
        const brandProfileOwner = getSingleRelation(c?.profiles);
        const bp = getSingleRelation(brandProfileOwner?.brand_profiles);
        if (!c) {
          setLoading(false);
          return;
        }

        setRoom({
          id: c.id,
          title: c.title,
          brand_id: c.brand_id,
          brand_name: bp?.company_name || brandProfileOwner?.full_name || "Brand",
          brand_description: bp?.description || null,
          brand_website: bp?.website || null,
          brand_rating: bp?.rating || 0,
          brief_description: c.brief_description,
          brief_requirements: c.brief_requirements,
          brief_dos: c.brief_dos,
          brief_donts: c.brief_donts,
          platforms: c.platforms || [],
          markets: c.markets || [],
          status: c.status,
          content_due_date: c.content_due_date,
          posting_window_start: c.posting_window_start,
          posting_window_end: c.posting_window_end,
          max_revisions: c.max_revisions ?? 3,
          compliance_notes: c.compliance_notes,
          accepted_rate: member.accepted_rate ?? 0,
          payment_status: member.payment_status,
          member_id: member.id,
          joined_at: member.joined_at,
        });
      }

      // Fetch deliverables
      const { data: delData } = await supabase
        .from("campaign_deliverables")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("platform", { ascending: true });

      if (delData) setDeliverables(delData as Deliverable[]);

      const { data: reportingRequirementData } = await supabase
        .from("campaign_reporting_requirements")
        .select("id, platform, platform_label, content_format, required_metric_keys")
        .eq("campaign_id", campaignId)
        .order("sort_order", { ascending: true });

      if (reportingRequirementData) {
        setReportingRequirements(reportingRequirementData as ReportingRequirement[]);
      }

      const { data: reportGoalData } = await supabase
        .from("campaign_reporting_plans")
        .select("report_preset_id, report_chart_mode_id, report_block_ids")
        .eq("campaign_id", campaignId)
        .maybeSingle();

      setReportGoalContext(getCreatorReportGoalContext(reportGoalData));

      if (member) {
        const { data: assetData } = await supabase
          .from("campaign_assets")
          .select(
            "id, campaign_id, title, description, asset_type, bucket_id, storage_path, file_name, mime_type, size_bytes, visibility, status, created_at",
          )
          .eq("campaign_id", campaignId)
          .neq("status", "archived")
          .order("created_at", { ascending: false });

        if (assetData) {
          const assetRows = assetData as CampaignAssetRecord[];
          const assetPaths = assetRows.map((asset) => asset.storage_path);
          const signedAssetUrls =
            assetPaths.length > 0
              ? await supabase.storage
                  .from("campaign-assets")
                  .createSignedUrls(assetPaths, 600)
              : { data: [] };

          setCreativeAssets(
            assetRows.map((asset, index) =>
              mapCampaignAssetRow(
                asset,
                signedAssetUrls.data?.[index]?.signedUrl ?? null,
              ),
            ),
          );
        }
      }

      // Fetch submissions for this member
      if (member) {
        const { data: subData } = await supabase
          .from("content_submissions")
          .select("*, content_performance ( id, report_task_id, reported_at, verification_status )")
          .eq("campaign_member_id", member.id)
          .order("created_at", { ascending: false });

        if (subData) {
          const submissionRows = subData as Submission[];
          const performanceIds = submissionRows.flatMap((submission) => {
            const rows = Array.isArray(submission.content_performance)
              ? submission.content_performance
              : submission.content_performance
                ? [submission.content_performance]
                : [];

            return rows
              .map((row) => row.id)
              .filter((id): id is string => Boolean(id));
          });
          const evidenceReviewNoteByPerformanceId = new Map<string, string>();

          if (performanceIds.length > 0) {
            const { data: evidenceData } = await supabase
              .from("content_performance_evidence")
              .select("performance_id, review_note, verification_status")
              .in("performance_id", performanceIds);

            for (const evidence of evidenceData ?? []) {
              if (
                evidence.performance_id &&
                evidence.verification_status === "rejected" &&
                evidence.review_note?.trim()
              ) {
                evidenceReviewNoteByPerformanceId.set(
                  evidence.performance_id,
                  evidence.review_note.trim(),
                );
              }
            }
          }

          setSubmissions(
            submissionRows.map((submission) => {
              const performanceRows = Array.isArray(submission.content_performance)
                ? submission.content_performance
                : submission.content_performance
                  ? [submission.content_performance]
                  : [];

              return {
                ...submission,
                content_performance: performanceRows.map((row) => ({
                  ...row,
                  evidence_review_note: row.id
                    ? evidenceReviewNoteByPerformanceId.get(row.id) ?? null
                    : null,
                })),
              };
            }),
          );
        }

        const { data: taskData } = await supabase
          .from("campaign_report_tasks")
          .select("id, task_key, period_start, period_end, due_at, status, submitted_at, review_note")
          .eq("campaign_member_id", member.id)
          .order("due_at", { ascending: true });

        if (taskData) setReportTasks(taskData as ReportTask[]);

        const { data: agreementStatusData } = await supabase
          .from("campaign_member_agreement_status")
          .select(
            "campaign_id, campaign_member_id, creator_id, agreement_id, agreement_version, status, accepted_at, typed_name",
          )
          .eq("campaign_member_id", member.id)
          .maybeSingle();
        setAgreementStatus((agreementStatusData as AgreementStatusRow | null) ?? null);

        if (
          agreementStatusData?.agreement_id &&
          agreementStatusData.status !== "not_required"
        ) {
          const { data: agreementData } = await supabase
            .from("campaign_agreements")
            .select(
              "id, campaign_id, version, gate_mode, title, rules, agreement_body, file_name, requires_typed_name",
            )
            .eq("id", agreementStatusData.agreement_id)
            .eq("status", "published")
            .maybeSingle();
          setAgreement((agreementData as CampaignAgreementGateRow | null) ?? null);
        } else {
          setAgreement(null);
        }
      }

      setLoading(false);
    }
    load();
  }, [campaignId]);

  const activeSubmissionStates = getActiveCreatorRoomSubmissions(
    submissions.map((submission) => ({
      id: submission.id,
      parentSubmissionId: submission.parent_submission_id,
      status: submission.status,
      publishedUrl: submission.published_url,
    })),
  );
  const activeSubmissionIds = new Set(
    activeSubmissionStates.map((submission) => submission.id),
  );
  const activeSubmissions = submissions.filter((submission) =>
    activeSubmissionIds.has(submission.id),
  );
  const hasRevisionNeeded = activeSubmissions.some(
    (s) => s.status === "revision_requested"
  );
  const allApproved =
    activeSubmissions.length > 0 &&
    activeSubmissions.every((s) => s.status === "approved" || s.status === "published");
  const hasSubmissions = activeSubmissions.length > 0;
  const hasPublishedSubmissions = activeSubmissions.some(
    (s) => s.status === "published"
  );
  const hasApprovedContentMissingLiveUrl = activeSubmissions.some(
    (submission) =>
      submission.status === "approved" && !submission.published_url,
  );
  const correctionReportTasks = reportTasks.filter(
    (task) => task.status === "needs_revision",
  );
  const correctionReportTask = correctionReportTasks.toSorted((first, second) => {
    const priority = getReportCorrectionPriority(first) - getReportCorrectionPriority(second);
    if (priority !== 0) return priority;
    return new Date(first.due_at).getTime() - new Date(second.due_at).getTime();
  })[0];
  const activeReportTask =
    correctionReportTask ??
    reportTasks.find((task) => !reportSubmittedStatuses.has(task.status)) ??
    reportTasks.at(-1) ??
    null;
  const hasOpenReportTask =
    activeReportTask != null && !reportSubmittedStatuses.has(activeReportTask.status);
  const creatorWorkIsOpen =
    room != null && ["in_progress", "publishing", "monitoring"].includes(room.status);
  const canAddExtraReportRead =
    room != null && reportTasks.length > 0 && creatorWorkIsOpen && !hasOpenReportTask;
  const showContentSubmitForm =
    creatorWorkIsOpen && (
      activeSubmissions.length === 0 || hasRevisionNeeded
    );
  const isReportCorrection = activeReportTask?.status === "needs_revision";
  const shouldOpenSubmitTab =
    creatorWorkIsOpen &&
    (isReportCorrection ||
      hasRevisionNeeded ||
      hasApprovedContentMissingLiveUrl ||
      (hasPublishedSubmissions && hasOpenReportTask));
  const requestedTab = getRequestedCreatorRoomTab(searchParams.get("tab"));
  const initialTab = shouldOpenSubmitTab ? "submit" : "brief";
  const selectedTab = requestedTab ?? initialTab;
  const handleCreatorRoomTabChange = useCallback(
    (tab: CreatorRoomTab) => {
      router.replace(buildCreatorRoomTabUrl(pathname, searchParams, tab), {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  function handleAddExtraReportRead() {
    if (!room || !canAddExtraReportRead) return;

    setExtraReportReadError(null);
    startAddingExtraReportRead(async () => {
      try {
        const task = await createExtraPerformanceReportTask({
          campaignMemberId: room.member_id,
        });
        setReportTasks((currentTasks) =>
          sortReportTasksByDueAt([...currentTasks, task as ReportTask]),
        );
        handleCreatorRoomTabChange("submit");
      } catch {
        setExtraReportReadError(t("task.addReportReadError"));
      }
    });
  }

  useEffect(() => {
    if (requestedTab || !shouldOpenSubmitTab || selectedTab !== "submit") return;

    router.replace(buildCreatorRoomTabUrl(pathname, searchParams, "submit"), {
      scroll: false,
    });
  }, [pathname, requestedTab, router, searchParams, selectedTab, shouldOpenSubmitTab]);

  const roomAction = getCreatorRoomNextAction({
    submissions: submissions.map((submission) => ({
      id: submission.id,
      parentSubmissionId: submission.parent_submission_id,
      status: submission.status,
      publishedUrl: submission.published_url,
    })),
    reportTasks: reportTasks.map((task) => ({
      status: task.status,
      dueAt: task.due_at,
    })),
  });

  // Loading skeleton - content-shaped to match page layout
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        {/* Back link */}
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        {/* Header: brand initials + title + meta */}
        <div className="flex items-start gap-3">
          <div className="size-10 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="flex gap-3">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
        </div>
        {/* Action banner */}
        <div className="h-16 animate-pulse rounded-xl bg-blue-50/50 dark:bg-blue-950/30" />
        {/* Tab bar */}
        <div className="flex gap-1">
          <div className="h-9 w-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-9 w-16 animate-pulse rounded-lg bg-muted/50" />
          <div className="h-9 w-16 animate-pulse rounded-lg bg-muted/50" />
        </div>
        {/* Brief content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted/50" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
              <div className="size-8 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto max-w-2xl p-4 lg:p-6">
        <Link
          href="/i/campaigns"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {tc("nav.campaigns")}
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("room.notFound")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {t("room.notFoundDetail")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeDueDate =
    hasPublishedSubmissions
      ? hasOpenReportTask
        ? activeReportTask?.due_at ?? null
        : null
      : room.content_due_date;
  const activeDueDays = daysUntil(activeDueDate);
  const activeDueLabel =
    hasPublishedSubmissions && hasOpenReportTask
      ? activeDueDays === 0
        ? t("status.reportDueToday")
        : t("status.reportDue", {
            date: formatShortDate(activeDueDate, locale),
          })
      : activeDueDays === 0
        ? t("status.dueToday")
        : activeDueDays != null
          ? t("status.dueIn", { days: String(activeDueDays) })
          : null;
  // Build task checklist from campaign state
  const tasks = [
    { label: t("task.joined"), done: true },
    { label: t("task.reviewBrief"), done: true },
    {
      label: t("task.submitContent"),
      done: hasSubmissions,
    },
    {
      label: t("task.contentApproved"),
      done: allApproved,
    },
    {
      label: t("task.publishContent"),
      done: activeSubmissions.some((s) => s.status === "published"),
    },
    {
      label: t("task.reportPerformance"),
      done:
        reportTasks.length > 0 &&
        reportTasks.every((task) => reportSubmittedStatuses.has(task.status)),
    },
  ];
  const completedTaskCount = tasks.filter((task) => task.done).length;
  const hasActionAttention = !creatorRoomStatusOnlyActions.has(roomAction.key);
  const flowTabs: {
    value: CreatorRoomTab;
    label: string;
    detail: string;
    attention: boolean;
  }[] = [
    {
      value: "brief",
      label: t("tab.brief"),
      detail: t("flow.brief.detail"),
      attention: hasActionAttention && roomAction.targetTab === "brief",
    },
    {
      value: "tasks",
      label: t("tab.tasks"),
      detail: t("flow.tasks.detail", {
        done: String(completedTaskCount),
        total: String(tasks.length),
      }),
      attention: hasActionAttention && roomAction.targetTab === "tasks",
    },
    {
      value: "submit",
      label: t("tab.submit"),
      detail:
        roomAction.targetTab === "submit"
          ? t("flow.submit.attention")
          : t("flow.submit.detail"),
      attention:
        (hasActionAttention && roomAction.targetTab === "submit") ||
        hasRevisionNeeded ||
        Boolean(correctionReportTask),
    },
  ];

  return (
    <div
      className="mx-auto max-w-2xl p-4 lg:p-6"
      data-testid="creator-room-first-viewport"
    >
      {/* Back */}
      <Link
        href="/i/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tc("nav.campaigns")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3" data-testid="creator-room-identity">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">
          {brandInitials(room.brand_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {room.title}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{room.brand_name}</span>
            {activeDueLabel && (
              <span
                data-testid="creator-room-active-due"
                className={`inline-flex items-center gap-1 ${
                  activeDueDays != null && activeDueDays <= 3
                    ? "font-medium text-red-500"
                    : ""
                }`}
              >
                <Clock className="size-3" />
                {activeDueLabel}
              </span>
            )}
            <span
              className="font-medium tabular-nums text-foreground"
              data-testid="creator-room-rate"
            >
              {formatCurrency(room.accepted_rate, locale)}
            </span>
            <span
              className="inline-flex rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-black/[0.04]"
              data-testid="creator-room-payment-status"
            >
              {t("room.paymentStatus", {
                status: t(`payment.status.${room.payment_status}`),
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Review CTA for completed campaigns */}
      {room.status === "completed" && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("room.completed")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("room.completedDetail", { name: room.brand_name })}</p>
          </div>
          <ReviewDialog
            campaignId={room.id}
            revieweeId={room.brand_id}
            revieweeName={room.brand_name}
          >
            <Button size="sm">{t("room.leaveReview")}</Button>
          </ReviewDialog>
        </div>
      )}

      {agreement &&
      agreementStatus &&
      agreementStatus.status !== "signed" &&
      agreementStatus.status !== "not_required" ? (
        <AgreementGate
          agreement={agreement}
          onAccepted={() =>
            setAgreementStatus((current) =>
              current ? { ...current, status: "signed" } : current,
            )
          }
        />
      ) : (
        <div className="mt-6 space-y-4">
        <div data-testid="creator-room-next-action">
          <CampaignRoomActionStrip
            action={roomAction}
            title={t(`next.${roomAction.key}.title`)}
            detail={t(`next.${roomAction.key}.detail`)}
            due={
              roomAction.dueAt
                ? t("next.due", {
                    date: formatShortDate(roomAction.dueAt, locale),
                  })
                : null
            }
            label={
              creatorRoomStatusOnlyActions.has(roomAction.key)
                ? tc("label.status")
                : t("next.label")
            }
            actionLabel={t(`next.${roomAction.key}.action`)}
            onClick={() => handleCreatorRoomTabChange(roomAction.targetTab)}
          />
        </div>
        <Tabs
          value={selectedTab}
          onValueChange={handleCreatorRoomTabChange}
        >
          <TabsList
            className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1"
            data-testid="creator-room-flow-tabs"
          >
            {flowTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-auto min-w-0 flex-col items-start gap-0.5 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-start text-muted-foreground shadow-none after:hidden transition-colors hover:bg-background/70 hover:text-foreground data-active:border-border data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border dark:data-active:bg-background"
                data-testid="creator-room-flow-tab"
              >
                <span className="flex w-full min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-current">
                    {tab.label}
                  </span>
                  {tab.attention && (
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                  )}
                </span>
                <span className="max-w-full truncate text-[11px] font-normal text-current opacity-65">
                  {tab.detail}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Brief tab */}
          <TabsContent value="brief" className="mt-4">
            <CampaignBriefWorkspace
              room={room}
              deliverables={deliverables}
              locale={locale}
              t={t}
              getContentFormatLabel={(contentType) =>
                FORMAT_KEYS[contentType as ContentFormat]
                  ? tGlobal(
                      "ui.common",
                      FORMAT_KEYS[contentType as ContentFormat],
                    )
                  : contentType
              }
            />
          </TabsContent>

          {/* Tasks tab */}
          <TabsContent value="tasks" className="mt-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {t("tab.tasks")}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {t("task.progress", {
                    done: String(completedTaskCount),
                    total: String(tasks.length),
                  })}
                </span>
              </div>
              <div
                className="grid grid-cols-3 gap-2 sm:grid-cols-6"
                data-testid="creator-task-rail"
              >
                {tasks.map((task, index) => (
                  <div
                    key={`${task.label}-${index}`}
                    className={`flex min-h-14 min-w-0 flex-col gap-2 rounded-lg border px-2 py-2 ${
                      task.done
                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
                        : "border-border bg-muted/30 text-foreground"
                    }`}
                    data-testid="creator-task-rail-item"
                  >
                    {task.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/60" />
                    )}
                    <span
                      className={`text-[11px] font-medium leading-tight ${
                        task.done ? "text-emerald-950" : "text-foreground"
                      }`}
                    >
                      {task.label}
                    </span>
                  </div>
                ))}
              </div>
              {reportTasks.length > 0 && (
                <section
                  className="mt-3 border-t border-border pt-3"
                  data-testid="creator-reporting-schedule"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {t("task.reportingSchedule")}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {t("task.reportingScheduleDetail")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {formatReportTaskCount(reportTasks.length, t)}
                      </span>
                      {canAddExtraReportRead && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddExtraReportRead}
                          disabled={isAddingExtraReportRead}
                          className="h-7 rounded-lg px-2 text-[11px]"
                          data-testid="creator-add-report-read"
                        >
                          {isAddingExtraReportRead
                            ? t("task.addingReportRead")
                            : t("task.addReportRead")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {extraReportReadError && (
                    <p className="mb-2 text-[11px] text-red-600">
                      {extraReportReadError}
                    </p>
                  )}
                  <div className="-mx-1 overflow-x-auto px-1 pb-1">
                    <div className="flex min-w-max gap-2">
                      {reportTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`w-36 shrink-0 rounded-lg border px-2.5 py-2 ${getCreatorReportTaskStyle(task.status)}`}
                          data-testid="creator-reporting-schedule-item"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] font-semibold">
                              {t(getCreatorReportTaskLabelKey(task.task_key))}
                            </span>
                            <span className="shrink-0 text-[10px] font-medium">
                              {t(getCreatorReportTaskStatusKey(task.status))}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-xs font-medium tabular-nums">
                            {formatReportTaskWindow(task, locale, t)}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] opacity-70">
                            {t("task.reportDueShort", {
                              date: formatShortDate(task.due_at, locale),
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </TabsContent>

          {/* Submit tab */}
          <TabsContent value="submit" className="mt-4">
            <CampaignSubmitWorkspace
              room={room}
              creativeAssets={creativeAssets}
              submissions={submissions}
              hasRevisionNeeded={hasRevisionNeeded}
              showContentSubmitForm={showContentSubmitForm}
              creatorWorkIsOpen={creatorWorkIsOpen}
              correctionReportTask={correctionReportTask}
              activeReportTask={activeReportTask}
              isReportCorrection={isReportCorrection}
              reportingRequirements={reportingRequirements}
              reportGoalContext={reportGoalContext}
              locale={locale}
              t={t}
              tc={tc}
              onReload={() => window.location.reload()}
            />
          </TabsContent>
        </Tabs>
        </div>
      )}
    </div>
  );
}
