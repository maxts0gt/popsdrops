"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";
import { submitReview as submitReviewAction } from "./reviews";

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

export async function getNotificationBellState() {
  const user = await getUser();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) throw new Error(error.message);

  return {
    userId: user.id,
    unreadCount: count ?? 0,
  };
}
