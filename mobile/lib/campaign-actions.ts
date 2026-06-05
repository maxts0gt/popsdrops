import { supabase } from "./supabase";
import {
  acceptCampaignAgreementSchema,
  submitApplicationSchema,
  submitContentSchema,
  submitPerformanceSchema,
} from "../../shared/validations";
import {
  EVIDENCE_BUCKET_ID,
  buildEvidenceStoragePath,
  getEvidenceFileValidationError,
  getEvidenceStorageUri,
  getEvidenceTypeFromMime,
  resolveEvidenceMimeType,
  sanitizeEvidenceFileName,
} from "../../shared/evidence-upload";

async function assertCampaignMemberAgreementAccess(
  campaignMemberId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("campaign_member_agreement_status")
    .select("status")
    .eq("campaign_member_id", campaignMemberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data && !["not_required", "signed"].includes(data.status)) {
    throw new Error("Sign the campaign rules before continuing.");
  }
}

function createEvidenceUuid(): string {
  const runtimeCrypto = (
    globalThis as {
      crypto?: { randomUUID?: () => string };
    }
  ).crypto;
  if (runtimeCrypto?.randomUUID) return runtimeCrypto.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    const hex = token === "x" ? value : (value & 0x3) | 0x8;
    return hex.toString(16);
  });
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isApplicationDeadlinePassed(value: string | null | undefined) {
  if (!value) return false;

  const deadlineTime = new Date(value).getTime();
  return Number.isFinite(deadlineTime) && deadlineTime < Date.now();
}

function assertCampaignAllowsApplicationWithdrawal(
  campaign: { status: string; application_deadline: string | null } | null,
) {
  if (!campaign || campaign.status !== "recruiting") {
    throw new Error("Application withdrawal is closed for this campaign stage.");
  }

  if (isApplicationDeadlinePassed(campaign.application_deadline)) {
    throw new Error("The application deadline has already passed.");
  }
}

function assertCampaignAllowsCreatorWork(
  campaign: { status: string } | null,
) {
  if (!campaign || !["in_progress", "publishing", "monitoring"].includes(campaign.status)) {
    throw new Error("Creator work is closed for this campaign stage.");
  }
}

const reportingPlatforms = new Set([
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
  "x",
  "generic",
]);

const creatorSubmittedMetricLabels = {
  views: "Views",
  reach: "Reach",
  impressions: "Impressions",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  sends: "Sends",
  screenshots: "Screenshots",
  replies: "Replies",
  clicks: "Clicks",
  completion_rate: "Completion rate",
  avg_watch_time_seconds: "Avg watch time",
  subscriber_gains: "Subscriber gains",
} as const;

type CreatorSubmittedMetricKey = keyof typeof creatorSubmittedMetricLabels;
type CreatorSubmittedMetricInput = Partial<
  Record<CreatorSubmittedMetricKey, number | null | undefined>
>;

function normalizeReportingPlatform(platform: string | null | undefined) {
  return platform && reportingPlatforms.has(platform) ? platform : "generic";
}

export function buildCreatorSubmittedMetricValueRows(input: {
  performanceId: string;
  reportTaskId?: string | null;
  platform?: string | null;
  metrics: CreatorSubmittedMetricInput;
}) {
  const platform = normalizeReportingPlatform(input.platform);
  const confirmedAt = new Date().toISOString();

  return (Object.keys(creatorSubmittedMetricLabels) as CreatorSubmittedMetricKey[])
    .flatMap((metricKey) => {
      const metricValue = input.metrics[metricKey];
      if (typeof metricValue !== "number" || !Number.isFinite(metricValue)) {
        return [];
      }

      return [
        {
          performance_id: input.performanceId,
          report_task_id: input.reportTaskId ?? null,
          platform,
          metric_key: metricKey,
          metric_label: creatorSubmittedMetricLabels[metricKey],
          metric_value: metricValue,
          metric_text: null,
          source_type: "creator_manual",
          confirmed_by_creator: true,
          confirmed_at: confirmedAt,
        },
      ];
    });
}

