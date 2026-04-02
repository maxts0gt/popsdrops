"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

export async function updateCreatorProfile(input: {
  bio?: string;
  slug?: string;
  niches?: string[];
  markets?: string[];
  languages?: string[];
  content_formats?: string[];
  primary_market?: string;
  rate_card?: Record<string, Record<string, number>>;
  tiktok?: { url: string; handle: string; followers: number } | null;
  instagram?: { url: string; handle: string; followers: number } | null;
  snapchat?: { url: string; handle: string; followers: number } | null;
  youtube?: { url: string; handle: string; followers: number } | null;
  facebook?: { url: string; handle: string; followers: number } | null;
}) {
  const user = await getUser();
  const supabase = await createClient();

  // Build update object, only including defined fields
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      update[key] = value;
    }
  }

  // Calculate profile completeness
  const { data: current } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  if (!current) throw new Error("Creator profile not found");

  const merged = { ...current, ...update };
  update.profile_completeness = calculateCompleteness(merged);

  const { error } = await supabase
    .from("creator_profiles")
    .update(update)
    .eq("profile_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/i/profile");
  if (input.slug) revalidatePath(`/c/${input.slug}`);
}

export async function updateBrandProfile(input: {
  company_name?: string;
  industry?: string;
  description?: string;
  website?: string;
  target_markets?: string[];
  logo_url?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
}) {
  const user = await getUser();
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      update[key] = value;
    }
  }

  const { error } = await supabase
    .from("brand_profiles")
    .update(update)
    .eq("profile_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/b/settings");
}

export async function updateAvatar(avatarUrl: string) {
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/i/profile");
  revalidatePath("/b/settings");
}

function calculateCompleteness(profile: Record<string, unknown>): number {
  const checks = [
    !!profile.bio,
    !!(profile.tiktok || profile.instagram || profile.snapchat || profile.youtube || profile.facebook),
    // At least 2 social accounts
    [profile.tiktok, profile.instagram, profile.snapchat, profile.youtube, profile.facebook]
      .filter(Boolean).length >= 2,
    Array.isArray(profile.niches) && (profile.niches as string[]).length > 0,
    !!profile.rate_card && Object.keys(profile.rate_card as object).length > 0,
    Array.isArray(profile.markets) && (profile.markets as string[]).length > 0,
    Array.isArray(profile.languages) && (profile.languages as string[]).length > 0,
    !!profile.primary_market,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100) / 100;
}
