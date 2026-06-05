"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  assertBrandWorkspacePermission,
  getBrandWorkspaceForCurrentUser,
  type BrandWorkspace,
} from "@/lib/brand-workspace";
import { acceptPendingBrandTeamInvitationForUser } from "@/lib/brand-team-invitations";
import { dispatchNotificationEmailByQueueId } from "@/lib/email/notification-queue";
import { getAppBaseUrl } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BrandTeamRole } from "@/types/database";
import { getUser } from "./auth";

const brandTeamInviteRoleSchema = z.enum(["admin", "manager", "viewer"]);
const brandTeamMemberRoleSchema = z.enum([
  "owner",
  "admin",
  "manager",
  "viewer",
]);

const inviteSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  role: brandTeamInviteRoleSchema,
});

const invitationIdSchema = z.string().uuid();
const memberIdSchema = z.string().uuid();
const memberRoleUpdateSchema = z.object({
  memberId: memberIdSchema,
  role: brandTeamMemberRoleSchema,
});

type TeamProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type BrandTeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: BrandTeamRole;
  acceptedAt: string | null;
  createdAt: string;
};

export type BrandTeamInvitation = {
  id: string;
  email: string;
  role: Exclude<BrandTeamRole, "owner">;
  status: "pending" | "expired";
  invitedAt: string;
  expiresAt: string;
  isExpired: boolean;
};

export type BrandTeamSettings = {
  workspaceBrandId: string;
  currentUserId: string;
  currentUserRole: BrandTeamRole;
  members: BrandTeamMember[];
  pendingInvitations: BrandTeamInvitation[];
};

type BrandTeamAuditInput = {
  actorId: string;
  action:
    | "brand_team_invitation_created"
    | "brand_team_invitation_resent"
    | "brand_team_invitation_revoked"
    | "brand_team_member_role_updated"
    | "brand_team_member_removed";
  target_type: "brand_team_invitation" | "brand_team_member";
  target_id: string;
  metadata: Record<string, unknown>;
};

async function insertBrandTeamAuditLog(input: BrandTeamAuditInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    admin_id: input.actorId,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    metadata: input.metadata,
  });

  if (error) throw new Error(error.message);
}

