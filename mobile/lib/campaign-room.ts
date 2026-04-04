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

export type CampaignMember = {
  id: string;
  campaignId: string;
  creatorId: string;
  acceptedRate: number | null;
};

export type CampaignRoomData = {
  brief: CampaignBrief;
  member: CampaignMember;
  deliverables: Deliverable[];
  submissions: ContentSubmission[];
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

  // Now fetch submissions for this member
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
  };
}
