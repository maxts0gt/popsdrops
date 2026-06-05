import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_AI_SOURCE_CAMPAIGN_ID,
  buildContentReportAiSourceSmokeTargets,
  validateContentReportAiSourceSmoke,
} from "./smoke-content-report-ai-source.mjs";

describe("AI evidence source smoke contract", () => {
  it("targets a disposable campaign dedicated to AI extraction source proof", () => {
    expect(
      buildContentReportAiSourceSmokeTargets({
        baseUrl: "http://localhost:4000",
      }),
    ).toMatchObject({
      baseUrl: "http://localhost:4000",
      campaignId: DEFAULT_CONTENT_REPORT_AI_SOURCE_CAMPAIGN_ID,
      brandReportUrl: `http://localhost:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_AI_SOURCE_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://localhost:4000/i/campaigns/${DEFAULT_CONTENT_REPORT_AI_SOURCE_CAMPAIGN_ID}`,
    });
  });

  it("rejects report evidence that never shows the creator edited AI source", () => {
    expect(() =>
      validateContentReportAiSourceSmoke({
        brandReportText:
          "Application Flow Smoke Campaign Evidence Trail Dev Creator TikTok Manual entry Verified",
        extractionStatus: "accepted_by_creator",
        consoleErrors: [],
      }),
    ).toThrow(/ai edited source/i);
  });

  it("requires the real Gemini extraction path without adding it to critical smoke", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const source = readFileSync(
      "scripts/smoke-content-report-ai-source.mjs",
      "utf8",
    );

    expect(packageJson.scripts["smoke:content-report-ai-source"]).toBe(
      "node scripts/smoke-content-report-ai-source.mjs",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:content-report-ai-source",
    );
    expect(source).toContain("requireAiSuggestions: true");
    expect(source).toContain("editExtractedMetric: true");
    expect(source).toContain("content_performance_ai_extractions");
    expect(source).toContain("edited_by_creator");
    expect(source).toContain("AI read, creator edited");
  });

  it("moves the accepted campaign into active work before creator draft submission", () => {
    const source = readFileSync(
      "scripts/smoke-content-report-ai-source.mjs",
      "utf8",
    );
    const runStart = source.indexOf("async function runContentReportAiSourceSmoke");
    const runSource = source.slice(
      runStart,
      source.indexOf("smokeEvidence.creatorSubmissionText", runStart),
    );

    expect(runSource).toContain("transitionSmokeCampaignToActiveWork");
    expect(runSource.indexOf("acceptCreatorApplication")).toBeGreaterThan(-1);
    expect(runSource.indexOf("transitionSmokeCampaignToActiveWork")).toBeGreaterThan(
      runSource.indexOf("acceptCreatorApplication"),
    );
  });
});
