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

export const FOLLOWER_RANGE_OPTIONS = [
  { value: "under_10k", label: "Under 10k" },
  { value: "10k_50k", label: "10k-50k" },
  { value: "50k_100k", label: "50k-100k" },
  { value: "100k_500k", label: "100k-500k" },
  { value: "500k_plus", label: "500k+" },
] as const;

export const FOLLOWER_RANGES = FOLLOWER_RANGE_OPTIONS.map(
  (option) => option.value,
) as [FollowerRange, ...FollowerRange[]];

export const FOLLOWER_RANGE_LABELS: Record<FollowerRange, string> =
  Object.fromEntries(
    FOLLOWER_RANGE_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<FollowerRange, string>;

export type FollowerRange = (typeof FOLLOWER_RANGE_OPTIONS)[number]["value"];

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
