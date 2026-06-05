import "server-only";

import type { createClient } from "@/lib/supabase/server";
import {
  hasBrandWorkspacePermission,
  type BrandWorkspacePermission,
} from "@/lib/brand-permissions";
import type { BrandTeamRole } from "@/types/database";

type SupabaseQueryClient = Awaited<ReturnType<typeof createClient>>;
export type BrandWorkspaceSupabaseClient = SupabaseQueryClient;

export type BrandWorkspace = {
  brandId: string;
  userId: string;
  role: BrandTeamRole;
  isOwner: boolean;
};

const defaultBrandWorkspaceRoles: BrandTeamRole[] = [
  "owner",
  "admin",
  "manager",
  "viewer",
];

export async function getBrandWorkspaceForUser(
  supabase: SupabaseQueryClient,
  userId: string,
): Promise<BrandWorkspace | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (profile?.role !== "brand" || profile.status !== "approved") return null;

  const { data: ownedBrand, error: ownedBrandError } = await supabase
    .from("brand_profiles")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (ownedBrandError) throw new Error(ownedBrandError.message);

  if (ownedBrand) {
    return {
      brandId: userId,
      userId,
      role: "owner",
      isOwner: true,
    };
  }

  const { data: member, error: memberError } = await supabase
    .from("brand_team_members")
    .select("brand_id, role, accepted_at")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);
  if (!member) return null;

  return {
    brandId: member.brand_id,
    userId,
    role: member.role as BrandTeamRole,
    isOwner: member.role === "owner",
  };
}

export async function getBrandWorkspaceForCurrentUser(
  supabase: SupabaseQueryClient,
  userId: string,
) {
  return getBrandWorkspaceForUser(supabase, userId);
}

export async function assertBrandWorkspaceRole(
  supabase: SupabaseQueryClient,
  userId: string,
  allowedRoles: BrandTeamRole[] = defaultBrandWorkspaceRoles,
): Promise<BrandWorkspace> {
  const workspace = await getBrandWorkspaceForCurrentUser(supabase, userId);

  if (!workspace || !allowedRoles.includes(workspace.role)) {
    throw new Error("Brand workspace access required.");
  }

  return workspace;
}

export async function assertBrandWorkspacePermission(
  supabase: SupabaseQueryClient,
  userId: string,
  permission: BrandWorkspacePermission,
): Promise<BrandWorkspace> {
  const workspace = await getBrandWorkspaceForCurrentUser(supabase, userId);

  if (!workspace || !hasBrandWorkspacePermission(workspace.role, permission)) {
    throw new Error("Brand workspace permission required.");
  }

  return workspace;
}
