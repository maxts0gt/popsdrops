import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("auth callback brand team invitations", () => {
  it("accepts pending brand team invitations before sending new users to pending approval", () => {
    expect(source).toContain("acceptPendingBrandTeamInvitationForUser");
    expect(source).toContain("isTeamInvitationReturnPath(next)");
    expect(source).toContain("const inviteAcceptance = await acceptPendingBrandTeamInvitationForUser");
    expect(source).toContain("if (inviteAcceptance.accepted)");
    expect(source).toContain('return NextResponse.redirect(`${origin}/b/home`)');

    const inviteAcceptanceIndex = source.indexOf(
      "await acceptPendingBrandTeamInvitationForUser",
    );
    const pendingApprovalIndex = source.indexOf("pending-approval");

    expect(inviteAcceptanceIndex).toBeGreaterThan(-1);
    expect(pendingApprovalIndex).toBeGreaterThan(-1);
    expect(inviteAcceptanceIndex).toBeLessThan(pendingApprovalIndex);
  });

  it("lets the invitation handoff page handle explicit acceptance when returnTo is the invite URL", () => {
    expect(source).toContain("normalizeAuthCallbackNextPath");
    expect(source).toContain("decodeURIComponent(next)");
    expect(source).toContain("new URL(next)");
    expect(source).toContain("function isTeamInvitationReturnPath");
    expect(source).toContain('next.startsWith("/team/invitations/")');
    expect(source).toContain("if (isTeamInvitationReturnPath(next))");
    expect(source).toContain("return NextResponse.redirect(`${origin}${next}`)");

    const explicitInviteIndex = source.indexOf("isTeamInvitationReturnPath(next)");
    const autoAcceptIndex = source.indexOf(
      "await acceptPendingBrandTeamInvitationForUser",
    );

    expect(explicitInviteIndex).toBeGreaterThan(-1);
    expect(autoAcceptIndex).toBeGreaterThan(-1);
    expect(explicitInviteIndex).toBeLessThan(autoAcceptIndex);
  });

  it("supports token-hash magic links before applying the team invite acceptance gate", () => {
    expect(source).toContain('const tokenHash = searchParams.get("token_hash")');
    expect(source).toContain("isSupportedEmailOtpType");
    expect(source).toContain("supabase.auth.verifyOtp");
    expect(source).toContain("supabase.auth.setSession");
    expect(source).toContain("token_hash: tokenHash");
    expect(source).toContain("withAuthCookies");
    expect(source).toContain("await redirectAuthenticatedUser");

    const verifyOtpIndex = source.indexOf("supabase.auth.verifyOtp");
    const inviteAcceptanceIndex = source.indexOf(
      "await acceptPendingBrandTeamInvitationForUser",
    );

    expect(verifyOtpIndex).toBeGreaterThan(-1);
    expect(inviteAcceptanceIndex).toBeGreaterThan(-1);
    expect(verifyOtpIndex).toBeLessThan(inviteAcceptanceIndex);
  });

  it("preserves the browser host when redirecting after auth cookies are set", () => {
    expect(source).toContain("getAuthCallbackRedirectOrigin");
    expect(source).toContain('request.headers.get("host")');
    expect(source).toContain('request.headers.get("x-forwarded-host")');
    expect(source).toContain('request.headers.get("x-forwarded-proto")');
    expect(source).toContain(
      "const origin = getAuthCallbackRedirectOrigin(nextRequest, requestUrl)",
    );
  });
});
