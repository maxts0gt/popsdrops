"use server";

import { revalidatePath } from "next/cache";
import {
  getBrandWorkspaceForCurrentUser,
  type BrandWorkspaceSupabaseClient,
} from "@/lib/brand-workspace";
import { hasBrandWorkspacePermission } from "@/lib/brand-permissions";
import {
  assertCampaignAllowsContentDecision,
  assertCampaignAllowsCreatorWork,
  assertCampaignAllowsMetricSubmission,
} from "@/lib/campaigns/lifecycle";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPrivilegedNotification,
  createPrivilegedReportTaskForSubmission,
  markPrivilegedReportTaskSubmittedIfComplete,
} from "@/lib/supabase/privileged";
import {
  buildMetricValueRows,
  mapMetricValuesToLegacyPerformanceColumns,
} from "@/lib/reporting/metric-values";
import {
  getMissingRequiredProofMetrics,
  getRequiredProofMetricGroupsForSubmission,
  type RequiredProofMetricGroup,
} from "@/lib/reporting/required-proof-metrics";
import {
  buildReportCorrectionResubmittedNotification,
  buildReportReadyForReviewNotification,
} from "@/lib/reporting/report-notifications";
import { assertReportTaskAcceptsCreatorSubmission } from "@/lib/reporting/report-task-status";
import {
  isReportingPlatform,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import { getEvidenceStorageUri } from "@/lib/reporting/evidence-upload";
import { getUser } from "./auth";
import { assertCampaignMemberAgreementAccess } from "./campaign-agreements";
import { submitContentSchema, submitPerformanceSchema } from "@/lib/validations";

type SubmittedPerformanceMetricValue = {
  platform?: ReportingPlatform;
  metricKey: string;
  metricValue?: number;
  metricText?: string;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function getRequiredMetricGroupsForSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    campaignId: string;
    contentFormat: string | null;
    campaignPlatforms: string[];
    submissionPlatform: string | null;
  },
) {
  if (!input.submissionPlatform) return [];

  const { data: requirements, error } = await supabase
    .from("campaign_reporting_requirements")
    .select("platform, content_format, required_metric_keys")
    .eq("campaign_id", input.campaignId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  if (!requirements?.length) return [];

  return getRequiredProofMetricGroupsForSubmission({
    campaignPlatforms: input.campaignPlatforms,
    submissionPlatform: input.submissionPlatform,
    submissionContentFormat: input.contentFormat,
    requirements,
  });
}

function assertRequiredMetricValuesSubmitted(input: {
  primaryPlatform: string | null;
  requiredMetricGroups: RequiredProofMetricGroup[];
  metricValues: SubmittedPerformanceMetricValue[] | undefined;
  sparseMetrics: Record<string, unknown>;
}) {
  if (input.requiredMetricGroups.length === 0) return;
  if (!input.primaryPlatform || !isReportingPlatform(input.primaryPlatform)) return;

  const missingMetricKeys = getMissingRequiredProofMetrics({
    primaryPlatform: input.primaryPlatform,
    requiredGroups: input.requiredMetricGroups,
    metricValues: input.metricValues,
    sparseMetrics: input.sparseMetrics,
  });
  if (missingMetricKeys.length > 0) {
    throw new Error(
      `Submit all required proof metrics: ${missingMetricKeys.join(", ")}`,
    );
  }
}

async function assertBrandContentWorkspace(
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

export async function submitContent(input: {
  campaign_member_id: string;
  content_url: string;
  caption?: string;
  platform: string;
}) {
  const parsed = submitContentSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  // Verify user is the campaign member
  const { data: member } = await supabase
    .from("campaign_members")
    .select("id, campaign_id, creator_id, campaigns(status)")
    .eq("id", input.campaign_member_id)
    .single();

  if (!member || member.creator_id !== user.id) throw new Error("Not authorized");
  const memberCampaign = firstRelation(
    (member as {
      campaigns?: { status: string } | { status: string }[] | null;
    }).campaigns,
  );
  if (!memberCampaign) throw new Error("Campaign not found");
  assertCampaignAllowsCreatorWork(memberCampaign);
  await assertCampaignMemberAgreementAccess(member.id);

  const { data: latestSubmission } = await supabase
    .from("content_submissions")
    .select("id, version, revision_count, status")
    .eq("campaign_member_id", input.campaign_member_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isRevision = latestSubmission?.status === "revision_requested";

  const { data, error } = await supabase
    .from("content_submissions")
    .insert({
      campaign_member_id: input.campaign_member_id,
      content_url: input.content_url,
      caption: input.caption ?? null,
      platform: input.platform,
      status: "submitted",
      version: isRevision ? latestSubmission.version + 1 : 1,
      parent_submission_id: isRevision ? latestSubmission.id : null,
      revision_count: isRevision
        ? (latestSubmission.revision_count ?? 0)
        : 0,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Notify brand (in-app + email)
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("brand_id, title")
    .eq("id", member.campaign_id)
    .single();

  if (campaign) {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    await createPrivilegedNotification({
      user_id: campaign.brand_id,
      type: "content_submitted",
      title: "Content Submitted",
      body: `New content submitted for "${campaign.title}"`,
      data: {
        campaign_id: member.campaign_id,
        campaignId: member.campaign_id,
        campaignTitle: campaign.title,
        creatorName: creatorProfile?.full_name ?? "A creator",
        platform: input.platform,
        submission_id: data.id,
      },
    });
  }

  revalidatePath(`/i/campaigns/${member.campaign_id}`);
  return { id: data.id };
}

export async function approveContent(submissionId: string) {
  const user = await getUser();
  const supabase = await createClient();

  // Get submission with member and campaign info
  const { data: submission } = await supabase
    .from("content_submissions")
    .select("id, campaign_member_id, campaign_members(campaign_id, creator_id, campaigns(brand_id, title, status))")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const member = submission.campaign_members as unknown as {
    campaign_id: string;
    creator_id: string;
    campaigns: { brand_id: string; title: string; status: string };
  };

  const workspace = await assertBrandContentWorkspace(
    supabase,
    user.id,
    member.campaigns.brand_id,
  );
  void workspace;
  assertCampaignAllowsContentDecision(member.campaigns);

  const { error } = await supabase
    .from("content_submissions")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);

  await createPrivilegedNotification({
    user_id: member.creator_id,
    type: "content_approved",
    title: "Content Approved!",
    body: `Your content for "${member.campaigns.title}" has been approved`,
    data: {
      campaign_id: member.campaign_id,
      campaignId: member.campaign_id,
      campaignTitle: member.campaigns.title,
      submission_id: submissionId,
    },
  });

  revalidatePath(`/b/campaigns/${member.campaign_id}`);
}

export async function requestRevision(
  submissionId: string,
  feedback: string
) {
  if (!submissionId || !feedback || feedback.length < 5) {
    throw new Error("Feedback must be at least 5 characters");
  }

  const user = await getUser();
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("content_submissions")
    .select("id, campaign_member_id, version, revision_count, campaign_members(campaign_id, creator_id, campaigns(brand_id, title, max_revisions, status))")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const member = submission.campaign_members as unknown as {
    campaign_id: string;
    creator_id: string;
    campaigns: { brand_id: string; title: string; max_revisions: number; status: string };
  };

  const workspace = await assertBrandContentWorkspace(
    supabase,
    user.id,
    member.campaigns.brand_id,
  );
  void workspace;
  assertCampaignAllowsContentDecision(member.campaigns);

  // Update current submission
  const { error } = await supabase
    .from("content_submissions")
    .update({
      status: "revision_requested",
      feedback,
      reviewed_at: new Date().toISOString(),
      revision_count: (submission.revision_count ?? 0) + 1,
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);

  await createPrivilegedNotification({
    user_id: member.creator_id,
    type: "revision_requested",
    title: "Revision Requested",
    body: `Changes needed for your content in "${member.campaigns.title}"`,
    data: {
      campaign_id: member.campaign_id,
      campaignId: member.campaign_id,
      campaignTitle: member.campaigns.title,
      feedback,
      submission_id: submissionId,
    },
  });

  revalidatePath(`/b/campaigns/${member.campaign_id}`);
}

export async function publishContent(
  submissionId: string,
  publishedUrl: string
) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("content_submissions")
    .select("id, campaign_member_id, status, campaign_members(creator_id, campaign_id, campaigns(status))")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const memberRelation = firstRelation(
    submission.campaign_members as unknown as
      | {
          creator_id: string;
          campaign_id: string;
          campaigns: { status: string } | { status: string }[] | null;
        }
      | Array<{
          creator_id: string;
          campaign_id: string;
          campaigns: { status: string } | { status: string }[] | null;
        }>
      | null,
  );
  const memberCampaign = firstRelation(memberRelation?.campaigns);
  if (!memberRelation || !memberCampaign) throw new Error("Submission not found");
  const member = {
    creator_id: memberRelation.creator_id,
    campaign_id: memberRelation.campaign_id,
    campaigns: memberCampaign,
  } as {
    creator_id: string;
    campaign_id: string;
    campaigns: { status: string };
  };

  if (member.creator_id !== user.id) throw new Error("Not authorized");
  if (submission.status !== "approved") {
    throw new Error("Content must be approved before publishing");
  }
  assertCampaignAllowsCreatorWork(member.campaigns);
  await assertCampaignMemberAgreementAccess(submission.campaign_member_id);

  const { error } = await supabase
    .from("content_submissions")
    .update({
      status: "published",
      published_url: publishedUrl,
      published_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);

  await createPrivilegedReportTaskForSubmission({
    submissionId,
    campaignId: member.campaign_id,
    campaignMemberId: submission.campaign_member_id,
  });

  revalidatePath(`/i/campaigns/${member.campaign_id}`);
  revalidatePath(`/b/campaigns/${member.campaign_id}`);
}

export async function submitPerformance(input: {
  submission_id: string;
  report_task_id?: string;
  measurement_type: "initial_48h" | "final_7d" | "extended_30d";
  views?: number;
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  sends?: number;
  screenshots?: number;
  replies?: number;
  clicks?: number;
  completion_rate?: number;
  avg_watch_time_seconds?: number;
  subscriber_gains?: number;
  screenshot_url?: string;
  evidence_id?: string;
  ai_extraction_id?: string;
  ai_extraction_edited?: boolean;
  metric_values?: Array<{
    platform: "instagram" | "tiktok" | "youtube" | "facebook" | "snapchat" | "x" | "generic";
    metricKey: string;
    metricLabel: string;
    metricValue?: number;
    metricText?: string;
  }>;
}) {
  const parsed = submitPerformanceSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const {
    submission_id,
    report_task_id,
    evidence_id,
    ai_extraction_id: aiExtractionId,
    ai_extraction_edited: aiExtractionEdited,
    metric_values,
    screenshot_url,
    ...metrics
  } =
    parsed.data;

  const { data: submission } = await supabase
    .from("content_submissions")
    .select("id, status, platform, deliverable_id, campaign_member_id, campaign_members(campaign_id, creator_id, campaigns(status, platforms))")
    .eq("id", submission_id)
    .single();

  if (!submission) throw new Error("Submission not found");

  const memberRelation = Array.isArray(submission.campaign_members)
    ? submission.campaign_members[0]
    : submission.campaign_members;
  const memberCampaign = firstRelation(
    (memberRelation as
      | {
          campaigns?: { status: string; platforms?: string[] | null } | { status: string; platforms?: string[] | null }[] | null;
        }
      | null
      | undefined)?.campaigns,
  );
  const member = memberRelation
    ? { id: submission.campaign_member_id, ...memberRelation, campaigns: memberCampaign }
    : null;

  if (!member || !member.campaigns || member.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  assertCampaignAllowsCreatorWork(member.campaigns);
  assertCampaignAllowsMetricSubmission({
    status: member.campaigns.status,
    submissionStatus: submission.status,
  });
  await assertCampaignMemberAgreementAccess(member.id);

  let submissionContentFormat: string | null = null;
  if (submission.deliverable_id) {
    const { data: deliverable, error: deliverableError } = await supabase
      .from("campaign_deliverables")
      .select("content_type")
      .eq("id", submission.deliverable_id)
      .eq("campaign_id", member.campaign_id)
      .maybeSingle();

    if (deliverableError) throw new Error(deliverableError.message);
    submissionContentFormat = deliverable?.content_type ?? null;
  }

  let reportTaskId: string | null = null;
  let reportTaskStatusBeforeSubmit: string | null = null;
  if (report_task_id) {
    const { data: reportTask } = await supabase
      .from("campaign_report_tasks")
      .select("id, campaign_id, campaign_member_id, due_at, status")
      .eq("id", report_task_id)
      .single();

    if (!reportTask) throw new Error("Report task not found");
    if (
      reportTask.campaign_member_id !== member.id ||
      reportTask.campaign_id !== member.campaign_id
    ) {
      throw new Error("Not authorized");
    }

    assertReportTaskAcceptsCreatorSubmission(reportTask.status);
    reportTaskId = reportTask.id;
    reportTaskStatusBeforeSubmit = reportTask.status;
  }

  let evidenceStorageUri: string | null = null;
  if (evidence_id) {
    if (!reportTaskId) {
      throw new Error("Evidence uploads require a report task");
    }

    const { data: evidence } = await supabase
      .from("content_performance_evidence")
      .select(
        "id, campaign_id, campaign_member_id, report_task_id, submission_id, performance_id, storage_path",
      )
      .eq("id", evidence_id)
      .single();

    if (!evidence) throw new Error("Evidence not found");
    if (evidence.performance_id) {
      throw new Error("Evidence has already been linked");
    }
    if (
      evidence.report_task_id !== reportTaskId ||
      evidence.campaign_member_id !== member.id ||
      evidence.campaign_id !== member.campaign_id ||
      (evidence.submission_id != null && evidence.submission_id !== submission_id)
    ) {
      throw new Error("Not authorized");
    }

    evidenceStorageUri = getEvidenceStorageUri(evidence.storage_path);
  }

  if (aiExtractionId) {
    if (!reportTaskId || !evidence_id) {
      throw new Error("AI extraction confirmation requires report proof");
    }
    if (!metric_values?.length) {
      throw new Error("AI extraction confirmation requires metric values");
    }

    const { data: extraction } = await supabase
      .from("content_performance_ai_extractions")
      .select("id, evidence_id, report_task_id, status")
      .eq("id", aiExtractionId)
      .eq("report_task_id", reportTaskId)
      .single();

    if (!extraction) throw new Error("AI extraction not found");
    if (extraction.evidence_id !== evidence_id) {
      throw new Error("AI extraction does not match the evidence proof");
    }
    if (extraction.status !== "pending_confirmation") {
      throw new Error("AI extraction has already been resolved");
    }
  }

  const requiredMetricGroups = await getRequiredMetricGroupsForSubmission(supabase, {
    campaignId: member.campaign_id,
    contentFormat: submissionContentFormat,
    campaignPlatforms: member.campaigns.platforms ?? [],
    submissionPlatform: submission.platform,
  });
  assertRequiredMetricValuesSubmitted({
    primaryPlatform: submission.platform,
    requiredMetricGroups,
    metricValues: metric_values,
    sparseMetrics: metrics,
  });

  const submittedAt = new Date().toISOString();
  const primaryMetricValues = metric_values?.filter(
    (metric) => metric.platform === submission.platform,
  ) ?? [];
  const sparseMetricColumns = primaryMetricValues.length
    ? mapMetricValuesToLegacyPerformanceColumns(primaryMetricValues)
    : {};
  const screenshotUrl =
    screenshot_url && screenshot_url.trim() !== ""
      ? screenshot_url.trim()
      : evidenceStorageUri;

  const { data, error } = await supabase
    .from("content_performance")
    .insert({
      submission_id,
      report_task_id: reportTaskId,
      reported_at: submittedAt,
      screenshot_url: screenshotUrl,
      ...metrics,
      ...sparseMetricColumns,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (evidence_id) {
    const admin = createAdminClient();
    const { error: evidenceUpdateError } = await admin
      .from("content_performance_evidence")
      .update({
        performance_id: data.id,
        updated_at: submittedAt,
      })
      .eq("id", evidence_id);

    if (evidenceUpdateError) throw new Error(evidenceUpdateError.message);
  }

  if (metric_values?.length) {
    const primaryReportingPlatform: ReportingPlatform = isReportingPlatform(
      submission.platform ?? "",
    )
      ? (submission.platform as ReportingPlatform)
      : "generic";
    const rows = buildMetricValueRows({
      performanceId: data.id,
      reportTaskId,
      platform: primaryReportingPlatform,
      metricValues: metric_values.map((metric) => ({
        platform: metric.platform,
        metricKey: metric.metricKey,
        metricLabel: metric.metricLabel,
        metricValue: metric.metricValue,
        metricText: metric.metricText,
      })),
      sourceType: aiExtractionId ? "creator_confirmed" : "creator_manual",
      confirmedByCreator: true,
    });

    const { error: metricValueError } = await supabase
      .from("content_performance_metric_values")
      .insert(rows);

    if (metricValueError) throw new Error(metricValueError.message);
  }

  if (aiExtractionId) {
    const admin = createAdminClient();
    const aiExtractionStatus = aiExtractionEdited
      ? "edited_by_creator"
      : "accepted_by_creator";
    const { error: extractionUpdateError } = await admin
      .from("content_performance_ai_extractions")
      .update({
        status: aiExtractionStatus,
      })
      .eq("id", aiExtractionId);

    if (extractionUpdateError) throw new Error(extractionUpdateError.message);
  }

  if (reportTaskId) {
    const reportSubmission = await markPrivilegedReportTaskSubmittedIfComplete({
      reportTaskId,
      submittedAt,
    });

    const alreadySubmitted = [
      "submitted",
      "submitted_late",
      "verified",
    ].includes(reportTaskStatusBeforeSubmit ?? "");

    if (reportSubmission.completed === true && !alreadySubmitted) {
      const [{ data: campaign }, { data: creatorProfile }] = await Promise.all([
        supabase
          .from("campaigns")
          .select("brand_id, title")
          .eq("id", member.campaign_id)
          .single(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single(),
      ]);

      if (campaign?.brand_id) {
        const notificationBuilder =
          reportTaskStatusBeforeSubmit === "needs_revision"
            ? buildReportCorrectionResubmittedNotification
            : buildReportReadyForReviewNotification;
        const creatorName = creatorProfile?.full_name ?? "A creator";

        await createPrivilegedNotification(
          notificationBuilder({
            brandId: campaign.brand_id,
            campaignId: member.campaign_id,
            campaignTitle: campaign.title,
            creatorName,
            reportTaskId,
          }),
        );
      }
    }
  }

  // Recalculate creator performance aggregates
  await recalculateCreatorPerformance(supabase, user.id);

  revalidatePath(`/i/campaigns/${member.campaign_id}`);
  revalidatePath(`/b/campaigns/${member.campaign_id}`);
  revalidatePath(`/b/campaigns/${member.campaign_id}/report`);

  return { id: data.id };
}

/**
 * Recalculate aggregated performance metrics on creator_profiles.
 * Called after new performance data is submitted.
 */
async function recalculateCreatorPerformance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  creatorId: string
) {
  // Get all memberships for this creator
  const { data: memberships } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("creator_id", creatorId);

  if (!memberships || memberships.length === 0) return;

  const memberIds = memberships.map((m) => m.id);

  // Get all submissions for these memberships
  const { data: submissions } = await supabase
    .from("content_submissions")
    .select(
      `id, campaign_member_id,
       content_performance ( views, likes, comments, shares, saves )`
    )
    .in("campaign_member_id", memberIds);

  if (!submissions) return;

  let totalViews = 0;
  let totalEngagements = 0;

  for (const sub of submissions) {
    const perfs = Array.isArray(sub.content_performance)
      ? sub.content_performance
      : sub.content_performance
        ? [sub.content_performance]
        : [];

    for (const p of perfs as Array<Record<string, number | null>>) {
      totalViews += p.views || 0;
      totalEngagements +=
        (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
    }
  }

  const avgER = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

  await supabase
    .from("creator_profiles")
    .update({
      total_views: totalViews,
      total_engagements: totalEngagements,
      avg_engagement_rate: Math.round(avgER * 10) / 10,
    })
    .eq("profile_id", creatorId);
}
