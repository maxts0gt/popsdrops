import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const applicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);

const creatorDetailSource = readFileSync(
  new URL("../(site)/(app)/i/discover/[id]/page.tsx", import.meta.url),
  "utf8",
);

const creatorProfileSource = readFileSync(
  new URL("../(site)/(app)/i/profile/page.tsx", import.meta.url),
  "utf8",
);

const connectPlatformSheetSource = readFileSync(
  new URL("../../components/profile/connect-platform-sheet.tsx", import.meta.url),
  "utf8",
);

const eligibilitySource = readFileSync(
  new URL("../../lib/reporting/eligibility.ts", import.meta.url),
  "utf8",
);

describe("creator application reporting eligibility", () => {
  it("enforces required platform accounts in the submit application action", () => {
    expect(applicationsSource).toContain("getCreatorReportingEligibility");
    expect(applicationsSource).toContain("getCreatorDeclaredPlatforms");
    expect(applicationsSource).toContain("campaign_reporting_requirements");
    expect(applicationsSource).toContain(
      'select("platforms, tiktok, instagram, snapchat, youtube, facebook")',
    );
    expect(applicationsSource).toContain("reportingEligibility.status === \"not_eligible\"");
    expect(applicationsSource).toContain(
      "Add {platform} to your creator profile before applying.",
    );

    const insertIndex = applicationsSource.indexOf(".from(\"campaign_applications\")");
    const eligibilityIndex = applicationsSource.indexOf("getCreatorReportingEligibility");
    expect(eligibilityIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(eligibilityIndex);
  });

  it("blocks direct application submits while the campaign service fee is unpaid", () => {
    expect(applicationsSource).toContain(
      "service_fee_cents, service_fee_status",
    );
    expect(applicationsSource).toContain("isCampaignServiceFeeUnlocked");
    expect(applicationsSource).toContain("!isCampaignServiceFeeUnlocked(campaign)");
    expect(applicationsSource).toContain(
      "This campaign is not accepting applications yet.",
    );

    const feeGateIndex = applicationsSource.indexOf(
      "!isCampaignServiceFeeUnlocked(campaign)",
    );
    const insertIndex = applicationsSource.indexOf(".from(\"campaign_applications\")");
    expect(feeGateIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(feeGateIndex);
  });

  it("tracks the private invite row when an invited creator applies", () => {
    expect(applicationsSource).toContain("invite_id");
    expect(applicationsSource).toContain("sourceInviteId");
    expect(applicationsSource).toContain("campaign_creator_invites");
    expect(applicationsSource).toContain("matchedSourceInvite");
    expect(applicationsSource).toContain("creatorProfileMatchesInvite");
    expect(applicationsSource).toContain("@/lib/campaigns/creator-invite-match");
    expect(applicationsSource).toContain("updateCampaignCreatorInviteResponse");
    expect(applicationsSource).toContain('status: "sent"');
    expect(applicationsSource).toContain("source_invite_id");

    const inviteLookupIndex = applicationsSource.indexOf("matchedSourceInvite");
    const applicationInsertIndex = applicationsSource.indexOf(
      ".from(\"campaign_applications\")",
    );
    const inviteUpdateIndex = applicationsSource.indexOf(
      "updateCampaignCreatorInviteResponse",
      applicationInsertIndex,
    );

    expect(inviteLookupIndex).toBeGreaterThan(-1);
    expect(applicationInsertIndex).toBeGreaterThan(inviteLookupIndex);
    expect(inviteUpdateIndex).toBeGreaterThan(applicationInsertIndex);
  });

  it("rejects inactive private invite rows before application insert", () => {
    expect(applicationsSource).toContain("isActiveCampaignCreatorInviteStatus");
    expect(applicationsSource).toContain(
      "!isActiveCampaignCreatorInviteStatus(invite.status)",
    );
    expect(applicationsSource).not.toContain('invite.status === "failed"');
  });

  it("requires a verified invite before private or shortlist applications insert", () => {
    expect(applicationsSource).toContain("requiresVerifiedInviteForApplication");
    expect(applicationsSource).toContain("recruitment_visibility");
    expect(applicationsSource).toContain("This campaign is invite-only.");

    const inviteRequirementIndex = applicationsSource.indexOf(
      "requiresVerifiedInviteForApplication(campaign)",
    );
    const applicationInsertIndex = applicationsSource.indexOf(
      ".from(\"campaign_applications\")",
    );

    expect(inviteRequirementIndex).toBeGreaterThan(-1);
    expect(applicationInsertIndex).toBeGreaterThan(inviteRequirementIndex);
  });

  it("carries invite context through the signed-in creator application form", () => {
    expect(creatorDetailSource).toContain("useSearchParams");
    expect(creatorDetailSource).toContain("inviteId");
    expect(creatorDetailSource).toContain("getCreatorCampaignInviteContext");
    expect(creatorDetailSource).toContain('data-testid="creator-private-invite-context"');
    expect(creatorDetailSource).toContain('t("privateInvite.title")');
    expect(creatorDetailSource).toContain("invite_id: verifiedInviteId ?? undefined");
  });

  it("shows and blocks missing reporting accounts on the signed-in creator detail page", () => {
    expect(creatorDetailSource).toContain("reportingRequirements");
    expect(creatorDetailSource).toContain("getCreatorReportingEligibility");
    expect(creatorDetailSource).toContain("getCreatorDeclaredPlatforms");
    expect(creatorDetailSource).toContain("isReportingBlocked");
    expect(creatorDetailSource).toContain("reportingAccountMissing");
    expect(creatorDetailSource).toContain(
      'disabled={applying || isReportingBlocked || !rate || parseInt(rate) <= 0}',
    );
  });

  it("gives creators a direct manual profile fix path and returns to the campaign", () => {
    expect(creatorDetailSource).toContain("missingCreatorProfilePlatforms");
    expect(creatorDetailSource).toContain("getMissingPlatformProfileHref");
    expect(creatorDetailSource).toContain('href={getMissingPlatformProfileHref(platform)}');
    expect(creatorDetailSource).toContain("reportingAddPlatform");

    expect(creatorProfileSource).toContain("useSearchParams");
    expect(creatorProfileSource).toContain("requestedPlatform");
    expect(creatorProfileSource).toContain("returnToPath");
    expect(creatorProfileSource).toContain("setConnectPlatform(requestedPlatform)");
    expect(creatorProfileSource).toContain("key={connectPlatform}");
    expect(creatorProfileSource).toContain("router.push(returnToPath)");

    expect(connectPlatformSheetSource).toContain("useState(currentAccount?.url || \"\")");
    expect(connectPlatformSheetSource).toContain(
      "currentAccount?.followers ? String(currentAccount.followers) : \"\"",
    );
  });

  it("derives creator platforms from both explicit platform lists and connected account fields", () => {
    expect(eligibilitySource).toContain("export function getCreatorDeclaredPlatforms");
    expect(eligibilitySource).toContain("profile.platforms");
    expect(eligibilitySource).toContain("profile.instagram");
    expect(eligibilitySource).toContain("profile.tiktok");
  });
});
