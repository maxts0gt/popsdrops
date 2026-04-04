import { supabase } from "./supabase";
import {
  submitApplicationSchema,
  submitContentSchema,
  submitPerformanceSchema,
  sendMessageSchema,
} from "../../shared/validations";

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

  const { error } = await supabase
    .from("campaign_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("creator_id", user.id)
    .in("status", ["pending", "counter_offer"])
    .select("id")
    .single();

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Submit Content
// ---------------------------------------------------------------------------

export async function submitContent(input: {
  campaign_member_id: string;
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
    .select("id, creator_id")
    .eq("id", input.campaign_member_id)
    .single();

  if (!member || member.creator_id !== user.id) {
    throw new Error("Not authorized");
  }

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("content_submissions")
    .update({
      status: "published",
      published_url: publishedUrl,
      published_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Submit Performance Metrics
// ---------------------------------------------------------------------------

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
}): Promise<{ id: string }> {
  const parsed = submitPerformanceSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const { submission_id, ...metrics } = input;

  const { data, error } = await supabase
    .from("content_performance")
    .insert({ submission_id, ...metrics })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Send Campaign Message
// ---------------------------------------------------------------------------

export async function sendCampaignMessage(input: {
  campaign_id: string;
  content: string;
}): Promise<{ id: string; created_at: string }> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("campaign_messages")
    .insert({
      campaign_id: input.campaign_id,
      sender_id: user.id,
      content: input.content,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, created_at: data.created_at };
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
