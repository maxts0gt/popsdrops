"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCreatorOnboardingSocialFields } from "@/lib/creator-socials";
import type { Platform } from "@/lib/constants";
import { getUser } from "./auth";

export async function submitCreatorOnboarding(input: {
  full_name: string;
  primary_market: string;
  social_accounts: Array<{
    platform: Platform;
    value: string;
  }>;
  niches: string[];
  base_rate: number;
  slug: string;
}) {
  const user = await getUser();
  const supabase = await createClient();

  // Update base profile
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: input.full_name,
      email: user.email!,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      role: "creator",
      status: "pending",
      onboarding_completed: true,
    },
    { onConflict: "id" }
  );

  if (profileError) throw new Error(profileError.message);

  const socialFields = buildCreatorOnboardingSocialFields(
    input.social_accounts,
    input.base_rate,
  );

  // Create creator profile
  const { error: creatorError } = await supabase
    .from("creator_profiles")
    .upsert({
      profile_id: user.id,
      slug: input.slug,
      primary_market: input.primary_market,
      niches: input.niches,
      rate_currency: "USD",
      markets: [input.primary_market],
      ...socialFields,
    }, { onConflict: "profile_id" });

  if (creatorError) {
    if (creatorError.code === "23505") {
      throw new Error("SLUG_TAKEN");
    }

    throw new Error(creatorError.message);
  }

  revalidatePath("/", "layout");
  return { success: true as const };
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
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: user.user_metadata?.full_name ?? input.company_name,
      email: user.email!,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      role: "brand",
      status: "pending",
      onboarding_completed: true,
    },
    { onConflict: "id" }
  );

  if (profileError) throw new Error(profileError.message);

  // Create brand profile
  const { error: brandError } = await supabase
    .from("brand_profiles")
    .upsert({
      profile_id: user.id,
      company_name: input.company_name,
      industry: input.industry,
      target_markets: [input.primary_market],
      description: input.description ?? null,
      website: input.website ?? null,
      contact_name: user.user_metadata?.full_name ?? "",
      contact_email: user.email!,
    }, { onConflict: "profile_id" });

  if (brandError) throw new Error(brandError.message);

  revalidatePath("/", "layout");
  return { success: true as const };
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
