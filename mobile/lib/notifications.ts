import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Fetch notifications
// ---------------------------------------------------------------------------

export async function loadNotifications(
  userId: string,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data as Record<string, unknown> | null,
    read: n.read,
    createdAt: n.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Unread count
// ---------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) return 0;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Realtime subscription
// ---------------------------------------------------------------------------

export function subscribeToNotifications(
  userId: string,
  onNew: (notification: AppNotification) => void,
): RealtimeChannel {
  return supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const n = payload.new as {
          id: string;
          type: string;
          title: string;
          body: string;
          data: Record<string, unknown> | null;
          read: boolean;
          created_at: string;
        };
        onNew({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          read: n.read,
          createdAt: n.created_at,
        });
      },
    )
    .subscribe();
}
