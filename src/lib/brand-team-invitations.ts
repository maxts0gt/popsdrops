import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandTeamRole } from "@/types/database";

type AcceptPendingBrandTeamInvitationInput = {
  userId: string;
  email: string | null | undefined;
  fullName?: string | null;
  avatarUrl?: string | null;
  invitationId?: string;
};

export type BrandTeamInvitationPreviewStatus =
  | "missing"
  | "pending"
  | "expired"
  | "revoked"
  | "accepted";

type BrandTeamInvitationPreviewRow = {
  id: string;
  brand_id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string | null;
  invited_at: string;
  expires_at: string;
};

const roleLabelKeys: Record<Exclude<BrandTeamRole, "owner">, string> = {
  admin: "teamInvite.role.admin",
  manager: "teamInvite.role.manager",
  viewer: "teamInvite.role.viewer",
};

const accessSummaryKeys: Record<Exclude<BrandTeamRole, "owner">, string> = {
  admin: "teamInvite.access.admin",
  manager: "teamInvite.access.manager",
  viewer: "teamInvite.access.viewer",
};

function toInvitableRole(role: string): Exclude<BrandTeamRole, "owner"> {
  return role === "admin" || role === "viewer" ? role : "manager";
}

async function getInvitationPreviewContext(
  invitation: BrandTeamInvitationPreviewRow,
) {
  const admin = createAdminClient();
  const [{ data: brandProfile }, { data: inviterProfile }] = await Promise.all([
    admin
      .from("brand_profiles")
      .select("company_name")
      .eq("profile_id", invitation.brand_id)
      .maybeSingle(),
    invitation.invited_by
      ? admin
          .from("profiles")
          .select("full_name, email")
          .eq("id", invitation.invited_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const brandName =
    brandProfile?.company_name?.trim() || "Brand workspace";
  const invitedByName =
    inviterProfile?.full_name?.trim() ||
    inviterProfile?.email ||
    "A teammate";

  return { brandName, invitedByName };
}

function getInvitationPreviewStatus(
  invitation: BrandTeamInvitationPreviewRow,
): BrandTeamInvitationPreviewStatus {
  if (invitation.status === "revoked") return "revoked";
  if (invitation.status === "accepted") return "accepted";
  if (
    invitation.status === "expired" ||
    new Date(invitation.expires_at).getTime() <= Date.now()
  ) {
    return "expired";
  }
  return "pending";
}

export async function getBrandTeamInvitationPreview(invitationId: string) {
  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("brand_team_invitations")
    .select("id, brand_id, email, role, status, invited_by, invited_at, expires_at")
    .eq("id", invitationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invitation) {
    return {
      status: "missing" as const,
    };
  }

  const { brandName, invitedByName } = await getInvitationPreviewContext(
    invitation,
  );
  const role = toInvitableRole(invitation.role);

  return {
    accessSummary: accessSummaryKeys[role],
    brandId: invitation.brand_id,
    brandName,
    email: invitation.email,
    expiresAt: invitation.expires_at,
    id: invitation.id,
    invitedAt: invitation.invited_at,
    invitedByName,
    role,
    roleLabel: roleLabelKeys[role],
    status: getInvitationPreviewStatus(invitation),
  };
}

async function insertBrandTeamInvitationAcceptanceAuditLog({
  userId,
  invitation,
}: {
  userId: string;
  invitation: {
    id: string;
    brand_id: string;
    email: string;
    role: string;
    invited_by: string | null;
  };
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    admin_id: userId,
    action: "brand_team_invitation_accepted",
    target_type: "brand_team_invitation",
    target_id: invitation.id,
    metadata: {
      accepted_user_id: userId,
      brand_id: invitation.brand_id,
      invited_by: invitation.invited_by,
      target_email: invitation.email,
      target_role: invitation.role,
    },
  });

  if (error) throw new Error(error.message);
}

export async function acceptPendingBrandTeamInvitationForUser({
  userId,
  email,
  fullName,
  avatarUrl,
  invitationId,
}: AcceptPendingBrandTeamInvitationInput) {
  if (!email) return { accepted: false as const };

  const now = new Date().toISOString();
  const admin = createAdminClient();

  let invitationQuery = admin
    .from("brand_team_invitations")
    .select("id, brand_id, email, role, invited_by, expires_at")
    .eq("email", email.toLowerCase())
    .eq("status", "pending")
    .gt("expires_at", now);

  if (invitationId) {
    invitationQuery = invitationQuery.eq("id", invitationId);
  } else {
    invitationQuery = invitationQuery.order("invited_at", { ascending: true }).limit(1);
  }

  const { data: invitation, error: invitationError } =
    await invitationQuery.maybeSingle();

  if (invitationError) throw new Error(invitationError.message);
  if (!invitation) return { accepted: false as const };

  const displayName =
    fullName?.trim() || email.split("@")[0]?.replace(/[._-]+/g, " ") || email;

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: email.toLowerCase(),
      full_name: displayName,
      avatar_url: avatarUrl ?? null,
      role: "brand",
      status: "approved",
      onboarding_completed: true,
      updated_at: now,
    },
    { onConflict: "id" },
  );

  if (profileError) throw new Error(profileError.message);

  const { error: memberError } = await admin.from("brand_team_members").upsert(
    {
      brand_id: invitation.brand_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
      accepted_at: now,
      updated_at: now,
    },
    { onConflict: "brand_id,user_id" },
  );

  if (memberError) throw new Error(memberError.message);

  const { data: acceptedInvitation, error: invitationUpdateError } = await admin
    .from("brand_team_invitations")
    .update({
      status: "accepted",
      updated_at: now,
    })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (invitationUpdateError) throw new Error(invitationUpdateError.message);
  if (!acceptedInvitation) return { accepted: false as const };

  await insertBrandTeamInvitationAcceptanceAuditLog({
    userId,
    invitation,
  });

  return {
    accepted: true as const,
    brandId: invitation.brand_id as string,
    role: invitation.role as string,
  };
}
