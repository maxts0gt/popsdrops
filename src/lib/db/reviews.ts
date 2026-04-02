import { createClient } from "@/lib/supabase/server";

export async function submitReview(data: {
  campaign_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
}) {
  const supabase = await createClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return review;
}

export async function listReviews(revieweeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, reviewer:profiles!reviewer_id(*), campaign:campaigns(*)")
    .eq("reviewee_id", revieweeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCampaignReviews(campaignId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "*, reviewer:profiles!reviewer_id(*), reviewee:profiles!reviewee_id(*)"
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
