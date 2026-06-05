"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EVIDENCE_BUCKET_ID,
  buildEvidenceStoragePath,
  getEvidenceFileValidationError,
  getEvidenceStorageUri,
  getEvidenceTypeFromMime,
  sanitizeEvidenceFileName,
} from "@/lib/reporting/evidence-upload";
import {
  buildReportCorrectionNotification,
  buildReportFollowUpNotification,
} from "@/lib/reporting/report-notifications";
import {
  getBrandWorkspaceForCurrentUser,
  type BrandWorkspaceSupabaseClient,
} from "@/lib/brand-workspace";
import { hasBrandWorkspacePermission } from "@/lib/brand-permissions";
import {
  assertCampaignAllowsProofDecision,
  assertCampaignAllowsProofSubmission,
} from "@/lib/campaigns/lifecycle";
import { createPrivilegedNotification } from "@/lib/supabase/privileged";
import {
  buildReportTaskReviewUpdate,
  getCurrentEvidenceReviewStatuses,
  type EvidenceReviewStatus,
} from "@/lib/reporting/evidence-review";
import { assertReportTaskAcceptsCreatorSubmission } from "@/lib/reporting/report-task-status";
import { buildMetricValueRows } from "@/lib/reporting/metric-values";
import { createExtraReportTaskDraft } from "@/lib/reporting/task-schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";
import { assertCampaignMemberAgreementAccess } from "./campaign-agreements";

type ConfirmableReportingPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "snapchat"
  | "x"
  | "generic";

type ExpectedMetric = {
  metricKey: string;
  metricLabel: string;
};

type AnalyzePerformanceEvidenceResult =
  | {
      status: "skipped";
      reason: string;
      userId?: string;
    }
  | {
      status: "manual_required";
      reason: string;
      extractionId: null;
      metricValues: [];
      userId?: string;
    }
  | {
      status: "pending_confirmation";
      extractionId: string | null;
      metricValues: Array<{
        metricKey: string;
        metricLabel: string;
        metricValue?: number;
        metricText?: string;
        confidence?: number;
      }>;
      userId?: string;
    };

const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format",
  );

const reportingPlatformSchema = z.enum([
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
  "x",
  "generic",
]);

const createPerformanceEvidenceUploadSchema = z.object({
  reportTaskId: uuidLike,
  submissionId: uuidLike.optional(),
  fileName: z.string().trim().min(1).max(220),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().positive(),
});

const createExtraPerformanceReportTaskSchema = z.object({
  campaignMemberId: uuidLike,
});

async function assertBrandReportingWorkspace(
  supabase: BrandWorkspaceSupabaseClient,
  userId: string,
  campaignBrandId: string,
) {
  const workspace = await getBrandWorkspaceForCurrentUser(supabase, userId);
  if (
    !workspace ||
    workspace.brandId !== campaignBrandId ||
    !hasBrandWorkspacePermission(workspace.role, "review_content")
  ) {
    throw new Error("Not authorized");
  }
  return workspace;
}

const analyzePerformanceEvidenceSchema = z.object({
  evidenceId: uuidLike,
  reportTaskId: uuidLike,
  platform: reportingPlatformSchema,
  expectedMetrics: z
    .array(
      z.object({
        metricKey: z.string().trim().min(1).max(80),
        metricLabel: z.string().trim().min(1).max(120),
      }),
    )
    .max(40)
    .optional(),
});

const reviewPerformanceEvidenceSchema = z.object({
  evidenceId: uuidLike,
  decision: z.enum(["verified", "needs_revision"]),
  correctionNote: z
    .string()
    .trim()
    .min(1, "Correction reason is required")
    .max(280, "Correction reason must be 280 characters or less")
    .optional(),
});

const reviewPerformanceProofLinkSchema = z.object({
  performanceId: uuidLike,
  decision: z.enum(["verified", "needs_revision"]),
  correctionNote: z
    .string()
    .trim()
    .min(1, "Correction reason is required")
    .max(280, "Correction reason must be 280 characters or less")
    .optional(),
});

const markReportTaskExcusedSchema = z.object({
  reportTaskId: uuidLike,
});

const requestMissedReportFollowUpSchema = z.object({
  reportTaskId: uuidLike,
});

const requestMissedReportFollowUpBatchSchema = z.object({
  reportTaskIds: z.array(uuidLike).min(1).max(100),
});

