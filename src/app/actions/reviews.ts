"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedNotification } from "@/lib/supabase/privileged";
import { getUser } from "./auth";
import { submitReviewSchema } from "@/lib/validations";

export async function submitReview(input: {
  campaign_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
}) {
  const parsed = submitReviewSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  if (input.reviewee_id === user.id) {
    throw new Error("You cannot review yourself.");
  }

  // Verify reviewer is a member of this campaign (either brand or creator)
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id")
    .eq("id", input.campaign_id)
    .single();

  if (!campaign) throw new Error("Campaign not found");

  const isBrand = campaign.brand_id === user.id;

  if (isBrand) {
    const { data: membership } = await supabase
      .from("campaign_members")
      .select("id")
      .eq("campaign_id", input.campaign_id)
      .eq("creator_id", input.reviewee_id)
      .single();

    if (!membership) {
      throw new Error("You can only review creators who joined this campaign.");
    }
  } else {
    const { data: membership } = await supabase
      .from("campaign_members")
      .select("id")
      .eq("campaign_id", input.campaign_id)
      .eq("creator_id", user.id)
      .single();

    if (!membership) throw new Error("Not a member of this campaign");

    if (input.reviewee_id !== campaign.brand_id) {
      throw new Error("Creators can only review the campaign brand.");
    }
  }

  // Insert review (unique constraint will prevent duplicates)
  const { error } = await supabase.from("reviews").insert({
    campaign_id: input.campaign_id,
    reviewer_id: user.id,
    reviewee_id: input.reviewee_id,
    rating: input.rating,
    comment: input.comment ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already reviewed this user for this campaign");
    }
    throw new Error(error.message);
  }

  // Notify the reviewee
  await createPrivilegedNotification({
    user_id: input.reviewee_id,
    type: "review_received",
    title: "New Review",
    body: `You received a ${input.rating}-star review.`,
    data: { campaign_id: input.campaign_id },
  });

  revalidatePath(`/b/campaigns/${input.campaign_id}`);
  revalidatePath(`/i/campaigns/${input.campaign_id}`);
}

export async function getReviewsForCampaign(campaignId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `id, rating, comment, created_at,
       reviewer:profiles!reviews_reviewer_id_fkey ( id, full_name, avatar_url ),
       reviewee:profiles!reviews_reviewee_id_fkey ( id, full_name, avatar_url )`
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function hasReviewed(
  campaignId: string,
  reviewerId: string,
  revieweeId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("reviewer_id", reviewerId)
    .eq("reviewee_id", revieweeId);

  return (count ?? 0) > 0;
}
