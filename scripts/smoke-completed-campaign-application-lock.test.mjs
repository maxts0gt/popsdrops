import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CLOSED_APPLICATION_DECISIONS_MESSAGE,
  DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID,
  buildCompletedCampaignApplicationLockSmokeTargets,
  validateCompletedCampaignApplicationLockSmoke,
} from "./smoke-completed-campaign-application-lock.mjs";
import {
  SMOKE_CAMPAIGN_TITLE,
  getSmokeCreatorDisplayName,
} from "./smoke-application-flow.mjs";

const creatorName = getSmokeCreatorDisplayName();

describe("completed campaign application lock smoke contract", () => {
  it("targets a disposable completed campaign and the brand creators tab", () => {
    expect(buildCompletedCampaignApplicationLockSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID,
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID}`,
      brandCampaignCreatorsUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID}?tab=creators`,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      publicApplyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID}`,
      creatorDiscoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_COMPLETED_CAMPAIGN_APPLICATION_LOCK_CAMPAIGN_ID}`,
    });
  });

  it("rejects a completed campaign page with active applicant controls", () => {
    expect(() =>
      validateCompletedCampaignApplicationLockSmoke({
        pageText:
          `${SMOKE_CAMPAIGN_TITLE} Applications are closed for this campaign stage. ${creatorName} Accept`,
        visibleBulkToolbarCount: 1,
        visibleApplicantActionCount: 1,
        visibleApplicantSelectCount: 2,
        closedActionCount: 0,
        consoleErrors: [],
      }),
    ).toThrow(/active applicant controls/i);
  });

  it("accepts a completed campaign page only when applicant controls are locked", () => {
    expect(
      validateCompletedCampaignApplicationLockSmoke({
        pageText: `${SMOKE_CAMPAIGN_TITLE} ${CLOSED_APPLICATION_DECISIONS_MESSAGE} ${creatorName} Closed`,
        visibleBulkToolbarCount: 0,
        visibleApplicantActionCount: 0,
        visibleApplicantSelectCount: 0,
        closedActionCount: 1,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("updates the seeded campaign to completed before the browser smoke", () => {
    const source = readFileSync(
      new URL("./smoke-completed-campaign-application-lock.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain('status: "completed"');
    expect(source).toContain("createPendingApplicationForCompletedCampaignSmoke");
    expect(source).toContain(CLOSED_APPLICATION_DECISIONS_MESSAGE);
    expect(source).toContain("campaign-applicant-bulk-toolbar");
    expect(source).toContain("campaign-applicant-action");
    expect(source).toContain("campaign-applicant-select");
    expect(source).toContain("completed-campaign-application-lock-smoke.png");
    expect(source).toContain("ensureSmokeIdentityEnvDefaults()");
    expect(source).toContain("getSmokeCreatorDisplayName()");
    expect(source).not.toContain('includes("Dev Creator")');
  });

  it("smokes completed private invite URLs as neutral audit states", () => {
    const source = readFileSync(
      new URL("./smoke-completed-campaign-application-lock.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("inspectCompletedPublicPrivateInviteLock");
    expect(source).toContain("inspectCompletedCreatorPrivateInviteLock");
    expect(source).toContain("clearCompletedCampaignCreatorApplicationsForInviteSmoke");
    expect(source).toContain("waitForPublicApplyHeroImage");
    expect(source).toContain("waitForCreatorCampaignHeroImage");
    expect(source).toContain('data-testid="public-apply-private-invite"');
    expect(source).toContain('data-testid="creator-private-invite-context"');
    expect(source).toContain(
      "This private invite is preserved for audit because the campaign is complete.",
    );
    expect(source).toContain(
      "This invite is confirmed, but the campaign is complete and no longer accepting applications.",
    );
    expect(source).toContain("completed-campaign-public-private-invite-lock-smoke.png");
    expect(source).toContain("completed-campaign-creator-private-invite-lock-smoke.png");
  });
});
