import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMessage = {
  id: string;
  campaignId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string;
  createdAt: string;
  isOwn: boolean;
};

// ---------------------------------------------------------------------------
// Fetch messages
// ---------------------------------------------------------------------------

export async function loadCampaignMessages(
  campaignId: string,
  currentUserId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("campaign_messages")
    .select(
      `id, campaign_id, sender_id, content, created_at,
       profiles!campaign_messages_sender_id_fkey ( full_name, avatar_url )`,
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((msg) => {
    const profile = Array.isArray(msg.profiles)
      ? msg.profiles[0]
      : msg.profiles;
    return {
      id: msg.id,
      campaignId: msg.campaign_id,
      senderId: msg.sender_id,
      senderName: profile?.full_name ?? "User",
      senderAvatarUrl: profile?.avatar_url ?? null,
      content: msg.content,
      createdAt: msg.created_at,
      isOwn: msg.sender_id === currentUserId,
    };
  });
}

// ---------------------------------------------------------------------------
// Realtime subscription
// ---------------------------------------------------------------------------

export function subscribeToCampaignMessages(
  campaignId: string,
  currentUserId: string,
  onNewMessage: (message: ChatMessage) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`campaign-messages-${campaignId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "campaign_messages",
        filter: `campaign_id=eq.${campaignId}`,
      },
      async (payload) => {
        const msg = payload.new as {
          id: string;
          campaign_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };

        // Fetch sender profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", msg.sender_id)
          .single();

        onNewMessage({
          id: msg.id,
          campaignId: msg.campaign_id,
          senderId: msg.sender_id,
          senderName: profile?.full_name ?? "User",
          senderAvatarUrl: profile?.avatar_url ?? null,
          content: msg.content,
          createdAt: msg.created_at,
          isOwn: msg.sender_id === currentUserId,
        });
      },
    )
    .subscribe();

  return channel;
}
