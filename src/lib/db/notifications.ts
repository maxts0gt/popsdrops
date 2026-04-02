import { createClient } from "@/lib/supabase/server";

export async function createNotification(data: {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({ ...data, read: false })
    .select()
    .single();

  if (error) throw error;
  return notification;
}

export async function listNotifications(
  userId: string,
  unreadOnly: boolean = false
) {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function markAsRead(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markAllRead(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
}

export async function getUnreadCount(userId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
  return count ?? 0;
}
