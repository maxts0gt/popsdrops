import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getUser } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import {
  formatBudgetRange,
  formatCurrency,
  CAMPAIGN_STATUS_LABELS,
  getMarketLabel,
  getPlatformLabel,
} from "@/lib/constants";
import { getAdminAuditActionLabel } from "@/lib/admin/audit-action-labels";
import { getCampaignPaidCreatorCapacity } from "@/lib/campaign-service-packages";
import { getCampaignCreatorInviteSendCapacityState } from "@/lib/campaigns/creator-invite-capacity";
import { getCurrentEvidenceReviewRows } from "@/lib/reporting/evidence-review";
import {
  excuseAdminReportTask,
  recordAdminProofReviewIntervention,
  retryAdminReportExportJob,
} from "@/app/actions/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationStatus,
  CampaignAssetStatus,
  CampaignAssetVisibility,
  CampaignModeType,
  CampaignReportTaskStatus,
  CampaignStatus,
  PaymentStatusType,
  PerformanceEvidenceVerificationStatus,
  PlatformType,
  SubmissionStatus,
} from "@/types/database";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  focus?: string | string[];
}>;
type AdminCampaignFocus = "finance" | "launch" | "reporting" | "operations" | null;

type CampaignRow = {
  id: string;
  brand_id: string;
  title: string;
  status: CampaignStatus;
  campaign_mode: CampaignModeType;
  platforms: PlatformType[];
  markets: string[];
  niches: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  max_creators: number | null;
  total_spend: number;
  service_fee_cents: number;
  service_fee_currency: string;
  service_fee_status: PaymentStatusType;
  service_fee_checkout_session_id: string | null;
  service_fee_payment_intent_id: string | null;
  service_fee_charge_id: string | null;
  service_fee_last_event_id: string | null;
  service_fee_last_event_type: string | null;
  service_fee_last_event_at: string | null;
  service_fee_paid_at: string | null;
  service_fee_failed_at: string | null;
  service_fee_refunded_at: string | null;
  service_fee_disputed_at: string | null;
  service_package_snapshot: Record<string, unknown> | null;
  application_deadline: string | null;
  content_due_date: string | null;
  performance_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  monitoring_end_date: string | null;
  usage_rights_duration: string | null;
  usage_rights_territory: string | null;
  usage_rights_paid_ads: boolean;
  max_revisions: number;
  brief_description: string | null;
  brief_requirements: string | null;
  compliance_notes: string | null;
  created_at: string;
  updated_at: string;
};

type BrandProfileRow = {
  company_name: string;
  industry: string | null;
  website: string | null;
  preferred_language: string;
  contact_name: string | null;
  contact_email: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  avatar_url: string | null;
};

type CreatorProfileRow = {
  profile_id: string;
  primary_market: string | null;
  platforms: string[];
  niches: string[];
  rating: number;
  tier: string;
  profile_completeness: number;
};

type ApplicationRow = {
  id: string;
  creator_id: string;
  status: ApplicationStatus;
  proposed_rate: number | null;
  pitch: string | null;
  created_at: string;
};

type MemberRow = {
  id: string;
  creator_id: string;
  accepted_rate: number | null;
  payment_status: PaymentStatusType;
  joined_at: string;
};

type SubmissionRow = {
  id: string;
  campaign_member_id: string;
  status: SubmissionStatus;
  platform: PlatformType | null;
  content_url: string | null;
  published_url: string | null;
  version: number;
  revision_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
};

type ReportTaskRow = {
  id: string;
  campaign_member_id: string;
  due_at: string;
  status: CampaignReportTaskStatus;
  submitted_at: string | null;
  missed_at: string | null;
  excused_at: string | null;
  review_note: string | null;
};

type EvidenceRow = {
  id: string;
  campaign_member_id: string;
  file_name: string | null;
  report_task_id: string;
  submission_id: string | null;
  performance_id: string | null;
  verification_status: PerformanceEvidenceVerificationStatus;
  review_note: string | null;
  created_at: string;
};

type ReportExportJobRow = {
  id: string;
  campaign_id: string;
  created_at: string;
  error_message: string | null;
  file_name: string | null;
  format: "json" | "csv" | "html";
  status: string;
};

type AssetRow = {
  id: string;
  title: string;
  asset_type: string;
  visibility: CampaignAssetVisibility;
  status: CampaignAssetStatus;
  created_at: string;
};

type AgreementRow = {
  id: string;
  title: string;
  version: number;
  status: string;
  gate_mode: string;
  requires_typed_name: boolean;
  published_at: string | null;
};

type AuditEntryRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PaymentEventRow = {
  id: string;
  event_id: string;
  event_type: string;
  service_fee_status: PaymentStatusType | null;
  checkout_session_id: string | null;
  event_summary: Record<string, unknown> | null;
  payment_intent_id: string | null;
  charge_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  received_at: string;
};

type CreatorInviteRow = {
  id: string;
  contact_type: string;
  contact_value: string;
  normalized_contact: string | null;
  status: string | null;
  invited_at: string | null;
};

type AdminCampaignDetail = {
  campaign: CampaignRow;
  brandProfile: BrandProfileRow | null;
  brandUser: ProfileRow | null;
  applications: ApplicationRow[];
  members: MemberRow[];
  creatorProfiles: Map<string, CreatorProfileRow>;
  creatorUsers: Map<string, ProfileRow>;
  submissions: SubmissionRow[];
  reportTasks: ReportTaskRow[];
  evidenceRows: EvidenceRow[];
  reportExportJobs: ReportExportJobRow[];
  assets: AssetRow[];
  agreements: AgreementRow[];
  auditEntries: AuditEntryRow[];
  creatorInvites: CreatorInviteRow[];
  paymentEvents: PaymentEventRow[];
};

type CurrentEvidenceReviewStatus =
  | "correction"
  | "correction_returned"
  | "evidence_review";

