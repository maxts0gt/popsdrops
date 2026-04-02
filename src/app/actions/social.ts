"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedNotifications } from "@/lib/supabase/privileged";
import { getUser } from "./auth";
import { submitReview as submitReviewAction } from "./reviews";

export async function sendMessage(input: {
  campaign_id: string;
  content: string;
}) {
  const user = await getUser();
  const supabase = await createClient();

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

  // Notify other campaign participants (batched for chat)
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", input.campaign_id)
    .neq("creator_id", user.id);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("brand_id, title")
    .eq("id", input.campaign_id)
    .single();

  if (campaign && members) {
    const recipientIds = [
      ...members.map((m) => m.creator_id),
      ...(campaign.brand_id !== user.id ? [campaign.brand_id] : []),
    ];

    if (recipientIds.length > 0) {
      await createPrivilegedNotifications(
        recipientIds.map((uid) => ({
          user_id: uid,
          type: "new_message" as const,
          title: "New Message",
          body: `New message in "${campaign.title}"`,
          data: { campaign_id: input.campaign_id },
        }))
      );
    }
  }

  return { id: data.id, created_at: data.created_at };
}

export async function submitReview(input: {
  campaign_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
}) {
  return submitReviewAction(input);
}

export async function markNotificationRead(notificationId: string) {
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead() {
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) throw new Error(error.message);
  revalidatePath("/i/notifications");
  revalidatePath("/b/notifications");
}
