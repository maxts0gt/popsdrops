import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(site)/team/invitations/[id]");
const pageSource = existsSync(join(routeDir, "page.tsx"))
  ? readFileSync(join(routeDir, "page.tsx"), "utf8")
  : "";
const layoutSource = existsSync(join(routeDir, "layout.tsx"))
  ? readFileSync(join(routeDir, "layout.tsx"), "utf8")
  : "";
const stringsSource = readFileSync(
  join(process.cwd(), "src/lib/i18n/strings.ts"),
  "utf8",
);
const emailActionSource = readFileSync(
  join(process.cwd(), "src/app/actions/brand-team.ts"),
  "utf8",
);
const emailTemplateSource = readFileSync(
  join(process.cwd(), "src/lib/email/templates/brand-team-invitation.tsx"),
  "utf8",
);

describe("brand team invitation handoff page", () => {
  it("uses a localized public shell and shows the invite context before acceptance", () => {
    expect(layoutSource).toContain("LocalizedRouteShell");
    expect(pageSource).toContain("getBrandTeamInvitationPreview");
    expect(pageSource).toContain("brandName");
    expect(pageSource).toContain("invitedByName");
    expect(pageSource).toContain("roleLabel");
    expect(pageSource).toContain("accessSummary");
    expect(pageSource).toContain('data-testid="brand-team-invitation-preview"');
    expect(pageSource).toContain('href={`/login?returnTo=${encodeURIComponent(returnToPath)}`}');
  });

  it("renders explicit expired, revoked, accepted, wrong-email, and pending states", () => {
    expect(pageSource).toContain('preview.status === "expired"');
    expect(pageSource).toContain('preview.status === "revoked"');
    expect(pageSource).toContain('preview.status === "accepted"');
    expect(pageSource).toContain("isWrongSignedInEmail");
    expect(pageSource).toContain("acceptBrandTeamInvitation");
    expect(pageSource).toContain('teamInvite.acceptCta');
    expect(pageSource).toContain('teamInvite.signInCta');
    expect(pageSource).toContain('teamInvite.openWorkspace');
    expect(pageSource).toContain('teamInvite.requestNewInvite');
  });

  it("keeps the email link pointed at the handoff page instead of bare login", () => {
    expect(emailActionSource).toContain("teamInvitationUrl");
    expect(emailActionSource).toContain("/team/invitations/");
    expect(emailActionSource).toContain("team_invitation_url");
    expect(emailTemplateSource).toContain("teamInvitationUrl");
    expect(emailTemplateSource).toContain("Review invitation");
  });

  it("adds source strings for the invitation page and keeps copy short", () => {
    expect(stringsSource).toContain('"team.invitation"');
    expect(stringsSource).toContain('"teamInvite.title": "Join {brandName}"');
    expect(stringsSource).toContain('"teamInvite.invitedBy": "Invited by {invitedByName}"');
    expect(stringsSource).toContain('"teamInvite.acceptCta": "Accept invitation"');
    expect(stringsSource).toContain('"teamInvite.expiredTitle": "Invite expired"');
    expect(stringsSource).toContain('"teamInvite.revokedTitle": "Invite revoked"');
    expect(stringsSource).toContain('"teamInvite.wrongEmailTitle": "Use the invited email"');
  });
});
