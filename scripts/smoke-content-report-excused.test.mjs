import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID,
  buildContentReportExcusedSmokeTargets,
  validateContentReportExcusedSmoke,
} from "./smoke-content-report-excused.mjs";
import {
  SMOKE_CAMPAIGN_TITLE,
  getSmokeCreatorDisplayName,
} from "./smoke-application-flow.mjs";

const excusedSmokeSource = readFileSync(
  new URL("./smoke-content-report-excused.mjs", import.meta.url),
  "utf8",
);
const creatorName = getSmokeCreatorDisplayName();

describe("excused content report workflow smoke contract", () => {
  it("targets a disposable campaign for excused missed reporting", () => {
    expect(buildContentReportExcusedSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID}`,
      brandReportUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_CONTENT_REPORT_EXCUSED_CAMPAIGN_ID}`,
    });
  });

  it("rejects a workflow that never clicks mark excused", () => {
    expect(() =>
      validateContentReportExcusedSmoke({
        brandMissedText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue ${creatorName} TikTok Missed Follow up Mark excused`,
        brandExcusedText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue ${creatorName} TikTok Missed Mark excused`,
        consoleErrors: [],
      }),
    ).toThrow(/excused state/i);
  });

  it("accepts missed proof becoming excused", () => {
    expect(
      validateContentReportExcusedSmoke({
        brandMissedText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue ${creatorName} TikTok Missed Follow up Mark excused`,
        brandExcusedText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue ${creatorName} TikTok Excused`,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("proves the brand action from the proof queue and the database state", () => {
    expect(excusedSmokeSource).toContain("transitionSmokeCampaignToActiveWork");
    expect(excusedSmokeSource).toMatch(
      /acceptCreatorApplication\(client, targets\);[\s\S]+transitionSmokeCampaignToActiveWork\(admin, targets\.campaignId\);[\s\S]+submitCreatorDraft\(client, targets\);/,
    );
    expect(excusedSmokeSource).toContain("openBrandReportingProofQueue");
    expect(excusedSmokeSource).toContain("content-report-excused-brand-smoke.png");
    expect(excusedSmokeSource).toContain("campaign-reporting-mark-excused");
    expect(excusedSmokeSource).toContain(
      `clickButtonByText(client, "Mark excused", '[data-testid="campaign-reporting-proof-queue"]')`,
    );
    expect(excusedSmokeSource).toContain("assertReportTaskExcused");
    expect(excusedSmokeSource).toContain('status: "excused"');
    expect(excusedSmokeSource).toMatch(
      /smokeEvidence\.brandMissedText = await openBrandMissedProofQueue[\s\S]+smokeEvidence\.brandExcusedText = await markBrandReportTaskExcused/,
    );
  });
});
