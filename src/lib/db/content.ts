import { createClient } from "@/lib/supabase/server";

export async function getSubmission(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_submissions")
    .select(
      "*, member:campaign_members(*, creator:creator_profiles(*, profile:profiles(*)), campaign:campaigns(*))"
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function listCampaignSubmissions(campaignId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_submissions")
    .select(
      "*, member:campaign_members!inner(*, creator:creator_profiles(*, profile:profiles(*)))"
    )
    .eq("member.campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function listMemberSubmissions(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_submissions")
    .select("*")
    .eq("campaign_member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getPerformanceData(submissionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_performance")
    .select("*")
    .eq("submission_id", submissionId)
    .order("measured_at", { ascending: true });

  if (error) throw error;
  return data;
}