async function getBrandTeamInvitationEmailContext({
  supabase,
  workspace,
  user,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspace: BrandWorkspace;
  user: Awaited<ReturnType<typeof getUser>>;
}) {
  const [{ data: brandProfile }, { data: inviterProfile }] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("company_name")
      .eq("profile_id", workspace.brandId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const brandName =
    brandProfile?.company_name?.trim() || "your brand workspace";
  const invitedByName =
    inviterProfile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    inviterProfile?.email ||
    user.email ||
    "A teammate";

  return { brandName, invitedByName };
}

async function queueBrandTeamInvitationEmail({
  admin,
  brandId,
  brandName,
  email,
  expiresAt,
  invitationId,
  invitedByName,
  role,
}: {
  admin: ReturnType<typeof createAdminClient>;
  brandId: string;
  brandName: string;
  email: string;
  expiresAt: string;
  invitationId: string;
  invitedByName: string;
  role: Exclude<BrandTeamRole, "owner">;
}) {
  const teamInvitationPath = `/team/invitations/${invitationId}`;
  const teamInvitationUrl = `${getAppBaseUrl()}${teamInvitationPath}`;
  const loginUrl = `${getAppBaseUrl()}/login?returnTo=${encodeURIComponent(
    teamInvitationPath,
  )}`;
  const emailData = {
    recipientName: "Team member",
    recipient_name: "Team member",
    brandName,
    brand_name: brandName,
    invitedByName,
    invited_by_name: invitedByName,
    role,
    expiresAt,
    expires_at: expiresAt,
    loginUrl,
    login_url: loginUrl,
    teamInvitationUrl,
    team_invitation_url: teamInvitationUrl,
    invitationId,
    invitation_id: invitationId,
    brandId,
    brand_id: brandId,
    data: {
      brand_name: brandName,
      invited_by_name: invitedByName,
      role,
      expires_at: expiresAt,
      login_url: loginUrl,
      team_invitation_url: teamInvitationUrl,
      invitation_id: invitationId,
      brand_id: brandId,
    },
  };

  const { data: queueItem, error } = await admin
    .from("notification_queue")
    .insert({
      email,
      template: "brand_team_invitation",
      priority: "immediate",
      data: emailData,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return queueItem;
}

export async function getBrandTeamSettings(): Promise<BrandTeamSettings> {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandWorkspaceForCurrentUser(supabase, user.id);

  if (!workspace) throw new Error("Brand workspace access required.");

  const { data: members, error: membersError } = await supabase
    .from("brand_team_members")
    .select("id, user_id, role, accepted_at, created_at")
    .eq("brand_id", workspace.brandId)
    .order("created_at", { ascending: true });

  if (membersError) throw new Error(membersError.message);

  const userIds = [...new Set((members ?? []).map((member) => member.user_id))];
  const profilesById = new Map<string, TeamProfile>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);

    if (profilesError) throw new Error(profilesError.message);

    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, profile);
    }
  }

  const teamMembers = (members ?? []).map((member) => {
    const profile = profilesById.get(member.user_id);

    return {
      id: member.id,
      userId: member.user_id,
      name: profile?.full_name || profile?.email || "Team member",
      email: profile?.email || "",
      avatarUrl: profile?.avatar_url ?? null,
      role: member.role as BrandTeamRole,
      acceptedAt: member.accepted_at,
      createdAt: member.created_at,
    };
  });

  const hasOwner = teamMembers.some((member) => member.role === "owner");

  if (!hasOwner && workspace.isOwner) {
    teamMembers.unshift({
      id: "owner",
      userId: workspace.brandId,
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        "Owner",
      email: user.email || "",
      avatarUrl:
        typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null,
      role: "owner",
      acceptedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  const { data: invitations, error: invitationsError } = await supabase
    .from("brand_team_invitations")
    .select("id, email, role, status, invited_at, expires_at")
    .eq("brand_id", workspace.brandId)
    .in("status", ["pending", "expired"])
    .order("invited_at", { ascending: false });

  if (invitationsError) throw new Error(invitationsError.message);
  const nowMs = Date.now();

  return {
    workspaceBrandId: workspace.brandId,
    currentUserId: user.id,
    currentUserRole: workspace.role,
    members: teamMembers,
    pendingInvitations: (invitations ?? []).map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role as Exclude<BrandTeamRole, "owner">,
      status: invitation.status as "pending" | "expired",
      invitedAt: invitation.invited_at,
      expiresAt: invitation.expires_at,
      isExpired:
        invitation.status === "expired" ||
        new Date(invitation.expires_at).getTime() <= nowMs,
    })),
  };
}

export async function createBrandTeamInvitation(input: {
  email: string;
  role: z.infer<typeof brandTeamInviteRoleSchema>;
}) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandTeamManagerAccess();
  const parsed = inviteSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Enter a valid teammate email.");
  }

  await assertEmailCanReceiveBrandTeamInvitation({
    brandId: workspace.brandId,
    normalizedEmail: parsed.data.email,
    supabase,
    user,
  });

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: invitation, error } = await supabase
    .from("brand_team_invitations")
    .upsert(
      {
        brand_id: workspace.brandId,
        email: parsed.data.email,
        role: parsed.data.role,
        status: "pending",
        invited_by: user.id,
        invited_at: now.toISOString(),
        expires_at: expiresAt,
        revoked_at: null,
        updated_at: now.toISOString(),
      },
      { onConflict: "brand_id,email" },
    )
    .select("id, expires_at")
    .single();

  if (error) throw new Error(error.message);
  if (!invitation) throw new Error("Invite could not be created.");

  const admin = createAdminClient();
  const { brandName, invitedByName } = await getBrandTeamInvitationEmailContext(
    {
      supabase,
      workspace,
      user,
    },
  );
  const queueItem = await queueBrandTeamInvitationEmail({
    admin,
    brandId: workspace.brandId,
    brandName,
    email: parsed.data.email,
    expiresAt: invitation.expires_at,
    invitationId: invitation.id,
    invitedByName,
    role: parsed.data.role,
  });

  await insertBrandTeamAuditLog({
    actorId: user.id,
    action: "brand_team_invitation_created",
    target_type: "brand_team_invitation",
    target_id: invitation.id,
    metadata: {
      brand_id: workspace.brandId,
      actor_role: workspace.role,
      target_email: parsed.data.email,
      target_role: parsed.data.role,
      queued_email_id: queueItem?.id ?? null,
    },
  });

  if (queueItem?.id) {
    try {
      await dispatchNotificationEmailByQueueId(queueItem.id, admin);
    } catch (dispatchError) {
      console.error(
        "Failed to dispatch brand team invitation email:",
        dispatchError,
      );
    }
  }

  revalidatePath("/b/settings");
}