async function upsertCreatorSubmittedMetricValueRows(input: {
  performanceId: string;
  reportTaskId?: string | null;
  platform?: string | null;
  metrics: CreatorSubmittedMetricInput;
}): Promise<void> {
  const rows = buildCreatorSubmittedMetricValueRows(input);
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("content_performance_metric_values")
    .upsert(rows, { onConflict: "performance_id,platform,metric_key" });

  if (error) throw new Error(error.message);
}

export async function acceptCampaignAgreement(input: {
  agreementId: string;
  campaignId: string;
  typedName: string;
  acceptedRules: Record<string, boolean>;
}): Promise<void> {
  const parsed = acceptCampaignAgreementSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: agreement, error: agreementError } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, version, rules, content_hash")
    .eq("id", parsed.data.agreementId)
    .eq("campaign_id", parsed.data.campaignId)
    .eq("status", "published")
    .single();

  if (agreementError || !agreement) {
    throw new Error(agreementError?.message ?? "Agreement is not available.");
  }

  const { data: member, error: memberError } = await supabase
    .from("campaign_members")
    .select("id, campaign_id, creator_id")
    .eq("campaign_id", parsed.data.campaignId)
    .eq("creator_id", user.id)
    .single();

  if (memberError || !member) {
    throw new Error(memberError?.message ?? "Campaign membership not found.");
  }

  const { error } = await supabase.from("campaign_agreement_acceptances").insert({
    agreement_id: agreement.id,
    campaign_id: agreement.campaign_id,
    campaign_member_id: member.id,
    creator_id: user.id,
    typed_name: parsed.data.typedName,
    accepted_rules: parsed.data.acceptedRules,
    accepted_content_hash: agreement.content_hash,
    accepted_version: agreement.version,
  });

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Apply to Campaign
// ---------------------------------------------------------------------------

