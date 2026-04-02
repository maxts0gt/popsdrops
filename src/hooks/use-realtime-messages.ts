"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  campaign_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
}

export function useRealtimeMessages(campaignId: string, userId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Load initial messages
  useEffect(() => {
    const supabase = createClient();

    async function loadMessages() {
      const { data } = await supabase
        .from("campaign_messages")
        .select("*, sender:profiles(full_name, avatar_url, role)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data) setMessages(data as Message[]);
    }

    loadMessages();
  }, [campaignId]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`campaign:${campaignId}`);

    channel
      .on("broadcast", { event: "message" }, (payload) => {
        const msg = payload.payload as Message;
        setMessages((prev) => [...prev, msg]);
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const supabase = createClient();

      // Insert to DB
      const { data, error } = await supabase
        .from("campaign_messages")
        .insert({
          campaign_id: campaignId,
          sender_id: userId,
          content,
        })
        .select("*, sender:profiles(full_name, avatar_url, role)")
        .single();

      if (error) throw error;

      // Broadcast to channel
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "message",
          payload: data,
        });
      }

      // Add locally (optimistic)
      setMessages((prev) => [...prev, data as Message]);
    },
    [campaignId, userId]
  );

  return { messages, sendMessage, isConnected };
}