export async function acceptBrandTeamInvitation(invitationId: string) {
  const parsed = invitationIdSchema.safeParse(invitationId);

  if (!parsed.success) {
    throw new Error("Invite not found.");
  }

  const user = await getUser();
  const accepted = await acceptPendingBrandTeamInvitationForUser({
    userId: user.id,
    email: user.email,
    fullName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null,
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null,
    invitationId: parsed.data,
  });

  if (!accepted.accepted) {
    throw new Error("Invite could not be accepted.");
  }

  revalidatePath("/b/settings");
  redirect("/b/home");
}

export async function resendBrandTeamInvitation(invitationId: string) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandTeamManagerAccess();
  const parsed = invitationIdSchema.safeParse(invitationId);

  if (!parsed.success) {
    throw new Error("Invite not found.");
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: invitation, error } = await supabase
    .from("brand_team_invitations")
    .update({
      status: "pending",
      invited_at: now.toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", parsed.data)
    .eq("brand_id", workspace.brandId)
    .in("status", ["pending", "expired"])
    .select("id, email, role, expires_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invitation) throw new Error("Invite could not be resent.");

  const admin = createAdminClient();
  const { brandName, invitedByName } = await getBrandTeamInvitationEmailContext(
    {
      supabase,
      workspace,
      user,
    },
  );
  const queueItem = await queueBrandTeamInvitationEmail({
    admin,
    brandId: workspace.brandId,
    brandName,
    email: invitation.email,
    expiresAt: invitation.expires_at,
    invitationId: invitation.id,
    invitedByName,
    role: invitation.role as Exclude<BrandTeamRole, "owner">,
  });

  await insertBrandTeamAuditLog({
    actorId: user.id,
    action: "brand_team_invitation_resent",
    target_type: "brand_team_invitation",
    target_id: invitation.id,
    metadata: {
      brand_id: workspace.brandId,
      actor_role: workspace.role,
      target_email: invitation.email,
      target_role: invitation.role,
      expires_at: invitation.expires_at,
      queued_email_id: queueItem?.id ?? null,
    },
  });

  if (queueItem?.id) {
    try {
      await dispatchNotificationEmailByQueueId(queueItem.id, admin);
    } catch (dispatchError) {
      console.error(
        "Failed to dispatch brand team invitation resend email:",
        dispatchError,
      );
    }
  }

  revalidatePath("/b/settings");
}

export async function revokeBrandTeamInvitation(invitationId: string) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandTeamManagerAccess();
  const parsed = invitationIdSchema.safeParse(invitationId);

  if (!parsed.success) {
    throw new Error("Invite not found.");
  }

  const { data: revokedInvitation, error } = await supabase
    .from("brand_team_invitations")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data)
    .eq("brand_id", workspace.brandId)
    .in("status", ["pending", "expired"])
    .select("id, email, role")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!revokedInvitation) throw new Error("Invite could not be revoked.");

  await insertBrandTeamAuditLog({
    actorId: user.id,
    action: "brand_team_invitation_revoked",
    target_type: "brand_team_invitation",
    target_id: revokedInvitation.id,
    metadata: {
      brand_id: workspace.brandId,
      actor_role: workspace.role,
      target_email: revokedInvitation.email,
      target_role: revokedInvitation.role,
    },
  });

  revalidatePath("/b/settings");
}

