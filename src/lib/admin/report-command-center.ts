import { getCurrentEvidenceReviewRows } from "../reporting/evidence-review";
import type {
  CampaignReportTaskStatus,
  CampaignStatus,
  PerformanceEvidenceVerificationStatus,
} from "../../types/database";

export type ReportCommandCampaignMeta = {
  brandName: string;
  id: string;
  status: CampaignStatus | string;
  title: string;
};

export type ReportCommandTaskRow = {
  id: string;
  campaign_id: string;
  campaign_member_id: string;
  due_at: string;
  missed_at: string | null;
  review_note: string | null;
  status: CampaignReportTaskStatus;
  submitted_at: string | null;
  updated_at: string;
};

export type ReportCommandEvidenceRow = {
  id: string;
  campaign_id: string;
  campaign_member_id: string;
  created_at: string;
  file_name: string | null;
  report_task_id: string;
  review_note: string | null;
  verification_status: PerformanceEvidenceVerificationStatus;
};

export type ReportCommandExportJobRow = {
  id: string;
  campaign_id: string;
  created_at: string;
  error_message: string | null;
  file_name: string | null;
  format: string;
  status: string;
};

export type ReportCommandExceptionKind =
  | "correction"
  | "correction_returned"
  | "evidence_review"
  | "export_failure"
  | "missing_evidence"
  | "missed"
  | "review_sla";

type CurrentEvidenceReviewStatus =
  | "correction"
  | "correction_returned"
  | "evidence_review";

type CurrentEvidenceReviewRow = {
  evidence: ReportCommandEvidenceRow;
  hasReturnedCorrection: boolean;
  status: CurrentEvidenceReviewStatus;
};

export type ReportCommandExceptionRow = {
  actionHref: string;
  actionLabel: string;
  campaign: ReportCommandCampaignMeta;
  createdAt: string;
  clearance: string;
  detail: string;
  id: string;
  impact: string;
  kind: ReportCommandExceptionKind;
  label: string;
  leadershipNextAction: string;
  nextStep: string;
  owner: string;
  shareGate: string;
  title: string;
  waitingLabel: string;
};

export type ReportCommandCampaignReadiness = {
  actionHref: string;
  actionLabel: string;
  blockerCount: number;
  campaign: ReportCommandCampaignMeta;
  clearance: string;
  leadershipNextAction: string;
  leadershipStatus: "Leadership hold";
  primaryKind: ReportCommandExceptionKind;
  primaryLabel: string;
  shareGate: string;
  summary: string;
  waitingLabel: string;
};

export type ReportCommandCenter = {
  campaignHoldCount: number;
  campaignReadiness: ReportCommandCampaignReadiness[];
  correctionCount: number;
  evidenceReviewCount: number;
  exportFailureCount: number;
  missingEvidenceCount: number;
  missedCount: number;
  reviewSlaBreachCount: number;
  rows: ReportCommandExceptionRow[];
};

export const REPORT_REVIEW_SLA_MS = 24 * 60 * 60 * 1000;

