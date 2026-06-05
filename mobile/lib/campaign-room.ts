import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignBrief = {
  id: string;
  title: string;
  brandName: string;
  briefDescription: string | null;
  briefRequirements: string | null;
  briefDos: string | null;
  briefDonts: string | null;
  contentDueDate: string | null;
  postingWindowStart: string | null;
  postingWindowEnd: string | null;
  maxRevisions: number;
  status: string;
};

export type Deliverable = {
  id: string;
  platform: string;
  contentType: string;
  quantity: number;
  notes: string | null;
};

export type ContentSubmission = {
  id: string;
  campaignMemberId: string;
  deliverableId: string | null;
  contentUrl: string;
  caption: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  platform: string;
  status: string;
  version: number;
  feedback: string | null;
  revisionCount: number;
  parentSubmissionId: string | null;
  submittedAt: string | null;
};

export type ContentPerformance = {
  id: string;
  submissionId: string;
  reportTaskId: string | null;
  measurementType: "initial_48h" | "final_7d" | "extended_30d";
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  screenshotUrl: string | null;
  verificationStatus: string | null;
  reportedAt: string | null;
};

export type CampaignReportTask = {
  id: string;
  campaignId: string;
  campaignMemberId: string;
  taskKey: string;
  dueAt: string;
  status: string;
  submittedAt: string | null;
  reviewNote: string | null;
};

export type CampaignMember = {
  id: string;
  campaignId: string;
  creatorId: string;
  acceptedRate: number | null;
};

export type CampaignAgreementStatus =
  | "not_required"
  | "pending"
  | "signed"
  | "needs_reacceptance";

export type CampaignAgreement = {
  id: string;
  campaignId: string;
  version: number;
  title: string;
  rules: Record<string, { title: string; body: string }>;
  agreementBody: string | null;
  fileName: string | null;
  requiresTypedName: boolean;
};

export type CampaignAgreementMemberStatus = {
  status: CampaignAgreementStatus;
  agreementId: string | null;
};

export type CampaignRoomData = {
  brief: CampaignBrief;
  member: CampaignMember;
  deliverables: Deliverable[];
  submissions: ContentSubmission[];
  performance: ContentPerformance[];
  reportTasks: CampaignReportTask[];
  agreement: CampaignAgreement | null;
  agreementStatus: CampaignAgreementMemberStatus;
};

// ---------------------------------------------------------------------------
// Load campaign room data
// ---------------------------------------------------------------------------