export async function applyToCampaign(input: {
  campaign_id: string;
  proposed_rate: number;
  pitch: string;
}): Promise<{ id: string }> {
  const parsed = submitApplicationSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify campaign is open
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, application_deadline")
    .eq("id", input.campaign_id)
    .single();

  if (!campaign || campaign.status !== "recruiting") {
    throw new Error("This campaign is not open for applications.");
  }

  if (
    campaign.application_deadline &&
    new Date(campaign.application_deadline).getTime() < Date.now()
  ) {
    throw new Error("The application deadline has already passed.");
  }

  const { data, error } = await supabase
    .from("campaign_applications")
    .insert({
      campaign_id: input.campaign_id,
      creator_id: user.id,
      proposed_rate: input.proposed_rate,
      pitch: input.pitch,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Respond to Counter-Offer
// ---------------------------------------------------------------------------

export async function respondToCounterOffer(
  applicationId: string,
  accept: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (accept) {
    // Use RPC for atomic accept + member insert
    const { error } = await supabase.rpc("accept_counter_offer", {
      p_application_id: applicationId,
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("campaign_applications")
      .update({ status: "rejected" })
      .eq("id", applicationId)
      .eq("creator_id", user.id)
      .eq("status", "counter_offer")
      .select("id")
      .single();

    if (error) throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Withdraw Application
// ---------------------------------------------------------------------------

export async function withdrawApplication(applicationId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: application, error: applicationError } = await supabase
    .from("campaign_applications")
    .select("campaign_id, creator_id, status, campaigns(status, application_deadline)")
    .eq("id", applicationId)
    .single();

  if (applicationError || !application || application.creator_id !== user.id) {
    throw new Error(applicationError?.message ?? "Not authorized");
  }

  if (!["pending", "counter_offer"].includes(application.status)) {
    throw new Error("Application cannot be withdrawn.");
  }

  const campaign = firstRelation(
    application.campaigns as
      | { status: string; application_deadline: string | null }
      | { status: string; application_deadline: string | null }[]
      | null,
  );
  assertCampaignAllowsApplicationWithdrawal(campaign);

  const { error } = await supabase
    .from("campaign_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("creator_id", user.id)
    .eq("status", application.status)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Submit Content
// ---------------------------------------------------------------------------

export async function submitContent(input: {
  campaign_member_id: string;
  deliverable_id?: string;
  content_url: string;
  caption?: string;
  platform: string;
}): Promise<{ id: string }> {
  const parsed = submitContentSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify membership
  const { data: member } = await supabase
    .from("campaign_members")
    .select("id, creator_id, campaigns(status)")
    .eq("id", input.campaign_member_id)
    .single();

  if (!member || member.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  const memberCampaign = firstRelation(
    (member as {
      campaigns?: { status: string } | { status: string }[] | null;
    }).campaigns,
  );
  assertCampaignAllowsCreatorWork(memberCampaign);
  await assertCampaignMemberAgreementAccess(input.campaign_member_id);

  // Check for revision
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
      deliverable_id: input.deliverable_id ?? null,
      content_url: input.content_url,
      caption: input.caption ?? null,
      platform: input.platform,
      status: "submitted",
      version: isRevision ? latestSubmission.version + 1 : 1,
      parent_submission_id: isRevision ? latestSubmission.id : null,
      revision_count: isRevision ? (latestSubmission.revision_count ?? 0) : 0,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Publish Content (mark as published with URL)
// ---------------------------------------------------------------------------

export async function publishContent(
  submissionId: string,
  publishedUrl: string,
): Promise<void> {
  try {
    new URL(publishedUrl);
  } catch {
    throw new Error("Invalid published URL");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: submission } = await supabase
    .from("content_submissions")
    .select("id, campaign_member_id, status, campaign_members(creator_id, campaign_id, campaigns(status))")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) throw new Error("Submission not found");
  if (submission.status !== "approved") {
    throw new Error("Submission must be approved before publishing");
  }
  const memberRelation = firstRelation(
    (submission as {
      campaign_members?:
        | {
            creator_id: string;
            campaign_id: string;
            campaigns?: { status: string } | { status: string }[] | null;
          }
        | Array<{
            creator_id: string;
            campaign_id: string;
            campaigns?: { status: string } | { status: string }[] | null;
          }>
        | null;
    }).campaign_members,
  );
  const memberCampaign = firstRelation(memberRelation?.campaigns);
  if (!memberRelation || memberRelation.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  assertCampaignAllowsCreatorWork(memberCampaign);
  await assertCampaignMemberAgreementAccess(submission.campaign_member_id);

  const { data, error } = await supabase
    .from("content_submissions")
    .update({
      status: "published",
      published_url: publishedUrl,
      published_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "approved")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Submission must be approved before publishing");
  }
}

// ---------------------------------------------------------------------------
// Upload Performance Evidence
// ---------------------------------------------------------------------------

export type PerformanceEvidenceFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export async function uploadPerformanceEvidenceFile(input: {
  reportTaskId: string;
  submissionId?: string;
  file: PerformanceEvidenceFile;
}): Promise<{ id: string; storagePath: string; storageUri: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: task, error: taskError } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, campaign_member_id, campaign_members(creator_id, campaigns(status))")
    .eq("id", input.reportTaskId)
    .single();

  if (taskError || !task) {
    throw new Error(taskError?.message ?? "Report task not found");
  }

  const taskMember = firstRelation(
    task.campaign_members as
      | {
          creator_id: string;
          campaigns?: { status: string } | { status: string }[] | null;
        }
      | Array<{
          creator_id: string;
          campaigns?: { status: string } | { status: string }[] | null;
        }>
      | null,
  );
  if (!taskMember || taskMember.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  assertCampaignAllowsCreatorWork(firstRelation(taskMember.campaigns));
  await assertCampaignMemberAgreementAccess(task.campaign_member_id);

  if (input.submissionId) {
    const { data: submission, error: submissionError } = await supabase
      .from("content_submissions")
      .select("id, campaign_member_id")
      .eq("id", input.submissionId)
      .single();

    if (submissionError || !submission) {
      throw new Error(submissionError?.message ?? "Submission not found");
    }
    if (submission.campaign_member_id !== task.campaign_member_id) {
      throw new Error("Not authorized");
    }
  }

  const response = await fetch(input.file.uri);
  if (!response.ok) {
    throw new Error("Could not read the selected proof file.");
  }
  const body = await response.arrayBuffer();
  const sizeBytes = input.file.size ?? body.byteLength;
  const mimeType = resolveEvidenceMimeType({
    fileName: input.file.name,
    mimeType: input.file.mimeType,
  });
  const validationError = getEvidenceFileValidationError({
    mimeType,
    sizeBytes,
  });
  if (validationError) throw new Error(validationError);

  const evidenceId = createEvidenceUuid();
  const storagePath = buildEvidenceStoragePath({
    campaignId: task.campaign_id,
    campaignMemberId: task.campaign_member_id,
    reportTaskId: task.id,
    evidenceId,
    fileName: input.file.name,
  });

  const { data: evidence, error: evidenceError } = await supabase
    .from("content_performance_evidence")
    .insert({
      id: evidenceId,
      campaign_id: task.campaign_id,
      campaign_member_id: task.campaign_member_id,
      report_task_id: task.id,
      submission_id: input.submissionId ?? null,
      uploaded_by: user.id,
      evidence_type: getEvidenceTypeFromMime(mimeType),
      bucket_id: EVIDENCE_BUCKET_ID,
      storage_path: storagePath,
      file_name: sanitizeEvidenceFileName(input.file.name),
      mime_type: mimeType,
      size_bytes: sizeBytes,
      verification_status: "submitted",
    })
    .select("id, storage_path")
    .single();

  if (evidenceError || !evidence) {
    throw new Error(evidenceError?.message ?? "Evidence upload could not be prepared");
  }

  const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET_ID).upload(
    evidence.storage_path,
    body,
    {
      contentType: mimeType,
      upsert: false,
    },
  );

  if (uploadError) throw new Error(uploadError.message);

  return {
    id: evidence.id,
    storagePath: evidence.storage_path,
    storageUri: getEvidenceStorageUri(evidence.storage_path),
  };
}

// ---------------------------------------------------------------------------
// Submit Performance Metrics
// ---------------------------------------------------------------------------

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
  evidence_id?: string;
  screenshot_url?: string;
}): Promise<{ id: string }> {
  const parsed = submitPerformanceSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { submission_id, evidence_id } = parsed.data;
  const metrics = {
    report_task_id: parsed.data.report_task_id,
    measurement_type: parsed.data.measurement_type,
    views: parsed.data.views,
    reach: parsed.data.reach,
    impressions: parsed.data.impressions,
    likes: parsed.data.likes,
    comments: parsed.data.comments,
    shares: parsed.data.shares,
    saves: parsed.data.saves,
    sends: parsed.data.sends,
    screenshots: parsed.data.screenshots,
    replies: parsed.data.replies,
    clicks: parsed.data.clicks,
    completion_rate: parsed.data.completion_rate,
    avg_watch_time_seconds: parsed.data.avg_watch_time_seconds,
    subscriber_gains: parsed.data.subscriber_gains,
    screenshot_url: parsed.data.screenshot_url,
  };
  const { data: submission } = await supabase
    .from("content_submissions")
    .select("id, platform, campaign_member_id")
    .eq("id", submission_id)
    .maybeSingle();

  if (!submission) throw new Error("Submission not found");

  const { data: member } = await supabase
    .from("campaign_members")
    .select("id, campaign_id, creator_id, campaigns(status)")
    .eq("id", submission.campaign_member_id)
    .single();

  if (!member || member.creator_id !== user.id) {
    throw new Error("Not authorized");
  }
  const memberCampaign = firstRelation(
    (member as {
      campaigns?: { status: string } | { status: string }[] | null;
    }).campaigns,
  );
  assertCampaignAllowsCreatorWork(memberCampaign);

  await assertCampaignMemberAgreementAccess(submission.campaign_member_id);

  let reportTaskId: string | null = metrics.report_task_id ?? null;
  if (reportTaskId) {
    const { data: reportTask, error: reportTaskError } = await supabase
      .from("campaign_report_tasks")
      .select("id, campaign_id, campaign_member_id")
      .eq("id", reportTaskId)
      .single();

    if (reportTaskError || !reportTask) {
      throw new Error(reportTaskError?.message ?? "Report task not found");
    }
    if (
      reportTask.campaign_member_id !== member.id ||
      reportTask.campaign_id !== member.campaign_id
    ) {
      throw new Error("Not authorized");
    }
    reportTaskId = reportTask.id;
  }

  if (evidence_id) {
    if (!reportTaskId) {
      throw new Error("Evidence uploads require a report task");
    }

    const { data: evidence, error: evidenceError } = await supabase
      .from("content_performance_evidence")
      .select("id, campaign_id, campaign_member_id, report_task_id, submission_id, performance_id")
      .eq("id", evidence_id)
      .single();

    if (evidenceError || !evidence) {
      throw new Error(evidenceError?.message ?? "Evidence not found");
    }
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
  }

  const existingQuery = supabase
    .from("content_performance")
    .select("id")
    .eq("submission_id", submission_id)
    .eq("measurement_type", metrics.measurement_type)
    .order("reported_at", { ascending: false })
    .limit(1);

  const { data: existingPerformance } = metrics.report_task_id
    ? await existingQuery.eq("report_task_id", metrics.report_task_id).maybeSingle()
    : await existingQuery.is("report_task_id", null).maybeSingle();

  if (existingPerformance?.id) {
    const { data, error } = await supabase
      .from("content_performance")
      .update({
        ...metrics,
        reported_at: new Date().toISOString(),
        verification_status: "submitted",
      })
      .eq("id", existingPerformance.id)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    const performanceId = data.id;

    await upsertCreatorSubmittedMetricValueRows({
      performanceId,
      reportTaskId,
      platform: submission.platform,
      metrics,
    });

    if (evidence_id) {
      const { error: evidenceLinkError } = await supabase.rpc(
        "link_creator_performance_evidence",
        {
          p_evidence_id: evidence_id,
          p_performance_id: performanceId,
          p_submission_id: submission_id,
        },
      );

      if (evidenceLinkError) throw new Error(evidenceLinkError.message);
    }
    if (reportTaskId) {
      const { error: reportTaskError } = await supabase.rpc(
        "submit_creator_report_task",
        {
          p_task_id: reportTaskId,
          p_submitted_at: new Date().toISOString(),
        },
      );

      if (reportTaskError) throw new Error(reportTaskError.message);
    }

    return { id: performanceId };
  }

  const { data, error } = await supabase
    .from("content_performance")
    .insert({
      submission_id,
      ...metrics,
      reported_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await upsertCreatorSubmittedMetricValueRows({
    performanceId: data.id,
    reportTaskId,
    platform: submission.platform,
    metrics,
  });

  if (evidence_id) {
    const { error: evidenceLinkError } = await supabase.rpc(
      "link_creator_performance_evidence",
      {
        p_evidence_id: evidence_id,
        p_performance_id: data.id,
        p_submission_id: submission_id,
      },
    );

    if (evidenceLinkError) throw new Error(evidenceLinkError.message);
  }
  if (reportTaskId) {
    const { error: reportTaskError } = await supabase.rpc(
      "submit_creator_report_task",
      {
        p_task_id: reportTaskId,
        p_submitted_at: new Date().toISOString(),
      },
    );

    if (reportTaskError) throw new Error(reportTaskError.message);
  }
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Mark Notifications Read
// ---------------------------------------------------------------------------

export async function markNotificationRead(notificationId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) throw new Error(error.message);
}
