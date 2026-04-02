import { createClient } from "@/lib/supabase/server";

export async function submitContent(data: {
  campaign_member_id: string;
  content_url: string;
  caption?: string;
  platform: string;
}) {
  const supabase = await createClient();
  const { data: submission, error } = await supabase
    .from("content_submissions")
    .insert({ ...data, status: "submitted", version: 1 })
    .select()
    .single();

  if (error) throw error;
  return submission;
}

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

export async function approveContent(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_submissions")
    .update({ status: "approved" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function requestRevision(id: string, feedback: string) {
  const supabase = await createClient();

  // Get current submission to determine next version
  const { data: current, error: fetchError } = await supabase
    .from("content_submissions")
    .select("campaign_member_id, platform, version")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  // Mark current as revision_requested
  const { error: updateError } = await supabase
    .from("content_submissions")
    .update({ status: "revision_requested", revision_feedback: feedback })
    .eq("id", id);

  if (updateError) throw updateError;

  // Create a new version entry for the creator to fill in
  const { data: newVersion, error: insertError } = await supabase
    .from("content_submissions")
    .insert({
      campaign_member_id: current.campaign_member_id,
      platform: current.platform,
      status: "pending_resubmission",
      version: current.version + 1,
      previous_version_id: id,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return newVersion;
}

export async function publishContent(id: string, publishedUrl: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_submissions")
    .update({
      status: "published",
      published_url: publishedUrl,
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function submitPerformance(data: {
  submission_id: string;
  measurement_type: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  reach?: number;
  impressions?: number;
  [key: string]: unknown;
}) {
  const supabase = await createClient();
  const { data: performance, error } = await supabase
    .from("content_performance")
    .insert({
      ...data,
      measured_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return performance;
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