export function formatReportCommandDateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function formatReportCommandWaitingAge(
  value: string | null,
  now = Date.now(),
) {
  if (!value) return "Waiting time unknown";
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "Waiting time unknown";

  const minutes = Math.max(1, Math.floor(Math.max(0, now - createdAt) / 60000));
  if (minutes < 60) return `${minutes}m waiting`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h waiting`;

  return `${Math.floor(hours / 24)}d waiting`;
}

export function isReportCommandReviewSlaBreached(
  value: string,
  now = Date.now(),
) {
  const createdAt = new Date(value).getTime();
  return Number.isFinite(createdAt) && now - createdAt >= REPORT_REVIEW_SLA_MS;
}

export function toneForReportCommandKind(kind: ReportCommandExceptionKind) {
  if (
    kind === "missed" ||
    kind === "export_failure" ||
    kind === "missing_evidence" ||
    kind === "review_sla"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (kind === "correction" || kind === "correction_returned") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getCampaign(
  campaignMap: Map<string, ReportCommandCampaignMeta>,
  campaignId: string,
): ReportCommandCampaignMeta {
  return campaignMap.get(campaignId) ?? {
    brandName: "Unknown brand",
    id: campaignId,
    status: "unknown",
    title: "Unknown campaign",
  };
}

function priorityForKind(kind: ReportCommandExceptionKind) {
  if (kind === "review_sla") return 5;
  if (kind === "export_failure") return 4;
  if (kind === "missed" || kind === "missing_evidence") return 3;
  if (kind === "correction" || kind === "correction_returned") return 2;
  return 1;
}

function impactForKind(kind: ReportCommandExceptionKind) {
  if (kind === "review_sla") {
    return "Blocks report confidence until brand confirms proof.";
  }
  if (kind === "export_failure") {
    return "Blocks board-ready artifact delivery.";
  }
  if (kind === "missed") {
    return "Blocks complete creator readout unless excused.";
  }
  if (kind === "missing_evidence") {
    return "Blocks report confidence because submitted metrics have no proof source.";
  }
  if (kind === "correction") {
    return "Blocks metric inclusion until creator returns usable proof.";
  }
  if (kind === "correction_returned") {
    return "Blocks corrected proof from updating report totals.";
  }
  return "Blocks submitted proof from entering the leadership report.";
}

function shareGateForKind(kind: ReportCommandExceptionKind) {
  if (kind === "review_sla" || kind === "evidence_review") {
    return "Leadership hold until brand verifies submitted proof.";
  }
  if (kind === "export_failure") {
    return "Leadership hold until replacement artifact is generated.";
  }
  if (kind === "missed") {
    return "Leadership hold unless the missed read is excused with audit trail.";
  }
  if (kind === "missing_evidence") {
    return "Leadership hold until the submitted task has evidence attached.";
  }
  if (kind === "correction") {
    return "Leadership hold until creator returns usable proof.";
  }
  return "Leadership hold until corrected proof is reviewed.";
}

function leadershipNextActionForKind(kind: ReportCommandExceptionKind) {
  if (kind === "review_sla" || kind === "evidence_review") {
    return "Review 1 submitted proof read before sharing.";
  }
  if (kind === "missing_evidence") {
    return "Ask creator to upload 1 missing proof read.";
  }
  if (kind === "correction") {
    return "Resolve 1 correction request before leadership sharing.";
  }
  if (kind === "correction_returned") {
    return "Review 1 corrected proof read before sharing.";
  }
  if (kind === "export_failure") {
    return "Regenerate the failed report export before leadership sharing.";
  }
  return "Resolve 1 missed report read before leadership sharing.";
}

function nextStepForKind(kind: ReportCommandExceptionKind) {
  if (kind === "review_sla") {
    return "Open the campaign and push brand proof review.";
  }
  if (kind === "export_failure") {
    return "Open the campaign and retry or inspect the failed export.";
  }
  if (kind === "missed") {
    return "Open the campaign and excuse only with a written audit reason.";
  }
  if (kind === "missing_evidence") {
    return "Open the campaign and ask the creator to attach proof before review.";
  }
  if (kind === "correction") {
    return "Open the campaign and confirm the creator correction path.";
  }
  if (kind === "correction_returned") {
    return "Open the campaign and review the returned proof.";
  }
  return "Open the campaign and review proof before totals update.";
}

function ownerForKind(kind: ReportCommandExceptionKind) {
  if (kind === "export_failure") {
    return "PopsDrops ops";
  }
  if (kind === "missed") {
    return "Admin operator + brand owner";
  }
  if (kind === "correction") {
    return "Creator success";
  }
  if (kind === "missing_evidence") {
    return "Creator success";
  }
  return "Brand owner";
}

function clearanceForKind(kind: ReportCommandExceptionKind) {
  if (kind === "review_sla") {
    return "Brand reviews or requests correction on submitted proof.";
  }
  if (kind === "export_failure") {
    return "Replacement export completes and old failure is traced.";
  }
  if (kind === "missed") {
    return "Creator submits proof or admin excuses with a written audit reason.";
  }
  if (kind === "missing_evidence") {
    return "Creator attaches evidence or admin returns the report task with an audit note.";
  }
  if (kind === "correction") {
    return "Creator submits corrected proof with visible account/date.";
  }
  if (kind === "correction_returned") {
    return "Brand reviews corrected proof and updates report totals.";
  }
  return "Brand verifies proof or requests correction before totals update.";
}

function evidenceReviewKey(row: ReportCommandEvidenceRow) {
  return `${row.report_task_id}:${row.campaign_member_id}`;
}

function buildCampaignReadiness(
  rows: ReportCommandExceptionRow[],
): ReportCommandCampaignReadiness[] {
  const groups = new Map<
    string,
    { blockerCount: number; primary: ReportCommandExceptionRow }
  >();

  for (const row of rows) {
    const current = groups.get(row.campaign.id);
    if (!current) {
      groups.set(row.campaign.id, {
        blockerCount: 1,
        primary: row,
      });
      continue;
    }

    current.blockerCount += 1;

    const currentPriority = priorityForKind(current.primary.kind);
    const nextPriority = priorityForKind(row.kind);
    const nextIsHigherPriority =
      nextPriority > currentPriority ||
      (nextPriority === currentPriority &&
        new Date(row.createdAt).getTime() >
          new Date(current.primary.createdAt).getTime());

    if (nextIsHigherPriority) {
      current.primary = row;
    }
  }

  return Array.from(groups.values())
    .map(({ blockerCount, primary }) => ({
      actionHref: primary.actionHref,
      actionLabel: "Open campaign",
      blockerCount,
      campaign: primary.campaign,
      clearance: primary.clearance,
      leadershipNextAction: primary.leadershipNextAction,
      leadershipStatus: "Leadership hold" as const,
      primaryKind: primary.kind,
      primaryLabel: primary.label,
      shareGate: primary.shareGate,
      summary: `${blockerCount} blocker${blockerCount === 1 ? "" : "s"}: ${
        primary.label
      } is the top leadership gate.`,
      waitingLabel: primary.waitingLabel,
    }))
    .sort(
      (a, b) =>
        priorityForKind(b.primaryKind) - priorityForKind(a.primaryKind) ||
        b.blockerCount - a.blockerCount ||
        a.campaign.title.localeCompare(b.campaign.title),
    );
}

function getCurrentAdminEvidenceReviewRows(
  evidenceRows: ReportCommandEvidenceRow[],
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

export function buildReportCommandCenter({
  campaigns,
  evidenceRows,
  exportRows,
  now = Date.now(),
  tasks,
}: {
  campaigns: Map<string, ReportCommandCampaignMeta>;
  evidenceRows: ReportCommandEvidenceRow[];
  exportRows: ReportCommandExportJobRow[];
  now?: number;
  tasks: ReportCommandTaskRow[];
}): ReportCommandCenter {
  const currentEvidenceRows = getCurrentAdminEvidenceReviewRows(evidenceRows);
  const evidenceTaskIds = new Set(evidenceRows.map((row) => row.report_task_id));

  const taskRows: ReportCommandExceptionRow[] = tasks
    .filter((task) => task.status === "missed" || task.status === "needs_revision")
    .map((task) => {
      const missed = task.status === "missed";
      const campaign = getCampaign(campaigns, task.campaign_id);
      const kind: ReportCommandExceptionKind = missed ? "missed" : "correction";
      const createdAt = task.missed_at ?? task.submitted_at ?? task.updated_at;
      return {
        actionHref: `/admin/campaigns/${task.campaign_id}?focus=reporting#admin-reporting-exceptions`,
        actionLabel: "Open campaign",
        campaign,
        createdAt,
        clearance: clearanceForKind(kind),
        detail: missed
          ? `Due ${formatReportCommandDateTime(task.due_at)}. Admin can excuse only with a written reason.`
          : task.review_note ?? "Creator correction remains open.",
        id: `task:${task.id}`,
        impact: impactForKind(kind),
        kind,
        label: missed ? "Missed report" : "Correction request",
        leadershipNextAction: leadershipNextActionForKind(kind),
        nextStep: nextStepForKind(kind),
        owner: ownerForKind(kind),
        shareGate: shareGateForKind(kind),
        title: missed ? "Report task missed" : "Correction request open",
        waitingLabel: formatReportCommandWaitingAge(createdAt, now),
      };
    });

  const missingEvidenceRows: ReportCommandExceptionRow[] = tasks
    .filter(
      (task) =>
        (task.status === "submitted" || task.status === "submitted_late") &&
        !evidenceTaskIds.has(task.id),
    )
    .map((task) => {
      const campaign = getCampaign(campaigns, task.campaign_id);
      const kind: ReportCommandExceptionKind = "missing_evidence";
      const createdAt = task.submitted_at ?? task.updated_at;
      return {
        actionHref: `/admin/campaigns/${task.campaign_id}?focus=reporting#admin-reporting-exceptions`,
        actionLabel: "Open campaign",
        campaign,
        createdAt,
        clearance: clearanceForKind(kind),
        detail: `Submitted at ${formatReportCommandDateTime(createdAt)}, but no evidence file is attached to the report task.`,
        id: `task:${task.id}:missing-evidence`,
        impact: impactForKind(kind),
        kind,
        label: "Missing proof",
        leadershipNextAction: leadershipNextActionForKind(kind),
        nextStep: nextStepForKind(kind),
        owner: ownerForKind(kind),
        shareGate: shareGateForKind(kind),
        title: "Report task submitted without proof",
        waitingLabel: formatReportCommandWaitingAge(createdAt, now),
      };
    });

  const evidenceRowsForReview: ReportCommandExceptionRow[] =
    currentEvidenceRows.map((row) => {
      const evidence = row.evidence;
      const rejected = row.status === "correction";
      const correctionReturned = row.status === "correction_returned";
      const slaBreached =
        row.status !== "correction" &&
        isReportCommandReviewSlaBreached(evidence.created_at, now);
      const campaign = getCampaign(campaigns, evidence.campaign_id);
      const kind: ReportCommandExceptionKind = rejected
        ? "correction"
        : slaBreached
          ? "review_sla"
          : correctionReturned
            ? "correction_returned"
            : "evidence_review";
      const fileName = evidence.file_name ?? "Submitted proof";
      return {
        actionHref: `/admin/campaigns/${evidence.campaign_id}?focus=reporting#admin-reporting-exceptions`,
        actionLabel: "Open campaign",
        campaign,
        createdAt: evidence.created_at,
        clearance: clearanceForKind(kind),
        detail: rejected
          ? evidence.review_note ?? "Rejected proof needs creator correction follow-up."
          : correctionReturned
            ? slaBreached
              ? `${fileName} replaced a rejected proof and has waited since ${formatReportCommandDateTime(evidence.created_at)}. Ask the brand owner to review or intervene.`
              : `${fileName} replaced a rejected proof. Review this correction before totals update.`
            : slaBreached
              ? `${fileName} has waited since ${formatReportCommandDateTime(evidence.created_at)}. Ask the brand owner to review or intervene.`
              : `${fileName} is waiting for brand evidence review.`,
        id: `evidence:${evidence.id}`,
        impact: impactForKind(kind),
        kind,
        label: rejected
          ? "Rejected proof"
          : slaBreached
            ? "Review SLA breach"
            : correctionReturned
              ? "Correction returned"
              : "Needs brand review",
        leadershipNextAction: leadershipNextActionForKind(kind),
        nextStep: nextStepForKind(kind),
        owner: ownerForKind(kind),
        shareGate: shareGateForKind(kind),
        title: rejected
          ? "Proof correction open"
          : correctionReturned
            ? "Corrected proof awaiting brand review"
            : slaBreached
              ? "Proof review older than 24h"
              : "Proof evidence awaiting brand review",
        waitingLabel: formatReportCommandWaitingAge(evidence.created_at, now),
      };
    });

  const exportFailureRows: ReportCommandExceptionRow[] = exportRows.map((job) => {
    const kind: ReportCommandExceptionKind = "export_failure";
    return {
      actionHref: `/admin/campaigns/${job.campaign_id}?focus=reporting#admin-reporting-exceptions`,
      actionLabel: "Open campaign",
      campaign: getCampaign(campaigns, job.campaign_id),
      createdAt: job.created_at,
      clearance: clearanceForKind(kind),
      detail:
        job.error_message ?? `${job.format.toUpperCase()} export failed before storage.`,
      id: `export:${job.id}`,
      impact: impactForKind(kind),
      kind,
      label: "Export failure",
      leadershipNextAction: leadershipNextActionForKind(kind),
      nextStep: nextStepForKind(kind),
      owner: ownerForKind(kind),
      shareGate: shareGateForKind(kind),
      title: job.file_name
        ? `Report export failed: ${job.file_name}`
        : "Report export failed",
      waitingLabel: formatReportCommandWaitingAge(job.created_at, now),
    };
  });

  const rows = [
    ...taskRows,
    ...missingEvidenceRows,
    ...evidenceRowsForReview,
    ...exportFailureRows,
  ].sort(
    (a, b) =>
      priorityForKind(b.kind) - priorityForKind(a.kind) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const campaignReadiness = buildCampaignReadiness(rows);

  return {
    campaignHoldCount: campaignReadiness.length,
    campaignReadiness,
    correctionCount:
      tasks.filter((task) => task.status === "needs_revision").length +
      currentEvidenceRows.filter((row) => row.status === "correction").length,
    evidenceReviewCount: currentEvidenceRows.filter(
      (row) => row.status !== "correction",
    ).length,
    exportFailureCount: exportRows.length,
    missingEvidenceCount: missingEvidenceRows.length,
    missedCount: tasks.filter((task) => task.status === "missed").length,
    reviewSlaBreachCount: currentEvidenceRows.filter(
      (row) =>
        row.status !== "correction" &&
        isReportCommandReviewSlaBreached(row.evidence.created_at, now),
    ).length,
    rows,
  };
}
