"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Eye,
  FileWarning,
  LinkIcon,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Megaphone,
  Send,
  Clock,
  Image as ImageIcon,
  RotateCcw,
  Search,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CAMPAIGN_STATUS_COLORS,
  CONTENT_FORMATS,
  FORMAT_KEYS,
  PLATFORM_LABELS,
  NICHE_KEYS,
  getMarketLabel,
  formatCurrency,
} from "@/lib/constants";
import { getCampaignServiceEstimate } from "@/lib/campaign-service-packages";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import {
  acceptApplication,
  acceptApplicationsBatch,
  rejectApplication,
  rejectApplicationsBatch,
  counterOffer,
  updateCampaignMemberPaymentStatus,
  updateCampaignMemberPaymentStatuses,
} from "@/app/actions/applications";
import { approveContent, requestRevision } from "@/app/actions/content";
import {
  getBrandTeamSettings,
  type BrandTeamMember,
} from "@/app/actions/brand-team";
import {
  completeCampaign,
  createCampaignServiceFeeCheckout,
  importCampaignCreatorInvites,
  launchCampaign,
  removeCampaignCreatorInvite,
  sendCampaignCreatorInvite,
  startCampaignWork,
  updateCampaignCreatorCapacity,
  updateCampaignResponsibility,
  updateCampaignReportingRequirement,
  updateCampaignLaunchSetup,
  updateCampaignDeadline,
  sendCampaignAnnouncement,
} from "@/app/actions/campaigns";
import {
  markReportTaskExcused,
  requestMissedReportFollowUp,
  requestMissedReportFollowUpsBatch,
  reviewPerformanceEvidence,
  reviewPerformanceProofLink,
} from "@/app/actions/reporting-evidence";
import { toast } from "sonner";
import type {
  CampaignStatus,
  ContentFormat,
  Platform,
  Niche,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { ReviewDialog } from "@/components/shared/review-dialog";
import {
  BrandAgreementPanel,
  type BrandAgreementRow,
} from "@/components/campaigns/brand-agreement-panel";
import { BrandCreativeKitPanel } from "@/components/campaigns/brand-creative-kit-panel";
import { AgreementStatusCell } from "@/components/campaigns/agreement-status-cell";
import type { AgreementStatus } from "@/lib/agreements/campaign-agreement";
import {
  getCreativeKitReadiness,
  mapCampaignAssetRow,
  type CampaignCreativeAsset,
} from "@/lib/campaigns/creative-kit";
import {
  getCampaignNextAction,
  type CampaignNextActionKind,
} from "@/lib/campaigns/brand-campaign-cockpit";
import {
  canCampaignAcceptApplicationDecision,
  getCampaignApplicationClosedReason,
  type CampaignApplicationClosedReason,
} from "@/lib/campaigns/application-deadline";
import { parseCreatorInviteImport } from "@/lib/campaigns/creator-invite-import";
import {
  getBrandCampaignHandoffSummary,
  type BrandCampaignHandoffStageKey,
  type BrandCampaignHandoffStageTone,
} from "@/lib/campaigns/brand-campaign-handoff";
import {
  BRAND_CAMPAIGN_WORKSPACE_TABS,
  type BrandCampaignWorkspaceTab,
} from "@/lib/campaigns/brand-campaign-links";
import { getCampaignCloseoutReadiness } from "@/lib/campaigns/campaign-closeout";
import { getActiveCampaignSubmissions } from "@/lib/campaigns/campaign-submissions";
import { hasBrandWorkspacePermission } from "@/lib/brand-permissions";
import {
  getCurrentEvidenceReviewStatuses,
  type EvidenceReviewStatus,
} from "@/lib/reporting/evidence-review";
import {
  getCurrentPerformanceRowsForTask,
  getProofQueueState,
  type ProofQueueState,
} from "@/lib/reporting/proof-queue";
import {
  getReportGoalContext,
  type ReportGoalContext,
} from "@/lib/reporting/creator-report-goal-context";
import {
  getReportingMetricTemplate,
  isReportingPlatform,
  type ReportingAccountRequirement,
  type ReportingEvidenceType,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import type {
  BrandTeamRole,
  CampaignResponsibilityKind as DatabaseCampaignResponsibilityKind,
  CampaignAssetStatus,
  CampaignAssetType,
  CampaignAssetVisibility,
  PaymentStatusType,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const brandInviteClosedDetailKeys: Record<
  CampaignApplicationClosedReason,
  string
> = {
  not_open: "inviteImport.closedClean",
  deadline_passed: "inviteImport.closedDetail.deadline",
  work_started: "inviteImport.closedDetail.workStarted",
  paused: "inviteImport.closedDetail.paused",
  completed: "inviteImport.closedDetail.completed",
  cancelled: "inviteImport.closedDetail.cancelled",
};

const inviteLifecycleClosedMessageKeys: Record<
  CampaignApplicationClosedReason,
  string
> = {
  not_open: "invite.closed.notOpen",
  deadline_passed: "invite.closed.deadline",
  work_started: "invite.closed.workStarted",
  paused: "invite.closed.paused",
  completed: "invite.closed.completed",
  cancelled: "invite.closed.cancelled",
};

interface CampaignRow {
  id: string;
  title: string;
  status: string;
  campaign_mode: string | null;
  recruitment_visibility: string | null;
  platforms: string[];
  markets: string[];
  niches: string[];
  budget_min: number | null;
  budget_max: number | null;
  service_fee_cents: number | null;
  service_fee_currency: string | null;
  service_fee_checkout_session_id: string | null;
  service_fee_failed_at: string | null;
  service_fee_last_event_at: string | null;
  service_fee_last_event_id: string | null;
  service_fee_last_event_type: string | null;
  service_fee_paid_at: string | null;
  service_fee_payment_intent_id: string | null;
  service_fee_refunded_at: string | null;
  service_fee_disputed_at: string | null;
  service_fee_status: PaymentStatusType;
  service_package_snapshot: Record<string, unknown> | null;
  total_spend: number | null;
  max_creators: number | null;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  application_deadline: string | null;
  content_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  max_revisions: number | null;
  created_at: string;
}

type CampaignResponsibilityKind = DatabaseCampaignResponsibilityKind;

interface ApplicationRow {
  id: string;
  proposed_rate: number | null;
  pitch: string | null;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  creator_profiles: {
    slug: string;
    primary_market: string | null;
    niches: string[];
    rating: number;
  } | null;
}

interface MemberRow {
  id: string;
  creator_id: string;
  accepted_rate: number | null;
  payment_status: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  creator_profiles: {
    primary_market: string | null;
    tiktok: unknown;
    instagram: unknown;
    snapchat: unknown;
    youtube: unknown;
    facebook: unknown;
  } | null;
}

interface CampaignCreatorInviteRow {
  id: string;
  campaign_id: string;
  contact_type: "email" | "handle";
  contact_value: string;
  normalized_contact: string;
  status: "manual" | "queued" | "sent" | "failed";
  queued_email_id: string | null;
  invited_at: string | null;
  created_at: string;
}

type CreatorInviteStatusFilter = "all" | CampaignCreatorInviteRow["status"];

interface CampaignResponsibilityAssignmentRow {
  id: string;
  campaign_id: string;
  brand_team_member_id: string;
  responsibility: CampaignResponsibilityKind;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

type MemberSortKey =
  | "creator"
  | "market"
  | "platform"
  | "agreement"
  | "report" | "proof"
  | "rate"
  | "payment";
type MemberSortDirection = "asc" | "desc";
type ApplicantSortKey = "creator" | "market" | "fit" | "rate" | "applied";
type ContentSortKey = "creator" | "platform" | "status" | "submitted" | "version" | "proof";
type ReportingQueueSortKey = "creator" | "platform" | "status" | "submitted" | "evidence";
type MemberRosterFilter = "all" | "needs_attention" | "missed_proof" | "payment_open";
type ContentQueueFilter = "all" | "my_work" | "needs_review" | "corrections";
type ReportingQueueFilter =
  | "all"
  | "my_work"
  | "needs_review"
  | "corrections"
  | "missed";

type QueueFilterOption<T extends string> = {
  value: T;
  label: string;
  count: number;
  testId: string;
};

interface SubmissionRow {
  id: string;
  parent_submission_id: string | null;
  campaign_member_id: string;
  content_url: string | null;
  published_url: string | null;
  caption: string | null;
  platform: string | null;
  status: string;
  version: number;
  feedback: string | null;
  revision_count: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  campaign_members: {
    profiles: {
      full_name: string;
      avatar_url: string | null;
    } | null;
  } | null;
}

interface DeliverableRow {
  id: string;
  platform: string;
  content_type: string;
  quantity: number;
  notes: string | null;
}

interface CampaignReportingRequirementRow {
  id: string;
  platform: ReportingPlatform;
  platform_label: string | null;
  content_format: string;
  account_requirement: ReportingAccountRequirement;
  evidence_types: string[];
  required_metric_keys: string[];
  ai_extraction_allowed: boolean;
  creator_confirmation_required: boolean;
}

interface ReportTaskRow {
  id: string;
  campaign_member_id: string;
  task_key: string;
  period_start: string | null;
  period_end: string | null;
  due_at: string;
  status: string;
  submitted_at: string | null;
  review_note: string | null;
  missed_at?: string | null;
  excused_at?: string | null;
}

interface EvidenceRow {
  id: string;
  campaign_member_id: string;
  report_task_id: string;
  submission_id: string | null;
  performance_id: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  signed_url: string | null;
  verification_status: string;
  review_note: string | null;
  created_at: string;
}

interface PerformanceRow {
  id: string;
  submission_id: string;
  report_task_id: string | null;
  measurement_type: string | null;
  reported_at: string | null;
  screenshot_url: string | null;
  verification_status: string | null;
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

interface MemberOperations {
  reportTaskId: string | null;
  reportStatus: string;
  reportLabel: string;
  reportDetail: string;
  reportFollowUpSent: boolean;
  reportClassName: string;
  reportRank: number;
  proofStatus: string;
  proofLabel: string;
  proofDetail: string;
  proofClassName: string;
  proofRank: number;
}

type LaunchReadinessItem = {
  key: "image" | "brief" | "deliverables" | "reporting" | "rules" | "invite";
  label: string;
  detail: string;
  ready: boolean;
  actionLabel?: string;
  targetTestId?: string;
};

type HeaderMetaItem = {
  key: string;
  content: ReactNode;
};

const CAMPAIGN_DETAIL_TABS = BRAND_CAMPAIGN_WORKSPACE_TABS;
type CampaignDetailTab = BrandCampaignWorkspaceTab;
type CampaignDetailTabSearchParams = Pick<URLSearchParams, "get" | "toString">;
const creatorCapacityPresets = [10, 50, 100] as const;
const campaignResponsibilitySlots: Array<{
  kind: CampaignResponsibilityKind;
  labelKey: string;
  detailKey: string;
}> = [
  {
    kind: "owner",
    labelKey: "responsibility.owner",
    detailKey: "responsibility.ownerDetail",
  },
  {
    kind: "approvals",
    labelKey: "responsibility.approvals",
    detailKey: "responsibility.approvalsDetail",
  },
  {
    kind: "reporting",
    labelKey: "responsibility.reporting",
    detailKey: "responsibility.reportingDetail",
  },
  {
    kind: "billing",
    labelKey: "responsibility.billing",
    detailKey: "responsibility.billingDetail",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCampaignDetailTab(value: string | null): value is CampaignDetailTab {
  return CAMPAIGN_DETAIL_TABS.includes(value as CampaignDetailTab);
}

function getCampaignDetailTabFromSearchParams(
  searchParams: CampaignDetailTabSearchParams,
): CampaignDetailTab {
  const tab = searchParams.get("tab");
  return isCampaignDetailTab(tab) ? tab : "overview";
}

function buildCampaignDetailTabUrl(
  pathname: string,
  searchParams: CampaignDetailTabSearchParams,
  tab: CampaignDetailTab,
): string {
  const nextSearchParams = new URLSearchParams(searchParams.toString());
  nextSearchParams.set("tab", tab);
  return `${pathname}?${nextSearchParams.toString()}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(
  dateStr: string,
  tc: (key: string, vars?: Record<string, string>) => string,
  locale = "en",
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tc("time.justNow");
  if (minutes < 60) return tc("time.minutesAgo", { count: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tc("time.hoursAgo", { count: String(hours) });
  const days = Math.floor(hours / 24);
  if (days === 1) return tc("time.yesterday");
  if (days < 7) return tc("time.daysAgo", { count: String(days) });
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
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

function getDateInputValue(dateStr: string | null): string | undefined {
  return dateStr?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
}

function getBrandReportTaskLabelKey(taskKey: string): string {
  if (taskKey.startsWith("daily:")) return "reporting.scheduleKind.daily";
  if (taskKey.startsWith("weekly:")) return "reporting.scheduleKind.weekly";
  if (taskKey.startsWith("custom:")) return "reporting.scheduleKind.custom";
  if (taskKey.startsWith("post:")) return "reporting.scheduleKind.post";
  if (taskKey.startsWith("extra:")) return "reporting.scheduleKind.extra";
  if (taskKey === "final" || taskKey.includes("final")) {
    return "reporting.scheduleKind.final";
  }
  return "reporting.scheduleKind.default";
}

function getBrandReportTaskStatusKey(status: string): string {
  if (status === "submitted_late") return "reportStatus.submittedLate";
  if (status === "submitted") return "reportStatus.toReview";
  if (status === "needs_revision") return "reportStatus.correction";
  if (status === "verified") return "reportStatus.verified";
  if (status === "missed") return "reportStatus.missed";
  if (status === "excused") return "reportStatus.excused";
  return "reportStatus.pending";
}

function getBrandReportTaskStatusClassName(status: string): string {
  if (status === "verified" || status === "excused") {
    return "border-slate-200 bg-slate-50 text-muted-foreground";
  }

  if (status === "submitted" || status === "submitted_late") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (status === "needs_revision" || status === "missed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-white text-muted-foreground";
}

function isReportTaskLate(task: Pick<ReportTaskRow, "due_at" | "submitted_at">) {
  if (!task.submitted_at || !task.due_at) return false;
  return new Date(task.submitted_at).getTime() > new Date(task.due_at).getTime();
}

function formatBrandReportTaskWindow(
  task: Pick<ReportTaskRow, "period_start" | "period_end" | "due_at">,
  locale: string,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const start = formatShortDate(task.period_start, locale);
  const end = formatShortDate(task.period_end, locale);

  if (task.period_start && task.period_end) {
    return start === end ? start : `${start} to ${end}`;
  }

  return t("reporting.scheduleDue", {
    date: formatShortDate(task.due_at, locale),
  });
}

function formatBrandReportTaskCount(
  count: number,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  if (count === 1) return t("reporting.scheduleCountSingular");
  return t("reporting.scheduleCountPlural", { count: String(count) });
}

function compactStripeId(value: string | null): string {
  if (!value) return "-";
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-7)}`;
}

function formatCompactCurrency(amount: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: amount >= 1000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 1000 ? 1 : 0,
  }).format(amount);
}

function getServicePackageSnapshotNumber(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
): number {
  const value = snapshot?.[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function getPrimaryPlatform(cp: MemberRow["creator_profiles"]): string | null {
  if (!cp) return null;
  const keys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
  for (const k of keys) {
    if (cp[k]) return k;
  }
  return null;
}

const submissionStatusStyles: Record<string, string> = {
  draft: "bg-muted text-foreground",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  revision_requested: "bg-red-100 text-red-700",
  published: "bg-blue-100 text-blue-700",
};

const submissionStatusKeys: Record<string, string> = {
  draft: "status.draft",
  submitted: "status.submitted",
  approved: "status.approved",
  revision_requested: "status.revisionRequested",
  published: "status.published",
};

const submissionStatusRank: Record<string, number> = {
  revision_requested: 0,
  submitted: 1,
  approved: 2,
  published: 3,
  draft: 4,
};

const paymentStatusStyles: Record<string, string> = {
  pending: "border-slate-200 bg-white text-muted-foreground",
  invoiced: "border-amber-200 bg-amber-50 text-amber-900",
  paid: "border-slate-200 bg-slate-50 text-slate-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  refunded: "border-slate-200 bg-slate-100 text-slate-700",
  disputed: "border-red-200 bg-red-50 text-red-700",
};

const paymentStatusKeys: Record<string, string> = {
  pending: "members.paymentStatus.pending",
  invoiced: "members.paymentStatus.invoiced",
  paid: "members.paymentStatus.paid",
  overdue: "members.paymentStatus.overdue",
  failed: "members.paymentStatus.failed",
  refunded: "members.paymentStatus.refunded",
  disputed: "members.paymentStatus.disputed",
};

const creatorInviteStatusKeys: Record<CampaignCreatorInviteRow["status"], string> = {
  failed: "inviteImport.status.failed",
  manual: "inviteImport.status.manual",
  queued: "inviteImport.status.queued",
  sent: "inviteImport.status.sent",
};

const creatorInviteReadOnlyStatusKeys: Record<CampaignCreatorInviteRow["status"], string> = {
  failed: "inviteImport.statusReadOnly.failed",
  manual: "inviteImport.statusReadOnly.manual",
  queued: "inviteImport.statusReadOnly.queued",
  sent: "inviteImport.statusReadOnly.sent",
};

const creatorInviteStatusFilterKeys: Record<CreatorInviteStatusFilter, string> = {
  all: "inviteImport.filter.all",
  failed: "inviteImport.status.failed",
  manual: "inviteImport.status.manual",
  queued: "inviteImport.status.queued",
  sent: "inviteImport.status.sent",
};

const memberPaymentStatuses: PaymentStatusType[] = [
  "pending",
  "invoiced",
  "paid",
  "overdue",
  "failed",
  "refunded",
  "disputed",
];

const reportStatusRank: Record<string, number> = {
  missed: 0,
  needs_revision: 1,
  submitted: 2,
  submitted_late: 2,
  pending: 3,
  verified: 4,
  excused: 5,
};

const proofStatusRank: Record<string, number> = {
  rejected: 0,
  submitted: 1,
  metrics_only: 2,
  missing: 3,
  waiting: 4,
  verified: 5,
};

const agreementStatusRank: Record<AgreementStatus, number> = {
  needs_reacceptance: 0,
  pending: 1,
  signed: 2,
  not_required: 3,
};

function isMemberOperationsNeedsAttention(operations: MemberOperations | undefined) {
  return Boolean(
    operations &&
      (operations.reportStatus === "missed" ||
        operations.reportStatus === "submitted" ||
        operations.reportStatus === "submitted_late" ||
        operations.reportStatus === "needs_revision" ||
        operations.proofStatus === "submitted" ||
        operations.proofStatus === "rejected" ||
        operations.proofStatus === "metrics_only"),
  );
}

function isMemberOperationsMissedProof(operations: MemberOperations | undefined) {
  return operations?.reportStatus === "missed";
}

function isMemberOperationsReportReady(operations: MemberOperations | undefined) {
  return Boolean(
    operations &&
      (operations.reportStatus === "verified" ||
        operations.reportStatus === "excused"),
  );
}

function isMemberOperationsReviewOpen(operations: MemberOperations | undefined) {
  return Boolean(
    operations &&
      (operations.reportStatus === "submitted" ||
        operations.reportStatus === "submitted_late" ||
        operations.reportStatus === "needs_revision" ||
        operations.proofStatus === "submitted" ||
        operations.proofStatus === "rejected" ||
        operations.proofStatus === "metrics_only"),
  );
}

function isMemberPaymentOpen(member: MemberRow) {
  return member.payment_status !== "paid";
}

function compareNullableText(a: string | null, b: string | null, locale: string) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, locale, { numeric: true, sensitivity: "base" });
}

function getUrgentReportTask(tasks: ReportTaskRow[]): ReportTaskRow | null {
  if (tasks.length === 0) return null;
  return tasks.toSorted((a, b) => {
    const rankDiff =
      (reportStatusRank[a.status] ?? 6) - (reportStatusRank[b.status] ?? 6);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  })[0];
}

function getProofStatus(
  evidenceRows: EvidenceRow[],
  task: ReportTaskRow | null,
  performanceRows: PerformanceRow[] = [],
) {
  const relevantEvidence = task
    ? evidenceRows.filter((evidence) => evidence.report_task_id === task.id)
    : evidenceRows;
  const currentEvidenceStatuses = getCurrentEvidenceReviewStatuses(
    relevantEvidence
      .filter(
        (evidence) =>
          evidence.verification_status === "submitted" ||
          evidence.verification_status === "verified" ||
          evidence.verification_status === "rejected",
      )
      .map((evidence) => ({
        status: evidence.verification_status as EvidenceReviewStatus,
        submissionId: evidence.submission_id,
        createdAt: evidence.created_at,
      })),
  );

  if (currentEvidenceStatuses.some((status) => status === "rejected")) {
    return "rejected";
  }

  if (currentEvidenceStatuses.some((status) => status === "submitted")) {
    return "submitted";
  }

  if (
    currentEvidenceStatuses.length > 0 &&
    currentEvidenceStatuses.every((status) => status === "verified")
  ) {
    return "verified";
  }

  const taskPerformanceRows = task
    ? getCurrentPerformanceRowsForTask(performanceRows, task.id)
    : performanceRows;
  if (taskPerformanceRows.length > 0) {
    if (taskPerformanceRows.some((row) => row.verification_status === "rejected")) {
      return "rejected";
    }
    if (
      taskPerformanceRows.every(
        (row) =>
          row.verification_status === "brand_verified" ||
          row.verification_status === "screenshot_verified",
      )
    ) {
      return "verified";
    }
    return "metrics_only";
  }

  return task ? "missing" : "waiting";
}

function getEvidenceReviewKey(evidence: EvidenceRow): string {
  return evidence.submission_id ?? evidence.performance_id ?? evidence.id;
}

function getCurrentEvidenceRowsForTask(
  evidenceRows: EvidenceRow[],
  taskId: string,
): EvidenceRow[] {
  const latestRows = new Map<string, { row: EvidenceRow; index: number }>();

  evidenceRows
    .filter((evidence) => evidence.report_task_id === taskId)
    .forEach((evidence, index) => {
      const key = getEvidenceReviewKey(evidence);
      const current = latestRows.get(key);
      const rowTime = new Date(evidence.created_at).getTime();
      const currentTime = current
        ? new Date(current.row.created_at).getTime()
        : -1;

      if (!current || rowTime >= currentTime) {
        latestRows.set(key, { row: evidence, index });
      }
    });

  return Array.from(latestRows.values())
    .toSorted((first, second) => first.index - second.index)
    .map((entry) => entry.row);
}

function getSubmissionProofPresentation({
  evidenceRows,
  submission,
  t,
}: {
  evidenceRows: EvidenceRow[];
  submission: SubmissionRow;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const submissionEvidence = evidenceRows.filter(
    (evidence) =>
      evidence.submission_id === submission.id ||
      (evidence.submission_id == null &&
        evidence.campaign_member_id === submission.campaign_member_id),
  );
  const shouldHaveProof =
    submission.status === "published" ||
    (submission.status === "approved" && Boolean(submission.published_url));
  const proofStatus =
    submissionEvidence.length > 0
      ? getProofStatus(submissionEvidence, null)
      : shouldHaveProof
        ? "missing"
        : "waiting";
  const proofDetail = submissionEvidence.length > 0
    ? t("proof.count", { count: String(submissionEvidence.length) })
    : t("proof.noFile");

  if (proofStatus === "verified") {
    return {
      label: t("proofStatus.verified"),
      detail: proofDetail,
      className: "border-slate-200 bg-slate-50 text-muted-foreground",
      rank: proofStatusRank.verified,
    };
  }

  if (proofStatus === "submitted") {
    return {
      label: t("proofStatus.toReview"),
      detail: proofDetail,
      className: "border-amber-200 bg-amber-50 text-amber-900",
      rank: proofStatusRank.submitted,
    };
  }

  if (proofStatus === "rejected") {
    return {
      label: t("proofStatus.correction"),
      detail: proofDetail,
      className: "border-red-200 bg-red-50 text-red-700",
      rank: proofStatusRank.rejected,
    };
  }

  if (proofStatus === "metrics_only") {
    return {
      label: t("proofStatus.metricsOnly"),
      detail: t("proofStatus.metricsOnlyDetail"),
      className: "border-amber-200 bg-amber-50 text-amber-900",
      rank: proofStatusRank.metrics_only,
    };
  }

  if (proofStatus === "missing") {
    return {
      label: t("proofStatus.missing"),
      detail: proofDetail,
      className: "border-slate-200 bg-white text-muted-foreground",
      rank: proofStatusRank.missing,
    };
  }

  return {
    label: t("proofStatus.waiting"),
    detail: t("content.proofAfterPublish"),
    className: "border-slate-200 bg-white text-muted-foreground",
    rank: proofStatusRank.waiting,
  };
}

function getMemberOperations({
  evidenceRows,
  locale,
  member,
  performanceRows,
  reportTasks,
  t,
}: {
  evidenceRows: EvidenceRow[];
  locale: string;
  member: MemberRow;
  performanceRows: PerformanceRow[];
  reportTasks: ReportTaskRow[];
  t: (key: string, vars?: Record<string, string>) => string;
}): MemberOperations {
  const memberTasks = reportTasks.filter(
    (task) => task.campaign_member_id === member.id,
  );
  const memberEvidence = evidenceRows.filter(
    (evidence) => evidence.campaign_member_id === member.id,
  );
  const memberPerformance = performanceRows.filter((performance) =>
    memberTasks.some((memberTask) => memberTask.id === performance.report_task_id),
  );
  const task = getUrgentReportTask(memberTasks);
  const proofStatus = getProofStatus(memberEvidence, task, memberPerformance);
  const proofDetail = memberEvidence.length > 0
    ? t("proof.count", { count: String(memberEvidence.length) })
    : t("proof.noFile");

  if (!task) {
    return {
      reportTaskId: null,
      reportStatus: "none",
      reportLabel: t("reportStatus.none"),
      reportDetail: t("reportStatus.noTask"),
      reportFollowUpSent: false,
      reportClassName: "border-slate-200 bg-white text-muted-foreground",
      reportRank: 6,
      proofStatus,
      proofLabel: t("proofStatus.waiting"),
      proofDetail,
      proofClassName: "border-slate-200 bg-white text-muted-foreground",
      proofRank: proofStatusRank.waiting,
    };
  }

  const reportDetail =
    task.submitted_at
      ? t("reportStatus.submittedOn", {
          date: formatShortDate(task.submitted_at, locale),
        })
      : t("reportStatus.due", {
          date: formatShortDate(task.due_at, locale),
        });
  const base = {
    reportTaskId: task.id,
    reportStatus: task.status,
    reportDetail,
    reportFollowUpSent: task.review_note === "Follow-up requested",
    proofStatus,
    proofDetail,
    proofRank: proofStatusRank[proofStatus],
  };
  const proofMeta =
    proofStatus === "verified"
      ? {
          proofLabel: t("proofStatus.verified"),
          proofClassName: "border-slate-200 bg-slate-50 text-muted-foreground",
        }
      : proofStatus === "rejected"
        ? {
            proofLabel: t("proofStatus.correction"),
            proofClassName: "border-red-200 bg-red-50 text-red-700",
          }
        : proofStatus === "submitted"
          ? {
              proofLabel: t("proofStatus.toReview"),
              proofClassName: "border-amber-200 bg-amber-50 text-amber-900",
            }
          : proofStatus === "metrics_only"
            ? {
                proofLabel: t("proofStatus.metricsOnly"),
                proofClassName: "border-amber-200 bg-amber-50 text-amber-900",
              }
          : {
              proofLabel: t("proofStatus.missing"),
              proofClassName: "border-slate-200 bg-white text-muted-foreground",
            };

  if (task.status === "missed") {
    return {
      ...base,
      ...proofMeta,
      reportLabel: t("reportStatus.missed"),
      reportClassName: "border-red-200 bg-red-50 text-red-700",
      reportRank: reportStatusRank.missed,
    };
  }

  if (task.status === "needs_revision") {
    return {
      ...base,
      ...proofMeta,
      reportLabel: t("reportStatus.correction"),
      reportClassName: "border-red-200 bg-red-50 text-red-700",
      reportRank: reportStatusRank.needs_revision,
    };
  }

  if (task.status === "submitted_late") {
    return {
      ...base,
      ...proofMeta,
      reportLabel: t("reportStatus.submittedLate"),
      reportClassName: "border-amber-200 bg-amber-50 text-amber-900",
      reportRank: reportStatusRank.submitted_late,
    };
  }

  if (task.status === "submitted") {
    return {
      ...base,
      ...proofMeta,
      reportLabel: t("reportStatus.toReview"),
      reportClassName: "border-amber-200 bg-amber-50 text-amber-900",
      reportRank: reportStatusRank.submitted,
    };
  }

  if (task.status === "verified") {
    return {
      ...base,
      ...proofMeta,
      reportLabel: t("reportStatus.verified"),
      reportClassName: "border-slate-200 bg-slate-50 text-muted-foreground",
      reportRank: reportStatusRank.verified,
    };
  }

  if (task.status === "excused") {
    return {
      ...base,
      ...proofMeta,
      reportLabel: t("reportStatus.excused"),
      reportClassName: "border-slate-200 bg-slate-50 text-muted-foreground",
      reportRank: reportStatusRank.excused,
    };
  }

  return {
    ...base,
    ...proofMeta,
    reportLabel: t("reportStatus.pending"),
    reportClassName: "border-slate-200 bg-white text-muted-foreground",
    reportRank: reportStatusRank.pending,
  };
}

function MemberSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: MemberSortKey;
  currentKey: MemberSortKey;
  currentDir: MemberSortDirection;
  onSort: (key: MemberSortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className="pb-3 pe-4 text-start" aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="campaign-members-sort-header"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-7 items-center gap-1.5 rounded-md text-start transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-35" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function ApplicantSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: ApplicantSortKey;
  currentKey: ApplicantSortKey;
  currentDir: MemberSortDirection;
  onSort: (key: ApplicantSortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className="pb-3 pe-4 text-start" aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="campaign-applicants-sort-header"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-7 items-center gap-1.5 rounded-md text-start transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-35" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function MemberStatusCell({
  testId,
  label,
  detail,
  className,
}: {
  testId: string;
  label: string;
  detail?: string;
  className: string;
}) {
  return (
    <div className="min-w-28">
      <span
        data-testid={testId}
        className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
      >
        {label}
      </span>
      {detail && (
        <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">
          {detail}
        </p>
      )}
    </div>
  );
}

function getCampaignResponsibilityOwnerName({
  assignmentsByKind,
  kind,
  teamMembersById,
}: {
  assignmentsByKind: Map<CampaignResponsibilityKind, CampaignResponsibilityAssignmentRow>;
  kind: CampaignResponsibilityKind;
  teamMembersById: Map<string, BrandTeamMember>;
}) {
  const assignment = assignmentsByKind.get(kind);
  if (!assignment) return null;

  return teamMembersById.get(assignment.brand_team_member_id)?.name ?? null;
}

function WorkstreamOwnerChip({
  ownerName,
  testId,
  t,
  workstreamLabel,
}: {
  ownerName: string | null;
  testId: string;
  t: (key: string, vars?: Record<string, string>) => string;
  workstreamLabel: string;
}) {
  return (
    <div
      data-testid={testId}
      className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-muted-foreground"
      title={`${workstreamLabel}: ${ownerName ?? t("responsibility.unassigned")}`}
    >
      <span className="shrink-0 font-semibold text-foreground">
        {workstreamLabel}
      </span>
      <span className="shrink-0 font-medium text-muted-foreground">
        {t("responsibility.workstreamOwner")}:
      </span>
      <span className="min-w-0 truncate text-foreground">
        {ownerName ?? t("responsibility.unassigned")}
      </span>
    </div>
  );
}

function QueueFilterBar<T extends string>({
  ariaLabel,
  onChange,
  options,
  testId,
  value,
}: {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: QueueFilterOption<T>[];
  testId: string;
  value: T;
}) {
  return (
    <div
      aria-label={ariaLabel}
      data-testid={testId}
      className="flex flex-wrap items-center gap-1.5"
      role="group"
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              isActive
                ? "border-slate-300 bg-white text-foreground shadow-sm"
                : "border-slate-200 bg-slate-50 text-muted-foreground hover:border-slate-300 hover:text-foreground"
            }`}
          >
            <span>{option.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function isContentSubmissionNeedsReview(submission: SubmissionRow) {
  return submission.status === "submitted";
}

function isContentSubmissionCorrection(submission: SubmissionRow) {
  return submission.status === "revision_requested";
}

function isContentSubmissionOwnerWork(submission: SubmissionRow) {
  return (
    isContentSubmissionNeedsReview(submission) ||
    isContentSubmissionCorrection(submission) ||
    (submission.status === "approved" && !submission.published_url)
  );
}

function ContentSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: ContentSortKey;
  currentKey: ContentSortKey;
  currentDir: MemberSortDirection;
  onSort: (key: ContentSortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className="pb-3 pe-4 text-start" aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="campaign-content-sort-header"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-7 items-center gap-1.5 rounded-md text-start transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-35" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function getApplicationActionKey(
  appId: string,
  action: "accept" | "reject" | "counter",
): string {
  return `application:${appId}:${action}`;
}

// ---------------------------------------------------------------------------
// Invite Link Card
// ---------------------------------------------------------------------------

function InviteLinkCard({
  campaignId,
  canManage,
  canShare,
  blockedMessageKey,
  blockedActionKey,
  onFixSetup,
  t,
}: {
  campaignId: string;
  canManage: boolean;
  canShare: boolean;
  blockedMessageKey: string;
  blockedActionKey: string;
  onFixSetup: () => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const [copied, setCopied] = useState(false);
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/apply/${campaignId}`
      : `/apply/${campaignId}`;
  const isLifecycleClosedInvite = blockedActionKey === "invite.closedAction";
  const shouldShowBlockedAction =
    !canShare &&
    blockedActionKey !== "invite.payFirstCta" &&
    blockedActionKey !== "invite.closedAction" &&
    blockedActionKey !== "invite.privateOnlyCta";

  const handleCopy = useCallback(async () => {
    if (!canShare) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [canShare, inviteUrl]);

  return (
    <div
      data-testid="campaign-invite-strip"
      className="rounded-lg border border-border/70 bg-white p-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-[132px] items-center gap-2 text-xs font-medium text-muted-foreground">
          <LinkIcon className="size-3.5" aria-hidden="true" />
          {t("invite.linkLabel")}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {!canManage ? (
            <div
              data-testid="campaign-invite-read-only"
              className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 text-xs font-medium text-muted-foreground"
            >
              <Eye className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t("invite.noPermission")}</span>
            </div>
          ) : canShare ? (
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="h-8 min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 text-xs text-muted-foreground focus:outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          ) : (
            <div
              data-testid="campaign-invite-locked"
              className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 text-xs font-medium ${
                isLifecycleClosedInvite
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {isLifecycleClosedInvite ? (
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <FileWarning className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{t(blockedMessageKey)}</span>
            </div>
          )}
          {canShare && (
            <Button
              variant={copied ? "default" : "outline"}
              size="sm"
              data-testid="campaign-invite-copy"
              onClick={handleCopy}
              className="shrink-0 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="size-3.5" />
                  {t("invite.copied")}
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  {t("invite.copyLink")}
                </>
              )}
            </Button>
          )}
          {canManage &&
            shouldShowBlockedAction && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="campaign-invite-fix-setup"
                className="shrink-0 px-2.5 text-xs"
                onClick={onFixSetup}
              >
                {t(blockedActionKey)}
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}

function ReportingQueueSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: ReportingQueueSortKey;
  currentKey: ReportingQueueSortKey;
  currentDir: MemberSortDirection;
  onSort: (key: ReportingQueueSortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className="pb-3 pe-4 text-start" aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="campaign-reporting-proof-sort-header"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-7 items-center gap-1.5 rounded-md text-start transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-50" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

const nextActionPresentation: Record<
  CampaignNextActionKind,
  {
    labelKey: string;
    detailKey: string;
    detailSingularKey?: string;
    ctaKey: string;
    icon: typeof FileText;
  }
> = {
  review_proof: {
    labelKey: "cockpit.reviewProof",
    detailKey: "cockpit.reviewProofDetail",
    detailSingularKey: "cockpit.reviewProofDetailSingular",
    ctaKey: "cockpit.reviewProofCta",
    icon: FileText,
  },
  resolve_missed: {
    labelKey: "cockpit.resolveMissed",
    detailKey: "cockpit.resolveMissedDetail",
    detailSingularKey: "cockpit.resolveMissedDetailSingular",
    ctaKey: "cockpit.resolveMissedCta",
    icon: XCircle,
  },
  review_applicants: {
    labelKey: "cockpit.reviewApplicants",
    detailKey: "cockpit.reviewApplicantsDetail",
    detailSingularKey: "cockpit.reviewApplicantsDetailSingular",
    ctaKey: "cockpit.reviewApplicantsCta",
    icon: Users,
  },
  publish_rules: {
    labelKey: "cockpit.publishRules",
    detailKey: "cockpit.publishRulesDetail",
    ctaKey: "cockpit.configureRulesCta",
    icon: ShieldCheck,
  },
  add_creative: {
    labelKey: "cockpit.addCreative",
    detailKey: "cockpit.addCreativeDetail",
    ctaKey: "cockpit.addCreativeCta",
    icon: ImageIcon,
  },
  invite_creators: {
    labelKey: "cockpit.inviteCreators",
    detailKey: "cockpit.inviteCreatorsDetail",
    ctaKey: "cockpit.inviteCreatorsCta",
    icon: LinkIcon,
  },
  review_content: {
    labelKey: "cockpit.reviewContent",
    detailKey: "cockpit.reviewContentDetail",
    detailSingularKey: "cockpit.reviewContentDetailSingular",
    ctaKey: "cockpit.reviewContentCta",
    icon: FileText,
  },
  collect_live_urls: {
    labelKey: "cockpit.collectLiveUrls",
    detailKey: "cockpit.collectLiveUrlsDetail",
    detailSingularKey: "cockpit.collectLiveUrlsDetailSingular",
    ctaKey: "cockpit.collectLiveUrlsCta",
    icon: LinkIcon,
  },
  monitor_corrections: {
    labelKey: "cockpit.monitorCorrections",
    detailKey: "cockpit.monitorCorrectionsDetail",
    detailSingularKey: "cockpit.monitorCorrectionsDetailSingular",
    ctaKey: "cockpit.reviewCorrectionsCta",
    icon: FileWarning,
  },
  wait_for_reports: {
    labelKey: "cockpit.waitForReports",
    detailKey: "cockpit.waitForReportsDetail",
    detailSingularKey: "cockpit.waitForReportsDetailSingular",
    ctaKey: "cockpit.trackReportsCta",
    icon: Clock,
  },
  pay_service_fee: {
    labelKey: "cockpit.payServiceFee",
    detailKey: "cockpit.payServiceFeeDetail",
    ctaKey: "cockpit.payServiceFeeCta",
    icon: ShieldCheck,
  },
  complete_campaign: {
    labelKey: "cockpit.completeCampaign",
    detailKey: "cockpit.completeCampaignDetail",
    ctaKey: "cockpit.completeCampaignCta",
    icon: CheckCircle,
  },
  start_work: {
    labelKey: "cockpit.startWork",
    detailKey: "cockpit.startWorkDetail",
    ctaKey: "cockpit.startWorkCta",
    icon: CheckCircle,
  },
  campaign_complete: {
    labelKey: "cockpit.campaignComplete",
    detailKey: "cockpit.campaignCompleteDetail",
    ctaKey: "action.viewReport",
    icon: CheckCircle,
  },
  campaign_paused: {
    labelKey: "cockpit.campaignPaused",
    detailKey: "cockpit.campaignPausedDetail",
    ctaKey: "action.viewReport",
    icon: Clock,
  },
  campaign_cancelled: {
    labelKey: "cockpit.campaignCancelled",
    detailKey: "cockpit.campaignCancelledDetail",
    ctaKey: "action.viewReport",
    icon: XCircle,
  },
  no_blockers: {
    labelKey: "cockpit.noBlockers",
    detailKey: "cockpit.noBlockersDetail",
    ctaKey: "action.viewReport",
    icon: CheckCircle,
  },
};

const handoffStagePresentation: Record<
  BrandCampaignHandoffStageKey,
  {
    labelKey: string;
    detailKeys: Record<BrandCampaignHandoffStageTone, string>;
    icon: typeof FileText;
  }
> = {
  content: {
    labelKey: "handoff.content",
    detailKeys: {
      done: "handoff.content.done",
      attention: "handoff.content.attention",
      waiting: "handoff.content.waiting",
    },
    icon: FileText,
  },
  liveUrl: {
    labelKey: "handoff.liveUrl",
    detailKeys: {
      done: "handoff.liveUrl.done",
      attention: "handoff.liveUrl.attention",
      waiting: "handoff.liveUrl.waiting",
    },
    icon: LinkIcon,
  },
  proof: {
    labelKey: "handoff.proof",
    detailKeys: {
      done: "handoff.proof.done",
      attention: "handoff.proof.attention",
      waiting: "handoff.proof.waiting",
    },
    icon: ShieldCheck,
  },
};

const handoffStageToneClassName: Record<BrandCampaignHandoffStageTone, string> = {
  done: "border-slate-200 bg-white text-slate-700",
  attention: "border-amber-200 bg-amber-50/80 text-amber-900",
  waiting: "border-slate-200 bg-muted/20 text-muted-foreground",
};

const handoffStageIconClassName: Record<BrandCampaignHandoffStageTone, string> = {
  done: "border-slate-200 bg-slate-50 text-slate-700",
  attention: "border-amber-200 bg-white text-amber-900",
  waiting: "border-slate-200 bg-white text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignRoomPage() {
  const { t } = useTranslation("brand.campaign");
  const { t: tc } = useTranslation("ui.common");
  const { locale } = useI18n();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const activeTab = getCampaignDetailTabFromSearchParams(searchParams);
  const checkoutState = searchParams.get("checkout");

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [creatorInvites, setCreatorInvites] = useState<CampaignCreatorInviteRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [reportingRequirements, setReportingRequirements] = useState<
    CampaignReportingRequirementRow[]
  >([]);
  const [reportingMetricDrafts, setReportingMetricDrafts] = useState<
    Record<string, string[]>
  >({});
  const [reportTasks, setReportTasks] = useState<ReportTaskRow[]>([]);
  const [reportGoalContext, setReportGoalContext] = useState<ReportGoalContext>(
    getReportGoalContext(null),
  );
  const [evidenceRows, setEvidenceRows] = useState<EvidenceRow[]>([]);
  const [performanceRows, setPerformanceRows] = useState<PerformanceRow[]>([]);
  const [agreement, setAgreement] = useState<BrandAgreementRow | null>(null);
  const [agreementStatusRows, setAgreementStatusRows] = useState<AgreementStatusRow[]>([]);
  const [creativeAssets, setCreativeAssets] = useState<CampaignCreativeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBrandUserId, setCurrentBrandUserId] = useState<string | null>(null);
  const [currentBrandRole, setCurrentBrandRole] = useState<BrandTeamRole | null>(null);
  const [teamMembers, setTeamMembers] = useState<BrandTeamMember[]>([]);
  const [responsibilityAssignments, setResponsibilityAssignments] = useState<
    CampaignResponsibilityAssignmentRow[]
  >([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [capacityDraft, setCapacityDraft] = useState<{
    activeDays: number;
    campaignId: string;
    reportingDays: number;
    value: number;
  } | null>(null);
  const [inviteImportText, setInviteImportText] = useState("");
  const [inviteListQuery, setInviteListQuery] = useState("");
  const [inviteListStatusFilter, setInviteListStatusFilter] =
    useState<CreatorInviteStatusFilter>("all");
  const [memberRosterQuery, setMemberRosterQuery] = useState("");
  const [memberRosterFilter, setMemberRosterFilter] =
    useState<MemberRosterFilter>("all");
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberBulkPaymentStatus, setMemberBulkPaymentStatus] = useState<
    PaymentStatusType | ""
  >("");
  const [counterDialog, setCounterDialog] = useState<string | null>(null);
  const [counterRate, setCounterRate] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [revisionDialog, setRevisionDialog] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [proofCorrectionDialog, setProofCorrectionDialog] = useState<{
    proofKind: "evidence" | "performance";
    proofId: string;
    reportTaskId: string;
    creatorName: string;
  } | null>(null);
  const [proofCorrectionNote, setProofCorrectionNote] = useState("");
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [showDeadlineDialog, setShowDeadlineDialog] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [deadlineError, setDeadlineError] = useState("");
  const [scrollTargetTestId, setScrollTargetTestId] = useState<string | null>(null);
  const [launchBriefDraft, setLaunchBriefDraft] = useState("");
  const [launchDeliverablePlatform, setLaunchDeliverablePlatform] =
    useState("instagram");
  const [launchDeliverableFormat, setLaunchDeliverableFormat] =
    useState<ContentFormat>("short_video");
  const [launchDeliverableQuantity, setLaunchDeliverableQuantity] = useState("1");
  const [memberSort, setMemberSort] = useState<{
    key: MemberSortKey;
    direction: MemberSortDirection;
  }>({ key: "creator", direction: "asc" });
  const [applicantSort, setApplicantSort] = useState<{
    key: ApplicantSortKey;
    direction: MemberSortDirection;
  }>({ key: "applied", direction: "desc" });
  const [contentSort, setContentSort] = useState<{
    key: ContentSortKey;
    direction: MemberSortDirection;
  }>({ key: "submitted", direction: "desc" });
  const [contentQueueFilter, setContentQueueFilter] =
    useState<ContentQueueFilter>("all");
  const [reportingQueueSort, setReportingQueueSort] = useState<{
    key: ReportingQueueSortKey;
    direction: MemberSortDirection;
  }>({ key: "status", direction: "asc" });
  const [reportingQueueFilter, setReportingQueueFilter] =
    useState<ReportingQueueFilter>("all");
  const canManageCampaigns = hasBrandWorkspacePermission(
    currentBrandRole,
    "manage_campaigns",
  );
  const canReviewCampaignContent = hasBrandWorkspacePermission(
    currentBrandRole,
    "review_content",
  );
  const canManageBilling = hasBrandWorkspacePermission(
    currentBrandRole,
    "manage_billing",
  );
  const canManageCampaignAssets = canManageCampaigns;
  const responsibilityAssignmentsByKind = useMemo(
    () =>
      new Map(
        responsibilityAssignments.map((assignment) => [
          assignment.responsibility,
          assignment,
        ]),
      ),
    [responsibilityAssignments],
  );
  const teamMembersById = useMemo(
    () => new Map(teamMembers.map((member) => [member.id, member])),
    [teamMembers],
  );
  const assignableTeamMembers = useMemo(
    () =>
      teamMembers.filter(
        (member) => member.acceptedAt !== null && member.id !== "owner",
      ),
    [teamMembers],
  );
  const currentBrandTeamMember = useMemo(
    () =>
      teamMembers.find((member) => member.userId === currentBrandUserId) ?? null,
    [currentBrandUserId, teamMembers],
  );
  const approvalsOwnerName = getCampaignResponsibilityOwnerName({
    assignmentsByKind: responsibilityAssignmentsByKind,
    kind: "approvals",
    teamMembersById,
  });
  const reportingOwnerName = getCampaignResponsibilityOwnerName({
    assignmentsByKind: responsibilityAssignmentsByKind,
    kind: "reporting",
    teamMembersById,
  });
  const currentUserOwnsApprovals = Boolean(
    currentBrandTeamMember &&
      responsibilityAssignmentsByKind.get("approvals")?.brand_team_member_id ===
        currentBrandTeamMember.id,
  );
  const currentUserOwnsReporting = Boolean(
    currentBrandTeamMember &&
      responsibilityAssignmentsByKind.get("reporting")?.brand_team_member_id ===
        currentBrandTeamMember.id,
  );

  const handleCampaignTabChange = useCallback(function handleCampaignTabChange(
    value: string,
  ) {
    const tab = isCampaignDetailTab(value) ? value : "overview";
    router.push(buildCampaignDetailTabUrl(pathname, searchParams, tab), {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!campaign) return;
    setLaunchBriefDraft(campaign.brief_description ?? "");
    setLaunchDeliverablePlatform(campaign.platforms[0] ?? "instagram");
  }, [campaign]);

  useEffect(() => {
    setReportingMetricDrafts(
      Object.fromEntries(
        reportingRequirements.map((requirement) => [
          requirement.id,
          requirement.required_metric_keys ?? [],
        ]),
      ),
    );
  }, [reportingRequirements]);

  useEffect(() => {
    if (!scrollTargetTestId || typeof document === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      document
        .querySelector(`[data-testid="${scrollTargetTestId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollTargetTestId(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, scrollTargetTestId]);

  const loadCampaignWorkspace = useCallback(async () => {
    const supabase = createClient();
    try {
      const teamSettings = await getBrandTeamSettings();
      setCurrentBrandUserId(teamSettings.currentUserId);
      setCurrentBrandRole(teamSettings.currentUserRole);
      setTeamMembers(teamSettings.members);
    } catch {
      setCurrentBrandUserId(null);
      setCurrentBrandRole(null);
      setTeamMembers([]);
    }

    // Fetch campaign
    const { data: camp } = await supabase
      .from("campaigns")
      .select(
        `id, title, status, campaign_mode, recruitment_visibility, service_fee_cents, service_fee_currency, service_fee_checkout_session_id, service_fee_failed_at, service_fee_last_event_at, service_fee_last_event_id, service_fee_last_event_type, service_fee_paid_at, service_fee_payment_intent_id, service_fee_refunded_at, service_fee_disputed_at, service_fee_status, service_package_snapshot, platforms, markets, niches, budget_min, budget_max,
         total_spend, max_creators, brief_description, brief_requirements,
         brief_dos, brief_donts, application_deadline, content_due_date,
         posting_window_start, posting_window_end, max_revisions, created_at`,
      )
      .eq("id", campaignId)
      .single();

    if (camp) setCampaign(camp as CampaignRow);

    const { data: inviteRows } = await supabase
      .from("campaign_creator_invites")
      .select(
        "id, campaign_id, contact_type, contact_value, normalized_contact, status, queued_email_id, invited_at, created_at",
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    setCreatorInvites((inviteRows ?? []) as CampaignCreatorInviteRow[]);

    const { data: responsibilityRows } = await supabase
      .from("campaign_responsibility_assignments")
      .select(
        "id, campaign_id, brand_team_member_id, responsibility, assigned_by, created_at, updated_at",
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    setResponsibilityAssignments(
      (responsibilityRows ?? []) as CampaignResponsibilityAssignmentRow[],
    );

    const { data: deliverableRows } = await supabase
      .from("campaign_deliverables")
      .select("id, platform, content_type, quantity, notes")
      .eq("campaign_id", campaignId)
      .order("platform", { ascending: true });
    setDeliverables((deliverableRows ?? []) as DeliverableRow[]);

    const { data: reportingRequirementRows } = await supabase
      .from("campaign_reporting_requirements")
      .select(
        "id, platform, platform_label, content_format, account_requirement, evidence_types, required_metric_keys, ai_extraction_allowed, creator_confirmation_required",
      )
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true });
    setReportingRequirements(
      (reportingRequirementRows ?? []) as CampaignReportingRequirementRow[],
    );

    const { data: reportGoalData } = await supabase
      .from("campaign_reporting_plans")
      .select("report_preset_id, report_chart_mode_id, report_block_ids")
      .eq("campaign_id", campaignId)
      .maybeSingle();
    setReportGoalContext(getReportGoalContext(reportGoalData));

    const { data: assetRows } = await supabase
      .from("campaign_assets")
      .select(
        "id, campaign_id, title, description, asset_type, bucket_id, storage_path, file_name, mime_type, size_bytes, visibility, status, created_at",
      )
      .eq("campaign_id", campaignId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    const typedAssets = (assetRows ?? []) as CampaignAssetRecord[];
    const assetPaths = typedAssets.map((asset) => asset.storage_path);
    const signedAssetUrls =
      assetPaths.length > 0
        ? await supabase.storage
            .from("campaign-assets")
            .createSignedUrls(assetPaths, 600)
        : { data: [] };
    setCreativeAssets(
      typedAssets.map((asset, index) =>
        mapCampaignAssetRow(
          asset,
          signedAssetUrls.data?.[index]?.signedUrl ?? null,
        ),
      ),
    );

    const { data: agreements } = await supabase
      .from("campaign_agreements")
      .select(
        "id, campaign_id, version, status, gate_mode, title, rules, agreement_body, preview_summary, file_name, file_mime_type, file_size_bytes, file_sha256, requires_typed_name",
      )
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false });
    setAgreement((agreements?.[0] as BrandAgreementRow | undefined) ?? null);

    // Fetch applications (profiles joined via FK, creator_profiles fetched separately)
    const { data: apps } = await supabase
      .from("campaign_applications")
      .select(
        `id, proposed_rate, pitch, status, created_at, creator_id,
         profiles!campaign_applications_creator_id_fkey ( full_name, avatar_url )`,
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (apps) {
      // Fetch creator_profiles for all applicant creator IDs
      const appCreatorIds = apps.map((a: Record<string, unknown>) => a.creator_id as string).filter(Boolean);
      const cpMap = new Map<string, Record<string, unknown>>();
      if (appCreatorIds.length > 0) {
        const { data: cps } = await supabase
          .from("creator_profiles")
          .select("profile_id, slug, primary_market, niches, rating")
          .in("profile_id", appCreatorIds);
        if (cps) {
          for (const cp of cps) cpMap.set(cp.profile_id, cp);
        }
      }

      setApplications(
        apps.map((a: Record<string, unknown>) => ({
          ...a,
          profiles: Array.isArray(a.profiles) ? a.profiles[0] : a.profiles,
          creator_profiles: cpMap.get(a.creator_id as string) ?? null,
        })) as ApplicationRow[],
      );
    }

    // Fetch members (profiles joined via FK, creator_profiles fetched separately)
    const { data: mems } = await supabase
      .from("campaign_members")
      .select(
        `id, creator_id, accepted_rate, payment_status,
         profiles!campaign_members_creator_id_fkey ( full_name, avatar_url )`,
      )
      .eq("campaign_id", campaignId);

    if (mems) {
      // Fetch creator_profiles for all member creator IDs
      const memCreatorIds = mems.map((m: Record<string, unknown>) => m.creator_id as string).filter(Boolean);
      const memCpMap = new Map<string, Record<string, unknown>>();
      if (memCreatorIds.length > 0) {
        const { data: cps } = await supabase
          .from("creator_profiles")
          .select("profile_id, primary_market, tiktok, instagram, snapchat, youtube, facebook")
          .in("profile_id", memCreatorIds);
        if (cps) {
          for (const cp of cps) memCpMap.set(cp.profile_id, cp);
        }
      }

      setMembers(
        mems.map((m: Record<string, unknown>) => ({
          ...m,
          profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
          creator_profiles: memCpMap.get(m.creator_id as string) ?? null,
        })) as MemberRow[],
      );
    }

    // Fetch content submissions, report tasks, and proof status via member IDs
    const memberIds = (mems || []).map((m: Record<string, unknown>) => m.id);
    let subs: Record<string, unknown>[] | null = null;
    if (memberIds.length > 0) {
      const { data } = await supabase
        .from("content_submissions")
        .select(
          `id, parent_submission_id, content_url, published_url, caption, platform, status, version, feedback, revision_count, submitted_at, reviewed_at, campaign_member_id,
           campaign_members!content_submissions_campaign_member_id_fkey ( profiles!campaign_members_creator_id_fkey ( full_name, avatar_url ) )`,
        )
        .in("campaign_member_id", memberIds)
        .order("submitted_at", { ascending: false });
      subs = data as Record<string, unknown>[] | null;

      const { data: tasks } = await supabase
        .from("campaign_report_tasks")
        .select("id, campaign_member_id, task_key, period_start, period_end, due_at, status, submitted_at, review_note, missed_at, excused_at")
        .eq("campaign_id", campaignId)
        .in("campaign_member_id", memberIds)
        .order("due_at", { ascending: true });
      setReportTasks((tasks ?? []) as ReportTaskRow[]);

      const submissionIds = (subs ?? [])
        .map((submission) => submission.id)
        .filter((id): id is string => typeof id === "string");
      if (submissionIds.length > 0) {
        const { data: performance } = await supabase
          .from("content_performance")
          .select("id, submission_id, report_task_id, measurement_type, reported_at, screenshot_url, verification_status")
          .in("submission_id", submissionIds)
          .order("reported_at", { ascending: false });
        setPerformanceRows((performance ?? []) as PerformanceRow[]);
      } else {
        setPerformanceRows([]);
      }

      const { data: evidence } = await supabase
        .from("content_performance_evidence")
        .select("id, campaign_member_id, report_task_id, submission_id, performance_id, file_name, mime_type, size_bytes, storage_path, verification_status, review_note, created_at")
        .eq("campaign_id", campaignId)
        .in("campaign_member_id", memberIds)
        .order("created_at", { ascending: false });
      const typedEvidence = (evidence ?? []) as EvidenceRow[];
      const evidencePaths = typedEvidence
        .map((row) => row.storage_path)
        .filter((path): path is string => Boolean(path));
      const signedEvidenceUrlsByPath = new Map<string, string>();
      if (evidencePaths.length > 0) {
        const { data: signedEvidenceUrls } = await supabase.storage
          .from("campaign-evidence")
          .createSignedUrls(evidencePaths, 600);

        signedEvidenceUrls?.forEach((item, index) => {
          const storagePath = evidencePaths[index];
          if (storagePath && item.signedUrl) {
            signedEvidenceUrlsByPath.set(storagePath, item.signedUrl);
          }
        });
      }
      setEvidenceRows(
        typedEvidence.map((row) => ({
          ...row,
          signed_url: row.storage_path
            ? signedEvidenceUrlsByPath.get(row.storage_path) ?? null
            : null,
        })),
      );

      const { data: agreementStatuses } = await supabase
        .from("campaign_member_agreement_status")
        .select(
          "campaign_id, campaign_member_id, creator_id, agreement_id, agreement_version, status, accepted_at, typed_name",
        )
        .eq("campaign_id", campaignId)
        .in("campaign_member_id", memberIds);
      setAgreementStatusRows((agreementStatuses ?? []) as AgreementStatusRow[]);
    } else {
      setReportTasks([]);
      setEvidenceRows([]);
      setPerformanceRows([]);
      setAgreementStatusRows([]);
    }

    if (subs) {
      setSubmissions(
        subs.map((s: Record<string, unknown>) => {
          const cm = Array.isArray(s.campaign_members) ? s.campaign_members[0] : s.campaign_members;
          return {
            ...s,
            campaign_members: cm
              ? {
                  profiles: Array.isArray((cm as Record<string, unknown>).profiles)
                    ? ((cm as Record<string, unknown>).profiles as unknown[])[0]
                    : (cm as Record<string, unknown>).profiles,
                }
              : null,
          };
        }) as SubmissionRow[],
      );
    } else {
      setSubmissions([]);
    }

    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    void loadCampaignWorkspace();
  }, [loadCampaignWorkspace]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async function handleAccept(appId: string, rate: number | null) {
    if (!canManageCampaigns || !campaignAcceptsApplicationDecisions) return;
    setActionLoading(getApplicationActionKey(appId, "accept"));
    try {
      await acceptApplication(appId, rate || 0);
      await loadCampaignWorkspace();
      toast.success(t("applicants.accept"));
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleReject(appId: string) {
    if (!canManageCampaigns || !campaignAcceptsApplicationDecisions) return;
    setActionLoading(getApplicationActionKey(appId, "reject"));
    try {
      await rejectApplication(appId);
      await loadCampaignWorkspace();
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  function handleApplicantSelection(appId: string, checked: boolean) {
    if (!canManageCampaigns || !campaignAcceptsApplicationDecisions) return;

    setSelectedApplicantIds((current) => {
      if (checked) {
        return current.includes(appId) ? current : [...current, appId];
      }

      return current.filter((id) => id !== appId);
    });
  }

  function handleVisibleApplicantSelection(checked: boolean) {
    if (!canManageCampaigns || !campaignAcceptsApplicationDecisions) return;

    const visibleIds = sortedPendingApps.map((app) => app.id);
    setSelectedApplicantIds((current) => {
      if (checked) {
        return [...new Set([...current, ...visibleIds])];
      }

      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  async function handleBulkAcceptApplicants() {
    if (!canManageCampaigns || !campaignAcceptsApplicationDecisions) return;
    const applicationIds = selectedPendingApps.map((app) => app.id);
    if (applicationIds.length === 0) return;
    if (selectedApplicantsOverCapacity) {
      toast.error(
        t("applicants.bulk.selectUpTo", {
          count: String(creatorCapacityOpenSeats),
        }),
      );
      return;
    }

    setActionLoading("applicants-bulk-accept");
    try {
      await acceptApplicationsBatch({ application_ids: applicationIds });
      setSelectedApplicantIds([]);
      await loadCampaignWorkspace();
      toast.success(
        t("applicants.bulk.acceptedToast", {
          count: String(applicationIds.length),
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBulkRejectApplicants() {
    if (!canManageCampaigns || !campaignAcceptsApplicationDecisions) return;
    const applicationIds = selectedPendingApps.map((app) => app.id);
    if (applicationIds.length === 0) return;

    setActionLoading("applicants-bulk-reject");
    try {
      await rejectApplicationsBatch({ application_ids: applicationIds });
      setSelectedApplicantIds([]);
      await loadCampaignWorkspace();
      toast.success(
        t("applicants.bulk.declinedToast", {
          count: String(applicationIds.length),
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCounter() {
    if (!canManageCampaigns || !campaignAcceptsApplicationDecisions) return;
    if (!counterDialog || !counterRate) return;
    setActionLoading(getApplicationActionKey(counterDialog, "counter"));
    try {
      await counterOffer({
        application_id: counterDialog,
        counter_rate: Number(counterRate),
        counter_message: counterMessage || undefined,
      });
      await loadCampaignWorkspace();
      setCounterDialog(null);
      setCounterRate("");
      setCounterMessage("");
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleMemberPaymentStatusChange(
    memberId: string,
    status: PaymentStatusType,
  ) {
    if (!canManageCampaigns) return;
    const loadingKey = `member-payment:${memberId}`;
    setActionLoading(loadingKey);
    try {
      await updateCampaignMemberPaymentStatus({ memberId, status });
      setMembers((current) =>
        current.map((member) =>
          member.id === memberId ? { ...member, payment_status: status } : member,
        ),
      );
      toast.success(t("members.paymentSavedToast"));
      await loadCampaignWorkspace();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("members.paymentSaveError"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  function handleMemberRosterQueryChange(value: string) {
    setMemberRosterQuery(value);
    setSelectedMemberIds([]);
  }

  function handleMemberRosterFilterChange(value: MemberRosterFilter) {
    setMemberRosterFilter(value);
    setSelectedMemberIds([]);
  }

  function handleMemberSelection(memberId: string, checked: boolean) {
    setSelectedMemberIds((current) => {
      if (checked) return Array.from(new Set([...current, memberId]));
      return current.filter((id) => id !== memberId);
    });
  }

  function handleVisibleMemberSelection(checked: boolean) {
    const visibleIds = filteredMembers.map((member) => member.id);
    setSelectedMemberIds((current) => {
      if (checked) return Array.from(new Set([...current, ...visibleIds]));
      const visibleSet = new Set(visibleIds);
      return current.filter((id) => !visibleSet.has(id));
    });
  }

  async function handleBulkMemberPaymentStatus() {
    if (!canManageCampaigns) return;
    if (!memberBulkPaymentStatus || selectedMembers.length === 0) return;

    const memberIds = selectedMembers.map((member) => member.id);
    setActionLoading("members-bulk-payment");
    try {
      const result = await updateCampaignMemberPaymentStatuses({
        member_ids: memberIds,
        status: memberBulkPaymentStatus,
      });
      setMembers((current) =>
        current.map((member) =>
          selectedMemberSet.has(member.id)
            ? { ...member, payment_status: memberBulkPaymentStatus }
            : member,
        ),
      );
      setMemberBulkPaymentStatus("");
      toast.success(
        t("members.bulk.paymentSavedToast", {
          count: String(result.updatedCount),
        }),
      );
      await loadCampaignWorkspace();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("members.paymentSaveError"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBulkMissedReportFollowUp() {
    if (
      !canReviewCampaignContent ||
      !campaignAcceptsProofReviewDecisions ||
      selectedMissedReportTaskIds.length === 0
    ) {
      return;
    }

    setActionLoading("members-bulk-follow-up");
    try {
      const result = await requestMissedReportFollowUpsBatch({
        reportTaskIds: selectedMissedReportTaskIds,
      });
      const followedUpTaskIds = new Set(selectedMissedReportTaskIds);
      setReportTasks((current) =>
        current.map((task) =>
          followedUpTaskIds.has(task.id)
            ? { ...task, review_note: "Follow-up requested" }
            : task,
        ),
      );
      toast.success(
        t("members.bulk.followUpToast", {
          count: String(result.requestedCount),
        }),
      );
      await loadCampaignWorkspace();
    } catch {
      toast.error(tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  function getReportingMetricDraft(requirement: CampaignReportingRequirementRow) {
    return reportingMetricDrafts[requirement.id] ?? requirement.required_metric_keys ?? [];
  }

  function handleReportingMetricToggle(
    requirement: CampaignReportingRequirementRow,
    metricKey: string,
  ) {
    setReportingMetricDrafts((current) => {
      const currentKeys = current[requirement.id] ?? requirement.required_metric_keys ?? [];
      const nextKeys = currentKeys.includes(metricKey)
        ? currentKeys.length > 1
          ? currentKeys.filter((key) => key !== metricKey)
          : currentKeys
        : [...currentKeys, metricKey];

      return {
        ...current,
        [requirement.id]: nextKeys,
      };
    });
  }

  async function handleReportingRequirementUpdate(
    requirement: CampaignReportingRequirementRow,
  ) {
    if (!campaign || !canEditReportingRequirements) return;
    const requiredMetricKeys = getReportingMetricDraft(requirement);

    if (requiredMetricKeys.length === 0) {
      toast.error(t("reportingConfig.selectOne"));
      return;
    }

    const loadingKey = `reporting-requirement:${requirement.id}`;
    setActionLoading(loadingKey);
    try {
      await updateCampaignReportingRequirement({
        campaignId: campaign.id,
        requirementId: requirement.id,
        platform: requirement.platform,
        platformLabel: requirement.platform_label,
        contentFormat: requirement.content_format,
        accountRequirement: requirement.account_requirement,
        evidenceTypes: requirement.evidence_types as ReportingEvidenceType[],
        requiredMetricKeys,
        aiExtractionAllowed: requirement.ai_extraction_allowed,
        creatorConfirmationRequired: requirement.creator_confirmation_required,
      });
      setReportingRequirements((current) =>
        current.map((item) =>
          item.id === requirement.id
            ? { ...item, required_metric_keys: requiredMetricKeys }
            : item,
        ),
      );
      toast.success(t("reportingConfig.saved"));
      await loadCampaignWorkspace();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("reportingConfig.error"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCampaignResponsibilityChange(
    responsibility: CampaignResponsibilityKind,
    brandTeamMemberId: string,
  ) {
    if (!canManageCampaigns) return;
    const loadingKey = `campaign-responsibility:${responsibility}`;
    const nextBrandTeamMemberId =
      brandTeamMemberId === "unassigned" ? null : brandTeamMemberId;
    setActionLoading(loadingKey);
    try {
      await updateCampaignResponsibility({
        campaignId,
        responsibility,
        brandTeamMemberId: nextBrandTeamMemberId,
      });
      setResponsibilityAssignments((current) => {
        const remaining = current.filter(
          (assignment) => assignment.responsibility !== responsibility,
        );
        if (!nextBrandTeamMemberId) return remaining;
        const previous = current.find(
          (assignment) => assignment.responsibility === responsibility,
        );
        return [
          ...remaining,
          {
            id: previous?.id ?? `${campaignId}:${responsibility}`,
            campaign_id: campaignId,
            responsibility,
            brand_team_member_id: nextBrandTeamMemberId,
            assigned_by: null,
            created_at: previous?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
      toast.success(t("responsibility.savedToast"));
      await loadCampaignWorkspace();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("responsibility.failedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveContent(subId: string) {
    if (!canReviewCampaignContent || !campaignAcceptsContentReviewDecisions) return;
    setActionLoading(subId);
    try {
      await approveContent(subId);
      setSubmissions((prev) => prev.map((s) => s.id === subId ? { ...s, status: "approved", reviewed_at: new Date().toISOString() } : s));
      toast.success(t("content.approve"));
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleRequestRevision() {
    if (!canReviewCampaignContent || !campaignAcceptsContentReviewDecisions) return;
    if (!revisionDialog || !revisionFeedback.trim()) return;
    setActionLoading(revisionDialog);
    try {
      await requestRevision(revisionDialog, revisionFeedback.trim());
      setSubmissions((prev) => prev.map((s) => s.id === revisionDialog ? { ...s, status: "revision_requested", feedback: revisionFeedback.trim(), revision_count: (s.revision_count ?? 0) + 1 } : s));
      setRevisionDialog(null);
      setRevisionFeedback("");
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleExcuseReportTask(reportTaskId: string) {
    if (!canReviewCampaignContent || !campaignAcceptsProofReviewDecisions) return;
    const loadingKey = `report-task:${reportTaskId}:excuse`;
    setActionLoading(loadingKey);
    try {
      await markReportTaskExcused({ reportTaskId });
      setReportTasks((current) =>
        current.map((task) =>
          task.id === reportTaskId
            ? {
                ...task,
                status: "excused",
                missed_at: null,
                excused_at: new Date().toISOString(),
                review_note: null,
              }
            : task,
        ),
      );
      toast.success(t("reportStatus.excusedToast"));
    } catch {
      toast.error(tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestReportFollowUp(reportTaskId: string) {
    if (!canReviewCampaignContent || !campaignAcceptsProofReviewDecisions) return;
    const loadingKey = `report-task:${reportTaskId}:follow-up`;
    setActionLoading(loadingKey);
    try {
      await requestMissedReportFollowUp({ reportTaskId });
      setReportTasks((current) =>
        current.map((task) =>
          task.id === reportTaskId
            ? {
                ...task,
                review_note: "Follow-up requested",
              }
            : task,
        ),
      );
      toast.success(t("reportStatus.followUpSentToast"));
    } catch {
      toast.error(tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleVerifyPerformanceEvidence(evidenceId: string) {
    if (!canReviewCampaignContent || !campaignAcceptsProofReviewDecisions) return;
    const loadingKey = `evidence:${evidenceId}:verify`;
    setActionLoading(loadingKey);
    try {
      await reviewPerformanceEvidence({
        evidenceId,
        decision: "verified",
      });
      setEvidenceRows((current) =>
        current.map((evidence) =>
          evidence.id === evidenceId
            ? {
                ...evidence,
                verification_status: "verified",
                review_note: null,
              }
            : evidence,
        ),
      );
      await loadCampaignWorkspace();
      toast.success(t("reporting.verifyProofToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleVerifyPerformanceProofLink(performanceId: string) {
    if (!canReviewCampaignContent || !campaignAcceptsProofReviewDecisions) return;
    const loadingKey = `performance:${performanceId}:verify`;
    setActionLoading(loadingKey);
    try {
      await reviewPerformanceProofLink({
        performanceId,
        decision: "verified",
      });
      setPerformanceRows((current) =>
        current.map((performance) =>
          performance.id === performanceId
            ? {
                ...performance,
                verification_status: "brand_verified",
              }
            : performance,
        ),
      );
      await loadCampaignWorkspace();
      toast.success(t("reporting.verifyProofToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestPerformanceCorrection() {
    if (!canReviewCampaignContent || !campaignAcceptsProofReviewDecisions) return;
    if (!proofCorrectionDialog || !proofCorrectionNote.trim()) return;

    const loadingKey = `${proofCorrectionDialog.proofKind}:${proofCorrectionDialog.proofId}:correction`;
    setActionLoading(loadingKey);
    try {
      if (proofCorrectionDialog.proofKind === "evidence") {
        await reviewPerformanceEvidence({
          evidenceId: proofCorrectionDialog.proofId,
          decision: "needs_revision",
          correctionNote: proofCorrectionNote.trim(),
        });
        setEvidenceRows((current) =>
          current.map((evidence) =>
            evidence.id === proofCorrectionDialog.proofId
              ? {
                  ...evidence,
                  verification_status: "rejected",
                  review_note: proofCorrectionNote.trim(),
                }
              : evidence,
          ),
        );
      } else {
        await reviewPerformanceProofLink({
          performanceId: proofCorrectionDialog.proofId,
          decision: "needs_revision",
          correctionNote: proofCorrectionNote.trim(),
        });
        setPerformanceRows((current) =>
          current.map((performance) =>
            performance.id === proofCorrectionDialog.proofId
              ? {
                  ...performance,
                  verification_status: "rejected",
                }
              : performance,
          ),
        );
      }
      setReportTasks((current) =>
        current.map((task) =>
          task.id === proofCorrectionDialog.reportTaskId
            ? {
                ...task,
                status: "needs_revision",
                review_note: proofCorrectionNote.trim(),
              }
            : task,
        ),
      );
      setProofCorrectionDialog(null);
      setProofCorrectionNote("");
      await loadCampaignWorkspace();
      toast.success(t("reporting.requestCorrectionToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLaunchCampaign() {
    if (!canManageCampaigns) return;
    if (!campaign) return;

    setActionLoading("launch");
    try {
      await launchCampaign(campaign.id);
      await loadCampaignWorkspace();
      toast.success(t("launchReadiness.launchedToast"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("launchReadiness.launchFailedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  const handleServiceFeeCheckout = useCallback(async () => {
    if (!canManageBilling) return;
    if (!campaign) return;

    setActionLoading("service-fee-checkout");
    try {
      const result = await createCampaignServiceFeeCheckout({
        campaignId: campaign.id,
      });

      if (result.alreadyPaid) {
        await loadCampaignWorkspace();
        toast.success(t("serviceFee.alreadyPaidToast"));
        return;
      }

      window.location.assign(result.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("serviceFee.checkoutFailedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }, [campaign, canManageBilling, loadCampaignWorkspace, t]);

  function handleLaunchReadinessFix(item: LaunchReadinessItem) {
    if (!item.targetTestId) return;

    if (item.key === "image" || item.key === "rules") {
      handleCampaignTabChange("brief");
    } else {
      handleCampaignTabChange("overview");
    }
    setScrollTargetTestId(item.targetTestId);
  }

  async function handleSaveLaunchBrief() {
    if (!canManageCampaigns) return;
    if (!campaign) return;

    const briefDescription = launchBriefDraft.trim();
    if (briefDescription.length < 10) {
      toast.error(t("launchReadiness.fix.briefTooShort"));
      return;
    }

    setActionLoading("launch-brief");
    try {
      await updateCampaignLaunchSetup({
        campaignId: campaign.id,
        briefDescription,
      });
      await loadCampaignWorkspace();
      toast.success(t("launchReadiness.fix.savedToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddLaunchDeliverable() {
    if (!canManageCampaigns) return;
    if (!campaign) return;

    const quantity = Number(launchDeliverableQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      toast.error(t("launchReadiness.fix.quantityInvalid"));
      return;
    }

    setActionLoading("launch-deliverable");
    try {
      await updateCampaignLaunchSetup({
        campaignId: campaign.id,
        deliverable: {
          platform: launchDeliverablePlatform,
          contentType: launchDeliverableFormat,
          quantity,
        },
      });
      await loadCampaignWorkspace();
      toast.success(t("launchReadiness.fix.savedToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSyncLaunchReporting() {
    if (!canManageCampaigns) return;
    if (!campaign) return;

    setActionLoading("launch-reporting");
    try {
      await updateCampaignLaunchSetup({
        campaignId: campaign.id,
        syncReportingRequirements: true,
      });
      await loadCampaignWorkspace();
      toast.success(t("launchReadiness.fix.savedToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("error.generic"));
    } finally {
      setActionLoading(null);
    }
  }

  const handleOperationCardClick = useCallback((key: string) => {
    if (key === "toReview") {
      handleCampaignTabChange("reporting");
      setReportingQueueFilter("needs_review");
      setScrollTargetTestId("campaign-reporting-proof-queue");
      return;
    }

    if (key === "corrections") {
      handleCampaignTabChange("reporting");
      setReportingQueueFilter("corrections");
      setScrollTargetTestId("campaign-reporting-proof-queue");
      return;
    }

    if (key === "missed") {
      handleCampaignTabChange("reporting");
      setReportingQueueFilter("missed");
      setScrollTargetTestId("campaign-reporting-proof-queue");
    }
  }, [handleCampaignTabChange]);

  // Computed values
  const budget = campaign?.budget_max || campaign?.budget_min || 0;
  const spent = campaign?.total_spend || 0;
  const activeSubmissions = useMemo(
    () =>
      getActiveCampaignSubmissions(
        submissions.map((submission) => ({
          ...submission,
          parentSubmissionId: submission.parent_submission_id,
        })),
      ),
    [submissions],
  );
  const totalContent = activeSubmissions.length;
  const approvedContent = activeSubmissions.filter(
    (submission) =>
      submission.status === "approved" || submission.status === "published",
  ).length;
  const pendingApps = applications.filter((a) => a.status === "pending");
  const unresolvedApplicationCount = applications.filter((a) =>
    a.status === "pending" || a.status === "counter_offer"
  ).length;
  const shouldPrioritizeApplicants = pendingApps.length > 0;
  const applicantSectionOrderClass = shouldPrioritizeApplicants ? (
    "order-1"
  ) : (
    "order-2"
  );
  const memberSectionOrderClass = shouldPrioritizeApplicants ? (
    "order-2"
  ) : (
    "order-1"
  );
  const memberOperationsById = useMemo(() => {
    const operations = new Map<string, MemberOperations>();

    for (const member of members) {
      operations.set(
        member.id,
        getMemberOperations({
          evidenceRows,
          locale,
          member,
          performanceRows,
          reportTasks,
          t,
        }),
      );
    }

    return operations;
  }, [evidenceRows, locale, members, performanceRows, reportTasks, t]);
  const agreementStatusByMemberId = useMemo(
    () =>
      new Map(
        agreementStatusRows.map((row) => [
          row.campaign_member_id,
          row.status,
        ]),
      ),
    [agreementStatusRows],
  );

  const reportingOperationCounts = useMemo(() => {
    const verified = reportTasks.filter((task) => task.status === "verified").length;
    const settled = reportTasks.filter(
      (task) => task.status === "verified" || task.status === "excused",
    ).length;
    let toReview = 0;
    let corrections = 0;
    const settledReportTaskIds = new Set(
      reportTasks
        .filter((task) => task.status === "verified" || task.status === "excused")
        .map((task) => task.id),
    );

    for (const task of reportTasks) {
      if (settledReportTaskIds.has(task.id)) continue;

      const currentEvidenceRows = getCurrentEvidenceRowsForTask(
        evidenceRows,
        task.id,
      );
      const currentPerformanceRows = getCurrentPerformanceRowsForTask(
        performanceRows,
        task.id,
      );
      let countedCorrection = false;

      if (currentEvidenceRows.length > 0) {
        for (const evidence of currentEvidenceRows) {
          if (evidence.verification_status === "submitted") {
            toReview += 1;
          }

          if (evidence.verification_status === "rejected") {
            corrections += 1;
            countedCorrection = true;
          }
        }
      } else {
        for (const performance of currentPerformanceRows) {
          const hasProofLink = Boolean(
            performance.screenshot_url?.startsWith("http"),
          );

          if (
            performance.verification_status === "submitted" &&
            hasProofLink
          ) {
            toReview += 1;
          }

          if (performance.verification_status === "rejected") {
            corrections += 1;
            countedCorrection = true;
          }
        }
      }

      if (task.status === "needs_revision" && !countedCorrection) {
        corrections += 1;
      }
    }

    return {
      verified,
      settled,
      toReview,
      corrections,
      missed: reportTasks.filter((task) => task.status === "missed").length,
    };
  }, [evidenceRows, performanceRows, reportTasks]);
  const pendingReportReads = reportTasks.filter(
    (task) => task.status === "pending",
  ).length;

  const handoffSummary = useMemo(
    () =>
      getBrandCampaignHandoffSummary({
        submissions: activeSubmissions.map((submission) => ({
          status: submission.status,
          publishedUrl: submission.published_url,
        })),
        reportTasks: reportTasks.map((task) => ({
          status: task.status,
        })),
      }),
    [activeSubmissions, reportTasks],
  );
  const missingLiveUrls =
    handoffSummary.stages.find((stage) => stage.key === "liveUrl")?.blockedCount ?? 0;
  const closeoutReadiness = useMemo(
    () =>
      getCampaignCloseoutReadiness({
        campaignStatus: campaign?.status ?? "draft",
        pendingApplicants: pendingApps.length,
        members: members.map((member) => ({ id: member.id })),
        submissions: activeSubmissions.map((submission) => ({
          id: submission.id,
          parentSubmissionId: submission.parent_submission_id,
          campaignMemberId: submission.campaign_member_id,
          publishedUrl: submission.published_url,
          status: submission.status,
        })),
        reportTasks: reportTasks.map((task) => ({
          campaignMemberId: task.campaign_member_id,
          status: task.status,
        })),
      }),
    [activeSubmissions, campaign?.status, members, pendingApps.length, reportTasks],
  );

  const creativeReadiness = useMemo(
    () => getCreativeKitReadiness(creativeAssets),
    [creativeAssets],
  );
  const hasBrief = Boolean(campaign?.brief_description?.trim());
  const hasDeliverables = deliverables.some(
    (deliverable) => deliverable.quantity > 0 && deliverable.content_type,
  );
  const hasReportingRequirements = reportingRequirements.length > 0;
  const rulesReady =
    !agreement || agreement.status === "published" || agreement.status === "archived";
  const launchPlatformOptions = campaign?.platforms.length
    ? campaign.platforms
    : ["instagram"];
  const launchReadinessItems: LaunchReadinessItem[] = [
    {
      key: "image",
      label: t("launchReadiness.image"),
      detail: creativeReadiness.hasCreatorImage
        ? t("launchReadiness.image.ready")
        : t("launchReadiness.image.missing"),
      ready: creativeReadiness.hasCreatorImage,
      actionLabel: creativeReadiness.hasCreatorImage
        ? undefined
        : t("launchReadiness.fix.image"),
      targetTestId: creativeReadiness.hasCreatorImage
        ? undefined
        : "brand-creative-kit-panel",
    },
    {
      key: "brief",
      label: t("launchReadiness.brief"),
      detail: hasBrief
        ? t("launchReadiness.brief.ready")
        : t("launchReadiness.brief.missing"),
      ready: hasBrief,
      actionLabel: hasBrief ? undefined : t("launchReadiness.fix.brief"),
      targetTestId: hasBrief ? undefined : "campaign-launch-brief-fix",
    },
    {
      key: "deliverables",
      label: t("launchReadiness.deliverables"),
      detail: hasDeliverables
        ? t("launchReadiness.deliverables.ready", {
            count: String(deliverables.length),
          })
        : t("launchReadiness.deliverables.missing"),
      ready: hasDeliverables,
      actionLabel: hasDeliverables
        ? undefined
        : t("launchReadiness.fix.deliverables"),
      targetTestId: hasDeliverables
        ? undefined
        : "campaign-launch-deliverable-fix",
    },
    {
      key: "reporting",
      label: t("launchReadiness.reporting"),
      detail: hasReportingRequirements
        ? t("launchReadiness.reporting.ready", {
            count: String(reportingRequirements.length),
          })
        : t("launchReadiness.reporting.missing"),
      ready: hasReportingRequirements,
      actionLabel: hasReportingRequirements
        ? undefined
        : t("launchReadiness.fix.reporting"),
      targetTestId: hasReportingRequirements
        ? undefined
        : "campaign-launch-reporting-fix",
    },
    {
      key: "rules",
      label: t("launchReadiness.rules"),
      detail: agreement
        ? rulesReady
          ? t("launchReadiness.rules.ready")
          : t("launchReadiness.rules.draft")
        : t("launchReadiness.rules.optional"),
      ready: rulesReady,
      actionLabel: rulesReady ? undefined : t("launchReadiness.fix.rules"),
      targetTestId: rulesReady ? undefined : "brand-agreement-panel",
    },
    {
      key: "invite",
      label: t("launchReadiness.invite"),
      detail: t("launchReadiness.invite.ready"),
      ready: true,
    },
  ];
  const launchReadinessBlockers = launchReadinessItems.filter(
    (item) => !item.ready,
  ).length;
  const setupTabBadge = `${
    launchReadinessItems.filter((item) => item.ready).length
  }/${launchReadinessItems.length}`;
  const serviceFeeIsPaid = campaign?.service_fee_status === "paid";
  const serviceFeeRequired = (campaign?.service_fee_cents ?? 0) > 0;

  const nextAction = getCampaignNextAction({
    pendingApplicants: unresolvedApplicationCount,
    reportProofToReview: reportingOperationCounts.toReview,
    reportCorrections: reportingOperationCounts.corrections,
    missedReports: reportingOperationCounts.missed,
    pendingReports: pendingReportReads,
    hasPublishedAgreement: agreement?.status === "published",
    requiresAgreement: Boolean(agreement && agreement.status !== "archived"),
    hasCreatorPreviewImage: creativeReadiness.hasCreatorImage,
    memberCount: members.length,
    approvedContent,
    totalContent,
    missingLiveUrls,
    serviceFeeRequired,
    serviceFeePaid: serviceFeeIsPaid,
    campaignStatus: campaign?.status ?? "draft",
    readyToComplete: closeoutReadiness.ready,
  });

  const reportingOperations = useMemo(() => {
    return [
      {
        key: "cleared",
        label: t("reporting.cleared"),
        detail:
          reportingOperationCounts.settled > 0
            ? t("reporting.clearedDetail")
            : t("reporting.clearedWaitingDetail"),
        value:
          reportTasks.length > 0
            ? `${reportingOperationCounts.settled}/${reportTasks.length}`
            : "0",
        icon: CheckCircle,
        className: "text-slate-700",
        actionCount: 0,
      },
      {
        key: "toReview",
        label: t("reporting.toReview"),
        detail: t("reporting.toReviewDetail"),
        value: String(reportingOperationCounts.toReview),
        icon: FileText,
        className: "text-amber-700",
        actionCount: reportingOperationCounts.toReview,
      },
      {
        key: "corrections",
        label: t("reporting.corrections"),
        detail: t("reporting.correctionsDetail"),
        value: String(reportingOperationCounts.corrections),
        icon: FileWarning,
        className: "text-red-700",
        actionCount: reportingOperationCounts.corrections,
      },
      {
        key: "missed",
        label: t("reporting.missed"),
        detail: t("reporting.missedDetail"),
        value: String(reportingOperationCounts.missed),
        icon: XCircle,
        className: "text-red-700",
        actionCount: reportingOperationCounts.missed,
      },
    ];
  }, [reportTasks.length, reportingOperationCounts, t]);
  const reportingQueueRows = useMemo(() => {
    return reportTasks.flatMap((task) => {
      const member = members.find((m) => m.id === task.campaign_member_id) ?? null;
      const name = member?.profiles?.full_name ?? "-";
      const taskEvidenceRows = evidenceRows.filter(
        (evidence) => evidence.report_task_id === task.id,
      );
      const currentEvidenceRows = getCurrentEvidenceRowsForTask(
        evidenceRows,
        task.id,
      );
      const currentPerformanceRows = getCurrentPerformanceRowsForTask(
        performanceRows,
        task.id,
      );
      const queueItems =
        currentEvidenceRows.length > 0
          ? currentEvidenceRows.map((evidence) => ({
              currentEvidence: evidence,
              currentPerformance:
                currentPerformanceRows.find(
                  (performance) => performance.id === evidence.performance_id,
                ) ?? null,
            }))
          : currentPerformanceRows.length > 0
            ? currentPerformanceRows.map((performance) => ({
                currentEvidence: null,
                currentPerformance: performance,
              }))
            : [{ currentEvidence: null, currentPerformance: null }];

      return queueItems.map(({ currentEvidence, currentPerformance }, evidenceIndex) => {
        const currentEvidenceHistory = currentEvidence
          ? taskEvidenceRows.filter(
              (evidence) =>
                getEvidenceReviewKey(evidence) ===
                getEvidenceReviewKey(currentEvidence),
            )
          : [];
        const reviewableEvidence =
          currentEvidence?.verification_status === "submitted" &&
          currentEvidence.performance_id
            ? currentEvidence
            : null;
        const currentPerformanceHasProof = Boolean(
          currentPerformance?.screenshot_url?.startsWith("http"),
        );
        const reviewablePerformance =
          !reviewableEvidence &&
          currentPerformance?.verification_status === "submitted" &&
          currentPerformanceHasProof
            ? currentPerformance
            : null;
        const hasCorrectionReturned =
          (task.status === "submitted" || task.status === "submitted_late") &&
          currentEvidenceHistory.some(
            (evidence) => evidence.verification_status === "rejected",
          ) &&
          currentEvidence?.verification_status === "submitted";
        const linkedSubmission =
          currentEvidence?.submission_id
            ? submissions.find(
                (submission) => submission.id === currentEvidence.submission_id,
              ) ?? null
            : submissions.find(
                (submission) =>
                  submission.campaign_member_id === task.campaign_member_id,
              ) ?? null;
        const platform = linkedSubmission?.platform
          ? PLATFORM_LABELS[linkedSubmission.platform as Platform] ||
            linkedSubmission.platform
          : member?.creator_profiles
            ? getPrimaryPlatform(member.creator_profiles)
            : null;
        const platformLabel = platform
          ? PLATFORM_LABELS[platform as Platform] || platform
          : "-";
        const submittedAt =
          currentEvidence?.created_at ??
          currentPerformance?.reported_at ??
          task.submitted_at ??
          taskEvidenceRows.toSorted(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0]?.created_at ??
          null;
        const queueState = getProofQueueState({
          currentEvidenceStatus: currentEvidence?.verification_status as
            | "submitted"
            | "verified"
            | "rejected"
            | null,
          currentPerformanceStatus: currentPerformance?.verification_status as
            | "submitted"
            | "screenshot_verified"
            | "brand_verified"
            | "rejected"
            | null,
          currentPerformanceHasProof,
          hasReturnedCorrection: hasCorrectionReturned,
          taskStatus: task.status,
        });
        const statusPresentationByState: Record<
          ProofQueueState,
          { label: string; className: string; rank: number }
        > = {
          correction: {
            label: t("proofStatus.correction"),
            className: "border-red-200 bg-red-50 text-red-700",
            rank: reportStatusRank.needs_revision,
          },
          correction_returned: {
            label: t("reportStatus.correctionReturned"),
            className: "border-amber-200 bg-amber-50 text-amber-900",
            rank: reportStatusRank.submitted,
          },
          review: {
            label:
              task.status === "submitted_late"
                ? t("reportStatus.submittedLate")
                : t("proofStatus.toReview"),
            className: "border-amber-200 bg-amber-50 text-amber-900",
            rank: reportStatusRank.submitted,
          },
          metrics_only: {
            label: t("proofStatus.metricsOnly"),
            className: "border-amber-200 bg-amber-50 text-amber-900",
            rank: reportStatusRank.submitted,
          },
          verified: {
            label:
              isReportTaskLate(task)
                ? t("reportStatus.verifiedLate")
                : t("reportStatus.verified"),
            className: "border-slate-200 bg-slate-50 text-muted-foreground",
            rank: reportStatusRank.verified,
          },
          missed: {
            label: t("reportStatus.missed"),
            className: "border-red-200 bg-red-50 text-red-700",
            rank: reportStatusRank.missed,
          },
          excused: {
            label: t("reportStatus.excused"),
            className: "border-slate-200 bg-slate-50 text-muted-foreground",
            rank: reportStatusRank.excused,
          },
          pending: {
            label: t("reportStatus.pending"),
            className: "border-slate-200 bg-white text-muted-foreground",
            rank: reportStatusRank.pending,
          },
        };
        const statusPresentation = statusPresentationByState[queueState];
        const reportImpactPresentationByState: Record<
          ProofQueueState,
          { label: string; className: string }
        > = {
          correction: {
            label: t("reporting.impact.rejected"),
            className: "border-red-200 bg-red-50 text-red-700",
          },
          correction_returned: {
            label: t("reporting.impact.pending"),
            className: "border-amber-200 bg-amber-50 text-amber-900",
          },
          review: {
            label: t("reporting.impact.pending"),
            className: "border-amber-200 bg-amber-50 text-amber-900",
          },
          metrics_only: {
            label: t("reporting.impact.missing"),
            className: "border-slate-200 bg-white text-muted-foreground",
          },
          verified: {
            label: t("reporting.impact.included"),
            className: "border-slate-200 bg-slate-50 text-muted-foreground",
          },
          missed: {
            label: t("reporting.impact.missing"),
            className: "border-slate-200 bg-white text-muted-foreground",
          },
          excused: {
            label: t("reporting.impact.missing"),
            className: "border-slate-200 bg-white text-muted-foreground",
          },
          pending: {
            label: t("reporting.impact.missing"),
            className: "border-slate-200 bg-white text-muted-foreground",
          },
        };
        const reportImpactPresentation = reportImpactPresentationByState[queueState];
        const evidenceLabel = currentEvidence
          ? currentEvidence.file_name || t("proof.count", { count: "1" })
          : currentPerformance
            ? currentPerformance.screenshot_url
              ? t("proofStatus.metricsWithProofLink")
              : t("proofStatus.metricsOnlyDetail")
            : t("proof.noFile");

        return {
          rowId: currentEvidence
            ? `${task.id}:${currentEvidence.id}`
            : currentPerformance
              ? `${task.id}:performance:${currentPerformance.id}`
            : `${task.id}:pending:${evidenceIndex}`,
          task,
          name,
          avatarUrl: member?.profiles?.avatar_url ?? null,
          platformLabel,
          evidenceCount: currentEvidence ? 1 : 0,
          evidenceLabel,
          currentEvidence,
          currentPerformance,
          reviewableEvidence,
          reviewablePerformance,
          queueState,
          reportImpactPresentation,
          submittedAt,
          statusPresentation,
        };
      });
    });
  }, [evidenceRows, members, performanceRows, reportTasks, submissions, t]);
  const reportingQueueFilterCounts = useMemo(() => {
    const needsReview = reportingQueueRows.filter((row) =>
      row.queueState === "review" || row.queueState === "correction_returned",
    ).length;
    const corrections = reportingQueueRows.filter(
      (row) => row.queueState === "correction",
    ).length;
    const missed = reportingQueueRows.filter(
      (row) => row.queueState === "missed",
    ).length;
    const ownerWork = currentUserOwnsReporting
      ? reportingQueueRows.filter((row) =>
          row.queueState === "review" ||
          row.queueState === "correction_returned" ||
          row.queueState === "correction" ||
          row.queueState === "missed",
        ).length
      : 0;

    return {
      all: reportingQueueRows.length,
      my_work: ownerWork,
      needs_review: needsReview,
      corrections,
      missed,
    };
  }, [currentUserOwnsReporting, reportingQueueRows]);
  const filteredReportingQueueRows = useMemo(() => {
    return reportingQueueRows.filter((row) => {
      if (reportingQueueFilter === "my_work") {
        return (
          currentUserOwnsReporting &&
          (row.queueState === "review" ||
            row.queueState === "correction_returned" ||
            row.queueState === "correction" ||
            row.queueState === "missed")
        );
      }
      if (reportingQueueFilter === "needs_review") {
        return row.queueState === "review" || row.queueState === "correction_returned";
      }
      if (reportingQueueFilter === "corrections") {
        return row.queueState === "correction";
      }
      if (reportingQueueFilter === "missed") {
        return row.queueState === "missed";
      }
      return true;
    });
  }, [currentUserOwnsReporting, reportingQueueFilter, reportingQueueRows]);
  const sortedFilteredReportingQueueRows = useMemo(() => {
    const direction = reportingQueueSort.direction === "asc" ? 1 : -1;

    return [...filteredReportingQueueRows].sort((a, b) => {
      let result = 0;

      switch (reportingQueueSort.key) {
        case "creator":
          result = compareNullableText(a.name, b.name, locale);
          break;
        case "platform":
          result = compareNullableText(a.platformLabel, b.platformLabel, locale);
          break;
        case "status":
          result = a.statusPresentation.rank - b.statusPresentation.rank;
          break;
        case "submitted":
          result =
            (a.submittedAt ? new Date(a.submittedAt).getTime() : 0) -
            (b.submittedAt ? new Date(b.submittedAt).getTime() : 0);
          break;
        case "evidence":
          result = compareNullableText(a.evidenceLabel, b.evidenceLabel, locale);
          break;
      }

      if (result === 0) {
        result = compareNullableText(a.name, b.name, locale);
      }

      return result * direction;
    });
  }, [
    filteredReportingQueueRows,
    locale,
    reportingQueueSort.direction,
    reportingQueueSort.key,
  ]);
  const campaignTabTriggerClass =
    "h-8 rounded-lg px-2.5 text-xs data-active:border-border data-active:bg-background data-active:shadow-sm focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200";

  const sortedMembers = useMemo(() => {
    const direction = memberSort.direction === "asc" ? 1 : -1;

    return [...members].sort((a, b) => {
      const aMarket = a.creator_profiles?.primary_market
        ? getMarketLabel(a.creator_profiles.primary_market, locale)
        : null;
      const bMarket = b.creator_profiles?.primary_market
        ? getMarketLabel(b.creator_profiles.primary_market, locale)
        : null;
      const aPlatform = getPrimaryPlatform(a.creator_profiles);
      const bPlatform = getPrimaryPlatform(b.creator_profiles);
      const aOperations = memberOperationsById.get(a.id);
      const bOperations = memberOperationsById.get(b.id);
      let result = 0;

      switch (memberSort.key) {
        case "creator":
          result = compareNullableText(a.profiles?.full_name ?? null, b.profiles?.full_name ?? null, locale);
          break;
        case "market":
          result = compareNullableText(aMarket, bMarket, locale);
          break;
        case "platform":
          result = compareNullableText(
            aPlatform ? PLATFORM_LABELS[aPlatform as Platform] || aPlatform : null,
            bPlatform ? PLATFORM_LABELS[bPlatform as Platform] || bPlatform : null,
            locale,
          );
          break;
        case "agreement": {
          const aStatus = agreementStatusByMemberId.get(a.id) ?? "not_required";
          const bStatus = agreementStatusByMemberId.get(b.id) ?? "not_required";
          result = agreementStatusRank[aStatus] - agreementStatusRank[bStatus];
          break;
        }
        case "report":
          result = (aOperations?.reportRank ?? 6) - (bOperations?.reportRank ?? 6);
          break;
        case "proof":
          result = (aOperations?.proofRank ?? 6) - (bOperations?.proofRank ?? 6);
          break;
        case "rate":
          result = (a.accepted_rate ?? Number.POSITIVE_INFINITY) - (b.accepted_rate ?? Number.POSITIVE_INFINITY);
          break;
        case "payment": {
          const aKey = paymentStatusKeys[a.payment_status] || "status.pending";
          const bKey = paymentStatusKeys[b.payment_status] || "status.pending";
          result = compareNullableText(tc(aKey), tc(bKey), locale);
          break;
        }
      }

      if (result === 0) {
        result = compareNullableText(a.profiles?.full_name ?? null, b.profiles?.full_name ?? null, locale);
      }

      return result * direction;
    });
  }, [
    agreementStatusByMemberId,
    locale,
    memberOperationsById,
    memberSort.direction,
    memberSort.key,
    members,
    tc,
  ]);
  const memberRosterFilterCounts = useMemo(
    () => ({
      all: sortedMembers.length,
      needs_attention: sortedMembers.filter((member) =>
        isMemberOperationsNeedsAttention(memberOperationsById.get(member.id)),
      ).length,
      missed_proof: sortedMembers.filter((member) =>
        isMemberOperationsMissedProof(memberOperationsById.get(member.id)),
      ).length,
      payment_open: sortedMembers.filter(isMemberPaymentOpen).length,
    }),
    [memberOperationsById, sortedMembers],
  );
  const memberReportReadiness = useMemo(() => {
    const ready = sortedMembers.filter((member) =>
      isMemberOperationsReportReady(memberOperationsById.get(member.id)),
    ).length;
    const review = sortedMembers.filter((member) =>
      isMemberOperationsReviewOpen(memberOperationsById.get(member.id)),
    ).length;
    const missed = sortedMembers.filter((member) =>
      isMemberOperationsMissedProof(memberOperationsById.get(member.id)),
    ).length;
    const paymentOpen = sortedMembers.filter(isMemberPaymentOpen).length;

    return [
      {
        key: "ready",
        label: t("members.reportReadiness.ready"),
        value: String(ready),
        detail: t("members.reportReadiness.readyDetail", {
          count: String(sortedMembers.length),
        }),
      },
      {
        key: "review",
        label: t("members.reportReadiness.review"),
        value: String(review),
        detail: t("members.reportReadiness.reviewDetail"),
      },
      {
        key: "missed",
        label: t("members.reportReadiness.missed"),
        value: String(missed),
        detail: t("members.reportReadiness.missedDetail"),
      },
      {
        key: "paymentOpen",
        label: t("members.reportReadiness.paymentOpen"),
        value: String(paymentOpen),
        detail: t("members.reportReadiness.paymentOpenDetail"),
      },
    ];
  }, [memberOperationsById, sortedMembers, t]);
  const memberRosterFilterOptions: QueueFilterOption<MemberRosterFilter>[] = [
    {
      value: "all",
      label: t("members.filter.all"),
      count: memberRosterFilterCounts.all,
      testId: "campaign-member-roster-filter-all",
    },
    {
      value: "needs_attention",
      label: t("members.filter.needsAttention"),
      count: memberRosterFilterCounts.needs_attention,
      testId: "campaign-member-roster-filter-needs_attention",
    },
    {
      value: "missed_proof",
      label: t("members.filter.missedProof"),
      count: memberRosterFilterCounts.missed_proof,
      testId: "campaign-member-roster-filter-missed_proof",
    },
    {
      value: "payment_open",
      label: t("members.filter.paymentOpen"),
      count: memberRosterFilterCounts.payment_open,
      testId: "campaign-member-roster-filter-payment_open",
    },
  ];
  const filteredMembers = useMemo(() => {
    const query = memberRosterQuery.trim().toLocaleLowerCase(locale);

    return sortedMembers.filter((member) => {
      const operations = memberOperationsById.get(member.id);
      const matchesFilter =
        memberRosterFilter === "all" ||
        (memberRosterFilter === "needs_attention" &&
          isMemberOperationsNeedsAttention(operations)) ||
        (memberRosterFilter === "missed_proof" &&
          isMemberOperationsMissedProof(operations)) ||
        (memberRosterFilter === "payment_open" && isMemberPaymentOpen(member));

      if (!matchesFilter) return false;
      if (!query) return true;

      const market = member.creator_profiles?.primary_market
        ? getMarketLabel(member.creator_profiles.primary_market, locale)
        : "";
      const platform = getPrimaryPlatform(member.creator_profiles);
      const platformLabel = platform
        ? PLATFORM_LABELS[platform as Platform] || platform
        : "";
      const paymentLabel = t(
        paymentStatusKeys[member.payment_status] || "members.paymentStatus.pending",
      );
      const searchableText = [
        member.profiles?.full_name,
        market,
        platformLabel,
        operations?.reportLabel,
        operations?.reportDetail,
        operations?.proofLabel,
        operations?.proofDetail,
        paymentLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase(locale);

      return searchableText.includes(query);
    });
  }, [
    locale,
    memberOperationsById,
    memberRosterFilter,
    memberRosterQuery,
    sortedMembers,
    t,
  ]);
  const applicationDeadline = campaign?.application_deadline ?? null;
  const applicationDeadlinePassed =
    applicationDeadline ? new Date(applicationDeadline).getTime() < Date.now() : false;
  const creatorInviteClosedReason = campaign
    ? getCampaignApplicationClosedReason(campaign)
    : null;
  const inviteLifecycleClosedReason = creatorInviteClosedReason;
  const creatorInviteClosedDetailKey = creatorInviteClosedReason
    ? brandInviteClosedDetailKeys[creatorInviteClosedReason]
    : "inviteImport.closedClean";
  const campaignAcceptsApplicationDecisions =
    campaign ? canCampaignAcceptApplicationDecision(campaign) : false;
  const campaignAcceptsContentReviewDecisions =
    campaign
      ? ["in_progress", "publishing", "monitoring"].includes(campaign.status)
      : false;
  const campaignAcceptsProofReviewDecisions =
    campaign
      ? ["in_progress", "publishing", "monitoring"].includes(campaign.status)
      : false;
  const selectedMemberSet = new Set(selectedMemberIds);
  const selectedMembers = members.filter((member) =>
    selectedMemberSet.has(member.id),
  );
  const selectedMemberCount = selectedMembers.length;
  const selectedMissedReportTaskIds = selectedMembers
    .map((member) => memberOperationsById.get(member.id))
    .filter(
      (
        operations,
      ): operations is MemberOperations & { reportTaskId: string } =>
        Boolean(
          operations?.reportTaskId &&
            operations.reportStatus === "missed" &&
            !operations.reportFollowUpSent,
        ),
    )
    .map((operations) => operations.reportTaskId);
  const allVisibleMembersSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((member) => selectedMemberSet.has(member.id));
  const memberBulkPaymentDisabled =
    !canManageCampaigns ||
    selectedMemberCount === 0 ||
    !memberBulkPaymentStatus ||
    actionLoading === "members-bulk-payment" ||
    actionLoading === "members-bulk-follow-up";
  const memberBulkFollowUpDisabled =
    !canReviewCampaignContent ||
    !campaignAcceptsProofReviewDecisions ||
    selectedMissedReportTaskIds.length === 0 ||
    actionLoading === "members-bulk-payment" ||
    actionLoading === "members-bulk-follow-up";

  const sortedPendingApps = useMemo(() => {
    const direction = applicantSort.direction === "asc" ? 1 : -1;

    return [...pendingApps].sort((a, b) => {
      const aMarket = a.creator_profiles?.primary_market
        ? getMarketLabel(a.creator_profiles.primary_market, locale)
        : null;
      const bMarket = b.creator_profiles?.primary_market
        ? getMarketLabel(b.creator_profiles.primary_market, locale)
        : null;
      const aFit = a.creator_profiles?.rating ?? 0;
      const bFit = b.creator_profiles?.rating ?? 0;
      let result = 0;

      switch (applicantSort.key) {
        case "creator":
          result = compareNullableText(a.profiles?.full_name ?? null, b.profiles?.full_name ?? null, locale);
          break;
        case "market":
          result = compareNullableText(aMarket, bMarket, locale);
          break;
        case "fit":
          result = aFit - bFit;
          break;
        case "rate":
          result = (a.proposed_rate ?? Number.POSITIVE_INFINITY) - (b.proposed_rate ?? Number.POSITIVE_INFINITY);
          break;
        case "applied":
          result =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      if (result === 0) {
        result = compareNullableText(a.profiles?.full_name ?? null, b.profiles?.full_name ?? null, locale);
      }

      return result * direction;
    });
  }, [applicantSort.direction, applicantSort.key, locale, pendingApps]);

  const contentQueueFilterCounts = useMemo(() => {
    const ownerWork = currentUserOwnsApprovals
      ? submissions.filter(isContentSubmissionOwnerWork).length
      : 0;

    return {
      all: submissions.length,
      my_work: ownerWork,
      needs_review: submissions.filter(isContentSubmissionNeedsReview).length,
      corrections: submissions.filter(isContentSubmissionCorrection).length,
    };
  }, [currentUserOwnsApprovals, submissions]);
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      if (contentQueueFilter === "my_work") {
        return currentUserOwnsApprovals && isContentSubmissionOwnerWork(submission);
      }
      if (contentQueueFilter === "needs_review") {
        return isContentSubmissionNeedsReview(submission);
      }
      if (contentQueueFilter === "corrections") {
        return isContentSubmissionCorrection(submission);
      }
      return true;
    });
  }, [contentQueueFilter, currentUserOwnsApprovals, submissions]);

  const sortedFilteredSubmissions = useMemo(() => {
    const direction = contentSort.direction === "asc" ? 1 : -1;

    return [...filteredSubmissions].sort((a, b) => {
      const aCreator = a.campaign_members?.profiles?.full_name ?? null;
      const bCreator = b.campaign_members?.profiles?.full_name ?? null;
      const aPlatform = a.platform
        ? PLATFORM_LABELS[a.platform as Platform] || a.platform
        : null;
      const bPlatform = b.platform
        ? PLATFORM_LABELS[b.platform as Platform] || b.platform
        : null;
      let result = 0;

      switch (contentSort.key) {
        case "creator":
          result = compareNullableText(aCreator, bCreator, locale);
          break;
        case "platform":
          result = compareNullableText(aPlatform, bPlatform, locale);
          break;
        case "status":
          result =
            (submissionStatusRank[a.status] ?? 99) -
            (submissionStatusRank[b.status] ?? 99);
          break;
        case "submitted":
          result =
            (a.submitted_at ? new Date(a.submitted_at).getTime() : 0) -
            (b.submitted_at ? new Date(b.submitted_at).getTime() : 0);
          break;
        case "version":
          result = a.version - b.version;
          break;
        case "proof":
          result =
            getSubmissionProofPresentation({ evidenceRows, submission: a, t }).rank -
            getSubmissionProofPresentation({ evidenceRows, submission: b, t }).rank;
          break;
      }

      if (result === 0) {
        result = compareNullableText(aCreator, bCreator, locale);
      }

      return result * direction;
    });
  }, [
    contentSort.direction,
    contentSort.key,
    evidenceRows,
    filteredSubmissions,
    locale,
    t,
  ]);

  const handleMemberSort = useCallback((key: MemberSortKey) => {
    setMemberSort((current) => {
      if (current.key !== key) return { key, direction: "asc" };
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }, []);

  const handleApplicantSort = useCallback((key: ApplicantSortKey) => {
    setApplicantSort((current) => {
      if (current.key !== key) {
        return { key, direction: key === "applied" || key === "fit" ? "desc" : "asc" };
      }
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  const handleContentSort = useCallback((key: ContentSortKey) => {
    setContentSort((current) => {
      if (current.key !== key) {
        return { key, direction: key === "submitted" ? "desc" : "asc" };
      }
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  const handleReportingQueueSort = useCallback((key: ReportingQueueSortKey) => {
    setReportingQueueSort((current) => {
      if (current.key !== key) {
        return { key, direction: key === "submitted" || key === "evidence" ? "desc" : "asc" };
      }
      return {
        key,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  const handleHandoffStageClick = useCallback((key: BrandCampaignHandoffStageKey) => {
    if (key === "content" || key === "liveUrl") {
      handleCampaignTabChange("content");
    }
  }, [handleCampaignTabChange]);

  const handleCompleteCampaign = useCallback(async () => {
    if (!canManageCampaigns) return;
    if (!campaign) return;

    setActionLoading("complete-campaign");
    try {
      await completeCampaign(campaign.id);
      await loadCampaignWorkspace();
      toast.success(t("completeCampaign.completedToast"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("completeCampaign.failedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }, [campaign, canManageCampaigns, loadCampaignWorkspace, t]);

  const handleStartCampaignWork = useCallback(async () => {
    if (!canManageCampaigns) return;
    if (!campaign) return;

    setActionLoading("start-work");
    try {
      await startCampaignWork(campaign.id);
      await loadCampaignWorkspace();
      toast.success(t("startWork.startedToast"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("startWork.failedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }, [campaign, canManageCampaigns, loadCampaignWorkspace, t]);

  const handleNextAction = useCallback((kind: CampaignNextActionKind) => {
    if (kind === "start_work") {
      void handleStartCampaignWork();
      return;
    }

    if (kind === "complete_campaign") {
      void handleCompleteCampaign();
      return;
    }

    if (kind === "pay_service_fee") {
      void handleServiceFeeCheckout();
      return;
    }

    if (kind === "review_applicants") {
      handleCampaignTabChange("creators");
      return;
    }

    if (kind === "review_content" || kind === "collect_live_urls") {
      handleCampaignTabChange("content");
      return;
    }

    if (
      kind === "review_proof" ||
      kind === "monitor_corrections" ||
      kind === "wait_for_reports"
    ) {
      handleCampaignTabChange("reporting");
      setScrollTargetTestId("campaign-reporting-proof-queue");
      return;
    }

    if (kind === "resolve_missed") {
      handleOperationCardClick("missed");
      return;
    }

    const targetTestId =
      kind === "publish_rules"
        ? "brand-agreement-panel"
        : kind === "add_creative"
          ? "brand-creative-kit-panel"
          : kind === "invite_creators"
            ? "campaign-invite-strip"
            : null;

    if (!targetTestId) return;

    if (kind === "publish_rules" || kind === "add_creative") {
      handleCampaignTabChange("brief");
    }

    if (kind === "invite_creators") {
      handleCampaignTabChange("overview");
    }

    setScrollTargetTestId(targetTestId);
  }, [
    handleCampaignTabChange,
    handleCompleteCampaign,
    handleOperationCardClick,
    handleServiceFeeCheckout,
    handleStartCampaignWork,
  ]);

  const handleInviteSetupFix = useCallback(() => {
    handleCampaignTabChange("brief");
    setScrollTargetTestId("campaign-launch-readiness");
  }, [handleCampaignTabChange]);

  useEffect(() => {
    if (campaignAcceptsApplicationDecisions || selectedApplicantIds.length === 0) {
      return;
    }

    setSelectedApplicantIds([]);
  }, [campaignAcceptsApplicationDecisions, selectedApplicantIds.length]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted/50" />
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="size-9 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-6 border-b border-border pb-3">
          {[80, 100, 72, 88].map((w, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: w }} />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="space-y-3">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <div className="space-y-3">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const dosItems = campaign.brief_dos?.split("\n").filter(Boolean) || [];
  const dontsItems = campaign.brief_donts?.split("\n").filter(Boolean) || [];
  const nextActionMeta = nextActionPresentation[nextAction.kind];
  const NextActionIcon = nextActionMeta.icon;
  const nextActionCountByKind: Partial<Record<CampaignNextActionKind, number>> = {
    review_proof: reportingOperationCounts.toReview,
    resolve_missed: reportingOperationCounts.missed,
    review_applicants: unresolvedApplicationCount,
    review_content: Math.max(totalContent - approvedContent, 0),
    collect_live_urls: missingLiveUrls,
    monitor_corrections: reportingOperationCounts.corrections,
    wait_for_reports: pendingReportReads,
  };
  const nextActionCount = nextActionCountByKind[nextAction.kind];
  const nextActionDetailKey =
    nextActionCount === 1 && nextActionMeta.detailSingularKey
      ? nextActionMeta.detailSingularKey
      : nextActionMeta.detailKey;
  const canUseNextAction =
    nextAction.kind === "pay_service_fee"
      ? canManageBilling
      : nextAction.kind === "complete_campaign" ||
          nextAction.kind === "publish_rules" ||
          nextAction.kind === "add_creative" ||
          nextAction.kind === "invite_creators" ||
          nextAction.kind === "start_work" ||
          nextAction.kind === "review_applicants"
        ? canManageCampaigns
        : nextAction.kind === "review_proof" ||
            nextAction.kind === "resolve_missed" ||
            nextAction.kind === "review_content" ||
            nextAction.kind === "collect_live_urls" ||
            nextAction.kind === "monitor_corrections" ||
            nextAction.kind === "wait_for_reports"
          ? canReviewCampaignContent
          : false;
  const nextActionToneClassName =
    nextAction.tone === "urgent"
      ? "border-red-200 bg-red-50 text-red-700"
      : nextAction.tone === "attention"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : nextAction.tone === "setup"
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-slate-200 bg-white text-slate-700";
  const reportsCleared = reportTasks.filter(
    (task) => task.status === "verified" || task.status === "excused",
  ).length;
  const contentQueueFilterOptions: QueueFilterOption<ContentQueueFilter>[] = [
    {
      value: "all",
      label: t("queueFilter.all"),
      count: contentQueueFilterCounts.all,
      testId: "campaign-content-queue-filter-all",
    },
    {
      value: "my_work",
      label: t("queueFilter.myWork"),
      count: contentQueueFilterCounts.my_work,
      testId: "campaign-content-queue-filter-my_work",
    },
    {
      value: "needs_review",
      label: t("queueFilter.needsReview"),
      count: contentQueueFilterCounts.needs_review,
      testId: "campaign-content-queue-filter-needs_review",
    },
    {
      value: "corrections",
      label: t("queueFilter.corrections"),
      count: contentQueueFilterCounts.corrections,
      testId: "campaign-content-queue-filter-corrections",
    },
  ];
  const reportingQueueFilterOptions: QueueFilterOption<ReportingQueueFilter>[] = [
    {
      value: "all",
      label: t("queueFilter.all"),
      count: reportingQueueFilterCounts.all,
      testId: "campaign-reporting-proof-filter-all",
    },
    {
      value: "my_work",
      label: t("queueFilter.myWork"),
      count: reportingQueueFilterCounts.my_work,
      testId: "campaign-reporting-proof-filter-my_work",
    },
    {
      value: "needs_review",
      label: t("queueFilter.needsReview"),
      count: reportingQueueFilterCounts.needs_review,
      testId: "campaign-reporting-proof-filter-needs_review",
    },
    {
      value: "corrections",
      label: t("queueFilter.corrections"),
      count: reportingQueueFilterCounts.corrections,
      testId: "campaign-reporting-proof-filter-corrections",
    },
    {
      value: "missed",
      label: t("queueFilter.missed"),
      count: reportingQueueFilterCounts.missed,
      testId: "campaign-reporting-proof-filter-missed",
    },
  ];
  const isDraftCampaign = campaign.status === "draft";
  const overviewIsPaymentBlocked = serviceFeeRequired && !serviceFeeIsPaid;
  const serviceFeeBlocksLaunch = isDraftCampaign && !serviceFeeIsPaid;
  const serviceFeeNeedsRecovery =
    serviceFeeRequired &&
    !serviceFeeIsPaid &&
    (campaign.service_fee_status === "failed" ||
      campaign.service_fee_status === "refunded" ||
      campaign.service_fee_status === "disputed" ||
      campaign.service_fee_status === "overdue");
  const checkoutWasCancelled =
    checkoutState === "cancelled" && serviceFeeRequired && !serviceFeeIsPaid;
  const creatorInvitesAreManageable =
    canManageCampaigns &&
    (campaign.status === "draft" || campaign.status === "recruiting") &&
    !(campaign.status === "recruiting" && applicationDeadlinePassed);
  const creatorInvitesAreSendable =
    creatorInvitesAreManageable &&
    campaign.status === "recruiting" &&
    !applicationDeadlinePassed;
  const canLaunchCampaign =
    canManageCampaigns &&
    isDraftCampaign &&
    launchReadinessBlockers === 0 &&
    serviceFeeIsPaid;
  const canShareInviteLink =
    canManageCampaigns &&
    creatorInvitesAreSendable &&
    launchReadinessBlockers === 0 &&
    serviceFeeIsPaid &&
    !isDraftCampaign;
  const canSharePublicApplyLink =
    canShareInviteLink &&
    campaign.recruitment_visibility === "open_applications";
  const shouldShowInviteStrip =
    canShareInviteLink ||
    nextAction.kind === "invite_creators" ||
    overviewIsPaymentBlocked ||
    Boolean(inviteLifecycleClosedReason);
  const inviteBlockedMessageKey =
    inviteLifecycleClosedReason
      ? inviteLifecycleClosedMessageKeys[inviteLifecycleClosedReason]
      : canShareInviteLink && campaign.recruitment_visibility !== "open_applications"
        ? "invite.privateOnly"
      : !serviceFeeIsPaid
        ? "invite.payFirst"
        : isDraftCampaign
          ? "invite.launchFirst"
          : "invite.locked";
  const inviteBlockedActionKey =
    inviteLifecycleClosedReason
      ? "invite.closedAction"
      : canShareInviteLink && campaign.recruitment_visibility !== "open_applications"
        ? "invite.privateOnlyCta"
      : !serviceFeeIsPaid
        ? "invite.payFirstCta"
        : isDraftCampaign
          ? "invite.launchFirstCta"
          : "invite.fixSetup";
  const overviewTabBadge =
    campaign.status === "completed"
      ? tc("status.completed")
      : campaign.status === "cancelled"
        ? tc("status.cancelled")
        : campaign.status === "paused"
          ? tc("status.paused")
          : overviewIsPaymentBlocked
            ? t("launchReadiness.paymentRequired")
            : launchReadinessBlockers === 0
              ? t("launchReadiness.ready")
              : String(launchReadinessBlockers);
  const canEditCampaignOperations =
    canManageCampaigns &&
    campaign.status !== "completed" &&
    campaign.status !== "cancelled";
  const canManageApplicationDeadline =
    canEditCampaignOperations &&
    (campaign.status === "draft" || campaign.status === "recruiting") &&
    !(campaign.status === "recruiting" && applicationDeadlinePassed);
  const canSendCampaignAnnouncement =
    canManageCampaigns &&
    ["recruiting", "in_progress", "publishing", "monitoring"].includes(campaign.status);
  const shouldShowCampaignControls =
    canSendCampaignAnnouncement || canManageApplicationDeadline;
  const canEditPreWorkSetup =
    canManageCampaigns &&
    (campaign.status === "draft" || campaign.status === "recruiting") &&
    !(campaign.status === "recruiting" && applicationDeadlinePassed);
  const canEditReportingRequirements = canEditPreWorkSetup;
  const canStartCampaignWork =
    canManageCampaigns &&
    campaign.status === "recruiting" &&
    members.length > 0 &&
    unresolvedApplicationCount === 0;
  const servicePackageSnapshot = campaign.service_package_snapshot ?? null;
  const requiresCustomServiceQuote =
    campaign.campaign_mode === "sourced" ||
    servicePackageSnapshot?.requiresCustomPricing === true;
  const serviceFeeDisplay = requiresCustomServiceQuote
    ? t("serviceFee.customQuote")
    : formatCurrency(
        (campaign.service_fee_cents ?? 0) / 100,
        locale,
        (campaign.service_fee_currency ?? "usd").toUpperCase(),
      );
  const serviceFeeBalanceDueCents = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "balanceDueCents",
    campaign.service_fee_status === "paid" ? 0 : (campaign.service_fee_cents ?? 0),
  );
  const serviceFeePaymentDueDisplay = requiresCustomServiceQuote
    ? t("serviceFee.customQuote")
    : formatCurrency(
        serviceFeeBalanceDueCents / 100,
        locale,
        (campaign.service_fee_currency ?? "usd").toUpperCase(),
      );
  const serviceFeeStatusDate =
    campaign.service_fee_status === "paid"
      ? campaign.service_fee_paid_at
      : campaign.service_fee_status === "failed"
        ? campaign.service_fee_failed_at
        : campaign.service_fee_status === "refunded"
          ? campaign.service_fee_refunded_at
          : campaign.service_fee_status === "disputed"
            ? campaign.service_fee_disputed_at
            : campaign.service_fee_last_event_at;
  const serviceFeeStatusDetailKey =
    campaign.service_fee_status === "paid"
      ? "serviceFee.detail.paid"
      : campaign.service_fee_status === "failed"
        ? "serviceFee.detail.failed"
        : campaign.service_fee_status === "refunded"
          ? "serviceFee.detail.refunded"
          : campaign.service_fee_status === "disputed"
            ? "serviceFee.detail.disputed"
            : campaign.service_fee_status === "invoiced"
              ? "serviceFee.detail.invoiced"
              : "serviceFee.detail.pending";
  const serviceFeeReferenceRows = [
    {
      key: "paymentIntent",
      labelKey: "serviceFee.reference.paymentIntent",
      value: campaign.service_fee_payment_intent_id,
    },
    {
      key: "checkoutSession",
      labelKey: "serviceFee.reference.checkoutSession",
      value: campaign.service_fee_checkout_session_id,
    },
    {
      key: "lastEvent",
      labelKey: "serviceFee.reference.lastEvent",
      value: campaign.service_fee_last_event_id,
    },
  ].filter((row) => row.value);
  const includedCreatorCount = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "includedCreatorCount",
    10,
  );
  const includedActiveDays = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "includedActiveDays",
    45,
  );
  const includedReportingDays = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "includedReportingDays",
    14,
  );
  const estimatedActiveDays = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "estimatedActiveDays",
    includedActiveDays,
  );
  const estimatedReportingDays = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "estimatedReportingDays",
    includedReportingDays,
  );
  const requestedCreatorCapacity = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "estimatedMaxCreators",
    campaign.max_creators ?? includedCreatorCount,
  );
  const paidCreatorCapacity =
    serviceFeeBalanceDueCents === 0 || campaign.service_fee_status === "paid"
      ? requestedCreatorCapacity
      : Math.min(
          requestedCreatorCapacity,
          getServicePackageSnapshotNumber(
            servicePackageSnapshot,
            "paidCreatorCapacity",
            0,
          ),
        );
  const creatorCapacityOpenSeats = Math.max(paidCreatorCapacity - members.length, 0);
  const selectedApplicantSet = new Set(selectedApplicantIds);
  const selectedPendingApps = pendingApps.filter((app) =>
    selectedApplicantSet.has(app.id),
  );
  const selectedApplicantCount = selectedPendingApps.length;
  const selectedApplicantsOverCapacity =
    selectedApplicantCount > creatorCapacityOpenSeats;
  const allVisibleApplicantsSelected =
    sortedPendingApps.length > 0 &&
    sortedPendingApps.every((app) => selectedApplicantSet.has(app.id));
  const applicantBulkAcceptDisabled =
    !canManageCampaigns ||
    !campaignAcceptsApplicationDecisions ||
    selectedApplicantCount === 0 ||
    selectedApplicantsOverCapacity ||
    actionLoading === "applicants-bulk-accept" ||
    actionLoading === "applicants-bulk-reject";
  const applicantBulkRejectDisabled =
    !canManageCampaigns ||
    !campaignAcceptsApplicationDecisions ||
    selectedApplicantCount === 0 ||
    actionLoading === "applicants-bulk-accept" ||
    actionLoading === "applicants-bulk-reject";
  const creatorCapacityUsedPercent =
    paidCreatorCapacity > 0
      ? Math.min(100, Math.round((members.length / paidCreatorCapacity) * 100))
      : 0;
  const creatorNeedsAttention = Array.from(memberOperationsById.values()).filter(
    isMemberOperationsNeedsAttention,
  ).length;
  const creatorPaymentOpenCount = memberRosterFilterCounts.payment_open;
  const creatorOperations = [
    {
      key: "accepted",
      label: t("creatorOps.accepted"),
      value: `${members.length} / ${paidCreatorCapacity}`,
      detail: t("creatorOps.capacityDetail", {
        count: String(paidCreatorCapacity),
      }),
    },
    {
      key: "openSeats",
      label: t("creatorOps.openSeats"),
      value: String(creatorCapacityOpenSeats),
      detail: t("creatorOps.openSeatsDetail"),
    },
    {
      key: "pendingReview",
      label: t("creatorOps.pendingReview"),
      value: String(pendingApps.length),
      detail: t("creatorOps.pendingReviewDetail"),
    },
    {
      key: "needsAttention",
      label: t("creatorOps.needsAttention"),
      value: String(creatorNeedsAttention),
      detail: t("creatorOps.needsAttentionDetail"),
    },
  ];
  const creatorInviteImportPreview = parseCreatorInviteImport({
    acceptedCount: members.length,
    capacity: paidCreatorCapacity,
    existingContacts: creatorInvites.map((invite) => invite.normalized_contact),
    reservedContacts: creatorInvites
      .filter((invite) => invite.status !== "sent")
      .map((invite) => invite.normalized_contact),
    rawText: inviteImportText,
  });
  const selectedCreatorCapacity =
    capacityDraft?.campaignId === campaign.id
      ? capacityDraft.value
      : requestedCreatorCapacity;
  const selectedActiveDays =
    capacityDraft?.campaignId === campaign.id
      ? capacityDraft.activeDays
      : estimatedActiveDays;
  const selectedReportingDays =
    capacityDraft?.campaignId === campaign.id
      ? capacityDraft.reportingDays
      : estimatedReportingDays;
  const currentPaidServiceFeeCents = getServicePackageSnapshotNumber(
    servicePackageSnapshot,
    "paidCents",
    campaign.service_fee_status === "paid"
      ? (campaign.service_fee_cents ?? 0)
      : Math.max(0, (campaign.service_fee_cents ?? 0) - serviceFeeBalanceDueCents),
  );
  const selectedCreatorCapacityEstimate = getCampaignServiceEstimate("private", {
    activeDays: selectedActiveDays,
    maxCreators: selectedCreatorCapacity,
    reportingDays: selectedReportingDays,
  });
  const selectedCreatorCapacityBalanceCents = Math.max(
    0,
    selectedCreatorCapacityEstimate.feeCents - currentPaidServiceFeeCents,
  );
  const selectedCreatorCapacityTotalDisplay = formatCurrency(
    selectedCreatorCapacityEstimate.feeCents / 100,
    locale,
    selectedCreatorCapacityEstimate.currency.toUpperCase(),
  );
  const selectedCreatorCapacityPaidDisplay = formatCurrency(
    currentPaidServiceFeeCents / 100,
    locale,
    (campaign.service_fee_currency ?? selectedCreatorCapacityEstimate.currency).toUpperCase(),
  );
  const selectedCreatorCapacityBalanceDisplay = formatCurrency(
    selectedCreatorCapacityBalanceCents / 100,
    locale,
    selectedCreatorCapacityEstimate.currency.toUpperCase(),
  );
  const creatorCapacityOptions = creatorCapacityPresets.map((count) => {
    const estimate = getCampaignServiceEstimate("private", {
      activeDays: selectedActiveDays,
      maxCreators: count,
      reportingDays: selectedReportingDays,
    });

    return {
      count,
      totalDisplay: formatCurrency(
        estimate.feeCents / 100,
        locale,
        estimate.currency.toUpperCase(),
      ),
    };
  });
  const activeDayScopeOptions = Array.from(
    new Set([
      includedActiveDays,
      estimatedActiveDays,
      selectedActiveDays,
      45,
      75,
      105,
      135,
    ]),
  )
    .filter((option) => option > 0)
    .sort((a, b) => a - b);
  const reportingDayScopeOptions = Array.from(
    new Set([
      includedReportingDays,
      estimatedReportingDays,
      selectedReportingDays,
      14,
      44,
      74,
      104,
    ]),
  )
    .filter((option) => option >= 0)
    .sort((a, b) => a - b);
  const inviteImportOverCapacityCount =
    creatorInviteImportPreview.summary.overCapacityCount;
  const inviteImportRequestedCapacity =
    members.length +
    creatorInviteImportPreview.summary.readyCount +
    inviteImportOverCapacityCount;
  const highestCreatorCapacityOption =
    creatorCapacityOptions[creatorCapacityOptions.length - 1]?.count ??
    requestedCreatorCapacity;
  const inviteImportSuggestedCapacity =
    creatorCapacityOptions.find(
      (option) => option.count >= inviteImportRequestedCapacity,
    )?.count ?? highestCreatorCapacityOption;
  const inviteListStatusCounts = creatorInvites.reduce(
    (counts, invite) => ({
      ...counts,
      [invite.status]: counts[invite.status] + 1,
    }),
    {
      all: creatorInvites.length,
      failed: 0,
      manual: 0,
      queued: 0,
      sent: 0,
    } satisfies Record<CreatorInviteStatusFilter, number>,
  );
  const creatorScaleReadinessState =
    creatorNeedsAttention > 0 || creatorPaymentOpenCount > 0
      ? "blocked"
      : pendingApps.length > 0 || inviteImportOverCapacityCount > 0
        ? "review"
        : "ready";
  const creatorScaleBlockedCopy =
    creatorPaymentOpenCount > 0 && creatorNeedsAttention > 0
      ? {
          label: t("creatorScale.blockedPaymentsAndProof"),
          detail: t("creatorScale.blockedPaymentsAndProofDetail"),
        }
      : creatorPaymentOpenCount > 0
        ? {
            label: t("creatorScale.blockedPayments"),
            detail: t("creatorScale.blockedPaymentsDetail"),
          }
        : creatorNeedsAttention > 0
          ? {
              label: t("creatorScale.blockedProof"),
              detail: t("creatorScale.blockedProofDetail"),
            }
          : {
              label: t("creatorScale.blocked"),
              detail: t("creatorScale.blockedDetail"),
            };
  const creatorScaleReadinessCopy = {
    ready: {
      label: t("creatorScale.ready"),
      detail: t("creatorScale.readyDetail"),
    },
    review: {
      label: t("creatorScale.review"),
      detail: t("creatorScale.reviewDetail"),
    },
    blocked: creatorScaleBlockedCopy,
  };
  const creatorScaleReadiness = {
    state: creatorScaleReadinessState,
    ...creatorScaleReadinessCopy[creatorScaleReadinessState],
  };
  const creatorScaleReadinessItems = [
    {
      key: "capacity",
      label: t("creatorScale.capacity"),
      value: `${members.length} / ${paidCreatorCapacity}`,
      detail: t("creatorScale.capacityDetail", {
        count: String(creatorCapacityOpenSeats),
      }),
    },
    {
      key: "invitePipeline",
      label: t("creatorScale.invitePipeline"),
      value: String(creatorInvites.length),
      detail: t("creatorScale.invitePipelineDetail", {
        manual: String(inviteListStatusCounts.manual),
        queued: String(inviteListStatusCounts.queued),
      }),
    },
    {
      key: "paymentExposure",
      label: t("creatorScale.paymentExposure"),
      value: String(creatorPaymentOpenCount),
      detail: t("creatorScale.paymentExposureDetail"),
    },
    {
      key: "proofPressure",
      label: t("creatorScale.proofPressure"),
      value: String(creatorNeedsAttention),
      detail: t("creatorScale.proofPressureDetail"),
    },
  ];
  const normalizedInviteListQuery = inviteListQuery.trim().toLowerCase();
  const filteredCreatorInvites = creatorInvites.filter((invite) => {
    const matchesStatus =
      inviteListStatusFilter === "all" ||
      invite.status === inviteListStatusFilter;
    const matchesQuery =
      normalizedInviteListQuery.length === 0 ||
      invite.contact_value.toLowerCase().includes(normalizedInviteListQuery) ||
      invite.normalized_contact.toLowerCase().includes(normalizedInviteListQuery);

    return matchesStatus && matchesQuery;
  });
  const campaignAllowsPaidScopeUpdate =
    (campaign.status === "draft" || campaign.status === "recruiting") &&
    !(campaign.status === "recruiting" && applicationDeadlinePassed);
  const canUpdateCreatorCapacity =
    canManageBilling &&
    campaignAllowsPaidScopeUpdate &&
    campaign.campaign_mode === "private" &&
    !requiresCustomServiceQuote &&
    campaign.status !== "completed" &&
    campaign.status !== "cancelled";
  const selectedCapacityIsBelowAcceptedCreators =
    selectedCreatorCapacity < members.length;
  const scopeChanged =
    selectedCreatorCapacity !== requestedCreatorCapacity ||
    selectedActiveDays !== estimatedActiveDays ||
    selectedReportingDays !== estimatedReportingDays;

  async function handleCreatorCapacityUpdate() {
    if (!campaign) return;
    if (!canUpdateCreatorCapacity) return;
    if (!scopeChanged) return;
    if (selectedCapacityIsBelowAcceptedCreators) return;

    setActionLoading("creator-capacity");
    try {
      const result = await updateCampaignCreatorCapacity({
        activeDays: selectedActiveDays,
        campaignId: campaign.id,
        maxCreators: selectedCreatorCapacity,
        reportingDays: selectedReportingDays,
      });
      setCapacityDraft(null);
      await loadCampaignWorkspace();
      toast.success(
        result.balance_due_cents > 0
          ? t("serviceFee.capacityBalanceToast")
          : t("serviceFee.capacitySavedToast"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("serviceFee.capacityFailedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  function handleInviteCapacityReview() {
    if (!campaign) return;

    setCapacityDraft({
      activeDays: estimatedActiveDays,
      campaignId: campaign.id,
      reportingDays: estimatedReportingDays,
      value: inviteImportSuggestedCapacity,
    });
    handleCampaignTabChange("brief");
    setScrollTargetTestId("campaign-capacity-upgrade-control");
  }

  async function handleCreatorInviteImport() {
    if (!campaign || !canManageCampaigns) return;
    if (creatorInviteImportPreview.summary.readyCount === 0) return;

    setActionLoading("creator-invite-import");
    try {
      const result = await importCampaignCreatorInvites({
        campaignId: campaign.id,
        rawContacts: inviteImportText,
      });
      setInviteImportText("");
      await loadCampaignWorkspace();
      toast.success(
        t("inviteImport.savedToast", {
          count: String(result.importedCount),
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("inviteImport.failedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendSavedCreatorInvite(invite: CampaignCreatorInviteRow) {
    if (!campaign || !canManageCampaigns) return;
    if (invite.contact_type !== "email") return;

    const loadingKey = `creator-invite-send:${invite.id}`;
    setActionLoading(loadingKey);
    try {
      await sendCampaignCreatorInvite({
        campaignId: campaign.id,
        inviteId: invite.id,
      });
      await loadCampaignWorkspace();
      toast.success(t("inviteImport.sendToast"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("inviteImport.sendFailedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveSavedCreatorInvite(invite: CampaignCreatorInviteRow) {
    if (!campaign || !canManageCampaigns) return;

    const loadingKey = `creator-invite-remove:${invite.id}`;
    setActionLoading(loadingKey);
    try {
      await removeCampaignCreatorInvite({
        campaignId: campaign.id,
        inviteId: invite.id,
      });
      await loadCampaignWorkspace();
      toast.success(t("inviteImport.removeToast"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("inviteImport.removeFailedToast"),
      );
    } finally {
      setActionLoading(null);
    }
  }

  const healthItems = [
    {
      label: tc("metric.creatorBudget"),
      value: `${formatCompactCurrency(spent, locale)} / ${formatCompactCurrency(budget, locale)}`,
      detail: tc("metric.spent"),
      testId: "campaign-health-creator-budget",
    },
    {
      label: tc("metric.creators"),
      value: String(members.length),
      detail: tc("metric.accepted"),
      testId: "campaign-health-creators",
    },
    {
      label: tc("metric.content"),
      value: `${approvedContent}/${totalContent}`,
      detail: tc("metric.approved"),
      testId: "campaign-health-content",
    },
    {
      label: tc("metric.reports"),
      value: `${reportsCleared}/${reportTasks.length}`,
      detail: tc("metric.cleared"),
      testId: "campaign-health-reports",
    },
  ];
  const headerMetaItems: HeaderMetaItem[] = [];

  if (campaign.platforms?.length > 0) {
    headerMetaItems.push({
      key: "platforms",
      content: (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
          {campaign.platforms.map((p) => (
            <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {PLATFORM_LABELS[p as Platform] || p}
            </span>
          ))}
        </span>
      ),
    });
  }

  if (campaign.markets?.length > 0) {
    headerMetaItems.push({
      key: "markets",
      content: (
        <span className="truncate">
          {campaign.markets.map((m) => getMarketLabel(m, locale)).join(", ")}
        </span>
      ),
    });
  }

  if (campaign.posting_window_start || campaign.posting_window_end) {
    headerMetaItems.push({
      key: "dates",
      content: (
        <span className="whitespace-nowrap">
          {formatDate(campaign.posting_window_start, locale)} -{" "}
          {formatDate(campaign.posting_window_end, locale)}
        </span>
      ),
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/b/campaigns"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {t("back")}
        </Link>
        <div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{campaign.title}</h1>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  CAMPAIGN_STATUS_COLORS[campaign.status as CampaignStatus] || "bg-muted text-foreground"
                }`}
              >
                {tc(`status.${campaign.status === "in_progress" ? "inProgress" : campaign.status}`)}
              </span>
            </div>
            <div
              data-testid="campaign-header-meta"
              className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
            >
              {headerMetaItems.map((item, index) => (
                <span
                  key={item.key}
                  data-testid="campaign-header-meta-item"
                  className={`inline-flex min-w-0 items-center ${
                    index === 0 ? "" : "border-s border-border ps-2"
                  }`}
                >
                  {item.content}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section
        data-testid="campaign-command-center"
        className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      >
        <div className="grid lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
          <div
            data-testid="campaign-next-action"
            className="border-b border-border p-4 lg:border-b-0 lg:border-e"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${nextActionToneClassName}`}
              >
                <NextActionIcon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("cockpit.nextAction")}
                </p>
                <h2 className="mt-1 text-base font-semibold text-foreground">
                  {t(nextActionMeta.labelKey)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    nextActionDetailKey,
                    nextActionCount === undefined
                      ? undefined
                      : { count: String(nextActionCount) },
                  )}
                </p>
              </div>
            </div>
            {nextAction.kind === "no_blockers" || !canUseNextAction ? null : (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    (nextAction.kind === "complete_campaign" &&
                      actionLoading === "complete-campaign") ||
                    (nextAction.kind === "pay_service_fee" &&
                      actionLoading === "service-fee-checkout") ||
                    (nextAction.kind === "start_work" &&
                      actionLoading === "start-work")
                  }
                  onClick={() => handleNextAction(nextAction.kind)}
                >
                  {nextAction.kind === "complete_campaign" &&
                  actionLoading === "complete-campaign"
                    ? t("completeCampaign.completing")
                    : nextAction.kind === "pay_service_fee" &&
                        actionLoading === "service-fee-checkout"
                      ? t("serviceFee.checkoutOpening")
                      : nextAction.kind === "start_work" &&
                          actionLoading === "start-work"
                        ? t("startWork.starting")
                      : t(nextActionMeta.ctaKey)}
                </Button>
              </div>
            )}
          </div>
          <div
            data-testid="campaign-health-strip"
            className="grid grid-cols-2 divide-x divide-y divide-border/70 sm:grid-cols-4 sm:divide-y-0"
          >
            {healthItems.map((item) => (
              <div
                key={item.label}
                data-testid={item.testId}
                className="grid min-h-[92px] grid-rows-[auto_1fr] p-4"
              >
                <span
                  data-testid="campaign-health-label"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {item.label}
                </span>
                <span
                  data-testid="campaign-health-value-group"
                  className="self-end"
                >
                  <span
                    data-testid="campaign-health-value"
                    className="block whitespace-nowrap text-xl font-semibold tabular-nums text-foreground"
                  >
                    {item.value}
                  </span>
                  {item.detail ? (
                    <span
                      data-testid="campaign-health-detail"
                      className="mt-0.5 block truncate text-xs text-muted-foreground"
                    >
                      {item.detail}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
        {shouldShowInviteStrip && (
          <div className="border-t border-border/70 p-3">
            <InviteLinkCard
              campaignId={campaign.id}
              canManage={canManageCampaigns}
              canShare={canSharePublicApplyLink}
              blockedMessageKey={inviteBlockedMessageKey}
              blockedActionKey={inviteBlockedActionKey}
              onFixSetup={handleInviteSetupFix}
              t={t}
            />
          </div>
        )}
      </section>

      {checkoutWasCancelled && (
        <div
          data-testid="campaign-service-fee-cancelled"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <p className="text-sm font-semibold text-foreground">
            {t("serviceFee.cancelled.title")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("serviceFee.cancelled.detail")}
          </p>
        </div>
      )}

      {serviceFeeNeedsRecovery && (
        <div
          data-testid="campaign-service-fee-recovery"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("serviceFee.recovery.title")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("serviceFee.recovery.detail")}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="campaign-service-fee-action"
            className="h-8 shrink-0 px-2.5 text-xs"
            disabled={!canManageBilling || actionLoading === "service-fee-checkout"}
            onClick={handleServiceFeeCheckout}
          >
            {actionLoading === "service-fee-checkout"
              ? t("serviceFee.checkoutOpening")
              : t("serviceFee.recovery.action")}
          </Button>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={handleCampaignTabChange}
        data-testid="campaign-detail-tabs"
      >
        <TabsList
          data-testid="campaign-detail-tab-rail"
          className="sticky top-14 z-20 mb-5 w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/80 bg-card/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:top-0"
        >
          <TabsTrigger value="overview" className={campaignTabTriggerClass}>
            {t("tab.overview")}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {overviewTabBadge}
            </span>
          </TabsTrigger>
          <TabsTrigger value="brief" className={campaignTabTriggerClass}>
            {t("tab.brief")}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {setupTabBadge}
            </span>
          </TabsTrigger>
          <TabsTrigger value="creators" className={campaignTabTriggerClass}>
            {t("tab.creators")}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {pendingApps.length + members.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="content" className={campaignTabTriggerClass}>
            {t("tab.content")}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {approvedContent}/{totalContent}
            </span>
          </TabsTrigger>
          <TabsTrigger value="reporting" className={campaignTabTriggerClass}>
            {t("tab.reporting")}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {reportingOperationCounts.settled}/{reportTasks.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-5">
          <div
            data-testid="campaign-overview-snapshot"
            className="space-y-5"
          >
            <div
              data-testid="campaign-overview-panels"
              className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]"
            >
              <Card data-testid="campaign-overview-timeline">
                <CardHeader>
                  <CardTitle>{t("section.timeline")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      {
                        label: t("label.start"),
                        value: formatShortDate(campaign.posting_window_start, locale),
                      },
                      {
                        label: t("label.applicationDeadline"),
                        value: formatShortDate(campaign.application_deadline, locale),
                      },
                      {
                        label: t("label.contentDeadline"),
                        value: formatShortDate(campaign.content_due_date, locale),
                        valueClassName: "text-amber-600",
                      },
                      {
                        label: t("label.end"),
                        value: formatShortDate(campaign.posting_window_end, locale),
                      },
                      {
                        label: t("label.maxRevisions"),
                        value: String(campaign.max_revisions ?? 2),
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        data-testid="campaign-overview-timeline-item"
                        className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                      >
                        <p className="truncate text-xs text-muted-foreground">
                          {item.label}
                        </p>
                        <p
                          className={`mt-1 truncate text-sm font-semibold tabular-nums ${
                            item.valueClassName ?? "text-foreground"
                          }`}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="campaign-overview-readiness">
                <CardHeader>
                  <CardTitle>{t("launchReadiness.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                        overviewIsPaymentBlocked
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : launchReadinessBlockers === 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-900"
                      }`}
                    >
                      {launchReadinessBlockers === 0 && !overviewIsPaymentBlocked ? (
                        <CheckCircle className="size-4" aria-hidden="true" />
                      ) : (
                        <FileWarning className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {overviewIsPaymentBlocked
                          ? t("launchReadiness.paymentRequiredSummary")
                          : launchReadinessBlockers === 0
                          ? t("launchReadiness.readySummary")
                          : t("launchReadiness.needsWork", {
                              count: String(launchReadinessBlockers),
                            })}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {overviewIsPaymentBlocked
                          ? t("launchReadiness.paymentRequiredDetail")
                          : launchReadinessBlockers === 0
                          ? t("launchReadiness.readyDetail")
                          : launchReadinessItems
                              .filter((item) => !item.ready)
                              .slice(0, 3)
                              .map((item) => item.label)
                              .join(", ")}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="campaign-overview-readiness-action"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => handleCampaignTabChange("brief")}
                  >
                    {launchReadinessBlockers === 0
                      ? t("tab.brief")
                      : t("launchReadiness.fixBlockers")}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="campaign-responsibility-panel">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle>{t("responsibility.title")}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("responsibility.detail")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("responsibility.accessNote")}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-4">
                  {campaignResponsibilitySlots.map((slot) => {
                    const assignment = responsibilityAssignmentsByKind.get(slot.kind);
                    const assignedMember = assignment
                      ? teamMembersById.get(assignment.brand_team_member_id)
                      : undefined;
                    const assignedName =
                      assignedMember?.name ?? t("responsibility.unassigned");
                    const loadingKey = `campaign-responsibility:${slot.kind}`;

                    return (
                      <div
                        key={slot.kind}
                        data-testid={`campaign-responsibility-slot-${slot.kind}`}
                        className="rounded-lg border border-border/70 bg-muted/20 p-3"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {t(slot.labelKey)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {t(slot.detailKey)}
                            </p>
                          </div>
                        </div>

                        {canManageCampaigns ? (
                          <select
                            data-testid={`campaign-responsibility-select-${slot.kind}`}
                            aria-label={t(slot.labelKey)}
                            value={assignment?.brand_team_member_id ?? "unassigned"}
                            disabled={actionLoading === loadingKey}
                            onChange={(event) =>
                              handleCampaignResponsibilityChange(
                                slot.kind,
                                event.target.value,
                              )
                            }
                            className="mt-3 h-9 w-full rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="unassigned">
                              {t("responsibility.unassigned")}
                            </option>
                            {assignableTeamMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="mt-3 truncate text-sm font-medium text-foreground">
                            {assignedName}
                          </p>
                        )}
                        <p
                          data-testid={`campaign-responsibility-assignee-${slot.kind}`}
                          className="mt-2 truncate text-xs text-muted-foreground"
                        >
                          {assignedName}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {shouldShowCampaignControls && (
              <section
                data-testid="campaign-controls"
                className="rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <div
                  data-testid="campaign-controls-rail"
                  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("section.quickActions")}
                  </h2>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {canSendCampaignAnnouncement && (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="campaign-announcement-control"
                        className="h-8 justify-start px-2.5 text-xs"
                        onClick={() => setShowAnnouncementDialog((v) => !v)}
                      >
                        <Megaphone className="size-4" />{" "}
                        {t("action.sendAnnouncement")}
                      </Button>
                    )}
                    {canManageApplicationDeadline && (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="campaign-control-action"
                        className="h-8 justify-start px-2.5 text-xs"
                        onClick={() => {
                          setShowDeadlineDialog((v) => !v);
                          setDeadlineError("");
                          if (!newDeadline && campaign?.application_deadline) {
                            setNewDeadline(campaign.application_deadline.split("T")[0]);
                          }
                        }}
                      >
                        <Clock className="size-4" /> {t("action.extendDeadline")}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {showAnnouncementDialog && canSendCampaignAnnouncement && (
                    <div
                      data-testid="campaign-announcement-panel"
                      className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <Label className="text-xs">{t("action.sendAnnouncement")}</Label>
                      <Textarea
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder={t("announcement.placeholder")}
                        className="min-h-[80px] text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAnnouncementDialog(false);
                            setAnnouncementText("");
                          }}
                        >
                          {tc("action.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          disabled={
                            !announcementText.trim() ||
                            actionLoading === "announcement"
                          }
                          onClick={async () => {
                            setActionLoading("announcement");
                            try {
                              await sendCampaignAnnouncement(campaignId, announcementText);
                              toast.success(t("announcement.sent"));
                              setAnnouncementText("");
                              setShowAnnouncementDialog(false);
                            } catch {
                              toast.error(tc("error.generic"));
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                        >
                          <Send className="size-3.5" />
                          {actionLoading === "announcement"
                            ? t("announcement.sending")
                            : tc("action.submit")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {showDeadlineDialog && canManageApplicationDeadline && (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                      <Label className="text-xs">{t("action.extendDeadline")}</Label>
                      <Input
                        type="date"
                        value={newDeadline}
                        onChange={(e) => {
                          setNewDeadline(e.target.value);
                          setDeadlineError("");
                        }}
                        min={new Date().toISOString().split("T")[0]}
                        max={getDateInputValue(campaign.content_due_date)}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("deadline.contentDueLimit")}
                      </p>
                      {deadlineError && (
                        <p className="text-xs font-medium text-destructive" role="alert">
                          {deadlineError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowDeadlineDialog(false);
                            setNewDeadline("");
                            setDeadlineError("");
                          }}
                        >
                          {tc("action.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!newDeadline || actionLoading === "deadline"}
                          onClick={async () => {
                            const contentDueDateKey = getDateInputValue(campaign.content_due_date);
                            if (contentDueDateKey && newDeadline > contentDueDateKey) {
                              const message = t("deadline.contentDueLimit");
                              setDeadlineError(message);
                              toast.error(message);
                              return;
                            }

                            setActionLoading("deadline");
                            setDeadlineError("");
                            try {
                              const updatedDeadline = await updateCampaignDeadline(campaignId, newDeadline);
                              toast.success(t("deadline.updated"));
                              setCampaign((prev) =>
                                prev ? { ...prev, application_deadline: updatedDeadline } : prev
                              );
                              setShowDeadlineDialog(false);
                            } catch {
                              toast.error(tc("error.generic"));
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                        >
                          {actionLoading === "deadline" ? t("deadline.updating") : tc("action.save")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="brief" className="space-y-5">
          <section
            data-testid="campaign-setup-sequence"
            className="rounded-xl border border-border bg-card p-3 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("setupSequence.title")}
              </h2>
              <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {setupTabBadge}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {launchReadinessItems.map((item, index) => (
                <div
                  key={item.key}
                  data-testid="campaign-setup-sequence-item"
                  className={`min-w-0 rounded-lg border px-3 py-2 ${
                    item.ready
                      ? "border-border/70 bg-muted/20"
                      : "border-amber-200 bg-amber-50/70"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                        item.ready
                          ? "bg-slate-900 text-white"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <p className="min-w-0 text-[11px] font-semibold leading-tight text-foreground">
                      {item.label}
                    </p>
                  </div>
                  <p
                    className={`mt-1 text-[11px] font-medium leading-tight ${
                      item.ready ? "text-muted-foreground" : "text-amber-900"
                    }`}
                  >
                    {item.ready
                      ? t("setupSequence.ready")
                      : t("setupSequence.needsWork")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            data-testid="campaign-launch-readiness"
            className="rounded-xl border border-border bg-card p-3 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">
                  {t("launchReadiness.title")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    overviewIsPaymentBlocked
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : launchReadinessBlockers === 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  {overviewIsPaymentBlocked
                    ? t("launchReadiness.paymentRequired")
                    : launchReadinessBlockers === 0
                    ? t("launchReadiness.ready")
                    : t("launchReadiness.needsWork", {
                        count: String(launchReadinessBlockers),
                      })}
                </span>
                {isDraftCampaign ? (
                  <Button
                    type="button"
                    size="sm"
                    data-testid="campaign-launch-action"
                    className="h-8 px-2.5 text-xs"
                    disabled={!canLaunchCampaign || actionLoading === "launch"}
                    onClick={handleLaunchCampaign}
                  >
                    {actionLoading === "launch"
                      ? t("launchReadiness.launching")
                      : canLaunchCampaign
                        ? t("launchReadiness.launch")
                        : t("launchReadiness.locked")}
                  </Button>
                ) : canStartCampaignWork ? (
                  <Button
                    type="button"
                    size="sm"
                    data-testid="campaign-start-work-action"
                    className="h-8 px-2.5 text-xs"
                    disabled={actionLoading === "start-work"}
                    onClick={handleStartCampaignWork}
                  >
                    {actionLoading === "start-work"
                      ? t("startWork.starting")
                      : t("startWork.start")}
                  </Button>
                ) : (
                  <Link
                    href={`/apply/${campaign.id}`}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    {t("launchReadiness.preview")}
                  </Link>
                )}
              </div>
            </div>
            {launchReadinessBlockers > 0 ? (
              <div
                data-testid="campaign-launch-readiness-blockers"
                className="grid gap-2 md:grid-cols-3"
              >
                {launchReadinessItems.map((item) => {
                  const ItemIcon = item.ready ? CheckCircle : FileWarning;
                  return (
                    <div
                      key={item.label}
                      data-testid="campaign-launch-readiness-item"
                      className="flex min-w-0 items-start gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                    >
                      <ItemIcon
                        className={`mt-0.5 size-3.5 shrink-0 ${
                          item.ready ? "text-emerald-600" : "text-amber-700"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {item.label}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                      {!item.ready && item.actionLabel && canManageCampaigns && (
                        <button
                          type="button"
                          data-testid="campaign-launch-readiness-fix"
                          className="ms-auto inline-flex h-6 shrink-0 items-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={() => handleLaunchReadinessFix(item)}
                        >
                          {item.actionLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                data-testid="campaign-launch-ready-summary"
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                  overviewIsPaymentBlocked
                    ? "border-amber-200 bg-amber-50/70"
                    : "border-emerald-200 bg-emerald-50/60"
                }`}
              >
                {overviewIsPaymentBlocked ? (
                  <FileWarning
                    className="mt-0.5 size-4 shrink-0 text-amber-800"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle
                    className="mt-0.5 size-4 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {overviewIsPaymentBlocked
                      ? t("launchReadiness.paymentRequiredSummary")
                      : t("launchReadiness.readySummary")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {overviewIsPaymentBlocked
                      ? t("launchReadiness.paymentRequiredDetail")
                      : t("launchReadiness.readyDetail")}
                  </p>
                </div>
              </div>
            )}
            {serviceFeeBlocksLaunch && !serviceFeeNeedsRecovery && (
              <div
                data-testid="campaign-service-fee-gate"
                className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {t("launchReadiness.payToLaunch")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("launchReadiness.payToLaunchDetail")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  data-testid="campaign-service-fee-action"
                  className="h-8 shrink-0 px-2.5 text-xs"
                  disabled={!canManageBilling || actionLoading === "service-fee-checkout"}
                  onClick={handleServiceFeeCheckout}
                >
                  {actionLoading === "service-fee-checkout"
                    ? t("serviceFee.checkoutOpening")
                    : t("serviceFee.payAmount", { amount: serviceFeePaymentDueDisplay })}
                </Button>
              </div>
            )}
            {isDraftCampaign && launchReadinessBlockers > 0 && canManageCampaigns && (
              <div
                data-testid="campaign-launch-readiness-fixes"
                className="mt-3 grid gap-2 border-t border-border/70 pt-3"
              >
                {!hasBrief && (
                  <div
                    data-testid="campaign-launch-brief-fix"
                    className="grid gap-2 rounded-lg border border-border/70 bg-background p-3"
                  >
                    <Label htmlFor="launch-brief" className="text-xs">
                      {t("launchReadiness.fix.briefLabel")}
                    </Label>
                    <Textarea
                      id="launch-brief"
                      value={launchBriefDraft}
                      rows={3}
                      placeholder={t("launchReadiness.fix.briefPlaceholder")}
                      onChange={(event) => setLaunchBriefDraft(event.target.value)}
                      className="text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        disabled={actionLoading === "launch-brief"}
                        onClick={handleSaveLaunchBrief}
                      >
                        {actionLoading === "launch-brief"
                          ? t("launchReadiness.fix.saving")
                          : t("launchReadiness.fix.saveBrief")}
                      </Button>
                    </div>
                  </div>
                )}
                {!hasDeliverables && (
                  <div
                    data-testid="campaign-launch-deliverable-fix"
                    className="grid gap-2 rounded-lg border border-border/70 bg-background p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_auto] md:items-end"
                  >
                    <div>
                      <Label className="text-xs">
                        {t("launchReadiness.fix.platformLabel")}
                      </Label>
                      <Select
                        value={launchDeliverablePlatform}
                        onValueChange={(value) => {
                          if (value) setLaunchDeliverablePlatform(value);
                        }}
                      >
                        <SelectTrigger className="mt-1.5 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {launchPlatformOptions.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              {PLATFORM_LABELS[platform as Platform] ?? platform}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">
                        {t("launchReadiness.fix.formatLabel")}
                      </Label>
                      <Select
                        value={launchDeliverableFormat}
                        onValueChange={(value) =>
                          value
                            ? setLaunchDeliverableFormat(value as ContentFormat)
                            : undefined
                        }
                      >
                        <SelectTrigger className="mt-1.5 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTENT_FORMATS.map((format) => (
                            <SelectItem key={format} value={format}>
                              {tc(FORMAT_KEYS[format])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="launch-deliverable-quantity" className="text-xs">
                        {t("launchReadiness.fix.quantityLabel")}
                      </Label>
                      <Input
                        id="launch-deliverable-quantity"
                        type="number"
                        min={1}
                        max={100}
                        value={launchDeliverableQuantity}
                        onChange={(event) =>
                          setLaunchDeliverableQuantity(event.target.value)
                        }
                        className="mt-1.5 h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-3 text-xs"
                      disabled={actionLoading === "launch-deliverable"}
                      onClick={handleAddLaunchDeliverable}
                    >
                      {actionLoading === "launch-deliverable"
                        ? t("launchReadiness.fix.saving")
                        : t("launchReadiness.fix.addDeliverable")}
                    </Button>
                  </div>
                )}
                {!hasReportingRequirements && (
                  <div
                    data-testid="campaign-launch-reporting-fix"
                    className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {t("launchReadiness.fix.reportingLabel")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("launchReadiness.fix.reportingDetail")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs"
                      disabled={!hasDeliverables || actionLoading === "launch-reporting"}
                      onClick={handleSyncLaunchReporting}
                    >
                      {actionLoading === "launch-reporting"
                        ? t("launchReadiness.fix.saving")
                        : t("launchReadiness.fix.addProof")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          <Card data-testid="campaign-reporting-config">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    {t("reportingConfig.title")}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("reportingConfig.detail")}
                  </p>
                </div>
                {!canEditReportingRequirements && (
                  <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {t("reportingConfig.locked")}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportingRequirements.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  {t("reportingConfig.noRequirements")}
                </div>
              ) : (
                reportingRequirements.map((requirement) => {
                  const draftMetricKeys = getReportingMetricDraft(requirement);
                  const selectedMetricKeys = new Set(draftMetricKeys);
                  const metricOptions = isReportingPlatform(requirement.platform)
                    ? getReportingMetricTemplate(requirement.platform)
                    : [];
                  const originalMetricKey = (requirement.required_metric_keys ?? []).join("|");
                  const draftMetricKey = draftMetricKeys.join("|");
                  const hasChanges = originalMetricKey !== draftMetricKey;
                  const loadingKey = `reporting-requirement:${requirement.id}`;
                  const platformLabel =
                    requirement.platform_label ||
                    PLATFORM_LABELS[requirement.platform as Platform] ||
                    requirement.platform;
                  const formatLabel =
                    requirement.content_format in FORMAT_KEYS
                      ? tc(FORMAT_KEYS[requirement.content_format as ContentFormat])
                      : requirement.content_format;

                  return (
                    <div
                      key={requirement.id}
                      data-testid="campaign-reporting-requirement-card"
                      className="rounded-xl border border-border bg-background p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {platformLabel} · {formatLabel}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("reportingConfig.required", {
                              count: String(draftMetricKeys.length),
                            })}
                          </p>
                        </div>
                        {canEditReportingRequirements && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-testid="campaign-reporting-requirement-save"
                            className="h-8 shrink-0 px-2.5 text-xs"
                            disabled={
                              !hasChanges ||
                              draftMetricKeys.length === 0 ||
                              actionLoading === loadingKey
                            }
                            onClick={() =>
                              void handleReportingRequirementUpdate(requirement)
                            }
                          >
                            {actionLoading === loadingKey
                              ? t("launchReadiness.fix.saving")
                              : t("reportingConfig.save")}
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {metricOptions.map((metric) => {
                          const selected = selectedMetricKeys.has(metric.metricKey);

                          return (
                            <button
                              key={metric.metricKey}
                              type="button"
                              data-testid="campaign-reporting-metric-toggle"
                              data-metric-key={metric.metricKey}
                              data-selected={selected ? "true" : "false"}
                              aria-pressed={selected}
                              disabled={!canEditReportingRequirements}
                              onClick={() =>
                                handleReportingMetricToggle(
                                  requirement,
                                  metric.metricKey,
                                )
                              }
                              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                                selected
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-border bg-card text-muted-foreground hover:border-slate-300 hover:text-foreground"
                              }`}
                            >
                              {selected && (
                                <Check className="size-3" aria-hidden="true" />
                              )}
                              <span>{metric.label}</span>
                              {metric.isPrivateMetric && (
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                                    selected
                                      ? "bg-white/15 text-white"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {t("reportingConfig.privateMetric")}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <BrandCreativeKitPanel
                campaignId={campaign.id}
                assets={creativeAssets}
                canManage={canManageCampaignAssets}
                onChanged={loadCampaignWorkspace}
              />

              <Card>
                <CardHeader>
                  <CardTitle>{t("section.brief")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 overflow-hidden">
                  {campaign.brief_description && (
                    <p className="break-words text-sm leading-relaxed text-foreground">
                      {campaign.brief_description}
                    </p>
                  )}
                  {campaign.brief_requirements && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground/70">
                        {t("section.requirements")}
                      </p>
                      <p className="break-words text-sm text-muted-foreground">
                        {campaign.brief_requirements}
                      </p>
                    </div>
                  )}
                  {(dosItems.length > 0 || dontsItems.length > 0) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {dosItems.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/70">
                            {t("section.dos")}
                          </p>
                          <ul className="space-y-1">
                            {dosItems.map((item, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-2 text-sm text-muted-foreground"
                              >
                                <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                                <span className="min-w-0 break-words">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {dontsItems.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/70">
                            {t("section.donts")}
                          </p>
                          <ul className="space-y-1">
                            {dontsItems.map((item, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-2 text-sm text-muted-foreground"
                              >
                                <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                                <span className="min-w-0 break-words">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="campaign-deliverables-summary">
                <CardHeader>
                  <CardTitle>{t("section.deliverables")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deliverables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("launchReadiness.deliverables.missing")}
                    </p>
                  ) : (
                    deliverables.map((deliverable) => (
                      <div
                        key={deliverable.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {PLATFORM_LABELS[deliverable.platform as Platform] ??
                              deliverable.platform}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tc(
                              FORMAT_KEYS[
                                deliverable.content_type as ContentFormat
                              ] ?? FORMAT_KEYS.short_video,
                            )}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-foreground">
                          {deliverable.quantity}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              <BrandAgreementPanel
                key={agreement?.id ?? "no-campaign-agreement"}
                campaignId={campaign.id}
                agreement={agreement}
                canManage={canEditPreWorkSetup}
                onPublished={loadCampaignWorkspace}
              />

              <Card data-testid="campaign-billing-scope">
                <CardHeader>
                  <CardTitle>{t("section.billingScope")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t("serviceFee.label")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {requiresCustomServiceQuote
                          ? t("serviceFee.scope.concierge")
                          : t("serviceFee.scope.private")}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-lg font-semibold text-foreground">
                        {serviceFeeDisplay}
                      </p>
                      <span
                        data-testid="campaign-service-fee-status"
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          paymentStatusStyles[campaign.service_fee_status] ||
                          "bg-muted text-foreground"
                        }`}
                      >
                        {t(`serviceFee.status.${campaign.service_fee_status}`)}
                      </span>
                    </div>
                  </div>
                  <div
                    data-testid="campaign-service-fee-receipt"
                    className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {campaign.service_fee_status === "paid"
                            ? t("serviceFee.receipt.title")
                            : t("serviceFee.receipt.statusTitle")}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t(serviceFeeStatusDetailKey)}
                        </p>
                      </div>
                      {serviceFeeStatusDate ? (
                        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {formatShortDate(serviceFeeStatusDate, locale)}
                        </span>
                      ) : null}
                    </div>
                    {serviceFeeReferenceRows.length > 0 ? (
                      <dl
                        data-testid="campaign-service-fee-reference"
                        className="mt-2 grid gap-1 border-t border-border/70 pt-2 text-xs"
                      >
                        {serviceFeeReferenceRows.map((row) => (
                          <div
                            key={row.key}
                            className="flex min-w-0 items-center justify-between gap-3"
                          >
                            <dt className="text-muted-foreground">
                              {t(row.labelKey)}
                            </dt>
                            <dd className="truncate font-mono font-medium text-foreground">
                              {compactStripeId(row.value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                  {!requiresCustomServiceQuote && (
                    <dl
                      data-testid="campaign-billing-scope-included"
                      className="grid gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                        <dt className="text-muted-foreground">
                          {t("serviceFee.scope.creatorCapacity")}
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {requestedCreatorCapacity}
                        </dd>
                      </div>
                      {canManageBilling &&
                        campaign.campaign_mode === "private" &&
                        !requiresCustomServiceQuote &&
                        !campaignAllowsPaidScopeUpdate && (
                          <p
                            data-testid="campaign-capacity-closed-note"
                            className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                          >
                            {t("serviceFee.capacityClosed")}
                          </p>
                        )}
                      {canUpdateCreatorCapacity ? (
                        <div
                          data-testid="campaign-capacity-upgrade-control"
                          className="rounded-lg border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <dt className="text-xs font-semibold text-foreground">
                              {t("serviceFee.scope.creatorCapacity")}
                            </dt>
                            <dd className="text-xs text-muted-foreground">
                              {t("serviceFee.capacityControl.detail")}
                            </dd>
                          </div>
                          <dd className="mt-3 grid grid-cols-3 gap-2">
                            {creatorCapacityOptions.map((option) => (
                              <button
                                key={option.count}
                                type="button"
                                data-testid={`campaign-capacity-option-${option.count}`}
                                aria-label={t("investment.creators.setCapacity", {
                                  count: String(option.count),
                                })}
                                onClick={() =>
                                  setCapacityDraft({
                                    activeDays: selectedActiveDays,
                                    campaignId: campaign.id,
                                    reportingDays: selectedReportingDays,
                                    value: option.count,
                                  })
                                }
                                className={`flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors ${
                                  selectedCreatorCapacity === option.count
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-border bg-white text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <span className="text-sm font-semibold tabular-nums">
                                  {option.count}
                                </span>
                                <span className="mt-0.5 text-[11px] font-medium tabular-nums opacity-80">
                                  {option.totalDisplay}
                                </span>
                              </button>
                            ))}
                          </dd>
                          <dd className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {t("serviceFee.scope.selectedActiveDays")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {t("serviceFee.capacityControl.durationDetail")}
                                </span>
                              </div>
                              <div
                                data-testid="campaign-active-days-options"
                                className="mt-2 grid grid-cols-4 gap-1.5"
                              >
                                {activeDayScopeOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    data-testid={`campaign-active-days-option-${option}`}
                                    onClick={() =>
                                      setCapacityDraft({
                                        activeDays: option,
                                        campaignId: campaign.id,
                                        reportingDays: selectedReportingDays,
                                        value: selectedCreatorCapacity,
                                      })
                                    }
                                    className={`min-h-9 rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors ${
                                      selectedActiveDays === option
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-border bg-white text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {t("serviceFee.scope.selectedReportingDays")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {t("serviceFee.scope.reportingDays")}
                                </span>
                              </div>
                              <div
                                data-testid="campaign-reporting-days-options"
                                className="mt-2 grid grid-cols-4 gap-1.5"
                              >
                                {reportingDayScopeOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    data-testid={`campaign-reporting-days-option-${option}`}
                                    onClick={() =>
                                      setCapacityDraft({
                                        activeDays: selectedActiveDays,
                                        campaignId: campaign.id,
                                        reportingDays: option,
                                        value: selectedCreatorCapacity,
                                      })
                                    }
                                    className={`min-h-9 rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors ${
                                      selectedReportingDays === option
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-border bg-white text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </dd>
                          <dd
                            data-testid="campaign-capacity-price-preview"
                            className="mt-3 grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-2 text-xs sm:grid-cols-3"
                          >
                            <div>
                              <span className="block text-muted-foreground">
                                {t("serviceFee.capacityPreview.total")}
                              </span>
                              <span className="mt-0.5 block font-semibold text-foreground">
                                {selectedCreatorCapacityTotalDisplay}
                              </span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground">
                                {t("serviceFee.capacityPreview.paidCredit")}
                              </span>
                              <span className="mt-0.5 block font-semibold text-foreground">
                                {selectedCreatorCapacityPaidDisplay}
                              </span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground">
                                {t("serviceFee.capacityPreview.balance")}
                              </span>
                              <span className="mt-0.5 block font-semibold text-foreground">
                                {selectedCreatorCapacityBalanceDisplay}
                              </span>
                            </div>
                          </dd>
                          <dd className="mt-3 flex items-center justify-between gap-3">
                            {selectedCapacityIsBelowAcceptedCreators ? (
                              <span className="text-xs text-red-600">
                                {t("serviceFee.capacityBelowAccepted")}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {!scopeChanged
                                  ? t("serviceFee.capacityCurrent")
                                  : t("serviceFee.capacityUnsaved")}
                              </span>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              data-testid="campaign-capacity-save"
                              className="h-8 shrink-0 px-3 text-xs"
                              disabled={
                                !scopeChanged ||
                                selectedCapacityIsBelowAcceptedCreators ||
                                actionLoading === "creator-capacity"
                              }
                              onClick={handleCreatorCapacityUpdate}
                            >
                              {actionLoading === "creator-capacity"
                                ? tc("action.saving")
                                : t("serviceFee.capacityUpdate")}
                            </Button>
                          </dd>
                        </div>
                      ) : null}
                      {serviceFeeBalanceDueCents > 0 &&
                      campaign.service_fee_status !== "paid" ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                          <dt className="text-muted-foreground">
                            {t("serviceFee.scope.balanceDue")}
                          </dt>
                          <dd className="font-semibold text-foreground">
                            {serviceFeePaymentDueDisplay}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                        <dt className="text-muted-foreground">
                          {t("serviceFee.scope.activeDays")}
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {estimatedActiveDays}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                        <dt className="text-muted-foreground">
                          {t("serviceFee.scope.reportingDays")}
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {estimatedReportingDays}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <p
                    data-testid="campaign-billing-scope-separate-costs"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    {t("serviceFee.scope.separateCosts")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Creators Tab */}
        <TabsContent value="creators" className="flex flex-col gap-5">
          <Card
            data-testid="campaign-creator-scale-readiness"
            data-scale-readiness-state={creatorScaleReadiness.state}
          >
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("creatorScale.title")}
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-foreground">
                      {creatorScaleReadiness.label}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {creatorScaleReadiness.detail}
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {t("creatorScale.scope", {
                    count: String(paidCreatorCapacity),
                  })}
                </span>
              </div>
              <div
                data-testid="campaign-creator-scale-rail"
                aria-label={t("creatorScale.title")}
                className="rounded-xl border border-slate-900 bg-slate-950 px-4 py-3 text-white shadow-sm"
              >
                <div className="grid gap-3 md:grid-cols-4">
                  {creatorScaleReadinessItems.map((item, index) => (
                    <div
                      key={item.key}
                      data-testid={`campaign-creator-scale-rail-${item.key}`}
                      className="min-w-0 border-slate-800 pb-3 last:pb-0 md:border-s md:pb-0 md:ps-4 md:first:border-s-0 md:first:ps-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[10px] font-semibold tabular-nums text-white">
                          {index + 1}
                        </span>
                        <p className="truncate text-[11px] font-semibold uppercase leading-none text-slate-300">
                          {item.label}
                        </p>
                      </div>
                      <p className="mt-3 text-xl font-semibold leading-none tracking-normal text-white tabular-nums">
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        {item.detail}
                      </p>
                      {item.key === "capacity" && (
                        <div
                          data-testid="campaign-creator-scale-capacity-track"
                          className="mt-3 h-1 overflow-hidden rounded-full bg-white/15"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-full bg-white"
                            style={{ width: `${creatorCapacityUsedPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {creatorScaleReadinessItems.map((item) => (
                  <div
                    key={item.key}
                    data-testid={`campaign-creator-scale-readiness-${item.key}`}
                    className="rounded-lg border border-border/70 bg-muted/20 p-3"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-xl font-semibold leading-none tracking-normal text-foreground tabular-nums">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="campaign-creator-operations-board">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("creatorOps.title")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("creatorOps.detail")}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {creatorOperations.map((operation) => (
                  <div
                    key={operation.key}
                    data-testid={`campaign-creator-operation-${operation.key}`}
                    className="rounded-lg border border-border/70 bg-muted/20 p-3"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {operation.label}
                    </p>
                    <p
                      data-testid={
                        operation.key === "openSeats"
                          ? "campaign-creator-open-seats"
                          : undefined
                      }
                      className="mt-2 text-2xl font-semibold leading-none tracking-normal text-foreground tabular-nums"
                    >
                      {operation.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {operation.detail}
                    </p>
                    {operation.key === "accepted" && (
                      <div
                        data-testid="campaign-creator-capacity-bar"
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{ width: `${creatorCapacityUsedPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {canManageCampaigns && (
            <Card data-testid="campaign-creator-invite-import">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">
                      {t("inviteImport.title")}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      {t("inviteImport.detail")}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {t("inviteImport.capacity", {
                      count: String(creatorInviteImportPreview.summary.openSeats),
                    })}
                  </div>
                </div>

                <Textarea
                  data-testid="campaign-invite-import-textarea"
                  value={inviteImportText}
                  onChange={(event) => setInviteImportText(event.target.value)}
                  placeholder={t("inviteImport.placeholder")}
                  rows={4}
                  className="resize-none text-sm"
                  disabled={!creatorInvitesAreManageable}
                />

                <div
                  data-testid="campaign-invite-import-summary"
                  className="grid gap-2 text-xs sm:grid-cols-5"
                >
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="font-medium text-muted-foreground">
                      {t(
                        creatorInvitesAreManageable
                          ? "inviteImport.ready"
                          : "inviteImport.readOnly",
                      )}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {creatorInviteImportPreview.summary.readyCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="font-medium text-muted-foreground">
                      {t("inviteImport.emails")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {creatorInviteImportPreview.summary.emailCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="font-medium text-muted-foreground">
                      {t("inviteImport.handles")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {creatorInviteImportPreview.summary.handleCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="font-medium text-muted-foreground">
                      {t("inviteImport.duplicates")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {creatorInviteImportPreview.summary.duplicateCount}
                    </p>
                  </div>
                  <div
                    data-testid="campaign-invite-import-over-capacity"
                    className="rounded-lg border border-border/70 bg-muted/20 p-3"
                  >
                    <p className="font-medium text-muted-foreground">
                      {t("inviteImport.overCapacity")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                      {creatorInviteImportPreview.summary.overCapacityCount}
                    </p>
                  </div>
                </div>

                {inviteImportOverCapacityCount > 0 && (
                  <div
                    data-testid="campaign-invite-import-capacity-warning"
                    className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-xs leading-5 text-amber-900">
                      {t("inviteImport.capacityWarning", {
                        count: String(inviteImportOverCapacityCount),
                        capacity: String(inviteImportSuggestedCapacity),
                      })}
                    </p>
                    {canUpdateCreatorCapacity && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="campaign-invite-import-review-capacity"
                        className="h-8 shrink-0 border-amber-200 bg-white px-3 text-xs text-amber-950 hover:bg-amber-50"
                        onClick={handleInviteCapacityReview}
                      >
                        {t("inviteImport.reviewCapacity")}
                      </Button>
                    )}
                  </div>
                )}

                {!creatorInvitesAreManageable ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {t("inviteImport.closed")}
                  </div>
                ) : !canShareInviteLink ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {t("inviteImport.locked")}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-h-5 text-xs text-muted-foreground">
                    {!creatorInvitesAreManageable
                      ? creatorInviteClosedDetailKey === "inviteImport.closedClean"
                        ? t("inviteImport.closedClean")
                        : t(creatorInviteClosedDetailKey)
                      : creatorInviteImportPreview.summary.invalidCount > 0
                        ? t("inviteImport.invalid", {
                            count: String(creatorInviteImportPreview.summary.invalidCount),
                          })
                        : t("inviteImport.clean")}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="campaign-invite-import-submit"
                    className="h-8 shrink-0 gap-1.5 px-3 text-xs"
                    disabled={
                      !creatorInvitesAreManageable ||
                      creatorInviteImportPreview.summary.readyCount === 0 ||
                      actionLoading === "creator-invite-import"
                    }
                    onClick={handleCreatorInviteImport}
                  >
                    <Send className="size-3.5" aria-hidden="true" />
                    {actionLoading === "creator-invite-import"
                      ? t("inviteImport.saving")
                      : !creatorInvitesAreManageable
                        ? t("inviteImport.closedAction")
                        : canShareInviteLink
                          ? t("inviteImport.send")
                          : t("inviteImport.save")}
                  </Button>
                </div>

                {creatorInvites.length > 0 && (
                  <div className="border-t border-border/60 pt-3">
                    <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {t("inviteImport.saved")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(
                            creatorInvitesAreManageable
                              ? "inviteImport.savedDetail"
                              : "inviteImport.savedClosedDetail",
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative min-w-0 sm:w-64">
                          <Search
                            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            data-testid="campaign-invite-list-search"
                            value={inviteListQuery}
                            onChange={(event) =>
                              setInviteListQuery(event.target.value)
                            }
                            placeholder={t("inviteImport.search")}
                            className="h-8 ps-8 text-xs"
                          />
                        </div>
                        <Select
                          value={inviteListStatusFilter}
                          onValueChange={(value) =>
                            setInviteListStatusFilter(
                              value as CreatorInviteStatusFilter,
                            )
                          }
                        >
                          <SelectTrigger
                            data-testid="campaign-invite-list-filter"
                            className="h-8 min-w-40 text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              [
                                "all",
                                "manual",
                                "queued",
                                "sent",
                                "failed",
                              ] as CreatorInviteStatusFilter[]
                            ).map((status) => (
                              <SelectItem key={status} value={status}>
                                {t(creatorInviteStatusFilterKeys[status])} (
                                {inviteListStatusCounts[status]})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto rounded-lg border border-border/70">
                      {filteredCreatorInvites.length === 0 ? (
                        <div
                          data-testid="campaign-invite-list-empty"
                          className="px-3 py-4 text-xs text-muted-foreground"
                        >
                          {t("inviteImport.emptySaved")}
                        </div>
                      ) : (
                        <div className="divide-y divide-border/60">
                          {filteredCreatorInvites.map((invite) => {
                            const sendKey = `creator-invite-send:${invite.id}`;
                            const removeKey = `creator-invite-remove:${invite.id}`;
                            const canSendSavedInvite =
                              invite.contact_type === "email" &&
                              ["manual", "failed"].includes(invite.status) &&
                              canShareInviteLink && creatorInvitesAreSendable;
                            const creatorInviteStatusLabelKeys =
                              creatorInvitesAreManageable ? creatorInviteStatusKeys : creatorInviteReadOnlyStatusKeys;

                            return (
                              <div
                                key={invite.id}
                                data-testid="campaign-invite-row"
                                data-status={invite.status}
                                className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {invite.contact_value}
                                  </p>
                                  <p className="mt-0.5 text-muted-foreground">
                                    {t(creatorInviteStatusLabelKeys[invite.status])}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                                  {canSendSavedInvite && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      data-testid="campaign-invite-send"
                                      className="h-7 gap-1.5 px-2 text-xs"
                                      disabled={actionLoading === sendKey}
                                      onClick={() =>
                                        handleSendSavedCreatorInvite(invite)
                                      }
                                    >
                                      <Send className="size-3" aria-hidden="true" />
                                      {actionLoading === sendKey
                                        ? t("inviteImport.sending")
                                        : invite.status === "failed"
                                          ? t("inviteImport.sendAgain")
                                          : t("inviteImport.sendSaved")}
                                    </Button>
                                  )}
                                  {creatorInvitesAreManageable && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      data-testid="campaign-invite-remove"
                                      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                                      disabled={actionLoading === removeKey}
                                      onClick={() =>
                                        handleRemoveSavedCreatorInvite(invite)
                                      }
                                    >
                                      <Trash2 className="size-3" aria-hidden="true" />
                                      {actionLoading === removeKey
                                        ? t("inviteImport.removing")
                                        : t("inviteImport.remove")}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <section
            data-testid="campaign-creators-section-applicants"
            className={`space-y-3 ${applicantSectionOrderClass}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tab.applicants")}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {pendingApps.length}
              </span>
            </div>
            {pendingApps.length > 0 &&
              canManageCampaigns &&
              !campaignAcceptsApplicationDecisions && (
                <div
                  data-testid="campaign-applicants-closed-note"
                  className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                >
                  {t("applicants.closedStage")}
                </div>
              )}
            {pendingApps.length > 0 && canManageCampaigns && campaignAcceptsApplicationDecisions && (
              <div
                data-testid="campaign-applicant-bulk-toolbar"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t("applicants.bulk.selected", {
                      count: String(selectedApplicantCount),
                    })}
                  </span>
                  <span>
                    {t("applicants.bulk.openSeats", {
                      count: String(creatorCapacityOpenSeats),
                    })}
                  </span>
                  {selectedApplicantsOverCapacity && (
                    <span className="text-red-700">
                      {t("applicants.bulk.selectUpTo", {
                        count: String(creatorCapacityOpenSeats),
                      })}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="campaign-applicant-bulk-decline"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    disabled={applicantBulkRejectDisabled}
                    onClick={handleBulkRejectApplicants}
                  >
                    {actionLoading === "applicants-bulk-reject"
                      ? t("applicants.bulk.declining")
                      : t("applicants.bulk.decline")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="campaign-applicant-bulk-accept"
                    className="h-7 px-2 text-xs"
                    disabled={applicantBulkAcceptDisabled}
                    onClick={handleBulkAcceptApplicants}
                  >
                    {actionLoading === "applicants-bulk-accept"
                      ? t("applicants.bulk.accepting")
                      : t("applicants.bulk.accept")}
                  </Button>
                </div>
              </div>
            )}
          {pendingApps.length === 0 ? (
            <div
              data-testid="campaign-creators-empty-note"
              className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
            >
              {t("empty.noApplicants")}
            </div>
          ) : (
            <Card data-testid="campaign-applicants-table">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs font-medium text-muted-foreground">
                        {canManageCampaigns && campaignAcceptsApplicationDecisions && (
                          <th className="w-10 pb-3 ps-4 text-start">
                            <input
                              type="checkbox"
                              data-testid="campaign-applicant-select-all"
                              aria-label={t("applicants.bulk.selectAll")}
                              checked={allVisibleApplicantsSelected}
                              onChange={(event) =>
                                handleVisibleApplicantSelection(
                                  event.currentTarget.checked,
                                )
                              }
                              className="size-4 rounded border-border text-slate-900"
                            />
                          </th>
                        )}
                        <ApplicantSortableHead
                          label={t("members.creator")}
                          sortKey="creator"
                          currentKey={applicantSort.key}
                          currentDir={applicantSort.direction}
                          onSort={handleApplicantSort}
                        />
                        <ApplicantSortableHead
                          label={t("members.market")}
                          sortKey="market"
                          currentKey={applicantSort.key}
                          currentDir={applicantSort.direction}
                          onSort={handleApplicantSort}
                        />
                        <ApplicantSortableHead
                          label={t("applicants.fit")}
                          sortKey="fit"
                          currentKey={applicantSort.key}
                          currentDir={applicantSort.direction}
                          onSort={handleApplicantSort}
                        />
                        <ApplicantSortableHead
                          label={t("members.rate")}
                          sortKey="rate"
                          currentKey={applicantSort.key}
                          currentDir={applicantSort.direction}
                          onSort={handleApplicantSort}
                        />
                        <ApplicantSortableHead
                          label={t("applicants.applied")}
                          sortKey="applied"
                          currentKey={applicantSort.key}
                          currentDir={applicantSort.direction}
                          onSort={handleApplicantSort}
                        />
                        <th className="pb-3 text-start">{t("applicants.decision")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPendingApps.map((app) => {
                        const name = app.profiles?.full_name || "";
                        const cp = app.creator_profiles;
                        const acceptLoading =
                          actionLoading === getApplicationActionKey(app.id, "accept");
                        const rejectLoading =
                          actionLoading === getApplicationActionKey(app.id, "reject");
                        const appActionLoading = acceptLoading || rejectLoading;
                        const market = cp?.primary_market
                          ? getMarketLabel(cp.primary_market, locale)
                          : "-";
                        const fitLabel = cp && cp.rating > 0 ? cp.rating.toFixed(1) : "-";

                        return (
                          <tr
                            key={app.id}
                            className="border-b border-border/50 align-top last:border-0"
                          >
                            {canManageCampaigns && campaignAcceptsApplicationDecisions && (
                              <td className="w-10 py-3 ps-4">
                                <input
                                  type="checkbox"
                                  data-testid="campaign-applicant-select"
                                  aria-label={t("applicants.bulk.selectCreator", {
                                    name,
                                  })}
                                  checked={selectedApplicantSet.has(app.id)}
                                  onChange={(event) =>
                                    handleApplicantSelection(
                                      app.id,
                                      event.currentTarget.checked,
                                    )
                                  }
                                  className="size-4 rounded border-border text-slate-900"
                                />
                              </td>
                            )}
                            <td className="py-3 pe-4 ps-4">
                              <div className="flex min-w-44 items-center gap-2">
                                <Avatar className="size-7">
                                  {app.profiles?.avatar_url && (
                                    <AvatarImage src={app.profiles.avatar_url} />
                                  )}
                                  <AvatarFallback className="text-xs">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {name}
                                  </p>
                                  {cp?.niches && cp.niches.length > 0 && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {cp.niches
                                        .slice(0, 2)
                                        .map((n) =>
                                          NICHE_KEYS[n as Niche]
                                            ? tc(NICHE_KEYS[n as Niche])
                                            : n,
                                        )
                                        .join(", ")}
                                    </p>
                                  )}
                                  {app.pitch && (
                                    <p
                                      data-testid="campaign-applicant-pitch"
                                      className="line-clamp-1 max-w-72 text-xs text-muted-foreground"
                                    >
                                      {app.pitch}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              <span className="inline-flex min-w-28 items-center gap-1.5">
                                {cp?.primary_market && (
                                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                                )}
                                <span className="truncate">{market}</span>
                              </span>
                            </td>
                            <td className="py-3 pe-4">
                              <span className="font-medium tabular-nums text-foreground">
                                {fitLabel}
                              </span>
                            </td>
                            <td className="py-3 pe-4 font-medium tabular-nums text-foreground">
                              {app.proposed_rate != null
                                ? formatCompactCurrency(app.proposed_rate, locale)
                                : "-"}
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              {timeAgo(app.created_at, tc, locale)}
                            </td>
                            <td className="py-3 pe-4">
                              {canManageCampaigns && campaignAcceptsApplicationDecisions ? (
                                <div
                                  data-testid="campaign-applicant-action"
                                  className="flex min-w-[244px] flex-nowrap gap-1.5"
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 whitespace-nowrap px-2 text-xs"
                                    onClick={() => {
                                      setCounterDialog(app.id);
                                      setCounterRate(String(app.proposed_rate || ""));
                                    }}
                                  >
                                    {t("applicants.counter")}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 whitespace-nowrap px-2 text-xs text-red-700 hover:text-red-800"
                                    disabled={appActionLoading}
                                    onClick={() => handleReject(app.id)}
                                  >
                                    {rejectLoading
                                      ? t("applicants.rejecting")
                                      : t("applicants.reject")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 whitespace-nowrap px-2 text-xs"
                                    disabled={appActionLoading}
                                    onClick={() => handleAccept(app.id, app.proposed_rate)}
                                  >
                                    {acceptLoading
                                      ? t("applicants.accepting")
                                      : t("applicants.accept")}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {canManageCampaigns
                                    ? t("applicants.closedAction")
                                    : t("content.noAction")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          </section>

          <section
            data-testid="campaign-creators-section-members"
            className={`space-y-3 ${memberSectionOrderClass}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tab.members")}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {members.length}
              </span>
            </div>
          {members.length === 0 ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {t("empty.noMembers")}
            </div>
          ) : (
            <>
              <div
                data-testid="campaign-member-report-readiness"
                className="rounded-lg border border-border/70 bg-white px-3 py-3"
              >
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {t("members.reportReadiness.title")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("members.reportReadiness.detail")}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t("members.reportReadiness.acceptedCount", {
                      count: String(sortedMembers.length),
                    })}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {memberReportReadiness.map((item) => (
                    <div
                      key={item.key}
                      data-testid={`campaign-member-report-readiness-${item.key}`}
                      className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                    >
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                        {item.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-[280px]">
                  <Search
                    className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    data-testid="campaign-member-roster-search"
                    value={memberRosterQuery}
                    onChange={(event) =>
                      handleMemberRosterQueryChange(event.target.value)
                    }
                    placeholder={t("members.searchPlaceholder")}
                    aria-label={t("members.searchPlaceholder")}
                    className="h-8 rounded-lg ps-8 text-xs"
                  />
                </div>
                <QueueFilterBar<MemberRosterFilter>
                  ariaLabel={t("members.filtersLabel")}
                  onChange={handleMemberRosterFilterChange}
                  options={memberRosterFilterOptions}
                  testId="campaign-member-roster-filters"
                  value={memberRosterFilter}
                />
              </div>
              {(canManageCampaigns || canReviewCampaignContent) && (
                <div
                  data-testid="campaign-member-bulk-toolbar"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t("members.bulk.selected", {
                        count: String(selectedMemberCount),
                      })}
                    </span>
                    <span>
                      {t("members.bulk.missedProof", {
                        count: String(selectedMissedReportTaskIds.length),
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canManageCampaigns && (
                      <>
                        <select
                          data-testid="campaign-member-bulk-payment-select"
                          value={memberBulkPaymentStatus}
                          onChange={(event) =>
                            setMemberBulkPaymentStatus(
                              event.target.value as PaymentStatusType | "",
                            )
                          }
                          className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                          aria-label={t("members.bulk.paymentPlaceholder")}
                        >
                          <option value="">
                            {t("members.bulk.paymentPlaceholder")}
                          </option>
                          {memberPaymentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {t(paymentStatusKeys[status])}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="campaign-member-bulk-payment-save"
                          className="h-7 px-2 text-xs"
                          disabled={memberBulkPaymentDisabled}
                          onClick={handleBulkMemberPaymentStatus}
                        >
                          {actionLoading === "members-bulk-payment"
                            ? t("members.bulk.applyingPayment")
                            : t("members.bulk.applyPayment")}
                        </Button>
                      </>
                    )}
                    {canReviewCampaignContent && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="campaign-member-bulk-follow-up"
                        className="h-7 px-2 text-xs"
                        disabled={memberBulkFollowUpDisabled}
                        onClick={handleBulkMissedReportFollowUp}
                      >
                        <Send className="size-3" aria-hidden="true" />
                        {actionLoading === "members-bulk-follow-up"
                          ? t("members.bulk.followingUp")
                          : selectedMissedReportTaskIds.length > 0
                            ? t("members.bulk.followUpMissedCount", {
                                count: String(selectedMissedReportTaskIds.length),
                              })
                            : t("members.bulk.followUpMissed")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <Card data-testid="campaign-members-table">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-start text-xs font-medium text-muted-foreground">
                          {(canManageCampaigns || canReviewCampaignContent) && (
                            <th className="w-10 pb-3 ps-4 text-start">
                              <input
                                type="checkbox"
                                data-testid="campaign-member-select-all"
                                aria-label={t("members.bulk.selectAll")}
                                className="size-4 rounded border-border accent-slate-950"
                                checked={allVisibleMembersSelected}
                                onChange={(event) =>
                                  handleVisibleMemberSelection(event.target.checked)
                                }
                              />
                            </th>
                          )}
                        <MemberSortableHead
                          label={t("members.creator")}
                          sortKey="creator"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        <MemberSortableHead
                          label={t("members.market")}
                          sortKey="market"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        <MemberSortableHead
                          label={t("members.platform")}
                          sortKey="platform"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        <MemberSortableHead
                          label={t("members.agreement")}
                          sortKey="agreement"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        <MemberSortableHead
                          label={t("members.report")}
                          sortKey="report"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        <MemberSortableHead
                          label={t("members.proof")}
                          sortKey="proof"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        <MemberSortableHead
                          label={t("members.rate")}
                          sortKey="rate"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        <MemberSortableHead
                          label={t("members.payment")}
                          sortKey="payment"
                          currentKey={memberSort.key}
                          currentDir={memberSort.direction}
                          onSort={handleMemberSort}
                        />
                        {campaign.status === "completed" && (
                          <th className="pb-3 text-start">{t("members.review")}</th>
                        )}
                      </tr>
                      </thead>
                      <tbody>
                        {filteredMembers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={
                                8 +
                                (canManageCampaigns || canReviewCampaignContent
                                  ? 1
                                  : 0) +
                                (campaign.status === "completed" ? 1 : 0)
                              }
                              className="px-4 py-6 text-center text-sm text-muted-foreground"
                            >
                              {t("members.emptyFiltered")}
                            </td>
                          </tr>
                        ) : (
                          filteredMembers.map((m) => {
                        const name = m.profiles?.full_name || "";
                        const market = m.creator_profiles?.primary_market;
                        const platform = getPrimaryPlatform(m.creator_profiles);
                        const payStyle = paymentStatusStyles[m.payment_status] || "bg-muted text-foreground";
                        const payKey = paymentStatusKeys[m.payment_status] || "members.paymentStatus.pending";
                        const operations = memberOperationsById.get(m.id);
                        const agreementStatus =
                          agreementStatusByMemberId.get(m.id) ?? "not_required";
                        return (
                          <tr
                            key={m.id}
                            data-member-id={m.id}
                            data-testid="campaign-member-row"
                            className="border-b border-border/50 align-top last:border-0"
                          >
                            {(canManageCampaigns || canReviewCampaignContent) && (
                              <td className="py-3 ps-4 pe-2">
                                <input
                                  type="checkbox"
                                  data-testid="campaign-member-select"
                                  aria-label={t("members.bulk.selectCreator", {
                                    name: name || t("members.creator"),
                                  })}
                                  className="size-4 rounded border-border accent-slate-950"
                                  checked={selectedMemberSet.has(m.id)}
                                  onChange={(event) =>
                                    handleMemberSelection(
                                      m.id,
                                      event.target.checked,
                                    )
                                  }
                                />
                              </td>
                            )}
                            <td className="py-3 pe-4 ps-4">
                              <div className="flex items-center gap-2">
                                <Avatar className="size-7">
                                  {m.profiles?.avatar_url && (
                                    <AvatarImage src={m.profiles.avatar_url} />
                                  )}
                                  <AvatarFallback className="text-xs">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-foreground">{name}</span>
                              </div>
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              {market ? getMarketLabel(market, locale) : "-"}
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              {platform ? PLATFORM_LABELS[platform as Platform] || platform : "-"}
                            </td>
                            <td className="py-3 pe-4">
                              <AgreementStatusCell status={agreementStatus} />
                            </td>
                            <td className="py-3 pe-4">
                              <MemberStatusCell
                                testId="campaign-member-report-status"
                                label={operations?.reportLabel ?? t("reportStatus.none")}
                                detail={operations?.reportDetail ?? t("reportStatus.noTask")}
                                className={
                                  operations?.reportClassName ??
                                  "border-slate-200 bg-white text-muted-foreground"
                                }
                              />
                              {operations?.reportStatus === "missed" &&
                              operations.reportTaskId &&
                              canReviewCampaignContent && (
                                <div
                                  data-testid="campaign-member-operation-actions"
                                  className="mt-2 flex min-w-[224px] flex-nowrap gap-1.5"
                                >
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-testid="campaign-member-follow-up-report"
                                    className="h-7 whitespace-nowrap px-2 text-xs"
                                    disabled={
                                      operations.reportFollowUpSent ||
                                      actionLoading ===
                                      `report-task:${operations.reportTaskId}:follow-up`
                                    }
                                    onClick={() =>
                                      operations.reportTaskId
                                        ? handleRequestReportFollowUp(operations.reportTaskId)
                                        : undefined
                                    }
                                  >
                                    <Send className="size-3" aria-hidden="true" />
                                    {operations.reportFollowUpSent
                                      ? t("reportStatus.followUpSent")
                                      : actionLoading ===
                                        `report-task:${operations.reportTaskId}:follow-up`
                                        ? t("reportStatus.followingUp")
                                        : t("reportStatus.followUp")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-testid="campaign-member-excuse-report"
                                    className="h-7 whitespace-nowrap px-2 text-xs text-muted-foreground"
                                    disabled={
                                      actionLoading ===
                                      `report-task:${operations.reportTaskId}:excuse`
                                    }
                                    onClick={() =>
                                      operations.reportTaskId
                                        ? handleExcuseReportTask(operations.reportTaskId)
                                        : undefined
                                    }
                                  >
                                    {actionLoading ===
                                    `report-task:${operations.reportTaskId}:excuse`
                                      ? t("reportStatus.excusing")
                                      : t("reportStatus.markExcused")}
                                  </Button>
                                </div>
                              )}
                            </td>
                            <td className="py-3 pe-4">
                              <MemberStatusCell
                                testId="campaign-member-proof-status"
                                label={operations?.proofLabel ?? t("proofStatus.waiting")}
                                detail={operations?.proofDetail ?? t("proof.noFile")}
                                className={
                                  operations?.proofClassName ??
                                  "border-slate-200 bg-white text-muted-foreground"
                                }
                              />
                            </td>
                            <td className="py-3 pe-4 font-medium text-foreground">
                              {m.accepted_rate != null ? formatCurrency(m.accepted_rate, locale) : "-"}
                            </td>
                            <td className="py-3 pe-4">
                              <div className="flex min-w-[132px] flex-col items-start gap-1.5">
                                <MemberStatusCell
                                  testId="campaign-member-payment-status"
                                  label={t(payKey)}
                                  className={payStyle}
                                />
                                {canManageCampaigns && (
                                  <Select
                                    value={m.payment_status}
                                    disabled={
                                      actionLoading === `member-payment:${m.id}`
                                    }
                                    onValueChange={(status) =>
                                      handleMemberPaymentStatusChange(
                                        m.id,
                                        status as PaymentStatusType,
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      data-testid="campaign-member-payment-status-select"
                                      aria-label={t("members.paymentTrackingOnly")}
                                      className="h-7 w-[132px] rounded-lg px-2 text-xs"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                      {memberPaymentStatuses.map((status) => (
                                        <SelectItem
                                          key={status}
                                          value={status}
                                          data-testid={`campaign-member-payment-status-option-${status}`}
                                        >
                                          {t(paymentStatusKeys[status])}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </td>
                            {campaign.status === "completed" && (
                              <td className="py-3">
                                <ReviewDialog
                                  campaignId={campaign.id}
                                  revieweeId={m.creator_id}
                                  revieweeName={name}
                                >
                                  <Button variant="ghost" size="sm">
                                    <FileText className="me-1 size-3.5" />
                                    {t("members.review")}
                                  </Button>
                                </ReviewDialog>
                              </td>
                            )}
                          </tr>
                        );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          </section>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-5">
          <section
            data-testid="campaign-handoff-rail"
            className="rounded-xl border border-border bg-card p-3"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">
                  {t("handoff.title")}
                </h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <WorkstreamOwnerChip
                  ownerName={approvalsOwnerName}
                  testId="campaign-content-approval-owner"
                  t={t}
                  workstreamLabel={t("responsibility.approvals")}
                />
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    handoffSummary.blockedCount > 0
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-slate-50 text-muted-foreground"
                  }`}
                >
                  {handoffSummary.blockedCount > 0
                    ? t("handoff.blocked", {
                        count: String(handoffSummary.blockedCount),
                      })
                    : t("handoff.clear")}
                </span>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {handoffSummary.stages.map((stage) => {
                const stageMeta = handoffStagePresentation[stage.key];
                const StageIcon = stageMeta.icon;
                const stageClassName = `flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-start transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${handoffStageToneClassName[stage.tone]}`;
                const stageContent = (
                  <>
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${handoffStageIconClassName[stage.tone]}`}
                    >
                      <StageIcon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {t(stageMeta.labelKey)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t(stageMeta.detailKeys[stage.tone])}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {stage.value}
                    </span>
                  </>
                );

                if (stage.key === "proof") {
                  return (
                    <Link
                      key={stage.key}
                      href={`/b/campaigns/${campaign.id}/report`}
                      data-testid="campaign-handoff-stage"
                      data-handoff-stage={stage.key}
                      className={stageClassName}
                      aria-label={`${t(stageMeta.labelKey)} ${stage.value}`}
                    >
                      {stageContent}
                    </Link>
                  );
                }

                return (
                  <button
                    key={stage.key}
                    type="button"
                    data-testid="campaign-handoff-stage"
                    data-handoff-stage={stage.key}
                    className={stageClassName}
                    onClick={() => handleHandoffStageClick(stage.key)}
                  >
                    {stageContent}
                  </button>
                );
              })}
            </div>
          </section>

          {submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <ImageIcon className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("empty.noContent")}</p>
            </div>
          ) : (
            <Card data-testid="campaign-content-table">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
                <QueueFilterBar
                  ariaLabel={t("queueFilter.contentLabel")}
                  onChange={setContentQueueFilter}
                  options={contentQueueFilterOptions}
                  testId="campaign-content-queue-filters"
                  value={contentQueueFilter}
                />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {sortedFilteredSubmissions.length}
                </span>
              </CardHeader>
              {canReviewCampaignContent && !campaignAcceptsContentReviewDecisions && (
                <div
                  data-testid="campaign-content-read-only-stage"
                  className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground"
                >
                  {t("content.readOnlyStage")}
                </div>
              )}
              <CardContent className="p-0">
                {sortedFilteredSubmissions.length === 0 ? (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">
                    {t("queueFilter.emptyContent")}
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs font-medium text-muted-foreground">
                        <ContentSortableHead
                          label={t("members.creator")}
                          sortKey="creator"
                          currentKey={contentSort.key}
                          currentDir={contentSort.direction}
                          onSort={handleContentSort}
                        />
                        <ContentSortableHead
                          label={t("members.platform")}
                          sortKey="platform"
                          currentKey={contentSort.key}
                          currentDir={contentSort.direction}
                          onSort={handleContentSort}
                        />
                        <ContentSortableHead
                          label={tc("label.status")}
                          sortKey="status"
                          currentKey={contentSort.key}
                          currentDir={contentSort.direction}
                          onSort={handleContentSort}
                        />
                        <ContentSortableHead
                          label={t("content.submittedAt")}
                          sortKey="submitted"
                          currentKey={contentSort.key}
                          currentDir={contentSort.direction}
                          onSort={handleContentSort}
                        />
                        <ContentSortableHead
                          label={t("content.version")}
                          sortKey="version"
                          currentKey={contentSort.key}
                          currentDir={contentSort.direction}
                          onSort={handleContentSort}
                        />
                        <ContentSortableHead
                          label={t("content.proof")}
                          sortKey="proof"
                          currentKey={contentSort.key}
                          currentDir={contentSort.direction}
                          onSort={handleContentSort}
                        />
                        <th className="pb-3 text-start">{t("content.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredSubmissions.map((cs) => {
                        const creatorName = cs.campaign_members?.profiles?.full_name || "";
                        const creatorAvatar = cs.campaign_members?.profiles?.avatar_url;
                        const statusStyle =
                          submissionStatusStyles[cs.status] || "bg-muted text-foreground";
                        const statusKey = submissionStatusKeys[cs.status] || "status.pending";
                        const platformLabel = cs.platform
                          ? PLATFORM_LABELS[cs.platform as Platform] || cs.platform
                          : "-";
                        const revCount = cs.revision_count ?? 0;
                        const maxRev = campaign.max_revisions ?? 3;
                        const primaryContentUrl = cs.published_url || cs.content_url;
                        const primaryContentUrlLabelKey = cs.published_url
                          ? "content.liveUrl"
                          : "content.reviewLink";
                        const PrimaryContentUrlIcon = cs.published_url ? LinkIcon : Eye;
                        const isMissingLiveUrl =
                          cs.status === "approved" && !cs.published_url;
                        const proofPresentation = getSubmissionProofPresentation({
                          evidenceRows,
                          submission: cs,
                          t,
                        });
                        const liveUrlPresentation = cs.published_url
                          ? {
                              label: t("content.liveUrl"),
                              detail: t("content.handoffLiveUrlSaved"),
                              className: "border-slate-200 bg-slate-50 text-muted-foreground",
                            }
                          : isMissingLiveUrl
                            ? {
                                label: t("content.liveUrlMissing"),
                                detail: t("content.handoffLiveUrlNeeded"),
                                className: "border-amber-200 bg-amber-50 text-amber-900",
                              }
                            : {
                                label: t("proofStatus.waiting"),
                                detail: t("content.handoffLiveUrlAfterApproval"),
                                className: "border-slate-200 bg-white text-muted-foreground",
                              };

                        return (
                          <tr
                            key={cs.id}
                            className="border-b border-border/50 align-top last:border-0"
                          >
                            <td className="py-3 pe-4 ps-4">
                              <div className="flex min-w-44 items-center gap-2">
                                <Avatar className="size-7">
                                  {creatorAvatar && <AvatarImage src={creatorAvatar} />}
                                  <AvatarFallback className="text-xs">
                                    {getInitials(creatorName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {creatorName}
                                  </p>
                                  {cs.caption && (
                                    <p className="max-w-72 truncate text-xs text-muted-foreground">
                                      {cs.caption}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pe-4">
                              <div className="flex min-w-36 flex-col gap-1.5">
                                <span className="text-muted-foreground">
                                  {platformLabel}
                                </span>
                                {primaryContentUrl ? (
                                  <a
                                    data-testid="campaign-content-primary-url"
                                    href={primaryContentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-52 items-center gap-1.5 truncate text-xs font-medium text-foreground hover:text-slate-700"
                                  >
                                    <PrimaryContentUrlIcon
                                      className="size-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate">
                                      {t(primaryContentUrlLabelKey)}
                                    </span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {t("content.noUrl")}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pe-4">
                              <div
                                className="grid min-w-[22rem] grid-cols-3 gap-1.5"
                                data-testid="campaign-content-handoff-grid"
                              >
                                <div
                                  className="min-w-0 rounded-lg border border-border bg-card px-2 py-1.5"
                                  data-testid="campaign-content-handoff-stage"
                                  data-handoff-stage="draft"
                                >
                                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                                    {t("content.handoffDraft")}
                                  </p>
                                  <span
                                    className={`mt-1 inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}
                                  >
                                    <span className="truncate">{tc(statusKey)}</span>
                                  </span>
                                </div>
                                <div
                                  className="min-w-0 rounded-lg border border-border bg-card px-2 py-1.5"
                                  data-testid="campaign-content-handoff-stage"
                                  data-handoff-stage="liveUrl"
                                >
                                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                                    {t("content.handoffLiveUrl")}
                                  </p>
                                  <MemberStatusCell
                                    testId="campaign-content-live-url-status"
                                    label={liveUrlPresentation.label}
                                    detail={liveUrlPresentation.detail}
                                    className={liveUrlPresentation.className}
                                  />
                                </div>
                                <div
                                  className="min-w-0 rounded-lg border border-border bg-card px-2 py-1.5"
                                  data-testid="campaign-content-handoff-stage"
                                  data-handoff-stage="proof"
                                >
                                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                                    {t("content.handoffProof")}
                                  </p>
                                  <MemberStatusCell
                                    testId="campaign-content-proof-status"
                                    label={proofPresentation.label}
                                    detail={proofPresentation.detail}
                                    className={proofPresentation.className}
                                  />
                                </div>
                              </div>
                              {isMissingLiveUrl && (
                                <p
                                  data-testid="campaign-content-missing-live-url"
                                  className="mt-1 max-w-44 text-xs text-amber-700"
                                >
                                  {t("content.liveUrlMissing")}
                                </p>
                              )}
                              {cs.feedback && cs.status === "revision_requested" && (
                                <p className="mt-1 max-w-56 truncate text-xs text-amber-700">
                                  {cs.feedback}
                                </p>
                              )}
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              {cs.submitted_at ? timeAgo(cs.submitted_at, tc, locale) : "-"}
                              {cs.status === "approved" && cs.reviewed_at && (
                                <p className="mt-1 whitespace-nowrap text-xs text-emerald-700">
                                  {t("content.approvedOn", {
                                    date: new Date(cs.reviewed_at).toLocaleDateString(locale, {
                                      month: "short",
                                      day: "numeric",
                                    }),
                                  })}
                                </p>
                              )}
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              <span className="font-medium text-foreground">
                                v{cs.version}
                              </span>
                              {revCount > 0 && (
                                <p className="mt-1 whitespace-nowrap text-xs">
                                  {t("content.revisionCount", {
                                    current: String(revCount),
                                    max: String(maxRev),
                                  })}
                                </p>
                              )}
                            </td>
                            <td className="py-3 pe-4">
                              <MemberStatusCell
                                testId="campaign-content-proof-sort-status"
                                label={proofPresentation.label}
                                detail={proofPresentation.detail}
                                className={proofPresentation.className}
                              />
                            </td>
                            <td className="py-3 pe-4">
                              {cs.status === "submitted" && canReviewCampaignContent && campaignAcceptsContentReviewDecisions ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    data-testid="campaign-content-request-revision"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => {
                                      setRevisionDialog(cs.id);
                                      setRevisionFeedback("");
                                    }}
                                  >
                                    <RotateCcw className="size-3" aria-hidden="true" />
                                    {t("content.revise")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    data-testid="campaign-content-approve"
                                    className="h-7 px-2 text-xs"
                                    disabled={actionLoading === cs.id}
                                    onClick={() => handleApproveContent(cs.id)}
                                  >
                                    <CheckCircle className="size-3" aria-hidden="true" />
                                    {actionLoading === cs.id
                                      ? t("content.approving")
                                      : t("content.approve")}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t("content.noAction")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reporting" className="space-y-5">
          {reportTasks.length > 0 && (
            <Card data-testid="campaign-reporting-schedule">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {t("reporting.scheduleTitle")}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("reporting.scheduleDetail")}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {formatBrandReportTaskCount(reportTasks.length, t)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-2 pb-1">
                    {reportTasks.map((task) => {
                      const member =
                        members.find((m) => m.id === task.campaign_member_id) ?? null;
                      const creatorName =
                        member?.profiles?.full_name ??
                        t("reporting.scheduleCreatorFallback");

                      return (
                        <div
                          key={task.id}
                          data-testid="campaign-reporting-schedule-item"
                          className="w-56 shrink-0 rounded-lg border border-border/80 bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {t(getBrandReportTaskLabelKey(task.task_key))}
                              </p>
                              <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                                {formatBrandReportTaskWindow(task, locale, t)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${getBrandReportTaskStatusClassName(
                                task.status,
                              )}`}
                            >
                              {t(getBrandReportTaskStatusKey(task.status))}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{creatorName}</span>
                            <span className="shrink-0">
                              {t("reporting.scheduleDue", {
                                date: formatShortDate(task.due_at, locale),
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div
            data-testid="campaign-reporting-operations"
            className="rounded-xl border border-border bg-card p-3"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">
                  {t("section.reportingOperations")}
                </h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <WorkstreamOwnerChip
                  ownerName={reportingOwnerName}
                  testId="campaign-reporting-owner"
                  t={t}
                  workstreamLabel={t("responsibility.reporting")}
                />
                <Link
                  href={`/b/campaigns/${campaign.id}/report`}
                  data-testid="campaign-reporting-report-link"
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {t("action.viewReport")}
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {reportingOperations.map((operation) => {
                const Icon = operation.icon;
                const hasActionableWork = operation.actionCount > 0;
                const body = (
                  <>
                    <Icon
                      className={`size-3.5 shrink-0 ${operation.className}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {operation.value}
                        </span>
                        <span className="truncate text-xs font-medium text-foreground">
                          {operation.label}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {operation.detail}
                      </p>
                    </div>
                  </>
                );
                const cardClassName =
                  hasActionableWork
                    ? operation.key === "toReview"
                      ? "flex min-w-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-start"
                      : "flex min-w-0 items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-start"
                    : "flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-start";

                if (
                  hasActionableWork &&
                  (operation.key === "corrections" ||
                    operation.key === "toReview" ||
                    operation.key === "missed")
                ) {
                  return (
                    <button
                      key={operation.key}
                      type="button"
                      data-testid="campaign-reporting-operation-action"
                      data-operation-key={operation.key}
                      onClick={() => handleOperationCardClick(operation.key)}
                      className={`${cardClassName} transition-colors hover:border-slate-300 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                    >
                      {body}
                    </button>
                  );
                }

                return (
                  <div
                    key={operation.key}
                    data-testid="campaign-reporting-operation-card"
                    data-operation-key={operation.key}
                    className={cardClassName}
                  >
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
          <Card data-testid="campaign-reporting-proof-queue">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">{t("reporting.queueTitle")}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("reporting.queueDetail")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <QueueFilterBar
                  ariaLabel={t("queueFilter.reportingLabel")}
                  onChange={setReportingQueueFilter}
                  options={reportingQueueFilterOptions}
                  testId="campaign-reporting-proof-filters"
                  value={reportingQueueFilter}
                />
                <WorkstreamOwnerChip
                  ownerName={reportingOwnerName}
                  testId="campaign-reporting-proof-queue-owner"
                  t={t}
                  workstreamLabel={t("responsibility.reporting")}
                />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {sortedFilteredReportingQueueRows.length}
                </span>
              </div>
            </CardHeader>
            {canReviewCampaignContent && !campaignAcceptsProofReviewDecisions && (
              <div
                data-testid="campaign-reporting-read-only-stage"
                className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground"
              >
                {t("reporting.readOnlyStage")}
              </div>
            )}
            <div
              data-testid="campaign-reporting-proof-report-goal"
              className="mx-4 mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
            >
              <p className="font-semibold text-foreground">
                {t("reporting.reportGoal.title")}
              </p>
              <p className="mt-0.5 leading-relaxed text-muted-foreground">
                {t("reporting.reportGoal.detail", {
                  goal: t(reportGoalContext.titleKey),
                  blocks: reportGoalContext.blockLabelKeys
                    .map((blockLabelKey) => t(blockLabelKey))
                    .join(", "),
                })}
              </p>
            </div>
            <CardContent className="p-0">
              {sortedFilteredReportingQueueRows.length === 0 ? (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  {reportingQueueRows.length === 0
                    ? t("reporting.queueEmpty")
                    : t("queueFilter.emptyReporting")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs font-medium text-muted-foreground">
                        <ReportingQueueSortableHead
                          label={t("members.creator")}
                          sortKey="creator"
                          currentKey={reportingQueueSort.key}
                          currentDir={reportingQueueSort.direction}
                          onSort={handleReportingQueueSort}
                        />
                        <ReportingQueueSortableHead
                          label={t("members.platform")}
                          sortKey="platform"
                          currentKey={reportingQueueSort.key}
                          currentDir={reportingQueueSort.direction}
                          onSort={handleReportingQueueSort}
                        />
                        <ReportingQueueSortableHead
                          label={tc("label.status")}
                          sortKey="status"
                          currentKey={reportingQueueSort.key}
                          currentDir={reportingQueueSort.direction}
                          onSort={handleReportingQueueSort}
                        />
                        <ReportingQueueSortableHead
                          label={t("reporting.submitted")}
                          sortKey="submitted"
                          currentKey={reportingQueueSort.key}
                          currentDir={reportingQueueSort.direction}
                          onSort={handleReportingQueueSort}
                        />
                        <ReportingQueueSortableHead
                          label={t("reporting.evidence")}
                          sortKey="evidence"
                          currentKey={reportingQueueSort.key}
                          currentDir={reportingQueueSort.direction}
                          onSort={handleReportingQueueSort}
                        />
                        <th className="pb-3 text-start">{t("members.review")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredReportingQueueRows.map((row) => {
                        const followUpKey = `report-task:${row.task.id}:follow-up`;
                        const excuseKey = `report-task:${row.task.id}:excuse`;
                        const reviewableProof = row.reviewableEvidence
                          ? {
                              kind: "evidence" as const,
                              id: row.reviewableEvidence.id,
                              url: row.reviewableEvidence.signed_url,
                            }
                          : row.reviewablePerformance
                            ? {
                                kind: "performance" as const,
                                id: row.reviewablePerformance.id,
                                url: row.reviewablePerformance.screenshot_url,
                              }
                            : null;
                        const needsReportReview = Boolean(reviewableProof);
                        const isCorrectionWaiting = row.task.status === "needs_revision";
                        const verifyKey = reviewableProof
                          ? `${reviewableProof.kind}:${reviewableProof.id}:verify`
                          : "";
                        const correctionKey = reviewableProof
                          ? `${reviewableProof.kind}:${reviewableProof.id}:correction`
                          : "";
                        const proofReviewWaitingAge =
                          row.submittedAt &&
                          (row.queueState === "review" ||
                            row.queueState === "correction_returned")
                            ? timeAgo(row.submittedAt, tc, locale)
                            : null;

                        return (
                          <tr
                            key={row.rowId}
                            data-testid="campaign-reporting-proof-row"
                            data-evidence-id={row.currentEvidence?.id ?? undefined}
                            data-performance-id={row.currentPerformance?.id ?? undefined}
                            className="border-b border-border/50 align-top last:border-0"
                          >
                            <td className="py-3 pe-4 ps-4">
                              <div className="flex min-w-44 items-center gap-2">
                                <Avatar className="size-7">
                                  {row.avatarUrl && <AvatarImage src={row.avatarUrl} />}
                                  <AvatarFallback className="text-xs">
                                    {getInitials(row.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-foreground">
                                  {row.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              {row.platformLabel}
                            </td>
                            <td className="py-3 pe-4">
                              <MemberStatusCell
                                testId="campaign-reporting-proof-status"
                                label={row.statusPresentation.label}
                                detail={
                                  row.task.review_note ||
                                  (row.queueState === "metrics_only"
                                    ? t("proofStatus.metricsOnlyDetail")
                                    : undefined) ||
                                  (row.task.status === "missed"
                                    ? formatShortDate(row.task.due_at, locale)
                                    : undefined)
                                }
                                className={row.statusPresentation.className}
                              />
                            </td>
                            <td className="py-3 pe-4 text-muted-foreground">
                              {row.submittedAt ? timeAgo(row.submittedAt, tc, locale) : "-"}
                            </td>
                            <td
                              data-testid="campaign-reporting-proof-evidence"
                              className="py-3 pe-4 text-muted-foreground"
                            >
                              <span
                                className="block max-w-48 truncate"
                                title={row.evidenceLabel}
                              >
                                {row.evidenceLabel}
                              </span>
                              <div
                                data-testid="campaign-reporting-proof-impact"
                                className="mt-1 flex max-w-56 flex-wrap items-center gap-1.5 text-[11px]"
                              >
                                <span className="font-medium text-muted-foreground">
                                  {t("reporting.impact")}
                                </span>
                                <span
                                  className={`inline-flex whitespace-nowrap rounded-full border px-1.5 py-0.5 font-medium ${row.reportImpactPresentation.className}`}
                                >
                                  {row.reportImpactPresentation.label}
                                </span>
                              </div>
                              {proofReviewWaitingAge ? (
                                <div
                                  data-testid="campaign-reporting-proof-review-age"
                                  data-proof-waiting-state="waiting"
                                  className="mt-1 flex max-w-56 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"
                                >
                                  <span className="font-medium">
                                    {t("proofStatus.waiting")}
                                  </span>
                                  <span>{proofReviewWaitingAge}</span>
                                </div>
                              ) : null}
                            </td>
                            <td className="py-3 pe-4">
                              {needsReportReview && canReviewCampaignContent && campaignAcceptsProofReviewDecisions ? (
                                <div className="flex min-w-[300px] flex-nowrap items-center gap-1.5">
                                  {reviewableProof?.url ? (
                                    <a
                                      href={reviewableProof.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      data-testid="campaign-reporting-open-proof"
                                      className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                      {t("reporting.openProof")}
                                    </a>
                                  ) : (
                                    <span
                                      data-testid="campaign-reporting-open-proof"
                                      className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-muted/30 px-2 text-xs font-medium text-muted-foreground"
                                    >
                                      {t("reporting.openProof")}
                                    </span>
                                  )}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-testid="campaign-reporting-verify-proof"
                                    className="h-7 whitespace-nowrap px-2 text-xs"
                                    disabled={
                                      !reviewableProof ||
                                      actionLoading === verifyKey
                                    }
                                    onClick={() => {
                                      if (!reviewableProof) return;
                                      if (reviewableProof.kind === "evidence") {
                                        void handleVerifyPerformanceEvidence(
                                          reviewableProof.id,
                                        );
                                        return;
                                      }
                                      void handleVerifyPerformanceProofLink(
                                        reviewableProof.id,
                                      );
                                    }}
                                  >
                                    {actionLoading === verifyKey
                                      ? t("reporting.verifyingProof")
                                      : t("reporting.verifyProof")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-testid="campaign-reporting-request-correction"
                                    className="h-7 whitespace-nowrap px-2 text-xs text-muted-foreground"
                                    disabled={
                                      !reviewableProof ||
                                      actionLoading === correctionKey
                                    }
                                    onClick={() => {
                                      if (!reviewableProof) return;
                                      setProofCorrectionDialog({
                                        proofKind: reviewableProof.kind,
                                        proofId: reviewableProof.id,
                                        reportTaskId: row.task.id,
                                        creatorName: row.name,
                                      });
                                      setProofCorrectionNote("");
                                    }}
                                  >
                                    {t("reporting.requestCorrection")}
                                  </Button>
                                </div>
                              ) : row.currentEvidence?.signed_url ? (
                                <a
                                  href={row.currentEvidence.signed_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  data-testid="campaign-reporting-open-proof"
                                  className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                  {t("reporting.openProof")}
                                </a>
                              ) : row.currentPerformance?.screenshot_url?.startsWith("http") ? (
                                <a
                                  href={row.currentPerformance.screenshot_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  data-testid="campaign-reporting-open-proof"
                                  className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                  {t("reporting.openProof")}
                                </a>
                              ) : row.queueState === "metrics_only" ? (
                                <span
                                  data-testid="campaign-reporting-proof-action"
                                  className="text-xs text-muted-foreground"
                                >
                                  {t("proofStatus.metricsOnlyAction")}
                                </span>
                              ) : isCorrectionWaiting ? (
                                <span
                                  data-testid="campaign-reporting-proof-action"
                                  className="text-xs text-muted-foreground"
                                >
                                  {t("reporting.waitingOnCreator")}
                                </span>
                              ) : row.task.status === "missed" && canReviewCampaignContent && campaignAcceptsProofReviewDecisions ? (
                                <div className="flex min-w-[224px] flex-nowrap gap-1.5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-testid="campaign-reporting-follow-up-missed"
                                    className="h-7 whitespace-nowrap px-2 text-xs"
                                    disabled={actionLoading === followUpKey}
                                    onClick={() => handleRequestReportFollowUp(row.task.id)}
                                  >
                                    <Send className="size-3" aria-hidden="true" />
                                    {actionLoading === followUpKey
                                      ? t("reportStatus.followingUp")
                                      : t("reportStatus.followUp")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    data-testid="campaign-reporting-mark-excused"
                                    className="h-7 whitespace-nowrap px-2 text-xs text-muted-foreground"
                                    disabled={actionLoading === excuseKey}
                                    onClick={() => handleExcuseReportTask(row.task.id)}
                                  >
                                    {actionLoading === excuseKey
                                      ? t("reportStatus.excusing")
                                      : t("reportStatus.markExcused")}
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  data-testid="campaign-reporting-proof-action"
                                  className="text-xs text-muted-foreground"
                                >
                                  {t("content.noAction")}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Counter-Offer Dialog */}
      {counterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">{t("applicants.counterTitle")}</h3>
            <div className="space-y-4">
              <div>
                <Label>{t("applicants.counterRate")}</Label>
                <Input
                  type="number"
                  value={counterRate}
                  onChange={(e) => setCounterRate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>{t("applicants.counterMessage")}</Label>
                <Textarea
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setCounterDialog(null)}>
                  {tc("action.cancel")}
                </Button>
                <Button
                  onClick={handleCounter}
                  disabled={
                    !counterRate ||
                    actionLoading === getApplicationActionKey(counterDialog, "counter")
                  }
                >
                  {actionLoading === getApplicationActionKey(counterDialog, "counter")
                    ? t("applicants.counterSending")
                    : t("applicants.counterSubmit")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Dialog */}
      {revisionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-foreground">{t("content.revisionTitle")}</h3>
            <div className="space-y-4">
              <div>
                <Label>{t("content.revisionFeedback")}</Label>
                <Textarea
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  placeholder={t("content.revisionPlaceholder")}
                  rows={4}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setRevisionDialog(null)}>
                  {tc("action.cancel")}
                </Button>
                <Button
                  onClick={handleRequestRevision}
                  disabled={!revisionFeedback.trim() || actionLoading === revisionDialog}
                >
                  {actionLoading === revisionDialog ? t("content.revisionSending") : t("content.revisionSubmit")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {proofCorrectionDialog && (
        <div
          data-testid="campaign-reporting-correction-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              {t("reporting.correctionTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("reporting.correctionDetail", {
                creator: proofCorrectionDialog.creatorName,
              })}
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="reporting-correction-note">
                  {t("reporting.correctionNote")}
                </Label>
                <Textarea
                  id="reporting-correction-note"
                  data-testid="campaign-reporting-correction-note"
                  value={proofCorrectionNote}
                  onChange={(event) => setProofCorrectionNote(event.target.value)}
                  placeholder={t("reporting.correctionPlaceholder")}
                  rows={4}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setProofCorrectionDialog(null);
                    setProofCorrectionNote("");
                  }}
                >
                  {tc("action.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleRequestPerformanceCorrection}
                  disabled={
                    !proofCorrectionNote.trim() ||
                    actionLoading ===
                      `${proofCorrectionDialog.proofKind}:${proofCorrectionDialog.proofId}:correction`
                  }
                >
                  {actionLoading ===
                  `${proofCorrectionDialog.proofKind}:${proofCorrectionDialog.proofId}:correction`
                    ? t("reporting.requestingCorrection")
                    : t("reporting.sendCorrection")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
