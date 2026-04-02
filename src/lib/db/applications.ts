import { createClient } from "@/lib/supabase/server";

export async function submitApplication(data: {
  campaign_id: string;
  creator_id: string;
  proposed_rate: number;
  pitch: string;
}) {
  const supabase = await createClient();
  const { data: application, error } = await supabase
    .from("campaign_applications")
    .insert({ ...data, status: "pending" })
    .select()
    .single();

  if (error) throw error;
  return application;
}

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

export async function acceptApplication(id: string, acceptedRate: number) {
  const supabase = await createClient();

  // Update application status
  const { data: application, error: appError } = await supabase
    .from("campaign_applications")
    .update({ status: "accepted", accepted_rate: acceptedRate })
    .eq("id", id)
    .select()
    .single();

  if (appError) throw appError;

  // Create campaign member
  const { data: member, error: memberError } = await supabase
    .from("campaign_members")
    .insert({
      campaign_id: application.campaign_id,
      creator_id: application.creator_id,
      rate: acceptedRate,
      payment_status: "pending",
    })
    .select()
    .single();

  if (memberError) throw memberError;

  return { application, member };
}

export async function rejectApplication(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_applications")
    .update({ status: "rejected" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function counterOffer(
  id: string,
  counterRate: number,
  message?: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_applications")
    .update({
      status: "countered",
      counter_rate: counterRate,
      counter_message: message ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function withdrawApplication(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_applications")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function respondToCounterOffer(id: string, accept: boolean) {
  const supabase = await createClient();

  if (accept) {
    // Get the counter rate, then accept at that rate
    const { data: application, error: fetchError } = await supabase
      .from("campaign_applications")
      .select("counter_rate, campaign_id, creator_id")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const { data: updated, error: updateError } = await supabase
      .from("campaign_applications")
      .update({
        status: "accepted",
        accepted_rate: application.counter_rate,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create campaign member at counter rate
    const { data: member, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: application.campaign_id,
        creator_id: application.creator_id,
        rate: application.counter_rate,
        payment_status: "pending",
      })
      .select()
      .single();

    if (memberError) throw memberError;

    return { application: updated, member };
  }

  // Decline counter — revert to pending
  const { data, error } = await supabase
    .from("campaign_applications")
    .update({ status: "declined" })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return { application: data, member: null };
}
