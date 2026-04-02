import { createClient } from "@/lib/supabase/server";

export async function sendMessage(data: {
  campaign_id: string;
  sender_id: string;
  content: string;
}) {
  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from("campaign_messages")
    .insert(data)
    .select("*, sender:profiles(*)")
    .single();

  if (error) throw error;
  return message;
}

export async function listMessages(
  campaignId: string,
  cursor?: string,
  limit: number = 50
) {
  const supabase = await createClient();
  let query = supabase
    .from("campaign_messages")
    .select("*, sender:profiles(*)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  const nextCursor =
    data.length === limit ? data[data.length - 1].created_at : null;

  return { data, nextCursor };
}
