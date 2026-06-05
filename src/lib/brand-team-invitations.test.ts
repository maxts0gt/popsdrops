import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceUrl = new URL("./brand-team-invitations.ts", import.meta.url);
const source = existsSync(sourceUrl) ? readFileSync(sourceUrl, "utf8") : "";

describe("brand team invitation acceptance", () => {
  it("builds a limited invitation preview for the emailed handoff page", () => {
    expect(source).toContain("export async function getBrandTeamInvitationPreview");
    expect(source).toContain(".from(\"brand_team_invitations\")");
    expect(source).toContain(".eq(\"id\", invitationId)");
    expect(source).toContain(".from(\"brand_profiles\")");
    expect(source).toContain(".select(\"company_name\")");
    expect(source).toContain(".from(\"profiles\")");
    expect(source).toContain(".select(\"full_name, email\")");
    expect(source).toContain("invitedByName");
    expect(source).toContain("brandName");
    expect(source).toContain("accessSummary");
  });

  it("derives expired, revoked, accepted, and missing invite states for the page", () => {
    expect(source).toContain('status: "missing"');
    expect(source).toContain('return "expired"');
    expect(source).toContain('return "revoked"');
    expect(source).toContain('return "accepted"');
    expect(source).toContain("new Date(invitation.expires_at).getTime()");
    expect(source).toContain("Date.now()");
  });

  it("accepts pending invitations with an admin client during auth callback", () => {
    expect(source).toContain("server-only");
    expect(source).toContain("export async function acceptPendingBrandTeamInvitationForUser");
    expect(source).toContain("createAdminClient");
    expect(source).toContain(".from(\"brand_team_invitations\")");
    expect(source).toContain(".eq(\"email\", email.toLowerCase())");
    expect(source).toContain(".eq(\"status\", \"pending\")");
    expect(source).toContain(".gt(\"expires_at\", now)");
    expect(source).toContain(".from(\"profiles\")");
    expect(source).toContain("role: \"brand\"");
    expect(source).toContain("status: \"approved\"");
    expect(source).toContain(".from(\"brand_team_members\")");
    expect(source).toContain("accepted_at: now");
    expect(source).toContain("status: \"accepted\"");
  });

  it("can accept one explicit invitation id after the teammate reviews the handoff page", () => {
    expect(source).toContain("invitationId?: string");
    expect(source).toContain("if (invitationId)");
    expect(source).toContain(".eq(\"id\", invitationId)");
    expect(source).toContain("accepted: true as const");
    expect(source).toContain("brandId: invitation.brand_id as string");
    expect(source).toContain("role: invitation.role as string");
  });

  it("does not reuse expired, revoked, or already accepted invitations", () => {
    expect(source).toContain(".eq(\"status\", \"pending\")");
    expect(source).toContain(".gt(\"expires_at\", now)");
    expect(source).toContain(".eq(\"id\", invitation.id)");
    expect(source).toContain(".eq(\"status\", \"pending\")");
  });

  it("confirms the invitation transition before returning an accepted workspace", () => {
    expect(source).toContain(".select(\"id\")");
    expect(source).toContain(".maybeSingle()");
    expect(source).toContain("if (!acceptedInvitation)");
    expect(source).toContain("return { accepted: false as const }");
  });

  it("records acceptance in the platform audit trail", () => {
    expect(source).toContain("insertBrandTeamInvitationAcceptanceAuditLog");
    expect(source).toContain(".from(\"admin_audit_log\")");
    expect(source).toContain("brand_team_invitation_accepted");
    expect(source).toContain("target_type: \"brand_team_invitation\"");
    expect(source).toContain("accepted_user_id: userId");
    expect(source).toContain("brand_id: invitation.brand_id");
  });
});
