import { supabase } from "./supabase";

export type WaitlistPlatform =
  | "tiktok"
  | "instagram"
  | "snapchat"
  | "youtube"
  | "facebook";

export const PLATFORM_LABELS: Record<WaitlistPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
  youtube: "YouTube",
  facebook: "Facebook",
};

export const FOLLOWER_RANGES = [
  "1k-10k",
  "10k-50k",
  "50k-100k",
  "100k-500k",
  "500k-1M",
  "1M+",
] as const;

export type FollowerRange = (typeof FOLLOWER_RANGES)[number];

export type WaitlistInput = {
  fullName: string;
  email: string;
  platform: WaitlistPlatform;
  socialUrl: string;
  followerRange: FollowerRange;
};

export async function submitCreatorWaitlist(
  input: WaitlistInput,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("waitlist").insert({
    type: "creator",
    email: input.email,
    full_name: input.fullName,
    social_platform: input.platform,
    social_url: input.socialUrl,
    follower_range: input.followerRange,
    referral_source: "mobile_app",
  });

  if (error) {
    // Duplicate email — they already submitted
    if (error.code === "23505") {
      return { success: true };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}
