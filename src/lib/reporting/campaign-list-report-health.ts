import {
  getCurrentEvidenceReviewRows,
  type EvidenceReviewStatus,
} from "./evidence-review";
import { hasEvidenceProofReference } from "./evidence-upload";

export interface CampaignListReportHealth {
  missed: number;
  corrections: number;
  toReview: number;
}

export interface CampaignListReportTaskHealthRow {
  id: string;
  campaign_id: string;
  status: string;
}

export interface CampaignListEvidenceHealthRow {
  id: string;
  campaign_id: string;
  campaign_member_id: string;
  created_at?: string | null;
  performance_id?: string | null;
  report_task_id: string;
  submission_id?: string | null;
  verification_status: EvidenceReviewStatus;
}

export interface CampaignListPerformanceHealthRow {
  id: string;
  campaign_id: string;
  created_at?: string | null;
  report_task_id?: string | null;
  reported_at?: string | null;
  screenshot_url?: string | null;
  submission_id?: string | null;
  verification_status?: string | null;
}

function evidenceHealthGroupKey(row: CampaignListEvidenceHealthRow) {
  if (row.performance_id) return `performance:${row.performance_id}`;
  if (row.submission_id) {
    return `submission:${row.report_task_id}:${row.submission_id}`;
  }

  return `task:${row.report_task_id}:${row.campaign_member_id}`;
}

function getSubmittedTaskFallback(status: string) {
  return status === "submitted" || status === "submitted_late";
}

function isVerifiedPerformanceStatus(status: string | null | undefined) {
  return status === "brand_verified" || status === "screenshot_verified";
}

export function buildCampaignReportHealth({
  campaignIds,
  evidenceRows,
  performanceRows = [],
  reportTasks,
}: {
  campaignIds: string[];
  evidenceRows: CampaignListEvidenceHealthRow[];
  performanceRows?: CampaignListPerformanceHealthRow[];
  reportTasks: CampaignListReportTaskHealthRow[];
}): Map<string, CampaignListReportHealth> {
  const healthByCampaignId = new Map<string, CampaignListReportHealth>();
  const evidencePerformanceIds = new Set(
    evidenceRows
      .map((row) => row.performance_id)
      .filter((id): id is string => Boolean(id)),
  );

  for (const campaignId of campaignIds) {
    const campaignTasks = reportTasks.filter(
      (task) => task.campaign_id === campaignId,
    );
    const taskIdsWithProof = new Set<string>();
    const campaignEvidence = evidenceRows.filter(
      (evidence) => evidence.campaign_id === campaignId,
    );
    const campaignPerformanceRows = performanceRows.filter(
      (performance) => performance.campaign_id === campaignId,
    );
    let corrections = 0;
    let toReview = 0;

    for (const evidence of campaignEvidence) {
      taskIdsWithProof.add(evidence.report_task_id);
    }

    const currentEvidenceRows = getCurrentEvidenceReviewRows(
      campaignEvidence.map((row) => ({
        ...row,
        createdAt: row.created_at,
        groupId: evidenceHealthGroupKey(row),
        status: row.verification_status,
      })),
    );

    for (const entry of currentEvidenceRows) {
      if (entry.status === "correction") corrections += 1;
      if (
        entry.status === "evidence_review" ||
        entry.status === "correction_returned"
      ) {
        toReview += 1;
      }
    }

    for (const performance of campaignPerformanceRows) {
      if (!performance.report_task_id) continue;
      if (!hasEvidenceProofReference(performance.screenshot_url)) continue;
      if (evidencePerformanceIds.has(performance.id)) continue;

      taskIdsWithProof.add(performance.report_task_id);

      if (performance.verification_status === "rejected") {
        corrections += 1;
      } else if (
        !isVerifiedPerformanceStatus(performance.verification_status)
      ) {
        toReview += 1;
      }
    }

    for (const task of campaignTasks) {
      if (taskIdsWithProof.has(task.id)) continue;
      if (task.status === "needs_revision") corrections += 1;
      if (getSubmittedTaskFallback(task.status)) toReview += 1;
    }

    healthByCampaignId.set(campaignId, {
      corrections,
      missed: campaignTasks.filter((task) => task.status === "missed").length,
      toReview,
    });
  }

  return healthByCampaignId;
}