export async function updateBrandTeamMemberRole(input: {
  memberId: string;
  role: z.infer<typeof brandTeamMemberRoleSchema>;
}) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandTeamManagerAccess();
  const parsed = memberRoleUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Team member not found.");
  }

  const member = await getBrandTeamMemberForManagement(
    supabase,
    workspace.brandId,
    parsed.data.memberId,
  );

  if (member.user_id === user.id) {
    throw new Error("You cannot change your own role.");
  }

  await assertOwnerRoleChangeAllowed({
    brandId: workspace.brandId,
    memberId: member.id,
    nextRole: parsed.data.role,
    previousRole: member.role as BrandTeamRole,
    supabase,
    workspace,
  });

  const { data: updatedMember, error } = await supabase
    .from("brand_team_members")
    .update({
      role: parsed.data.role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.memberId)
    .eq("brand_id", workspace.brandId)
    .not("accepted_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updatedMember) throw new Error("Team member could not be updated.");

  const memberProfile = await getBrandTeamMemberProfileForAudit(
    supabase,
    member.user_id,
  );

  await insertBrandTeamAuditLog({
    actorId: user.id,
    action: "brand_team_member_role_updated",
    target_type: "brand_team_member",
    target_id: updatedMember.id,
    metadata: {
      brand_id: workspace.brandId,
      actor_role: workspace.role,
      target_user_id: member.user_id,
      target_email: memberProfile?.email ?? null,
      target_name: memberProfile?.full_name ?? null,
      previous_role: member.role,
      target_role: parsed.data.role,
    },
  });

  revalidatePath("/b/settings");
}

export async function removeBrandTeamMember(memberId: string) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandTeamManagerAccess();
  const parsed = memberIdSchema.safeParse(memberId);

  if (!parsed.success) {
    throw new Error("Team member not found.");
  }

  const member = await getBrandTeamMemberForManagement(
    supabase,
    workspace.brandId,
    parsed.data,
  );

  if (member.role === "owner") {
    throw new Error("Owner cannot be removed.");
  }

  if (member.user_id === user.id) {
    throw new Error("You cannot remove yourself.");
  }

  const { data: removedMember, error } = await supabase
    .from("brand_team_members")
    .delete()
    .eq("id", parsed.data)
    .eq("brand_id", workspace.brandId)
    .not("accepted_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!removedMember) throw new Error("Team member could not be removed.");

  const memberProfile = await getBrandTeamMemberProfileForAudit(
    supabase,
    member.user_id,
  );

  await insertBrandTeamAuditLog({
    actorId: user.id,
    action: "brand_team_member_removed",
    target_type: "brand_team_member",
    target_id: removedMember.id,
    metadata: {
      brand_id: workspace.brandId,
      actor_role: workspace.role,
      target_user_id: member.user_id,
      target_email: memberProfile?.email ?? null,
      target_name: memberProfile?.full_name ?? null,
      target_role: member.role,
    },
  });

  revalidatePath("/b/settings");
}

async function getBrandTeamMemberForManagement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
  memberId: string,
) {
  const { data: member, error } = await supabase
    .from("brand_team_members")
    .select("id, user_id, role, accepted_at")
    .eq("id", memberId)
    .eq("brand_id", brandId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!member) throw new Error("Team member not found.");

  return member;
}

async function assertOwnerRoleChangeAllowed({
  brandId,
  memberId,
  nextRole,
  previousRole,
  supabase,
  workspace,
}: {
  brandId: string;
  memberId: string;
  nextRole: BrandTeamRole;
  previousRole: BrandTeamRole;
  supabase: Awaited<ReturnType<typeof createClient>>;
  workspace: BrandWorkspace;
}) {
  const touchesOwnerRole = previousRole === "owner" || nextRole === "owner";

  if (!touchesOwnerRole) return;

  if (workspace.role !== "owner") {
    throw new Error("Only owners can assign owner access.");
  }

  if (previousRole !== "owner" || nextRole === "owner") return;

  const { data: otherOwners, error } = await supabase
    .from("brand_team_members")
    .select("id")
    .eq("brand_id", brandId)
    .eq("role", "owner")
    .not("accepted_at", "is", null)
    .neq("id", memberId);

  if (error) throw new Error(error.message);
  if (!otherOwners?.length) {
    throw new Error("Workspace must keep at least one owner.");
  }
}

async function assertEmailCanReceiveBrandTeamInvitation({
  brandId,
  normalizedEmail,
  supabase,
  user,
}: {
  brandId: string;
  normalizedEmail: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: Awaited<ReturnType<typeof getUser>>;
}) {
  if (normalizedEmail === user.email?.toLowerCase()) {
    throw new Error("That person is already on this team.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile?.id) return;

  const { data: acceptedMember, error: acceptedMemberError } = await supabase
    .from("brand_team_members")
    .select("id")
    .eq("brand_id", brandId)
    .eq("user_id", profile.id)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (acceptedMemberError) throw new Error(acceptedMemberError.message);
  if (acceptedMember) {
    throw new Error("That person is already on this team.");
  }
}

async function getBrandTeamMemberProfileForAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: memberProfile, error } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return memberProfile;
}

async function assertBrandTeamManagerAccess(): Promise<BrandWorkspace> {
  const user = await getUser();
  const supabase = await createClient();
  return assertBrandWorkspacePermission(supabase, user.id, "manage_team");
}
