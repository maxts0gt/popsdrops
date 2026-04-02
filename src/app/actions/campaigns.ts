"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedNotifications } from "@/lib/supabase/privileged";
import { getUser } from "./auth";
import { createCampaignSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// Brief Translation (Gemini API)
// ---------------------------------------------------------------------------

async function translateBrief(campaignId: string) {
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("brief_description, brief_requirements, brief_dos, brief_donts, markets")
    .eq("id", campaignId)
    .single();

  if (!campaign) return;

  // Determine target languages from markets
  const marketLocales: Record<string, string> = {
    saudi_arabia: "ar", uae: "ar", egypt: "ar", morocco: "fr",
    tunisia: "fr", jordan: "ar", kuwait: "ar", bahrain: "ar",
    oman: "ar", qatar: "ar", lebanon: "ar", iraq: "ar",
    kazakhstan: "kk", uzbekistan: "uz", turkey: "tr",
    south_korea: "ko", japan: "ja", brazil: "pt",
    indonesia: "id", malaysia: "ms", thailand: "th",
    vietnam: "vi", philippines: "tl", india: "hi",
    nigeria: "en", kenya: "sw", south_africa: "en",
    mexico: "es", colombia: "es", argentina: "es",
    germany: "de", france: "fr", italy: "it",
    spain: "es", netherlands: "nl", poland: "pl",
    romania: "ro", ukraine: "uk", russia: "ru",
    china: "zh", taiwan: "zh", hong_kong: "zh",
  };

  const targetLocales = new Set<string>();
  for (const market of campaign.markets ?? []) {
    const locale = marketLocales[market];
    if (locale && locale !== "en") targetLocales.add(locale);
  }

  if (targetLocales.size === 0) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[translate-brief] No GEMINI_API_KEY, skipping translation");
    return;
  }

  // Build brief fields to translate
  const briefFields: Record<string, string> = {};
  if (campaign.brief_description) briefFields.description = campaign.brief_description;
  if (campaign.brief_requirements) briefFields.requirements = campaign.brief_requirements;
  if (campaign.brief_dos) briefFields.dos = campaign.brief_dos;
  if (campaign.brief_donts) briefFields.donts = campaign.brief_donts;

  if (Object.keys(briefFields).length === 0) return;

  const translated: Record<string, Record<string, string>> = {};

  for (const locale of targetLocales) {
    try {
      const localeName = new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale;

      const prompt = `Translate the following campaign brief fields to ${localeName}.
Return ONLY a JSON object with the same keys and translated values. No markdown.
Keep brand names, platform names (TikTok, Instagram, etc.), and technical terms in English.
Maintain the original formatting (line breaks, bullet points).

${JSON.stringify(briefFields, null, 2)}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        translated[locale] = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error(`[translate-brief] Failed for locale ${locale}:`, err);
    }
  }

  if (Object.keys(translated).length > 0) {
    await supabase
      .from("campaigns")
      .update({ brief_translated: translated })
      .eq("id", campaignId);
  }
}

export async function createCampaign(input: {
  title: string;
  brief_description: string;
  brief_requirements?: string;
  brief_dos?: string;
  brief_donts?: string;
  platforms: string[];
  markets: string[];
  niches: string[];
  budget_min: number;
  budget_max: number;
  max_creators: number;
  application_deadline: string;
  content_due_date: string;
  posting_window_start?: string;
  posting_window_end?: string;
  usage_rights_duration?: string;
  usage_rights_territory?: string;
  usage_rights_paid_ads: boolean;
  max_revisions: number;
  playbook_id?: string;
  deliverables: Array<{
    platform: string;
    content_type: string;
    quantity: number;
    notes?: string;
  }>;
}) {
  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  // Verify user is a brand
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "brand") throw new Error("Only brands can create campaigns");

  const { deliverables, ...campaignData } = input;

  // Insert campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      brand_id: user.id,
      ...campaignData,
      status: "draft",
    })
    .select("id")
    .single();

  if (campaignError) throw new Error(campaignError.message);

  // Insert deliverables
  if (deliverables.length > 0) {
    const { error: delError } = await supabase
      .from("campaign_deliverables")
      .insert(
        deliverables.map((d) => ({
          campaign_id: campaign.id,
          platform: d.platform,
          content_type: d.content_type,
          quantity: d.quantity,
          notes: d.notes ?? null,
        }))
      );

    if (delError) throw new Error(delError.message);
  }

  revalidatePath("/b/campaigns");
  return { id: campaign.id };
}

export async function publishCampaign(campaignId: string) {
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "recruiting" })
    .eq("id", campaignId)
    .eq("brand_id", user.id)
    .eq("status", "draft");

  if (error) throw new Error(error.message);

  // Fire-and-forget: translate brief to target market languages
  translateBrief(campaignId).catch((err) =>
    console.error("[publishCampaign] Brief translation failed:", err)
  );

  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath("/b/campaigns");
}

export async function updateCampaignStatus(
  campaignId: string,
  status: string
) {
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", campaignId)
    .eq("brand_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath("/b/campaigns");
}

export async function completeCampaign(campaignId: string) {
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("brand_id", user.id);

  if (error) throw new Error(error.message);

  // TODO: trigger generate-report Edge Function

  // Notify all campaign members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", campaignId);

  if (members) {
    const notifications = members.map((m) => ({
      user_id: m.creator_id,
      type: "campaign_completed" as const,
      title: "Campaign Completed",
      body: "A campaign you participated in has been completed. Please leave a review!",
      data: { campaign_id: campaignId },
    }));

    await createPrivilegedNotifications(notifications);
  }

  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath("/b/campaigns");
}

export async function updateCampaignDeadline(
  campaignId: string,
  newDeadline: string
) {
  const user = await getUser();
  const supabase = await createClient();

  // Validate date
  const date = new Date(newDeadline);
  if (isNaN(date.getTime()) || date < new Date()) {
    throw new Error("Deadline must be a valid future date");
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ application_deadline: newDeadline })
    .eq("id", campaignId)
    .eq("brand_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${campaignId}`);
}

export async function sendCampaignAnnouncement(
  campaignId: string,
  message: string
) {
  if (!message.trim()) throw new Error("Message cannot be empty");

  const user = await getUser();
  const supabase = await createClient();

  // Verify ownership
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title")
    .eq("id", campaignId)
    .eq("brand_id", user.id)
    .single();

  if (!campaign) throw new Error("Campaign not found");

  // Get all campaign members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", campaignId);

  if (!members || members.length === 0) {
    throw new Error("No members to notify");
  }

  // Create notifications for all members
  const notifications = members.map((m) => ({
    user_id: m.creator_id,
    type: "new_message" as const,
    title: `Announcement: ${campaign.title}`,
    body: message.trim(),
    data: { campaign_id: campaignId },
  }));

  await createPrivilegedNotifications(notifications);

  revalidatePath(`/b/campaigns/${campaignId}`);
}
