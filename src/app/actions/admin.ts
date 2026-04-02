"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";
import { sendNotificationEmail } from "@/lib/email/notify";

async function requireAdmin() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Admin access required");
  return { user, supabase };
}

export async function approveProfile(profileId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  // Notify user
  await supabase.from("notifications").insert({
    user_id: profileId,
    type: "account_approved",
    title: "Account Approved!",
    body: "Your account has been approved. You can now access the platform.",
  });

  // Email user
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", profileId)
    .single();

  if (profile?.email) {
    sendNotificationEmail({
      type: "account_approved",
      recipientEmail: profile.email,
      recipientName: profile.full_name ?? "User",
      data: { role: profile.role },
    });
  }

  revalidatePath("/admin/approvals");
}

export async function rejectProfile(profileId: string, reason: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  await supabase.from("notifications").insert({
    user_id: profileId,
    type: "account_rejected",
    title: "Account Update",
    body: reason,
  });

  revalidatePath("/admin/approvals");
}

export async function suspendUser(profileId: string, reason: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

export async function unsuspendUser(profileId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", profileId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

export async function pauseCampaign(campaignId: string, reason: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "paused" })
    .eq("id", campaignId);

  if (error) throw new Error(error.message);

  // Notify brand and all members
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("brand_id, title")
    .eq("id", campaignId)
    .single();

  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", campaignId);

  if (campaign) {
    const recipientIds = [
      campaign.brand_id,
      ...(members?.map((m) => m.creator_id) ?? []),
    ];

    await supabase.from("notifications").insert(
      recipientIds.map((uid) => ({
        user_id: uid,
        type: "campaign_completed" as const,
        title: "Campaign Paused",
        body: `"${campaign.title}" has been paused by admin: ${reason}`,
        data: { campaign_id: campaignId },
      }))
    );
  }

  revalidatePath("/admin/campaigns");
}

export async function cancelCampaign(campaignId: string, reason: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", campaignId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/campaigns");
}
