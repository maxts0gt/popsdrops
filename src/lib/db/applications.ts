import { createClient } from "@/lib/supabase/server";

export async function getApplication(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_applications")
    .select(
      "*, campaign:campaigns(*), creator:creator_profiles(*, profile:profiles(*))"
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function listCampaignApplications(
  campaignId: string,
  status?: string
) {
  const supabase = await createClient();
  let query = supabase
    .from("campaign_applications")
    .select("*, creator:creator_profiles(*, profile:profiles(*))")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listCreatorApplications(creatorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_applications")
    .select("*, campaign:campaigns(*, brand:brand_profiles(*, profile:profiles(*)))")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