export async function loadCampaignRoom(
  campaignId: string,
  userId: string,
): Promise<CampaignRoomData> {
  const [campaignRes, memberRes, deliverablesRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        `id, title, brief_description, brief_requirements, brief_dos, brief_donts,
         content_due_date, posting_window_start, posting_window_end, max_revisions, status,
         profiles!campaigns_brand_id_fkey ( full_name, brand_profiles ( company_name ) )`,
      )
      .eq("id", campaignId)
      .single(),
    supabase
      .from("campaign_members")
      .select("id, campaign_id, creator_id, accepted_rate")
      .eq("campaign_id", campaignId)
      .eq("creator_id", userId)
      .single(),
    supabase
      .from("campaign_deliverables")
      .select("id, platform, content_type, quantity, notes")
      .eq("campaign_id", campaignId),
  ]);

  if (campaignRes.error) throw new Error(campaignRes.error.message);
  if (memberRes.error) throw new Error(memberRes.error.message);
  if (deliverablesRes.error) throw new Error(deliverablesRes.error.message);

  const campaign = campaignRes.data;
  const member = memberRes.data;

  const { data: submissionsData, error: subError } = await supabase
    .from("content_submissions")
    .select(
      `id, campaign_member_id, deliverable_id, content_url, caption, published_url,
       published_at, platform, status, version, feedback, revision_count,
       parent_submission_id, submitted_at`,
    )
    .eq("campaign_member_id", member.id)
    .order("version", { ascending: false });

  if (subError) throw new Error(subError.message);

  const submissionIds = (submissionsData ?? []).map((submission) => submission.id);

  const [{ data: performanceData, error: performanceError }, { data: reportTaskData, error: reportTaskError }] =
    await Promise.all([
      submissionIds.length > 0
        ? supabase
            .from("content_performance")
            .select(
              `id, submission_id, report_task_id, measurement_type, views, likes,
               comments, shares, saves, screenshot_url, verification_status, reported_at`,
            )
            .in("submission_id", submissionIds)
            .order("reported_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("campaign_report_tasks")
        .select(
          "id, campaign_id, campaign_member_id, task_key, due_at, status, submitted_at, review_note",
        )
        .eq("campaign_member_id", member.id)
        .order("due_at", { ascending: true }),
    ]);

  if (performanceError) throw new Error(performanceError.message);
  if (reportTaskError) throw new Error(reportTaskError.message);

  const { data: agreementStatusData, error: agreementStatusError } = await supabase
    .from("campaign_member_agreement_status")
    .select("agreement_id, status")
    .eq("campaign_member_id", member.id)
    .maybeSingle();

  if (agreementStatusError) throw new Error(agreementStatusError.message);

  let agreement: CampaignAgreement | null = null;
  if (
    agreementStatusData?.agreement_id &&
    agreementStatusData.status !== "not_required"
  ) {
    const { data: agreementData, error: agreementError } = await supabase
      .from("campaign_agreements")
      .select(
        "id, campaign_id, version, title, rules, agreement_body, file_name, requires_typed_name",
      )
      .eq("id", agreementStatusData.agreement_id)
      .eq("status", "published")
      .maybeSingle();

    if (agreementError) throw new Error(agreementError.message);
    agreement = agreementData
      ? {
          id: agreementData.id,
          campaignId: agreementData.campaign_id,
          version: agreementData.version,
          title: agreementData.title,
          rules: agreementData.rules as Record<string, { title: string; body: string }>,
          agreementBody: agreementData.agreement_body,
          fileName: agreementData.file_name,
          requiresTypedName: agreementData.requires_typed_name,
        }
      : null;
  }

  // Extract brand name
  const brandProfile = Array.isArray(campaign.profiles)
    ? campaign.profiles[0]
    : campaign.profiles;
  const brandSub = brandProfile?.brand_profiles;
  const brandProfileData = Array.isArray(brandSub) ? brandSub[0] : brandSub;
  const brandName =
    brandProfileData?.company_name ?? brandProfile?.full_name ?? "Brand";

  return {
    brief: {
      id: campaign.id,
      title: campaign.title,
      brandName,
      briefDescription: campaign.brief_description,
      briefRequirements: campaign.brief_requirements,
      briefDos: campaign.brief_dos,
      briefDonts: campaign.brief_donts,
      contentDueDate: campaign.content_due_date,
      postingWindowStart: campaign.posting_window_start,
      postingWindowEnd: campaign.posting_window_end,
      maxRevisions: campaign.max_revisions ?? 3,
      status: campaign.status,
    },
    member: {
      id: member.id,
      campaignId: member.campaign_id,
      creatorId: member.creator_id,
      acceptedRate: member.accepted_rate,
    },
    deliverables: (deliverablesRes.data ?? []).map((d) => ({
      id: d.id,
      platform: d.platform,
      contentType: d.content_type,
      quantity: d.quantity,
      notes: d.notes,
    })),
    submissions: (submissionsData ?? []).map((s) => ({
      id: s.id,
      campaignMemberId: s.campaign_member_id,
      deliverableId: s.deliverable_id,
      contentUrl: s.content_url,
      caption: s.caption,
      publishedUrl: s.published_url,
      publishedAt: s.published_at,
      platform: s.platform,
      status: s.status,
      version: s.version,
      feedback: s.feedback,
      revisionCount: s.revision_count ?? 0,
      parentSubmissionId: s.parent_submission_id,
      submittedAt: s.submitted_at,
    })),
    performance: (performanceData ?? []).map((row) => ({
      id: row.id,
      submissionId: row.submission_id,
      reportTaskId: row.report_task_id,
      measurementType: row.measurement_type,
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
      screenshotUrl: row.screenshot_url,
      verificationStatus: row.verification_status,
      reportedAt: row.reported_at,
    })),
    reportTasks: (reportTaskData ?? []).map((task) => ({
      id: task.id,
      campaignId: task.campaign_id,
      campaignMemberId: task.campaign_member_id,
      taskKey: task.task_key,
      dueAt: task.due_at,
      status: task.status,
      submittedAt: task.submitted_at,
      reviewNote: task.review_note,
    })),
    agreement,
    agreementStatus: {
      agreementId: agreementStatusData?.agreement_id ?? null,
      status:
        (agreementStatusData?.status as CampaignAgreementStatus | undefined) ??
        "not_required",
    },
  };
}
