import { createClient } from "@/lib/supabase/server";

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getProfileWithRole(userId: string) {
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;

  if (profile.role === "creator") {
    const { data: creatorProfile, error: creatorError } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    if (creatorError) throw creatorError;
    return { ...profile, creator_profile: creatorProfile };
  }

  if (profile.role === "brand") {
    const { data: brandProfile, error: brandError } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    if (brandError) throw brandError;
    return { ...profile, brand_profile: brandProfile };
  }

  return profile;
}

export async function getCreatorProfile(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("*, profile:profiles(*)")
    .eq("profile_id", profileId)
    .single();

  if (error) throw error;
  return data;
}

export async function getCreatorBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("*, profile:profiles(*)")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data;
}

export async function getBrandProfile(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_profiles")
    .select("*, profile:profiles(*)")
    .eq("profile_id", profileId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  data: Record<string, unknown>
) {
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function updateCreatorProfile(
  profileId: string,
  data: Record<string, unknown>
) {
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("creator_profiles")
    .update(data)
    .eq("profile_id", profileId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function updateBrandProfile(
  profileId: string,
  data: Record<string, unknown>
) {
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("brand_profiles")
    .update(data)
    .eq("profile_id", profileId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function listPendingProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, creator_profile:creator_profiles(*), brand_profile:brand_profiles(*)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function approveProfile(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function rejectProfile(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