type CurrentEvidenceReviewRow = {
  evidence: EvidenceRow;
  hasReturnedCorrection: boolean;
  status: CurrentEvidenceReviewStatus;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const submissionStatusLabels: Record<SubmissionStatus, string> = {
  approved: "Approved",
  draft: "Draft",
  published: "Published",
  revision_requested: "Revision requested",
  submitted: "Submitted",
};

const paymentExceptionStatuses = new Set<PaymentStatusType>([
  "failed",
  "refunded",
  "disputed",
  "overdue",
]);
const REVIEW_SLA_MS = 24 * 60 * 60 * 1000;

function countBy<T extends string>(values: readonly T[]) {
  return values.reduce(
    (counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    },
    {} as Record<T, number>,
  );
}

function statusCount<T extends string>(counts: Partial<Record<T, number>>, key: T) {
  return counts[key] ?? 0;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function isReportReviewSlaBreached(value: string, now = Date.now()) {
  const createdAt = new Date(value).getTime();
  return Number.isFinite(createdAt) && now - createdAt >= REVIEW_SLA_MS;
}

function formatServiceFee(cents: number, currency: string) {
  return formatCurrency(cents / 100, "en", currency.toUpperCase());
}

function labelFromValue(value: string) {
  const words = value
    .split("_")
    .filter(Boolean)
    .map((part) => part.toLowerCase());

  return words
    .map((part, index) =>
      index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

function badgeClassForTone(tone: "neutral" | "good" | "warning" | "danger") {
  if (tone === "good") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-white text-muted-foreground";
}

function paymentTone(status: PaymentStatusType) {
  if (status === "paid") return "good";
  if (isServiceFeeException(status)) {
    return "danger";
  }
  if (status === "invoiced") return "warning";
  return "neutral";
}

function isServiceFeeException(status: PaymentStatusType) {
  return paymentExceptionStatuses.has(status);
}

function getServiceFeeEventDate(campaign: CampaignRow) {
  if (campaign.service_fee_status === "paid") {
    return campaign.service_fee_paid_at ?? campaign.service_fee_last_event_at;
  }
  if (campaign.service_fee_status === "failed") {
    return campaign.service_fee_failed_at ?? campaign.service_fee_last_event_at;
  }
  if (campaign.service_fee_status === "refunded") {
    return campaign.service_fee_refunded_at ?? campaign.service_fee_last_event_at;
  }
  if (campaign.service_fee_status === "disputed") {
    return campaign.service_fee_disputed_at ?? campaign.service_fee_last_event_at;
  }
  return campaign.service_fee_last_event_at;
}

function getServiceFeeAdminAction(status: PaymentStatusType) {
  if (status === "failed" || status === "overdue") {
    return "Brand retry checkout";
  }
  if (status === "refunded") {
    return "Confirm refund reason, then ask brand to pay again";
  }
  if (status === "disputed") {
    return "Review Stripe dispute before unlocking campaign";
  }
  return "Monitor service fee";
}

function isServiceFeeBlockingCampaign(
  campaign: Pick<CampaignRow, "service_fee_cents" | "service_fee_status">,
) {
  const serviceFeeRequired = (campaign.service_fee_cents ?? 0) > 0;
  return serviceFeeRequired && campaign.service_fee_status !== "paid";
}

function reportTaskTone(status: CampaignReportTaskStatus) {
  if (status === "missed") return "danger";
  if (status === "needs_revision") return "warning";
  if (status === "verified") return "good";
  return "neutral";
}

function getAdminCampaignFocus(params: Awaited<SearchParams>): AdminCampaignFocus {
  const value = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  if (
    value === "finance" ||
    value === "launch" ||
    value === "reporting" ||
    value === "operations"
  ) {
    return value;
  }
  return null;
}

function reportTaskLabel(status: CampaignReportTaskStatus) {
  if (status === "needs_revision") return "Needs correction";
  return labelFromValue(status);
}

function reportExportFormatLabel(format: ReportExportJobRow["format"]) {
  return format.toUpperCase();
}

function getReportInterventionReason(entry: AuditEntryRow) {
  const reason = entry.metadata?.reason;
  if (typeof reason === "string" && reason.trim().length > 0) {
    return reason.trim();
  }

  if (
    entry.action === "retry_report_export" &&
    typeof entry.metadata?.new_job_id === "string"
  ) {
    return `Created replacement export ${entry.metadata.new_job_id}.`;
  }

  return null;
}

function isEvidenceVisibleInReport(evidence: EvidenceRow) {
  return Boolean(evidence.performance_id);
}

function getReportCorrectionEvidence(
  task: ReportTaskRow,
  evidenceRows: EvidenceRow[],
) {
  const taskEvidenceRows = evidenceRows.filter(
    (evidence) => evidence.report_task_id === task.id,
  );
  const visibleEvidenceRows = taskEvidenceRows.filter(isEvidenceVisibleInReport);

  return (
    visibleEvidenceRows.find(
      (evidence) => evidence.verification_status === "rejected",
    ) ??
    visibleEvidenceRows.find(
      (evidence) => evidence.verification_status === "submitted",
    ) ??
    visibleEvidenceRows[0] ??
    taskEvidenceRows.find(
      (evidence) => evidence.verification_status === "rejected",
    ) ??
    taskEvidenceRows.find(
      (evidence) => evidence.verification_status === "submitted",
    ) ??
    taskEvidenceRows[0] ??
    null
  );
}

function evidenceReviewKey(row: EvidenceRow) {
  return `${row.report_task_id}:${row.campaign_member_id}`;
}

function getCurrentAdminEvidenceReviewRows(
  evidenceRows: EvidenceRow[],
): CurrentEvidenceReviewRow[] {
  return getCurrentEvidenceReviewRows(
    evidenceRows.map((row) => ({
      ...row,
      groupId: evidenceReviewKey(row),
      status: row.verification_status,
    })),
  ).map((entry) => ({
    evidence: entry.row,
    hasReturnedCorrection: entry.hasReturnedCorrection,
    status: entry.status,
  }));
}

function getNextAction(detail: AdminCampaignDetail) {
  const pendingApplications = detail.applications.filter(
    (application) => application.status === "pending",
  ).length;
  const pendingSubmissions = detail.submissions.filter(
    (submission) => submission.status === "submitted",
  ).length;
  const missedReports = detail.reportTasks.filter(
    (task) => task.status === "missed",
  ).length;
  const currentEvidenceRows = getCurrentAdminEvidenceReviewRows(detail.evidenceRows);
  const rejectedEvidence = currentEvidenceRows.filter(
    (row) => row.status === "correction",
  ).length;
  const returnedCorrections = currentEvidenceRows.filter(
    (row) => row.status === "correction_returned",
  ).length;
  const failedReportExports = detail.reportExportJobs.length;

  if (detail.campaign.service_fee_status === "overdue") {
    return {
      detail: "Service fee needs collection follow-up.",
      label: "Collect service fee",
      tone: "danger" as const,
    };
  }

  if (isServiceFeeBlockingCampaign(detail.campaign)) {
    return {
      detail: `${labelFromValue(detail.campaign.service_fee_status)} service fee blocks the invite link and launch actions.`,
      label: "Resolve service fee before sharing",
      tone: "warning" as const,
    };
  }

  if (missedReports > 0) {
    return {
      detail: `${missedReports} report task${missedReports === 1 ? "" : "s"} missed.`,
      label: "Follow up on reporting",
      tone: "danger" as const,
    };
  }

  if (failedReportExports > 0) {
    return {
      detail: `${failedReportExports} leadership report export${failedReportExports === 1 ? "" : "s"} failed before delivery.`,
      label: "Retry failed report export",
      tone: "danger" as const,
    };
  }

  if (rejectedEvidence > 0) {
    return {
      detail: `${rejectedEvidence} proof item${rejectedEvidence === 1 ? "" : "s"} needs correction.`,
      label: "Resolve evidence",
      tone: "warning" as const,
    };
  }

  if (returnedCorrections > 0) {
    return {
      detail: `${returnedCorrections} corrected proof item${returnedCorrections === 1 ? "" : "s"} waiting for brand review.`,
      label: "Review returned correction",
      tone: "warning" as const,
    };
  }

  if (pendingSubmissions > 0) {
    return {
      detail: `${pendingSubmissions} content submission${pendingSubmissions === 1 ? "" : "s"} waiting for brand review.`,
      label: "Review content queue",
      tone: "warning" as const,
    };
  }

  if (pendingApplications > 0) {
    return {
      detail: `${pendingApplications} creator application${pendingApplications === 1 ? "" : "s"} waiting.`,
      label: "Review applicants",
      tone: "warning" as const,
    };
  }

  return {
    detail: "Campaign setup, creator work, and reporting are clear.",
    label: "No blockers",
    tone: "good" as const,
  };
}

async function assertAdmin() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") notFound();
}

async function loadReportInterventionAuditEntries(
  reportTasks: ReportTaskRow[],
  reportExportJobs: ReportExportJobRow[],
  evidenceRows: EvidenceRow[],
): Promise<AuditEntryRow[]> {
  const reportTaskIds = reportTasks.map((task) => task.id);
  const reportExportJobIds = reportExportJobs.map((job) => job.id);
  const evidenceIds = evidenceRows.map((evidence) => evidence.id);
  if (
    reportTaskIds.length === 0 &&
    reportExportJobIds.length === 0 &&
    evidenceIds.length === 0
  ) {
    return [];
  }

  const admin = createAdminClient();
  const [taskAuditResult, exportAuditResult, evidenceAuditResult] =
    await Promise.all([
      reportTaskIds.length > 0
        ? admin
            .from("admin_audit_log")
            .select("id, action, target_type, target_id, metadata, created_at")
            .eq("target_type", "campaign_report_task")
            .in("target_id", reportTaskIds)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
      reportExportJobIds.length > 0
        ? admin
            .from("admin_audit_log")
            .select("id, action, target_type, target_id, metadata, created_at")
            .eq("target_type", "report_export_job")
            .in("target_id", reportExportJobIds)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
      evidenceIds.length > 0
        ? admin
            .from("admin_audit_log")
            .select("id, action, target_type, target_id, metadata, created_at")
            .eq("target_type", "content_performance_evidence")
            .in("target_id", evidenceIds)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (taskAuditResult.error) throw new Error(taskAuditResult.error.message);
  if (exportAuditResult.error) throw new Error(exportAuditResult.error.message);
  if (evidenceAuditResult.error) {
    throw new Error(evidenceAuditResult.error.message);
  }
  return [
    ...((taskAuditResult.data ?? []) as AuditEntryRow[]),
    ...((exportAuditResult.data ?? []) as AuditEntryRow[]),
    ...((evidenceAuditResult.data ?? []) as AuditEntryRow[]),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

async function fetchAdminCampaignDetail(
  campaignId: string,
): Promise<AdminCampaignDetail | null> {
  const admin = createAdminClient();

  const { data: campaign, error } = await admin
    .from("campaigns")
    .select(
      [
        "id",
        "brand_id",
        "title",
        "status",
        "campaign_mode",
        "platforms",
        "markets",
        "niches",
        "budget_min",
        "budget_max",
        "budget_currency",
        "max_creators",
        "total_spend",
        "service_fee_cents",
        "service_fee_currency",
        "service_fee_status",
        "service_fee_checkout_session_id",
        "service_fee_payment_intent_id",
        "service_fee_charge_id",
        "service_fee_last_event_id",
        "service_fee_last_event_type",
        "service_fee_last_event_at",
        "service_fee_paid_at",
        "service_fee_failed_at",
        "service_fee_refunded_at",
        "service_fee_disputed_at",
        "service_package_snapshot",
        "application_deadline",
        "content_due_date",
        "performance_due_date",
        "posting_window_start",
        "posting_window_end",
        "monitoring_end_date",
        "usage_rights_duration",
        "usage_rights_territory",
        "usage_rights_paid_ads",
        "max_revisions",
        "brief_description",
        "brief_requirements",
        "compliance_notes",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!campaign) return null;

  const typedCampaign = campaign as unknown as CampaignRow;

  const [
    brandUserResult,
    brandProfileResult,
    applicationsResult,
    membersResult,
    assetsResult,
    agreementsResult,
    paymentEventsResult,
    creatorInvitesResult,
    auditResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, status, avatar_url")
      .eq("id", typedCampaign.brand_id)
      .maybeSingle(),
    admin
      .from("brand_profiles")
      .select(
        "company_name, industry, website, preferred_language, contact_name, contact_email",
      )
      .eq("profile_id", typedCampaign.brand_id)
      .maybeSingle(),
    admin
      .from("campaign_applications")
      .select("id, creator_id, status, proposed_rate, pitch, created_at, updated_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
    admin
      .from("campaign_members")
      .select("id, creator_id, accepted_rate, payment_status, joined_at")
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: false }),
    admin
      .from("campaign_assets")
      .select("id, title, asset_type, visibility, status, created_at")
      .eq("campaign_id", campaignId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    admin
      .from("campaign_agreements")
      .select(
        "id, title, version, status, gate_mode, requires_typed_name, published_at",
      )
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false })
      .limit(3),
    admin
      .from("campaign_payment_events")
      .select(
        "id, event_id, event_type, service_fee_status, checkout_session_id, event_summary, payment_intent_id, charge_id, amount_cents, currency, received_at",
      )
      .eq("campaign_id", campaignId)
      .order("received_at", { ascending: false })
      .limit(6),
    admin
      .from("campaign_creator_invites")
      .select("id, contact_type, contact_value, normalized_contact, status, invited_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
    admin
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, metadata, created_at")
      .eq("target_type", "campaign")
      .eq("target_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  for (const result of [
    brandUserResult,
    brandProfileResult,
    applicationsResult,
    membersResult,
    assetsResult,
    agreementsResult,
    paymentEventsResult,
    creatorInvitesResult,
    auditResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const applications = (applicationsResult.data ?? []) as ApplicationRow[];
  const members = (membersResult.data ?? []) as MemberRow[];
  const memberIds = members.map((member) => member.id);
  const creatorIds = Array.from(
    new Set([
      ...applications.map((application) => application.creator_id),
      ...members.map((member) => member.creator_id),
    ]),
  );

  const [
    creatorUsersResult,
    creatorProfilesResult,
    submissionsResult,
    reportTasksResult,
    evidenceResult,
    reportExportJobsResult,
  ] = await Promise.all([
    creatorIds.length > 0
      ? admin
          .from("profiles")
          .select("id, full_name, email, status, avatar_url")
          .in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length > 0
      ? admin
          .from("creator_profiles")
          .select(
            "profile_id, primary_market, platforms, niches, rating, tier, profile_completeness",
          )
          .in("profile_id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? admin
          .from("content_submissions")
          .select(
            "id, campaign_member_id, status, platform, content_url, published_url, version, revision_count, submitted_at, reviewed_at, published_at",
          )
          .in("campaign_member_id", memberIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("campaign_report_tasks")
      .select(
        "id, campaign_member_id, due_at, status, submitted_at, missed_at, excused_at, review_note",
      )
      .eq("campaign_id", campaignId)
      .order("due_at", { ascending: true }),
    admin
      .from("content_performance_evidence")
      .select(
        "id, campaign_member_id, file_name, report_task_id, submission_id, performance_id, verification_status, review_note, created_at",
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
    admin
      .from("report_export_jobs")
      .select("id, campaign_id, format, status, file_name, error_message, created_at")
      .eq("campaign_id", campaignId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  for (const result of [
    creatorUsersResult,
    creatorProfilesResult,
    submissionsResult,
    reportTasksResult,
    evidenceResult,
    reportExportJobsResult,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const reportTasks = (reportTasksResult.data ?? []) as ReportTaskRow[];
  const evidenceRows = (evidenceResult.data ?? []) as EvidenceRow[];
  const reportExportJobs =
    (reportExportJobsResult.data ?? []) as ReportExportJobRow[];
  const reportInterventionAuditEntries = await loadReportInterventionAuditEntries(
    reportTasks,
    reportExportJobs,
    evidenceRows,
  );
  const auditEntries = [
    ...reportInterventionAuditEntries,
    ...((auditResult.data ?? []) as AuditEntryRow[]),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 8);

  return {
    applications,
    assets: (assetsResult.data ?? []) as AssetRow[],
    auditEntries,
    brandProfile: (brandProfileResult.data as BrandProfileRow | null) ?? null,
    brandUser: (brandUserResult.data as ProfileRow | null) ?? null,
    campaign: typedCampaign,
    creatorInvites: (creatorInvitesResult.data ?? []) as CreatorInviteRow[],
    creatorProfiles: new Map(
      ((creatorProfilesResult.data ?? []) as CreatorProfileRow[]).map((profile) => [
        profile.profile_id,
        profile,
      ]),
    ),
    creatorUsers: new Map(
      ((creatorUsersResult.data ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile,
      ]),
    ),
    evidenceRows,
    reportExportJobs,
    agreements: (agreementsResult.data ?? []) as AgreementRow[],
    members,
    paymentEvents: (paymentEventsResult.data ?? []) as PaymentEventRow[],
    reportTasks,
    submissions: (submissionsResult.data ?? []) as SubmissionRow[],
  };
}

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border p-4 lg:border-s">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionSummary({
  className,
  id,
  title,
  children,
}: {
  className?: string;
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function AdminCampaignDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  await assertAdmin();
  const { id } = await params;
  const focus = getAdminCampaignFocus((await searchParams) ?? {});
  if (!uuidPattern.test(id)) notFound();

  const detail = await fetchAdminCampaignDetail(id);
  if (!detail) notFound();

  const {
    applications,
    assets,
    auditEntries,
    brandProfile,
    brandUser,
    campaign,
    creatorInvites,
    evidenceRows,
    members,
    paymentEvents,
    reportExportJobs,
    reportTasks,
    submissions,
  } = detail;
  const nextAction = getNextAction(detail);
  const applicationCounts = countBy(applications.map((item) => item.status));
  const submissionCounts = countBy(submissions.map((item) => item.status));
  const reportCounts = countBy(reportTasks.map((item) => item.status));
  const evidenceCounts = countBy(evidenceRows.map((item) => item.verification_status));
  const paymentCounts = countBy(members.map((item) => item.payment_status));
  const acceptedCreators = members.length;
  const paidCreatorCapacity = getCampaignPaidCreatorCapacity({
    maxCreators: campaign.max_creators,
    paymentEvents,
    serviceFeeCents: campaign.service_fee_cents,
    serviceFeeStatus: campaign.service_fee_status,
    servicePackageSnapshot: campaign.service_package_snapshot,
  });
  const inviteCapacityState = getCampaignCreatorInviteSendCapacityState({
    acceptedCreatorCount: acceptedCreators,
    capacity: paidCreatorCapacity,
    inviteNormalizedContact: null,
    savedInvites: creatorInvites.map((invite) => ({
      normalizedContact: invite.normalized_contact,
      status: invite.status,
    })),
  });
  const activeAgreement = detail.agreements[0] ?? null;
  const readyAssets = assets.filter((asset) => asset.status === "ready").length;
  const publicAssets = assets.filter((asset) => asset.visibility === "public").length;
  const memberAssets = assets.filter((asset) => asset.visibility === "member").length;
  const latestSubmissions = submissions.slice(0, 3);
  const serviceFeeBlocking = isServiceFeeBlockingCampaign(campaign);
  const serviceFeeException = isServiceFeeException(campaign.service_fee_status);
  const serviceFeeEventDate = getServiceFeeEventDate(campaign);
  const reportExceptionTasks = reportTasks.filter(
    (task) => task.status === "missed" || task.status === "needs_revision",
  );
  const currentPendingEvidenceReviewRows = getCurrentAdminEvidenceReviewRows(
    evidenceRows,
  ).filter((row) => row.status !== "correction");
  const reportingExceptionCount =
    reportExceptionTasks.length +
    currentPendingEvidenceReviewRows.length +
    reportExportJobs.length;
  const reportInterventionEntries = auditEntries.filter(
    (entry) =>
      entry.target_type === "campaign_report_task" ||
      entry.target_type === "report_export_job" ||
      entry.target_type === "content_performance_evidence",
  );
  const campaignWindow =
    campaign.posting_window_start || campaign.posting_window_end
      ? `${formatDate(campaign.posting_window_start)} to ${formatDate(campaign.posting_window_end)}`
      : "Not set";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <LinkButton
          href="/admin/campaigns"
          variant="ghost"
          size="sm"
          className="-ms-2 mb-4"
        >
          <ArrowLeft className="size-4" />
          Campaign Oversight
        </LinkButton>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                {campaign.title}
              </h1>
              <Badge variant="outline" className="capitalize">
                {CAMPAIGN_STATUS_LABELS[campaign.status]}
              </Badge>
              <Badge
                variant="outline"
                className={badgeClassForTone(paymentTone(campaign.service_fee_status))}
              >
                Fee {campaign.service_fee_status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {brandProfile?.company_name ?? brandUser?.full_name ?? "Unknown brand"}
              {" | "}
              {campaign.campaign_mode === "sourced" ? "Sourced" : "Private"}
              {" | "}
              {campaign.platforms.map(getPlatformLabel).join(", ") || "No platforms"}
              {" | "}
              {campaign.markets.map((market) => getMarketLabel(market)).join(", ") ||
                "No markets"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/apply/${campaign.id}`}
              variant="outline"
              size="sm"
            >
              Apply page
              <ArrowUpRight className="size-4" />
            </LinkButton>
          </div>
        </div>
      </div>

      {focus === "launch" && (
        <Card
          id="admin-launch-readiness"
          data-testid="admin-campaign-focus-panel"
          className="mb-6 scroll-mt-24 border-slate-300 bg-white"
        >
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <Badge
                variant="outline"
                className={badgeClassForTone(serviceFeeBlocking ? "warning" : "good")}
              >
                {serviceFeeBlocking ? "Payment gate" : "Launch readiness"}
              </Badge>
              <h2 className="mt-3 text-xl font-semibold text-foreground">
                {serviceFeeBlocking
                  ? "Resolve service fee before sharing"
                  : "Payment and launch gates are clear"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {serviceFeeBlocking
                  ? `${labelFromValue(campaign.service_fee_status)} service fee blocks the invite link and launch actions.`
                  : "The service fee is not blocking this campaign."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton
                href={`/admin/revenue?status=${campaign.service_fee_status}&campaign=${campaign.id}#service-fees`}
                variant="outline"
                size="sm"
              >
                View revenue
              </LinkButton>
              <LinkButton href="#admin-payment-trail" variant="outline" size="sm">
                Payment trail
              </LinkButton>
            </div>
          </CardContent>
        </Card>
      )}

      {focus === "reporting" && (
        <Card
          id="admin-reporting-exceptions"
          data-testid="admin-campaign-focus-panel"
          className="mb-6 scroll-mt-24 border-amber-200 bg-white"
        >
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span
                  data-testid="admin-reporting-focus-label"
                  className="inline-flex h-6 w-fit items-center rounded-full border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700"
                >
                  Reporting
                </span>
                <CardTitle className="mt-3">Review reporting exceptions</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reportingExceptionCount > 0
                    ? `${reportingExceptionCount} reporting exception${reportingExceptionCount === 1 ? " needs" : "s need"} admin attention.`
                    : "No reporting blockers remain."}
                </p>
              </div>
              <Link
                href={`/b/campaigns/${campaign.id}/report`}
                data-testid="admin-reporting-brand-report-link"
                className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[0.8rem] font-medium leading-none text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                style={{
                  WebkitTextFillColor: "#0f172a",
                  color: "#0f172a",
                  outline: "none",
                  textDecoration: "none",
                }}
              >
                Brand report
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {reportingExceptionCount > 0 ? (
              <div className="divide-y divide-border rounded-xl border border-border">
                {reportExportJobs.map((job) => (
                  <div
                    key={job.id}
                    data-testid="admin-reporting-export-failure-row"
                    className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Failed report exports
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        Report export failed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reportExportFormatLabel(job.format)} export failed{" "}
                        {formatDateTime(job.created_at)}
                      </p>
                      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                        {job.error_message ??
                          "The report artifact failed before storage. Retry after confirming report data is still available."}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={badgeClassForTone("danger")}
                    >
                      Export failure
                    </Badge>
                    <form
                      action={retryAdminReportExportJob}
                      data-testid="admin-reporting-export-retry-form"
                      className="md:justify-self-end"
                    >
                      <input
                        type="hidden"
                        name="report_export_job_id"
                        value={job.id}
                      />
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground shadow-sm transition hover:bg-slate-50"
                      >
                        Retry export
                      </button>
                    </form>
                  </div>
                ))}
                {currentPendingEvidenceReviewRows.map((row) => {
                  const evidence = row.evidence;
                  const task = reportTasks.find(
                    (candidate) => candidate.id === evidence.report_task_id,
                  );
                  const member = members.find(
                    (candidate) => candidate.id === evidence.campaign_member_id,
                  );
                  const creator = member
                    ? detail.creatorUsers.get(member.creator_id)
                    : null;
                  const reviewSlaBreached = isReportReviewSlaBreached(
                    evidence.created_at,
                  );
                  const correctionReturned = row.status === "correction_returned";
                  return (
                    <div
                      key={evidence.id}
                      data-testid="admin-reporting-evidence-review-row"
                      data-evidence-id={evidence.id}
                      className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(14rem,18rem)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {creator?.full_name ?? "Creator"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {formatDateTime(evidence.created_at)}
                        </p>
                        <p
                          data-testid="admin-reporting-evidence-review-age"
                          className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground"
                        >
                          {correctionReturned
                            ? reviewSlaBreached
                              ? `${evidence.file_name ?? "Submitted proof"} replaced a rejected proof and is older than the 24h proof review SLA. Ask the brand owner to review or intervene.`
                              : `${evidence.file_name ?? "Submitted proof"} replaced a rejected proof and is waiting for brand evidence review.`
                            : reviewSlaBreached
                              ? `${evidence.file_name ?? "Submitted proof"} is older than the 24h proof review SLA. Ask the brand owner to review or intervene.`
                              : `${evidence.file_name ?? "Submitted proof"} is waiting for brand evidence review.`}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <Badge
                          variant="outline"
                          className={badgeClassForTone("warning")}
                        >
                          {reviewSlaBreached
                            ? "Review SLA breach"
                            : correctionReturned
                              ? "Correction returned"
                              : "Needs brand review"}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {reviewSlaBreached
                            ? "Proof review older than 24h"
                            : correctionReturned
                              ? "Corrected proof awaiting brand review"
                              : "Proof awaiting brand review"}
                        </p>
                      </div>
                      <form
                        action={recordAdminProofReviewIntervention}
                        data-testid="admin-reporting-proof-intervention-form"
                        className="grid gap-2"
                      >
                        <input
                          type="hidden"
                          name="evidence_id"
                          value={evidence.id}
                        />
                        <label
                          htmlFor={`proof-intervention-${evidence.id}`}
                          className="text-xs font-medium text-foreground"
                        >
                          What did admin do?
                        </label>
                        <textarea
                          id={`proof-intervention-${evidence.id}`}
                          name="intervention_note"
                          data-testid="admin-reporting-proof-intervention-note"
                          required
                          minLength={12}
                          maxLength={500}
                          rows={2}
                          placeholder="Asked brand owner to review this proof before leadership sharing."
                          className="min-h-16 rounded-lg border border-border bg-white px-3 py-2 text-xs text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        />
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Saved to admin audit. Does not verify proof or change
                          report totals.
                        </p>
                        <button
                          type="submit"
                          data-testid="admin-reporting-proof-intervention-submit"
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground shadow-sm transition hover:bg-slate-50"
                        >
                          Record intervention
                        </button>
                      </form>
                      <LinkButton
                        href={`/b/campaigns/${campaign.id}/report?evidence=${evidence.id}&reportTask=${task?.id ?? evidence.report_task_id}#report-evidence-trail`}
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs md:justify-self-end"
                      >
                        Review proof
                      </LinkButton>
                    </div>
                  );
                })}
                {reportExceptionTasks.map((task) => {
                  const member = members.find(
                    (candidate) => candidate.id === task.campaign_member_id,
                  );
                  const creator = member
                    ? detail.creatorUsers.get(member.creator_id)
                    : null;
                  const correctionEvidence =
                    task.status === "needs_revision"
                      ? getReportCorrectionEvidence(task, evidenceRows)
                      : null;
                  const correctionNote =
                    task.status === "needs_revision"
                      ? correctionEvidence?.review_note?.trim() ||
                        task.review_note?.trim() ||
                        "Creator needs to resubmit corrected proof."
                      : null;
                  return (
                    <div
                      key={task.id}
                      data-testid="admin-reporting-exception-row"
                      className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {creator?.full_name ?? "Creator"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due {formatDate(task.due_at)}
                        </p>
                        {correctionNote && (
                          <p
                            data-testid="admin-reporting-correction-note"
                            className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground"
                          >
                            {correctionNote}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={badgeClassForTone(reportTaskTone(task.status))}
                      >
                        {reportTaskLabel(task.status)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {task.submitted_at
                          ? `Submitted ${formatDateTime(task.submitted_at)}`
                          : task.missed_at
                            ? `Missed ${formatDateTime(task.missed_at)}`
                            : "Awaiting creator"}
                      </p>
                      {task.status === "missed" ? (
                        <form
                          action={excuseAdminReportTask}
                          data-testid="admin-reporting-excuse-form"
                          className="grid min-w-64 gap-2 md:justify-self-end"
                        >
                          <input
                            type="hidden"
                            name="report_task_id"
                            value={task.id}
                          />
                          <label
                            htmlFor={`excuse-reason-${task.id}`}
                            className="text-xs font-medium text-foreground"
                          >
                            Why can this missed report be excused?
                          </label>
                          <textarea
                            id={`excuse-reason-${task.id}`}
                            name="excuse_reason"
                            data-testid="admin-reporting-excuse-reason"
                            required
                            minLength={12}
                            maxLength={500}
                            rows={2}
                            placeholder="Creator reported a platform outage and the brand accepts this exception."
                            className="min-h-16 rounded-lg border border-border bg-white px-3 py-2 text-xs text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          />
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            Required for audit. This note is saved to the reporting
                            task and admin log.
                          </p>
                          <button
                            type="submit"
                            data-testid="admin-reporting-excuse-submit"
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground shadow-sm transition hover:bg-slate-50"
                          >
                            Mark excused
                          </button>
                        </form>
                      ) : correctionEvidence ? (
                        <LinkButton
                          href={`/b/campaigns/${campaign.id}/report?evidence=${correctionEvidence.id}&reportTask=${task.id}#report-evidence-trail`}
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs md:justify-self-end"
                        >
                          Review proof
                        </LinkButton>
                      ) : (
                        <span className="hidden md:block" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Reporting queue is clear for this campaign.
              </p>
            )}
            <div
              data-testid="admin-reporting-intervention-trace"
              className="mt-4 rounded-xl border border-border bg-slate-50/60 p-3"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Reporting intervention trace
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Admin decisions recorded against proof, report tasks, and
                    export jobs for this campaign.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit bg-white">
                  {reportInterventionEntries.length} recorded
                </Badge>
              </div>
              {reportInterventionEntries.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {reportInterventionEntries.map((entry) => {
                    const reason = getReportInterventionReason(entry);
                    return (
                      <div
                        key={entry.id}
                        data-testid="admin-reporting-intervention-row"
                        className="rounded-lg border border-border bg-white px-3 py-2"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {getAdminAuditActionLabel(entry.action)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(entry.created_at)}
                          </p>
                        </div>
                        <p
                          data-testid="admin-reporting-intervention-reason"
                          className="mt-1 text-xs leading-relaxed text-muted-foreground"
                        >
                          {reason ?? "No reason captured."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-border bg-white px-3 py-4 text-center text-xs text-muted-foreground">
                  No reporting interventions recorded yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {serviceFeeException && (
        <Card
          id="admin-finance-exception"
          data-testid="admin-campaign-finance-exception"
          className="mb-6 scroll-mt-24 border-red-200 bg-white"
        >
          <CardContent className="p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <Badge
                  variant="outline"
                  className={badgeClassForTone("danger")}
                >
                  Payment exception
                </Badge>
                <h2 className="mt-3 text-xl font-semibold text-foreground">
                  Service fee needs finance review
                </h2>
                <p
                  data-testid="admin-campaign-payment-lock-state"
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Creator and public access locked until payment is restored.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton
                  href={`/admin/revenue?status=${campaign.service_fee_status}&campaign=${campaign.id}#service-fees`}
                  variant="outline"
                  size="sm"
                >
                  Revenue trace
                </LinkButton>
                <LinkButton href="#admin-payment-trail" variant="outline" size="sm">
                  Payment trail
                </LinkButton>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1.2fr]">
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {labelFromValue(campaign.service_fee_status)}
                </p>
              </div>
              <div
                data-testid="admin-campaign-payment-next-action"
                className="rounded-lg border border-border px-3 py-2"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  Next action
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {getServiceFeeAdminAction(campaign.service_fee_status)}
                </p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Updated
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {serviceFeeEventDate
                    ? formatDateTime(serviceFeeEventDate)
                    : "No timestamp"}
                </p>
              </div>
              <div
                data-testid="admin-campaign-payment-trace"
                className="min-w-0 rounded-lg border border-border px-3 py-2"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  Stripe trace
                </p>
                <p className="mt-1 truncate font-mono text-sm text-foreground">
                  {campaign.service_fee_payment_intent_id ??
                    campaign.service_fee_charge_id ??
                    campaign.service_fee_checkout_session_id ??
                    "No Stripe object"}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {campaign.service_fee_last_event_id ?? "No Stripe event"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {focus === "operations" && (
        <Card
          id="admin-creator-operations"
          data-testid="admin-campaign-focus-panel"
          className="mb-6 scroll-mt-24 border-orange-200 bg-white"
        >
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <Badge
                variant="outline"
                className={badgeClassForTone(
                  inviteCapacityState.isOverCapacity ? "warning" : "good",
                )}
              >
                Creator operations
              </Badge>
              <h2 className="mt-3 text-xl font-semibold text-foreground">
                {inviteCapacityState.isOverCapacity
                  ? "Invite capacity needs intervention"
                  : "Creator capacity is aligned"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {inviteCapacityState.isOverCapacity
                  ? "Pause outreach or increase paid capacity before sending more creator invites."
                  : "Accepted creators and saved invite reservations are inside paid capacity."}
              </p>
            </div>
            <div
              data-testid="admin-creator-operations-capacity"
              className="grid gap-2 rounded-xl border border-border bg-slate-50 p-3 text-sm sm:grid-cols-3"
            >
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Paid slots
                </p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">
                  {inviteCapacityState.capacity}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Reserved
                </p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">
                  {inviteCapacityState.totalReservedCreatorCount}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Remaining
                </p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">
                  {inviteCapacityState.remainingCreatorSlots}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Campaign command center</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-0 overflow-hidden rounded-xl border border-border lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div className="bg-white p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                  <CheckCircle2 className="size-5 text-slate-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Next action
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {nextAction.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {nextAction.detail}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={badgeClassForTone(nextAction.tone)}
              >
                {nextAction.tone === "good" ? "Clear" : "Needs attention"}
              </Badge>
            </div>

            <MetricTile
              icon={ReceiptText}
              label="Service fee"
              value={formatServiceFee(
                campaign.service_fee_cents,
                campaign.service_fee_currency,
              )}
              detail={labelFromValue(campaign.service_fee_status)}
            />
            <MetricTile
              icon={Users}
              label="Creators"
              value={`${acceptedCreators}/${paidCreatorCapacity || "-"}`}
              detail={`${inviteCapacityState.reservedInviteCount} invite reservations`}
            />
            <MetricTile
              icon={FileText}
              label="Content"
              value={`${statusCount(submissionCounts, "approved") + statusCount(submissionCounts, "published")}/${submissions.length}`}
              detail={`${statusCount(submissionCounts, "submitted")} in review`}
            />
            <MetricTile
              icon={BarChart3}
              label="Reports"
              value={`${statusCount(reportCounts, "verified")}/${reportTasks.length}`}
              detail={`${statusCount(reportCounts, "missed")} missed`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <SectionSummary title="Operating health">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Campaign window
                </p>
                <p className="text-sm text-muted-foreground">{campaignWindow}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Applications close</p>
                <p className="font-medium text-foreground">
                  {formatDate(campaign.application_deadline)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Content due</p>
                <p className="font-medium text-foreground">
                  {formatDate(campaign.content_due_date)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Performance due</p>
                <p className="font-medium text-foreground">
                  {formatDate(campaign.performance_due_date)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Monitoring ends</p>
                <p className="font-medium text-foreground">
                  {formatDate(campaign.monitoring_end_date)}
                </p>
              </div>
            </div>
          </div>
        </SectionSummary>

        <SectionSummary title="Creator operations">
          <div className="space-y-4">
            {inviteCapacityState.isOverCapacity && (
              <div
                data-testid="admin-creator-operations-capacity-inline"
                className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900"
              >
                <p className="font-semibold">Invite capacity exception</p>
                <p className="mt-1">
                  {inviteCapacityState.totalReservedCreatorCount} creator seats
                  reserved for {inviteCapacityState.capacity} paid slots. Pause
                  outreach or increase paid capacity before sending more creator
                  invites.
                </p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {statusCount(applicationCounts, "pending")}
                </p>
                <p className="text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {statusCount(applicationCounts, "accepted")}
                </p>
                <p className="text-muted-foreground">Accepted</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {statusCount(paymentCounts, "paid")}
                </p>
                <p className="text-muted-foreground">Paid</p>
              </div>
            </div>
            <div className="space-y-2">
              {members.slice(0, 4).map((member) => {
                const user = detail.creatorUsers.get(member.creator_id);
                const creator = detail.creatorProfiles.get(member.creator_id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user?.full_name ?? "Creator"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {creator?.primary_market
                          ? getMarketLabel(creator.primary_market)
                          : "Market not set"}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {member.payment_status}
                    </Badge>
                  </div>
                );
              })}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No accepted creators yet.
                </p>
              )}
            </div>
          </div>
        </SectionSummary>

        <SectionSummary title="Content and reporting">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Submitted content</p>
                <p className="font-medium text-foreground">{submissions.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Proof received</p>
                <p className="font-medium text-foreground">{evidenceRows.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Verified proof</p>
                <p className="font-medium text-foreground">
                  {statusCount(evidenceCounts, "verified")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Report tasks</p>
                <p className="font-medium text-foreground">{reportTasks.length}</p>
              </div>
            </div>
            <div className="space-y-2">
              {latestSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {submission.platform
                        ? getPlatformLabel(submission.platform)
                        : "Content"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Version {submission.version}, {submission.revision_count} revisions
                    </p>
                  </div>
                  <Badge variant="outline">
                    {submissionStatusLabels[submission.status]}
                  </Badge>
                </div>
              ))}
              {latestSubmissions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No content submissions yet.
                </p>
              )}
            </div>
          </div>
        </SectionSummary>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <SectionSummary title="Rules and materials">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Creator gate</p>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {activeAgreement
                  ? `${labelFromValue(activeAgreement.status)} v${activeAgreement.version}`
                  : "No agreement"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeAgreement
                  ? `${labelFromValue(activeAgreement.gate_mode)}, typed name ${
                      activeAgreement.requires_typed_name ? "required" : "optional"
                    }`
                  : "Creators can join without a rules gate."}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Creative kit</p>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {readyAssets}/{assets.length} ready
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {publicAssets} public, {memberAssets} member-only
              </p>
            </div>
          </div>
        </SectionSummary>

        <SectionSummary title="Brief and commercial terms">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Budget</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatBudgetRange(
                  campaign.budget_min,
                  campaign.budget_max,
                  "en",
                  campaign.budget_currency,
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(campaign.total_spend, "en", campaign.budget_currency)} spent
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Usage</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {campaign.usage_rights_duration
                  ? labelFromValue(campaign.usage_rights_duration)
                  : "Not set"}
              </p>
              <p className="text-sm text-muted-foreground">
                {campaign.usage_rights_territory
                  ? labelFromValue(campaign.usage_rights_territory)
                  : "No territory set"}
                {campaign.usage_rights_paid_ads ? ", paid ads allowed" : ""}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Brief</p>
              <p className="mt-1 line-clamp-3 text-sm text-foreground">
                {campaign.brief_description ??
                  campaign.brief_requirements ??
                  "No brief summary available."}
              </p>
            </div>
          </div>
        </SectionSummary>
      </div>

      <SectionSummary
        id="admin-payment-trail"
        title="Payment trail"
        className="scroll-mt-24"
      >
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                Checkout session
              </p>
              <p className="mt-1 truncate font-mono text-sm text-foreground">
                {campaign.service_fee_checkout_session_id ?? "Not created"}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                Payment intent
              </p>
              <p className="mt-1 truncate font-mono text-sm text-foreground">
                {campaign.service_fee_payment_intent_id ?? "Not available"}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">
                Latest event
              </p>
              <p className="mt-1 truncate font-mono text-sm text-foreground">
                {campaign.service_fee_last_event_id ?? "No event yet"}
              </p>
              {campaign.service_fee_last_event_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(campaign.service_fee_last_event_at)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {paymentEvents.map((event) => (
              <div
                key={event.id}
                className="grid gap-3 rounded-lg border border-border px-3 py-2 md:grid-cols-[1.2fr_0.8fr_1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {event.event_type}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {event.event_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Status
                  </p>
                  <p className="text-sm capitalize text-foreground">
                    {event.service_fee_status ?? "Recorded"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Trace
                  </p>
                  <p className="truncate font-mono text-xs text-foreground">
                    {event.payment_intent_id ??
                      event.charge_id ??
                      event.checkout_session_id ??
                      "No Stripe object"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.received_at)}
                </p>
              </div>
            ))}
            {paymentEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No Stripe payment events recorded for this campaign yet.
              </p>
            )}
          </div>
        </div>
      </SectionSummary>

      <div className="mt-6">
        <SectionSummary title="Recent admin activity">
          <div className="space-y-3">
            {auditEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {getAdminAuditActionLabel(entry.action)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {typeof entry.metadata?.target_name === "string"
                      ? entry.metadata.target_name
                      : campaign.title}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(entry.created_at)}
                </p>
              </div>
            ))}
            {auditEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No admin interventions recorded for this campaign.
              </p>
            )}
          </div>
        </SectionSummary>
      </div>
    </div>
  );
}
