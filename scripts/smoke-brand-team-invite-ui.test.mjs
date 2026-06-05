import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-brand-team-invite-ui.mjs", import.meta.url)),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../package.json", import.meta.url)),
    "utf8",
  ),
);
const releaseMatrixSource = readFileSync(
  fileURLToPath(new URL("./release-smoke-matrix.test.ts", import.meta.url)),
  "utf8",
);

describe("brand team invite UI smoke", () => {
  it("drives the real settings invite, magic-link accept, and cleanup path", () => {
    expect(scriptSource).toContain("brand-team-invite-form");
    expect(scriptSource).toContain("teamInviteEmail");
    expect(scriptSource).toContain("brand_team_invitations");
    expect(scriptSource).toContain("notification_queue");
    expect(scriptSource).toContain("admin_audit_log");
    expect(scriptSource).toContain("generateLink");
    expect(scriptSource).toContain("/auth/callback");
    expect(scriptSource).toContain("/team/invitations/");
    expect(scriptSource).toContain("teamInvitationUrl");
    expect(scriptSource).toContain("brand-team-invitation-preview");
    expect(scriptSource).toContain("Accept invitation");
    expect(scriptSource).toContain("brand_team_invitation_accepted");
    expect(scriptSource).toContain("resendPendingInviteFromSettings");
    expect(scriptSource).toContain("expirePendingInvitationForSmoke");
    expect(scriptSource).toContain("assertExpiredInviteVisibleInSettings");
    expect(scriptSource).toContain("assertResentInvitation");
    expect(scriptSource).toContain("assertResentNotificationQueue");
    expect(scriptSource).toContain("brand_team_invitation_resent");
    expect(scriptSource).toContain("Read resent UI smoke brand team audit rows");
    expect(scriptSource).toContain("auditStartedAt");
    expect(scriptSource).toContain("Resent team invitation audit row did not settle.");
    expect(scriptSource).toContain("assertAcceptedTeammateInviteRejected");
    expect(scriptSource).toContain("assertNoPendingInvitationForAcceptedEmail");
    expect(scriptSource).toContain("Expired");
    expect(scriptSource).toContain("revokePendingInviteFromSettings");
    expect(scriptSource).toContain("assertRevokedInvitation");
    expect(scriptSource).toContain("updateAcceptedMemberRoleFromSettings");
    expect(scriptSource).toContain("assertUpdatedTeamMemberRole");
    expect(scriptSource).toContain('"owner"');
    expect(scriptSource).toContain('"viewer"');
    expect(scriptSource).toContain("removeAcceptedMemberFromSettings");
    expect(scriptSource).toContain("assertRemovedTeamMember");
    expect(scriptSource).toContain("brand_team_invitation_revoked");
    expect(scriptSource).toContain("brand_team_member_role_updated");
    expect(scriptSource).toContain("brand_team_member_removed");
    expect(scriptSource).toContain("brand-team-member-row");
    expect(scriptSource).toContain("cleanupBrandTeamInviteUiSmoke");
    expect(scriptSource).toContain("process.exit(process.exitCode ?? 0)");
    expect(scriptSource).toContain('SMOKE_EMAIL_DOMAIN = "example.invalid"');
    expect(scriptSource).not.toContain('SMOKE_EMAIL_DOMAIN = "tengrivertex.com"');
  });

  it("is wired into package scripts and the release smoke matrix", () => {
    expect(packageJson.scripts["smoke:brand-team-invite-ui"]).toBe(
      "node scripts/smoke-brand-team-invite-ui.mjs",
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:brand-team-invite-ui",
    );
    expect(releaseMatrixSource).toContain('"smoke:brand-team-invite-ui"');
  });
});