export type PerformanceEvidenceReviewDecision = z.infer<
  typeof reviewPerformanceEvidenceSchema
>["decision"];

export type PerformanceProofLinkReviewDecision = z.infer<
  typeof reviewPerformanceProofLinkSchema
>["decision"];

function assertProofReviewIsPending({
  evidenceStatus,
  performanceStatus,
}: {
  evidenceStatus?: string | null;
  performanceStatus?: string | null;
}) {
  if (evidenceStatus && evidenceStatus !== "submitted") {
    throw new Error("Proof has already been reviewed");
  }
  if (performanceStatus && performanceStatus !== "submitted") {
    throw new Error("Proof has already been reviewed");
  }
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildManualExtractionFallback(
  userId: string,
  reason = "Evidence extraction returned no data",
): AnalyzePerformanceEvidenceResult {
  return {
    status: "manual_required",
    reason,
    extractionId: null,
    metricValues: [],
    userId,
  };
}

export async function createPerformanceEvidenceUpload(input: {
  reportTaskId: string;
  submissionId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const parsed = createPerformanceEvidenceUploadSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const validationError = getEvidenceFileValidationError({
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
  });
  if (validationError) throw new Error(validationError);

  const user = await getUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, campaign_member_id, status, campaigns(status), campaign_members(creator_id)")
    .eq("id", parsed.data.reportTaskId)
    .single();

  if (!task) throw new Error("Report task not found");

  const taskMember = firstRelation(
    task.campaign_members as { creator_id: string } | { creator_id: string }[] | null,
  );
  if (!taskMember || taskMember.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  const taskCampaign = firstRelation(
    task.campaigns as { status: string } | { status: string }[] | null,
  );
  if (!taskCampaign) throw new Error("Campaign not found");
  assertCampaignAllowsProofSubmission(taskCampaign);
  assertReportTaskAcceptsCreatorSubmission(task.status);
  await assertCampaignMemberAgreementAccess(task.campaign_member_id);

  if (parsed.data.submissionId) {
    const { data: submission } = await supabase
      .from("content_submissions")
      .select("id, campaign_member_id")
      .eq("id", parsed.data.submissionId)
      .single();

    if (!submission) throw new Error("Submission not found");
    if (submission.campaign_member_id !== task.campaign_member_id) {
      throw new Error("Not authorized");
    }
  }

  const evidenceId = randomUUID();
  const storagePath = buildEvidenceStoragePath({
    campaignId: task.campaign_id,
    campaignMemberId: task.campaign_member_id,
    reportTaskId: task.id,
    evidenceId,
    fileName: parsed.data.fileName,
  });

  const { data: evidence, error } = await supabase
    .from("content_performance_evidence")
    .insert({
      id: evidenceId,
      campaign_id: task.campaign_id,
      campaign_member_id: task.campaign_member_id,
      report_task_id: task.id,
      submission_id: parsed.data.submissionId ?? null,
      uploaded_by: user.id,
      evidence_type: getEvidenceTypeFromMime(parsed.data.mimeType),
      bucket_id: EVIDENCE_BUCKET_ID,
      storage_path: storagePath,
      file_name: sanitizeEvidenceFileName(parsed.data.fileName),
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      verification_status: "submitted",
    })
    .select("id, storage_path")
    .single();

  if (error) throw new Error(error.message);
  if (!evidence) throw new Error("Evidence upload could not be prepared");

  return {
    id: evidence.id,
    bucket: EVIDENCE_BUCKET_ID,
    storagePath: evidence.storage_path,
    storageUri: getEvidenceStorageUri(evidence.storage_path),
  };
}

export async function analyzePerformanceEvidence(input: {
  evidenceId: string;
  reportTaskId: string;
  platform: ConfirmableReportingPlatform;
  expectedMetrics?: ExpectedMetric[];
}) {
  const parsed = analyzePerformanceEvidenceSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, campaign_member_id, status, campaigns(status), campaign_members(creator_id)")
    .eq("id", parsed.data.reportTaskId)
    .single();

  const taskMember = firstRelation(
    task?.campaign_members as { creator_id: string } | { creator_id: string }[] | null,
  );
  if (!task || !taskMember || taskMember.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  const taskCampaign = firstRelation(
    task.campaigns as { status: string } | { status: string }[] | null,
  );
  if (!taskCampaign) throw new Error("Campaign not found");
  assertCampaignAllowsProofSubmission(taskCampaign);
  assertReportTaskAcceptsCreatorSubmission(task.status);
  await assertCampaignMemberAgreementAccess(task.campaign_member_id);

  const { data, error } = await supabase.functions.invoke("analyze-performance-evidence", {
    body: parsed.data,
  });

  if (error) {
    return buildManualExtractionFallback(user.id, error.message);
  }
  if (!data || typeof data !== "object") {
    return buildManualExtractionFallback(user.id);
  }

  return {
    ...(data as AnalyzePerformanceEvidenceResult),
    userId: user.id,
  };
}

export async function createExtraPerformanceReportTask(input: {
  campaignMemberId: string;
}) {
  const parsed = createExtraPerformanceReportTaskSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("campaign_members")
    .select("id, campaign_id, creator_id, campaigns(status)")
    .eq("id", parsed.data.campaignMemberId)
    .single();

  if (!member) throw new Error("Campaign member not found");
  if (member.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  const memberCampaign = firstRelation(
    (member as {
      campaigns?: { status: string } | { status: string }[] | null;
    }).campaigns,
  );
  if (!memberCampaign) throw new Error("Campaign not found");
  assertCampaignAllowsProofSubmission(memberCampaign);
  await assertCampaignMemberAgreementAccess(member.id);

  const admin = createAdminClient();
  const { data: existingTasks, error: existingTasksError } = await admin
    .from("campaign_report_tasks")
    .select("id, status")
    .eq("campaign_member_id", member.id);

  if (existingTasksError) throw new Error(existingTasksError.message);
  if (!existingTasks || existingTasks.length === 0) {
    throw new Error("Campaign has no reporting schedule");
  }

  const hasOpenTask = existingTasks.some(
    (task) =>
      !["submitted", "submitted_late", "verified", "excused"].includes(
        task.status,
      ),
  );
  if (hasOpenTask) {
    throw new Error("Finish the open report read first");
  }

  const readId = randomUUID();
  const requestedAt = new Date().toISOString();
  const draft = createExtraReportTaskDraft({
    campaignId: member.campaign_id,
    campaignMemberId: member.id,
    readId,
    dueAt: requestedAt,
  });

  const { data: task, error } = await admin
    .from("campaign_report_tasks")
    .insert(draft)
    .select(
      "id, task_key, period_start, period_end, due_at, status, submitted_at, review_note",
    )
    .single();

  if (error) throw new Error(error.message);
  if (!task) throw new Error("Report task could not be created");

  revalidatePath(`/i/campaigns/${member.campaign_id}`);
  revalidatePath(`/b/campaigns/${member.campaign_id}`);
  revalidatePath(`/b/campaigns/${member.campaign_id}/report`);

  return task;
}

export async function confirmAiExtraction(input: {
  extractionId: string;
  performanceId: string;
  reportTaskId: string;
  platform: ConfirmableReportingPlatform;
  values: Array<{
    metricKey: string;
    metricLabel: string;
    metricValue?: number;
    metricText?: string;
  }>;
}) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, campaign_member_id, status, campaigns(status), campaign_members(creator_id)")
    .eq("id", input.reportTaskId)
    .single();

  const taskMember = firstRelation(
    task?.campaign_members as { creator_id: string } | { creator_id: string }[] | null,
  );
  if (!task || !taskMember || taskMember.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  const taskCampaign = firstRelation(
    task.campaigns as { status: string } | { status: string }[] | null,
  );
  if (!taskCampaign) throw new Error("Campaign not found");
  assertCampaignAllowsProofSubmission(taskCampaign);
  assertReportTaskAcceptsCreatorSubmission(task.status);
  await assertCampaignMemberAgreementAccess(task.campaign_member_id);

  const { data: extraction } = await supabase
    .from("content_performance_ai_extractions")
    .select("id, report_task_id, status")
    .eq("id", input.extractionId)
    .eq("report_task_id", input.reportTaskId)
    .single();

  if (!extraction) throw new Error("Extraction not found");
  if (extraction.status !== "pending_confirmation") {
    throw new Error("Extraction has already been resolved");
  }

  const { data: performance } = await supabase
    .from("content_performance")
    .select("id, report_task_id, verification_status")
    .eq("id", input.performanceId)
    .single();

  if (!performance) throw new Error("Performance proof not found");
  if (performance.report_task_id !== input.reportTaskId) {
    throw new Error("Performance proof does not match this report task");
  }
  if (
    performance.verification_status === "brand_verified" ||
    performance.verification_status === "screenshot_verified" ||
    performance.verification_status === "rejected"
  ) {
    throw new Error("Performance proof has already been reviewed");
  }

  const rows = buildMetricValueRows({
    performanceId: input.performanceId,
    reportTaskId: input.reportTaskId,
    platform: input.platform,
    metricValues: input.values,
    sourceType: "creator_confirmed",
    confirmedByCreator: true,
  });

  const { error: upsertError } = await supabase
    .from("content_performance_metric_values")
    .upsert(rows, { onConflict: "performance_id,platform,metric_key" });

  if (upsertError) throw new Error(upsertError.message);

  const { error: updateError } = await supabase
    .from("content_performance_ai_extractions")
    .update({
      status: "accepted_by_creator",
    })
    .eq("id", extraction.id);

  if (updateError) throw new Error(updateError.message);

  if (task?.campaign_id) {
    revalidatePath(`/i/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}/report`);
  }

  return { ok: true, userId: user.id };
}

export async function reviewPerformanceEvidence(input: {
  evidenceId: string;
  decision: PerformanceEvidenceReviewDecision;
  correctionNote?: string;
}) {
  const parsed = reviewPerformanceEvidenceSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const isVerified = parsed.data.decision === "verified";
  const correctionNote = isVerified ? null : parsed.data.correctionNote?.trim();
  if (!isVerified && !correctionNote) {
    throw new Error("Correction reason is required");
  }
  const evidenceStatus = isVerified ? "verified" : "rejected";
  const performanceStatus = isVerified ? "brand_verified" : "rejected";
  const reviewedAt = new Date().toISOString();

  const { data: evidence, error: evidenceLookupError } = await supabase
    .from("content_performance_evidence")
    .select("id, campaign_id, report_task_id, performance_id, verification_status, content_performance ( verification_status )")
    .eq("id", parsed.data.evidenceId)
    .single();

  if (evidenceLookupError || !evidence) {
    throw new Error("Evidence not found or not authorized");
  }
  if (!evidence.performance_id) {
    throw new Error("Evidence is not linked to a performance read");
  }

  const { data: campaignForReview } = await supabase
    .from("campaigns")
    .select("brand_id, status")
    .eq("id", evidence.campaign_id)
    .single();

  if (!campaignForReview) throw new Error("Not authorized");
  const workspace = await assertBrandReportingWorkspace(
    supabase,
    user.id,
    campaignForReview.brand_id,
  );
  void workspace;
  assertCampaignAllowsProofDecision(campaignForReview);

  const evidencePerformance = firstRelation(
    evidence.content_performance as
      | { verification_status: string | null }
      | { verification_status: string | null }[]
      | null,
  );
  assertProofReviewIsPending({
    evidenceStatus: evidence.verification_status,
    performanceStatus: evidencePerformance?.verification_status,
  });

  const { data: reviewedEvidence, error: evidenceReviewError } = await supabase
    .from("content_performance_evidence")
    .update({
      verification_status: evidenceStatus,
      review_note: correctionNote,
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    })
    .eq("id", evidence.id)
    .eq("verification_status", "submitted")
    .select("id")
    .single();

  if (evidenceReviewError || !reviewedEvidence) {
    throw new Error("Evidence not found or not authorized");
  }

  const admin = createAdminClient();
  const { error: performanceError } = await admin
    .from("content_performance")
    .update({
      verification_status: performanceStatus,
      verified_at: isVerified ? reviewedAt : null,
      verified_by: isVerified ? user.id : null,
    })
    .eq("id", evidence.performance_id)
    .eq("verification_status", "submitted");

  if (performanceError) throw new Error(performanceError.message);

  const { data: task, error: taskLookupError } = await admin
    .from("campaign_report_tasks")
    .select("status, campaigns(title), campaign_members(creator_id)")
    .eq("id", evidence.report_task_id)
    .single();

  if (taskLookupError || !task) throw new Error("Report task not found");

  const { data: linkedEvidence, error: linkedEvidenceError } = await admin
    .from("content_performance_evidence")
    .select(
      `id,
       submission_id,
       verification_status,
       created_at,
       content_performance ( measurement_type )`,
    )
    .eq("report_task_id", evidence.report_task_id)
    .not("performance_id", "is", null);

  if (linkedEvidenceError) throw new Error(linkedEvidenceError.message);

  const evidenceStatuses = getCurrentEvidenceReviewStatuses(
    (linkedEvidence || []).map((row, index) => {
      const performance = firstRelation(
        row.content_performance as
          | { measurement_type: string | null }
          | { measurement_type: string | null }[]
          | null,
      );

      return {
        status: row.verification_status as EvidenceReviewStatus,
        submissionId: row.submission_id,
        measurementType: performance?.measurement_type ?? null,
        createdAt: row.created_at ?? String(index),
      };
    }),
  );
  const taskUpdate = buildReportTaskReviewUpdate({
    evidenceStatuses,
    correctionNote,
    currentTaskStatus: task.status,
    reviewedAt,
  });

  const { error: taskError } = await admin
    .from("campaign_report_tasks")
    .update(taskUpdate)
    .eq("id", evidence.report_task_id);

  if (taskError) throw new Error(taskError.message);

  const taskCampaign = firstRelation(
    task.campaigns as { title: string } | { title: string }[] | null,
  );
  const taskMember = firstRelation(
    task.campaign_members as
      | { creator_id: string }
      | { creator_id: string }[]
      | null,
  );

  if (!isVerified && taskMember?.creator_id && correctionNote) {
    const campaignTitle = taskCampaign?.title ?? "Campaign";

    await createPrivilegedNotification(
      buildReportCorrectionNotification({
        campaignId: evidence.campaign_id,
        campaignTitle,
        correctionNote,
        creatorId: taskMember.creator_id,
        evidenceId: evidence.id,
        reportTaskId: evidence.report_task_id,
      }),
    );
  }

  revalidatePath(`/i/campaigns/${evidence.campaign_id}`);
  revalidatePath(`/b/campaigns/${evidence.campaign_id}`);
  revalidatePath(`/b/campaigns/${evidence.campaign_id}/report`);

  return {
    ok: true,
    evidenceId: evidence.id,
    decision: parsed.data.decision,
  };
}

export async function reviewPerformanceProofLink(input: {
  performanceId: string;
  decision: PerformanceProofLinkReviewDecision;
  correctionNote?: string;
}) {
  const parsed = reviewPerformanceProofLinkSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const isVerified = parsed.data.decision === "verified";
  const correctionNote = isVerified ? null : parsed.data.correctionNote?.trim();
  if (!isVerified && !correctionNote) {
    throw new Error("Correction reason is required");
  }
  const performanceStatus = isVerified ? "brand_verified" : "rejected";
  const reviewedAt = new Date().toISOString();

  const { data: performance, error: performanceLookupError } = await supabase
    .from("content_performance")
    .select("id, report_task_id, submission_id, measurement_type, reported_at, screenshot_url, verification_status")
    .eq("id", parsed.data.performanceId)
    .single();

  if (performanceLookupError || !performance) {
    throw new Error("Performance proof not found or not authorized");
  }
  if (!performance.report_task_id) {
    throw new Error("Performance proof is not linked to a report task");
  }
  if (!performance.screenshot_url?.startsWith("http")) {
    throw new Error("Proof link is required");
  }

  const { data: task, error: taskLookupError } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, status, campaigns(brand_id, title, status), campaign_members(creator_id)")
    .eq("id", performance.report_task_id)
    .single();

  if (taskLookupError || !task) throw new Error("Report task not found");

  const taskCampaign = firstRelation(
    task.campaigns as
      | { brand_id: string; title: string | null; status: string }
      | { brand_id: string; title: string | null; status: string }[]
      | null,
  );
  const taskMember = firstRelation(
    task.campaign_members as
      | { creator_id: string | null }
      | { creator_id: string | null }[]
      | null,
  );

  if (!taskCampaign) throw new Error("Not authorized");
  const workspace = await assertBrandReportingWorkspace(
    supabase,
    user.id,
    taskCampaign.brand_id,
  );
  void workspace;
  assertCampaignAllowsProofDecision(taskCampaign);
  assertProofReviewIsPending({
    performanceStatus: performance.verification_status,
  });

  const admin = createAdminClient();
  const { error: performanceReviewError } = await admin
    .from("content_performance")
    .update({
      verification_status: performanceStatus,
      verified_at: isVerified ? reviewedAt : null,
      verified_by: isVerified ? user.id : null,
    })
    .eq("id", performance.id)
    .eq("verification_status", "submitted");

  if (performanceReviewError) throw new Error(performanceReviewError.message);

  const { data: linkedPerformanceRows, error: linkedPerformanceError } = await admin
    .from("content_performance")
    .select("id, submission_id, measurement_type, reported_at, verification_status")
    .eq("report_task_id", performance.report_task_id);

  if (linkedPerformanceError) throw new Error(linkedPerformanceError.message);

  const evidenceStatuses = getCurrentEvidenceReviewStatuses(
    (linkedPerformanceRows || []).map((row, index) => {
      const rowStatus =
        row.id === performance.id
          ? performanceStatus
          : row.verification_status;
      const status: EvidenceReviewStatus =
        rowStatus === "brand_verified" || rowStatus === "screenshot_verified"
          ? "verified"
          : rowStatus === "rejected"
            ? "rejected"
            : "submitted";

      return {
        status,
        submissionId: row.submission_id,
        measurementType: row.measurement_type,
        createdAt: row.reported_at ?? String(index),
      };
    }),
  );
  const taskUpdate = buildReportTaskReviewUpdate({
    evidenceStatuses,
    correctionNote,
    currentTaskStatus: task.status,
    reviewedAt,
  });

  const { error: taskError } = await admin
    .from("campaign_report_tasks")
    .update(taskUpdate)
    .eq("id", performance.report_task_id);

  if (taskError) throw new Error(taskError.message);

  if (!isVerified && taskMember?.creator_id && correctionNote) {
    const campaignTitle = taskCampaign.title ?? "Campaign";

    await createPrivilegedNotification(
      buildReportCorrectionNotification({
        campaignId: task.campaign_id,
        campaignTitle,
        correctionNote,
        creatorId: taskMember.creator_id,
        performanceId: performance.id,
        reportTaskId: performance.report_task_id,
      }),
    );
  }

  revalidatePath(`/i/campaigns/${task.campaign_id}`);
  revalidatePath(`/b/campaigns/${task.campaign_id}`);
  revalidatePath(`/b/campaigns/${task.campaign_id}/report`);

  return {
    ok: true,
    performanceId: performance.id,
    decision: parsed.data.decision,
  };
}

export async function markReportTaskExcused(input: { reportTaskId: string }) {
  const parsed = markReportTaskExcusedSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, status, campaigns(brand_id, status)")
    .eq("id", parsed.data.reportTaskId)
    .single();

  if (!task) throw new Error("Report task not found");

  const campaign = firstRelation(
    task.campaigns as
      | { brand_id: string; status: string }
      | { brand_id: string; status: string }[]
      | null,
  );
  if (!campaign) throw new Error("Not authorized");
  const workspace = await assertBrandReportingWorkspace(
    supabase,
    user.id,
    campaign.brand_id,
  );
  if (!workspace || campaign.brand_id !== workspace.brandId) {
    throw new Error("Not authorized");
  }
  assertCampaignAllowsProofDecision(campaign);
  if (task.status !== "missed") {
    throw new Error("Only missed report tasks can be excused");
  }

  const excusedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign_report_tasks")
    .update({
      status: "excused",
      excused_at: excusedAt,
      missed_at: null,
      review_note: null,
    })
    .eq("id", parsed.data.reportTaskId);

  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns`);
  revalidatePath(`/b/campaigns/${task.campaign_id}`);
  revalidatePath(`/b/campaigns/${task.campaign_id}/report`);
  revalidatePath(`/i/campaigns/${task.campaign_id}`);

  return {
    ok: true,
    reportTaskId: task.id,
    status: "excused",
  };
}

export async function requestMissedReportFollowUp(input: {
  reportTaskId: string;
}) {
  const parsed = requestMissedReportFollowUpSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, status, campaigns(brand_id, title, status), campaign_members(creator_id)")
    .eq("id", parsed.data.reportTaskId)
    .single();

  if (!task) throw new Error("Report task not found");

  const campaign = firstRelation(
    task.campaigns as
      | { brand_id: string; title: string | null; status: string }
      | { brand_id: string; title: string | null; status: string }[]
      | null,
  );
  const member = firstRelation(
    task.campaign_members as
      | { creator_id: string | null }
      | { creator_id: string | null }[]
      | null,
  );

  if (!campaign) throw new Error("Not authorized");
  const workspace = await assertBrandReportingWorkspace(
    supabase,
    user.id,
    campaign.brand_id,
  );
  if (!workspace || campaign.brand_id !== workspace.brandId) {
    throw new Error("Not authorized");
  }
  assertCampaignAllowsProofDecision(campaign);
  if (task.status !== "missed") {
    throw new Error("Only missed report tasks can receive follow-up");
  }
  if (!member?.creator_id) {
    throw new Error("Report task creator not found");
  }

  const followedUpAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign_report_tasks")
    .update({
      review_note: "Follow-up requested",
      updated_at: followedUpAt,
    })
    .eq("id", task.id);

  if (error) throw new Error(error.message);

  const campaignTitle = campaign.title ?? "Campaign";

  await createPrivilegedNotification(
    buildReportFollowUpNotification({
      campaignId: task.campaign_id,
      campaignTitle,
      creatorId: member.creator_id,
      reportTaskId: task.id,
    }),
  );

  revalidatePath(`/b/campaigns`);
  revalidatePath(`/b/campaigns/${task.campaign_id}`);
  revalidatePath(`/b/campaigns/${task.campaign_id}/report`);
  revalidatePath(`/i/campaigns/${task.campaign_id}`);

  return {
    ok: true,
    reportTaskId: task.id,
    status: "follow_up_requested",
  };
}

export async function requestMissedReportFollowUpsBatch(input: {
  reportTaskIds: string[];
}) {
  const parsed = requestMissedReportFollowUpBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const reportTaskIds = [...new Set(parsed.data.reportTaskIds)];
  const user = await getUser();
  const supabase = await createClient();

  const { data: tasks, error: taskError } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, status, campaigns(brand_id, title, status), campaign_members(creator_id)")
    .in("id", reportTaskIds);

  if (taskError) throw new Error(taskError.message);
  if (!tasks || tasks.length !== reportTaskIds.length) {
    throw new Error("Report tasks not found");
  }

  const campaigns = tasks.map((task) => {
    const campaign = firstRelation(
      task.campaigns as
        | { brand_id: string; title: string | null; status: string }
        | { brand_id: string; title: string | null; status: string }[]
        | null,
    );
    if (!campaign) throw new Error("Not authorized");
    return campaign;
  });
  const members = tasks.map((task) => {
    const member = firstRelation(
      task.campaign_members as
        | { creator_id: string | null }
        | { creator_id: string | null }[]
        | null,
    );
    if (!member?.creator_id) throw new Error("Report task creator not found");
    return { creator_id: member.creator_id };
  });
  const campaignIds = new Set(tasks.map((task) => task.campaign_id));
  const brandIds = new Set(campaigns.map((campaign) => campaign.brand_id));

  if (campaignIds.size !== 1 || brandIds.size !== 1) {
    throw new Error("Select report tasks from one campaign");
  }

  const campaign = campaigns[0];
  const workspace = await assertBrandReportingWorkspace(
    supabase,
    user.id,
    campaign.brand_id,
  );
  if (!workspace || campaign.brand_id !== workspace.brandId) {
    throw new Error("Not authorized");
  }
  assertCampaignAllowsProofDecision(campaign);

  const invalidTask = tasks.find((task) => task.status !== "missed");
  if (invalidTask) {
    throw new Error("Only missed report tasks can receive follow-up");
  }

  const followedUpAt = new Date().toISOString();
  const admin = createAdminClient();
  const campaignId = tasks[0].campaign_id;
  const campaignTitle = campaign.title ?? "Campaign";

  for (const [index, task] of tasks.entries()) {
    const { error } = await admin
      .from("campaign_report_tasks")
      .update({
        review_note: "Follow-up requested",
        updated_at: followedUpAt,
      })
      .eq("id", task.id);

    if (error) throw new Error(error.message);

    await createPrivilegedNotification(
      buildReportFollowUpNotification({
        campaignId: task.campaign_id,
        campaignTitle,
        creatorId: members[index].creator_id,
        reportTaskId: task.id,
      }),
    );
  }

  revalidatePath(`/b/campaigns`);
  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath(`/b/campaigns/${campaignId}/report`);
  revalidatePath(`/i/campaigns/${campaignId}`);

  return {
    ok: true,
    campaignId,
    requestedCount: tasks.length,
  };
}
