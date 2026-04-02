"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

export async function submitCreatorOnboarding(input: {
  full_name: string;
  primary_market: string;
  social_url: string;
  social_platform: string;
  niches: string[];
  base_rate: number;
  slug: string;
}) {
  const user = await getUser();
  const supabase = await createClient();

  // Extract handle from social URL
  const handle = extractHandle(input.social_url, input.social_platform);

  // Update base profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name,
      role: "creator",
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (profileError) throw new Error(profileError.message);

  // Build social account data
  const socialData = {
    url: input.social_url,
    handle,
    followers: 0,
    verified: false,
  };

  // Create creator profile
  const { error: creatorError } = await supabase
    .from("creator_profiles")
    .insert({
      profile_id: user.id,
      slug: input.slug,
      primary_market: input.primary_market,
      niches: input.niches,
      rate_card: { [input.social_platform]: { video: input.base_rate } },
      markets: [input.primary_market],
      [input.social_platform]: socialData,
    });

  if (creatorError) throw new Error(creatorError.message);

  revalidatePath("/", "layout");
  redirect("/pending-approval");
}

export async function submitBrandOnboarding(input: {
  company_name: string;
  industry: string;
  primary_market: string;
  description?: string;
  website?: string;
}) {
  const user = await getUser();
  const supabase = await createClient();

  // Update base profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: "brand",
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (profileError) throw new Error(profileError.message);

  // Create brand profile
  const { error: brandError } = await supabase
    .from("brand_profiles")
    .insert({
      profile_id: user.id,
      company_name: input.company_name,
      industry: input.industry,
      target_markets: [input.primary_market],
      description: input.description ?? null,
      website: input.website ?? null,
    });

  if (brandError) throw new Error(brandError.message);

  revalidatePath("/", "layout");
  redirect("/pending-approval");
}

export async function selectRole(role: "creator" | "brand") {
  const user = await getUser();
  const supabase = await createClient();

  // Upsert profile with selected role
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      role,
      full_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
      email: user.email!,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  redirect(`/onboarding/${role}`);
}

function extractHandle(url: string, platform: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return last.startsWith("@") ? last : `@${last}`;
  } catch {
    return url;
  }
}
