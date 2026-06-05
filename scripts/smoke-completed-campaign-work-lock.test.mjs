import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CLOSED_CREATOR_WORK_MESSAGE,
  CLOSED_CONTENT_DECISIONS_MESSAGE,
  CLOSED_PROOF_DECISIONS_MESSAGE,
  DEFAULT_COMPLETED_CAMPAIGN_WORK_LOCK_CAMPAIGN_ID,
  buildCompletedCampaignWorkLockSmokeTargets,
  validateCompletedCampaignWorkLockSmoke,
} from "./smoke-completed-campaign-work-lock.mjs";
import {
  SMOKE_CAMPAIGN_TITLE,
  getSmokeCreatorDisplayName,
} from "./smoke-application-flow.mjs";

const creatorName = getSmokeCreatorDisplayName();

describe("completed campaign content and proof lock smoke contract", () => {
  it("targets a disposable completed campaign and the brand and creator work tabs", () => {
    expect(buildCompletedCampaignWorkLockSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_COMPLETED_CAMPAIGN_WORK_LOCK_CAMPAIGN_ID,
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandCampaignContentUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_COMPLETED_CAMPAIGN_WORK_LOCK_CAMPAIGN_ID}?tab=content`,
      brandCampaignReportingUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_COMPLETED_CAMPAIGN_WORK_LOCK_CAMPAIGN_ID}?tab=reporting`,
      creatorCampaignSubmitUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_COMPLETED_CAMPAIGN_WORK_LOCK_CAMPAIGN_ID}?tab=submit`,
    });
  });

  it("rejects a completed campaign page with active content, proof, or creator work controls", () => {
    expect(() =>
      validateCompletedCampaignWorkLockSmoke({
        contentText: `${SMOKE_CAMPAIGN_TITLE} ${CLOSED_CONTENT_DECISIONS_MESSAGE} ${creatorName} Submitted`,
        reportingText: `${SMOKE_CAMPAIGN_TITLE} ${CLOSED_PROOF_DECISIONS_MESSAGE} ${creatorName} Open proof`,
        creatorText: `${SMOKE_CAMPAIGN_TITLE} ${CLOSED_CREATOR_WORK_MESSAGE} Submission handoff`,
        visibleContentDecisionCount: 1,
        visibleProofDecisionCount: 1,
        visibleMissedDecisionCount: 1,
        visibleCreatorWorkControlCount: 1,
        consoleErrors: [],
      }),
    ).toThrow(/active content decisions/i);
  });

  it("accepts a completed campaign page only when work decisions are locked", () => {
    expect(
      validateCompletedCampaignWorkLockSmoke({
        contentText: `${SMOKE_CAMPAIGN_TITLE} ${CLOSED_CONTENT_DECISIONS_MESSAGE} ${creatorName} Submitted No action`,
        reportingText: `${SMOKE_CAMPAIGN_TITLE} ${CLOSED_PROOF_DECISIONS_MESSAGE} ${creatorName} Open proof No action`,
        creatorText: `${SMOKE_CAMPAIGN_TITLE} ${CLOSED_CREATOR_WORK_MESSAGE} Submission handoff No action`,
        visibleContentDecisionCount: 0,
        visibleProofDecisionCount: 0,
        visibleMissedDecisionCount: 0,
        visibleCreatorWorkControlCount: 0,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("seeds submitted work and completes the campaign before browser inspection", () => {
    const source = readFileSync(
      new URL("./smoke-completed-campaign-work-lock.mjs", import.meta.url),
      "utf8",
    );
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );

    expect(packageJson.scripts["smoke:completed-campaign-work-lock"]).toBe(
      "node scripts/smoke-completed-campaign-work-lock.mjs",
    );
    expect(source).toContain('status: "completed"');
    expect(source).toContain("seedCompletedCampaignWorkLockRows");
    expect(source).toContain("campaign-content-request-revision");
    expect(source).toContain("campaign-content-approve");
    expect(source).toContain("campaign-reporting-verify-proof");
    expect(source).toContain("campaign-reporting-request-correction");
    expect(source).toContain("creator-work-read-only-stage");
    expect(source).toContain("visibleCreatorWorkControlCount");
    expect(source).toContain("completed-campaign-work-lock-content-smoke.png");
    expect(source).toContain("completed-campaign-work-lock-reporting-smoke.png");
    expect(source).toContain("completed-campaign-work-lock-creator-smoke.png");
    expect(source).toContain("ensureSmokeIdentityEnvDefaults()");
    expect(source).toContain("getSmokeCreatorDisplayName()");
    expect(source).not.toContain('includes("Dev Creator")');
  });
});
