"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedNotification } from "@/lib/supabase/privileged";
import { getUser } from "./auth";
import { submitContentSchema, submitPerformanceSchema } from "@/lib/validations";
import { sendNotificationEmail } from "@/lib/email/notify";

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
    .select("id, campaign_id, creator_id")
    .eq("id", input.campaign_member_id)
    .single();

  if (!member || member.creator_id !== user.id) throw new Error("Not authorized");

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
    await createPrivilegedNotification({
      user_id: campaign.brand_id,
      type: "content_submitted",
      title: "Content Submitted",
      body: `New content submitted for "${campaign.title}"`,
      data: { campaign_id: member.campaign_id, submission_id: data.id },
    });

    // Fetch brand email + creator name for email
    const [{ data: brandProfile }, { data: creatorProfile }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("id", campaign.brand_id).single(),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);

    if (brandProfile?.email) {
      sendNotificationEmail({
        type: "content_submitted",
        recipientEmail: brandProfile.email,
        recipientName: brandProfile.full_name ?? "Brand",
        data: {
          creatorName: creatorProfile?.full_name ?? "A creator",
          campaignTitle: campaign.title,
          campaignId: member.campaign_id,
          platform: input.platform,
        },
      });
    }
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
    .select("id, campaign_member_id, campaign_members(campaign_id, creator_id, campaigns(brand_id, title))")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const member = submission.campaign_members as unknown as {
    campaign_id: string;
    creator_id: string;
    campaigns: { brand_id: string; title: string };
  };

  if (member.campaigns.brand_id !== user.id) throw new Error("Not authorized");

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
    data: { campaign_id: member.campaign_id, submission_id: submissionId },
  });

  // Email creator
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", member.creator_id)
    .single();

  if (creatorProfile?.email) {
    sendNotificationEmail({
      type: "content_approved",
      recipientEmail: creatorProfile.email,
      recipientName: creatorProfile.full_name ?? "Creator",
      data: {
        campaignTitle: member.campaigns.title,
        campaignId: member.campaign_id,
      },
    });
  }

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
    .select("id, campaign_member_id, version, revision_count, campaign_members(campaign_id, creator_id, campaigns(brand_id, title, max_revisions))")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const member = submission.campaign_members as unknown as {
    campaign_id: string;
    creator_id: string;
    campaigns: { brand_id: string; title: string; max_revisions: number };
  };

  if (member.campaigns.brand_id !== user.id) throw new Error("Not authorized");

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
    data: { campaign_id: member.campaign_id, submission_id: submissionId },
  });

  // Email creator
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", member.creator_id)
    .single();

  if (creatorProfile?.email) {
    sendNotificationEmail({
      type: "revision_requested",
      recipientEmail: creatorProfile.email,
      recipientName: creatorProfile.full_name ?? "Creator",
      data: {
        campaignTitle: member.campaigns.title,
        campaignId: member.campaign_id,
        feedback,
      },
    });
  }

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
    .select("campaign_member_id, campaign_members(creator_id, campaign_id)")
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");

  const member = submission.campaign_members as unknown as {
    creator_id: string;
    campaign_id: string;
  };

  if (member.creator_id !== user.id) throw new Error("Not authorized");

  const { error } = await supabase
    .from("content_submissions")
    .update({
      status: "published",
      published_url: publishedUrl,
      published_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);

  revalidatePath(`/i/campaigns/${member.campaign_id}`);
}

export async function submitPerformance(input: {
  submission_id: string;
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
}) {
  const parsed = submitPerformanceSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { submission_id, ...metrics } = input;

  const { data, error } = await supabase
    .from("content_performance")
    .insert({
      submission_id,
      ...metrics,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Recalculate creator performance aggregates
  await recalculateCreatorPerformance(supabase, user.id);

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
