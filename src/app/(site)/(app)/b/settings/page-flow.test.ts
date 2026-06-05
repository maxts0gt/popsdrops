import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./page.tsx", import.meta.url)),
  "utf8",
);
const stringsSource = readFileSync(
  fileURLToPath(new URL("../../../../../lib/i18n/strings.ts", import.meta.url)),
  "utf8",
);
const validationsSource = readFileSync(
  fileURLToPath(new URL("../../../../../lib/validations.ts", import.meta.url)),
  "utf8",
);
const marketPickerSource = readFileSync(
  fileURLToPath(
    new URL("../../../../../components/campaigns/campaign-market-picker.tsx", import.meta.url),
  ),
  "utf8",
);

describe("brand settings team management", () => {
  it("uses the shared brand permission map for profile and team controls", () => {
    expect(source).toContain("hasBrandWorkspacePermission");
    expect(source).toContain("const canManageProfile");
    expect(source).toContain('"manage_profile"');
    expect(source).toContain('"manage_team"');
    expect(source).toContain('data-testid="brand-profile-readonly-badge"');
    expect(source).toContain("disabled={!canManageProfile}");
    expect(source).toContain("if (!data || !canManageProfile) return;");
    expect(source).toContain("{canManageProfile && (");
    expect(stringsSource).toContain('"team.readOnly": "Read-only"');
    expect(stringsSource).toContain(
      '"markets.none": "No target markets selected."',
    );
  });

  it("shows a compact team section with owner, teammates, and pending invites", () => {
    expect(source).toContain("getBrandTeamSettings");
    expect(source).toContain("createBrandTeamInvitation");
    expect(source).toContain("resendBrandTeamInvitation");
    expect(source).toContain("revokeBrandTeamInvitation");
    expect(source).toContain('data-testid="brand-team-settings"');
    expect(source).toContain('data-testid="brand-team-active-members"');
    expect(source).toContain('data-testid="brand-team-pending-invites"');
    expect(source).toContain('data-testid="brand-team-member-row"');
    expect(source).toContain('data-testid="brand-team-invite-row"');
    expect(source).toContain('data-testid="brand-team-invite-form"');
    expect(source).toContain('data-testid="brand-team-role-guide"');
    expect(source).toContain("team.roleGuide");
    expect(source).toContain("team.activeMembers");
    expect(source).toContain('type="email"');
    expect(source).toContain("team.role.owner");
    expect(source).toContain("team.role.manager");
    expect(source).toContain("brandTeamInviteRoleOptions");
    expect(source).toContain("brandTeamMemberRoleOptions");
    expect(stringsSource).toContain('"team.title": "Team access"');
    expect(stringsSource).toContain('"team.inviteCta": "Invite"');
    expect(stringsSource).toContain('"team.resend": "Resend invite"');
    expect(stringsSource).toContain('"team.expired": "Expired"');
    expect(stringsSource).toContain('"team.roleGuide": "Role permissions"');
  });

  it("keeps team management controls owner and admin only", () => {
    expect(source).toContain("const canManageTeam");
    expect(source).toContain("hasBrandWorkspacePermission");
    expect(source).toContain('"manage_team"');
    expect(source).toContain("{canManageTeam && (");
    expect(source).toContain("{canManageTeam && (");
    expect(source).toContain('"team.manageUnavailable"');
    expect(source).toContain("team.currentAccess");
    expect(source).toContain("handleResendInvite");
    expect(source).toContain("resendingInviteId");
    expect(source).toContain('aria-label={t("team.resend")}');
    expect(source).toContain("error instanceof Error ? error.message");
    expect(stringsSource).toContain(
      '"team.manageUnavailable": "Ask an owner or admin to invite teammates."',
    );
    expect(stringsSource).toContain('"team.resendSent": "Invite resent"');
  });

  it("keeps accepted teammate role, owner transfer, and removal controls compact", () => {
    expect(source).toContain("updateBrandTeamMemberRole");
    expect(source).toContain("removeBrandTeamMember");
    expect(source).toContain("handleUpdateTeamMemberRole");
    expect(source).toContain("handleRemoveTeamMember");
    expect(source).toContain("canManageAcceptedMember");
    expect(source).toContain('team?.currentUserRole === "owner"');
    expect(source).toContain("brandTeamMemberRoleOptions.map");
    expect(source).toContain('aria-label={t("team.changeRole")}');
    expect(source).toContain('aria-label={t("team.remove")}');
    expect(source).toContain("UserMinus");
    expect(source).toContain("updatingMemberId");
    expect(source).toContain("removingMemberId");
    expect(stringsSource).toContain('"team.roleSaved": "Role updated"');
    expect(stringsSource).toContain('"team.removeSent": "Teammate removed"');
  });

  it("makes pending invite metadata and role permissions visible before action", () => {
    expect(source).toContain("team.sent");
    expect(source).toContain("team.status.pending");
    expect(source).toContain("team.roleHelp.admin");
    expect(source).toContain("team.roleHelp.manager");
    expect(source).toContain("team.roleHelp.viewer");
    expect(source).toContain("invitation.invitedAt");
    expect(source).toContain("rolePermissionItems.map");
    expect(stringsSource).toContain('"team.sent": "Sent {date}"');
    expect(stringsSource).toContain('"team.status.pending": "Pending"');
    expect(stringsSource).toContain('"team.roleHelp.admin"');
    expect(stringsSource).toContain(
      "Manage campaigns, reports, profile settings, and teammates.",
    );
    expect(stringsSource).toContain('"team.roleHelp.viewer"');
    expect(stringsSource).toContain(
      "View campaigns and reports without changing workspace settings.",
    );
  });

  it("reuses the campaign market picker for compact brand target markets", () => {
    expect(source).toContain("CampaignMarketPicker");
    expect(source).toContain("MARKET_SCOPE_OPTIONS");
    expect(source).toContain("sanitizeCampaignMarkets");
    expect(source).toContain("targetMarkets: sanitizeCampaignMarkets");
    expect(source).toContain('testId="brand-settings-market-picker"');
    expect(source).toContain('selectedChipTone="subtle"');
    expect(marketPickerSource).toContain("selectedChipTone = \"primary\"");
    expect(marketPickerSource).toContain("selectedChipTone === \"subtle\"");
    expect(marketPickerSource).toContain("border-border bg-muted/40 text-foreground");
    expect(source).toContain('data-testid="brand-markets-save"');
    expect(source).toContain("markets.placeholder");
    expect(source).toContain("markets.selected");
    expect(source).toContain("markets.scope");
    expect(source).toContain("markets.search");
    expect(source).toContain("markets.empty");
    expect(source).not.toContain("Object.entries(MARKET_LABELS).map");
    expect(stringsSource).toContain('"markets.placeholder": "Select markets"');
    expect(stringsSource).toContain('"markets.selected": "{count} selected"');
    expect(stringsSource).toContain('"markets.scope": "Market scope"');
    expect(stringsSource).toContain('"markets.search": "Search countries"');
    expect(stringsSource).toContain('"markets.empty": "No countries found"');
    expect(validationsSource).toContain(
      "target_markets: z.array(campaignMarketEnum).min(1).optional()",
    );
  });
});
