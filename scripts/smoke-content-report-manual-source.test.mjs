import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID,
  buildContentReportManualSourceSmokeTargets,
  validateContentReportManualSourceSmoke,
} from "./smoke-content-report-manual-source.mjs";

describe("manual evidence source smoke contract", () => {
  it("targets a disposable campaign dedicated to manual report proof", () => {
    expect(
      buildContentReportManualSourceSmokeTargets({
        baseUrl: "http://localhost:4000",
      }),
    ).toMatchObject({
      baseUrl: "http://localhost:4000",
      campaignId: DEFAULT_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID,
      brandReportUrl: `http://localhost:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://localhost:4000/i/campaigns/${DEFAULT_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID}`,
    });
  });

  it("rejects report evidence that does not show the brand-reviewed manual source", () => {
    expect(() =>
      validateContentReportManualSourceSmoke({
        brandReportText:
          "Application Flow Smoke Campaign Evidence Trail Dev Creator TikTok AI read, creator confirmed Verified",
        latestAiExtractionStatus: "accepted_by_creator",
        latestMetricSourceType: "creator_confirmed",
        consoleErrors: [],
      }),
    ).toThrow(/brand-reviewed manual source/i);
  });

  it("requires no AI extraction row and the brand-reviewed proof report label", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const source = readFileSync(
      "scripts/smoke-content-report-manual-source.mjs",
      "utf8",
    );

    expect(packageJson.scripts["smoke:content-report-manual-source"]).toBe(
      "node scripts/smoke-content-report-manual-source.mjs",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:content-report-manual-source",
    );
    expect(source).toContain("manualOnlyEvidence: true");
    expect(source).toContain("Brand-reviewed proof");
    expect(source).toContain("report-evidence-trail");
    expect(source).toContain("scrollIntoView");
    expect(source).toContain("creator_manual");
    expect(source).toContain("content_performance_ai_extractions");
  });

  it("moves the accepted smoke campaign into active work before the creator submits content", () => {
    const source = readFileSync(
      "scripts/smoke-content-report-manual-source.mjs",
      "utf8",
    );

    expect(source).toContain("transitionSmokeCampaignToActiveWork");
    expect(source.indexOf("await acceptCreatorApplication")).toBeLessThan(
      source.indexOf("await transitionSmokeCampaignToActiveWork"),
    );
    expect(source.indexOf("await transitionSmokeCampaignToActiveWork")).toBeLessThan(
      source.indexOf("await submitCreatorDraft"),
    );
  });

  it("reasserts smoke creator identity after creator dev-login steps", () => {
    const source = readFileSync(
      "scripts/smoke-content-report-manual-source.mjs",
      "utf8",
    );

    expect(source).toContain(
      'smokeEvidence.creatorSubmissionText = await submitCreatorDraft(client, targets);\n    await ensureSmokeDataDevUser(admin, "creator");',
    );
    expect(source).toContain(
      'smokeEvidence.creatorReportText = await submitCreatorPerformanceProof(client, {\n      manualOnlyEvidence: true,\n    });\n    await ensureSmokeDataDevUser(admin, "creator");',
    );
  });

  it("can leave manual proof pending so report-share smoke can prove leadership hold", () => {
    const source = readFileSync(
      "scripts/smoke-content-report-manual-source.mjs",
      "utf8",
    );

    expect(source).toContain("runContentReportManualSourceSmoke({ skipBrandReview = false } = {})");
    expect(source).toContain("if (!skipBrandReview)");
    expect(source).toContain("skippedBrandReview: skipBrandReview");
    expect(source).toContain("latestMetricSourceType !== \"creator_manual\"");
  });
});
