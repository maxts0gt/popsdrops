import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./brand-team.ts", import.meta.url)),
  "utf8",
);
const actionsIndexSource = readFileSync(
  fileURLToPath(new URL("./index.ts", import.meta.url)),
  "utf8",
);

describe("brand team actions", () => {
  it("loads the owner, active teammates, and pending invitations for the current brand", () => {
    expect(source).toContain("export async function getBrandTeamSettings");
    expect(source).toContain('.from("brand_team_members")');
    expect(source).toContain('.from("brand_team_invitations")');
    expect(source).toContain("getBrandWorkspaceForCurrentUser");
    expect(source).toContain("workspaceBrandId");
    expect(source).toContain('.eq("brand_id", workspace.brandId)');
    expect(source).toContain('.in("status", ["pending", "expired"])');
    expect(source).toContain("owner");
  });

  it("lets brand owners and admins invite or revoke pending teammates", () => {
    expect(source).toContain("export async function createBrandTeamInvitation");
    expect(source).toContain("export async function resendBrandTeamInvitation");
    expect(source).toContain("export async function revokeBrandTeamInvitation");
    expect(source).toContain("brandTeamInviteRoleSchema");
    expect(source).toContain("role: parsed.data.role");
    expect(source).toContain('status: "pending"');
    expect(source).toContain('status: "revoked"');
    expect(source).toContain("brand_id: workspace.brandId");
    expect(source).toContain("assertBrandTeamManagerAccess");
    expect(source).toContain('revalidatePath("/b/settings")');
  });

  it("checks manage_team permission before validating team mutation targets", () => {
    const teamMutationChecks = [
      {
        name: "createBrandTeamInvitation",
        action: "export async function createBrandTeamInvitation",
        firstPayloadRead: "inviteSchema.safeParse(input)",
      },
      {
        name: "resendBrandTeamInvitation",
        action: "export async function resendBrandTeamInvitation",
        firstPayloadRead: "invitationIdSchema.safeParse(invitationId)",
      },
      {
        name: "revokeBrandTeamInvitation",
        action: "export async function revokeBrandTeamInvitation",
        firstPayloadRead: "invitationIdSchema.safeParse(invitationId)",
      },
      {
        name: "updateBrandTeamMemberRole",
        action: "export async function updateBrandTeamMemberRole",
        firstPayloadRead: "memberRoleUpdateSchema.safeParse(input)",
      },
      {
        name: "removeBrandTeamMember",
        action: "export async function removeBrandTeamMember",
        firstPayloadRead: "memberIdSchema.safeParse(memberId)",
      },
    ];

    for (const check of teamMutationChecks) {
      const start = source.indexOf(check.action);
      const actionSource = source.slice(start, source.indexOf("export async function", start + 1));
      const permissionIndex = actionSource.indexOf("assertBrandTeamManagerAccess()");
      const payloadIndex = actionSource.indexOf(check.firstPayloadRead);

      expect(start, `${check.name} action should exist`).toBeGreaterThanOrEqual(0);
      expect(permissionIndex, `${check.name} should check manage_team`).toBeGreaterThanOrEqual(0);
      expect(payloadIndex, `${check.name} should validate its payload`).toBeGreaterThanOrEqual(0);
      expect(permissionIndex, `${check.name} should check manage_team first`).toBeLessThan(payloadIndex);
    }
  });

  it("blocks invites for the current user or an accepted teammate", () => {
    expect(source).toContain("assertEmailCanReceiveBrandTeamInvitation");
    expect(source).toContain("normalizedEmail === user.email?.toLowerCase()");
    expect(source).toContain('.from("profiles")');
    expect(source).toContain('.eq("email", normalizedEmail)');
    expect(source).toContain('.eq("user_id", profile.id)');
    expect(source).toContain(
      'throw new Error("That person is already on this team.")',
    );
  });

  it("queues a branded teammate invitation email when an invite is created", () => {
    expect(source).toContain("getAppBaseUrl");
    expect(source).toContain("dispatchNotificationEmailByQueueId");
    expect(source).toContain('.from("notification_queue")');
    expect(source).toContain('template: "brand_team_invitation"');
    expect(source).toContain("brandName");
    expect(source).toContain("invitedByName");
    expect(source).toContain("expiresAt");
    expect(source).toContain("teamInvitationUrl");
    expect(source).toContain("/team/invitations/");
  });

  it("accepts an explicit teammate invitation from the handoff page", () => {
    expect(source).toContain("export async function acceptBrandTeamInvitation");
    expect(source).toContain("acceptPendingBrandTeamInvitationForUser");
    expect(source).toContain("invitationId: parsed.data");
    expect(source).toContain('throw new Error("Invite could not be accepted.")');
    expect(source).toContain('revalidatePath("/b/settings")');
    expect(source).toContain('redirect("/b/home")');
  });

  it("resends pending or expired invitations with a fresh expiry and audit trail", () => {
    expect(source).toContain("export async function resendBrandTeamInvitation");
    expect(source).toContain('.in("status", ["pending", "expired"])');
    expect(source).toContain('status: "pending"');
    expect(source).toContain("invited_at: now.toISOString()");
    expect(source).toContain("expires_at: expiresAt");
    expect(source).toContain("queueBrandTeamInvitationEmail");
    expect(source).toContain('action: "brand_team_invitation_resent"');
    expect(source).toContain("queued_email_id: queueItem?.id ?? null");
    expect(source).toContain('throw new Error("Invite could not be resent.")');
  });

  it("writes an audit trail for every brand team lifecycle change", () => {
    expect(source).toContain("insertBrandTeamAuditLog");
    expect(source).toContain('.from("admin_audit_log")');
    expect(source).toContain('action: "brand_team_invitation_created"');
    expect(source).toContain('action: "brand_team_invitation_resent"');
    expect(source).toContain('action: "brand_team_invitation_revoked"');
    expect(source).toContain('action: "brand_team_member_role_updated"');
    expect(source).toContain('action: "brand_team_member_removed"');
    expect(source).toContain('target_type: "brand_team_invitation"');
    expect(source).toContain('target_type: "brand_team_member"');
    expect(source).toContain("actor_role: workspace.role");
    expect(source).toContain("brand_id: workspace.brandId");
  });

  it("stores human-readable teammate targets in member change audit metadata", () => {
    expect(source).toContain("getBrandTeamMemberProfileForAudit");
    expect(source).toContain("target_email: memberProfile?.email ?? null");
    expect(source).toContain("target_name: memberProfile?.full_name ?? null");
  });

  it("confirms a pending invite was actually revoked before refreshing settings", () => {
    expect(source).toContain('.select("id, email, role")');
    expect(source).toContain(".maybeSingle()");
    expect(source).toContain('throw new Error("Invite could not be revoked.")');
  });

  it("lets owners transfer owner access while preserving at least one owner", () => {
    expect(source).toContain("export async function updateBrandTeamMemberRole");
    expect(source).toContain("memberRoleUpdateSchema");
    expect(source).toContain("brandTeamMemberRoleSchema");
    expect(source).toContain('"owner"');
    expect(source).toContain("memberIdSchema");
    expect(source).toContain("assertBrandTeamManagerAccess");
    expect(source).toContain("role: parsed.data.role");
    expect(source).toContain('.from("brand_team_members")');
    expect(source).toContain(".update({");
    expect(source).toContain('.eq("id", parsed.data.memberId)');
    expect(source).toContain('.eq("brand_id", workspace.brandId)');
    expect(source).toContain('member.role === "owner"');
    expect(source).toContain("member.user_id === user.id");
    expect(source).toContain("assertOwnerRoleChangeAllowed");
    expect(source).toContain("Only owners can assign owner access.");
    expect(source).toContain("Workspace must keep at least one owner.");
    expect(source).toContain("You cannot change your own role.");
    expect(source).toContain('revalidatePath("/b/settings")');
  });

  it("lets owners and admins remove accepted teammates without deleting the user profile", () => {
    expect(source).toContain("export async function removeBrandTeamMember");
    expect(source).toContain("getBrandTeamMemberForManagement");
    expect(source).toContain('.from("brand_team_members")');
    expect(source).toContain(".delete()");
    expect(source).toContain('.eq("id", parsed.data)');
    expect(source).toContain('.eq("brand_id", workspace.brandId)');
    expect(source).toContain('member.role === "owner"');
    expect(source).toContain("Owner cannot be removed.");
    expect(source).toContain("You cannot remove yourself.");
    expect(source).not.toContain('.from("profiles").delete()');
    expect(source).not.toContain("auth.admin.deleteUser");
    expect(source).toContain('revalidatePath("/b/settings")');
  });

  it("exports the complete team management surface from the action barrel", () => {
    expect(actionsIndexSource).toContain("getBrandTeamSettings");
    expect(actionsIndexSource).toContain("createBrandTeamInvitation");
    expect(actionsIndexSource).toContain("resendBrandTeamInvitation");
    expect(actionsIndexSource).toContain("revokeBrandTeamInvitation");
    expect(actionsIndexSource).toContain("updateBrandTeamMemberRole");
    expect(actionsIndexSource).toContain("removeBrandTeamMember");
  });
});
