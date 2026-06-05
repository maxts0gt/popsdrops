import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CAMPAIGN_ID,
  buildContentReportAiConfirmedSourceSmokeTargets,
  validateContentReportAiConfirmedSourceSmoke,
} from "./smoke-content-report-ai-confirmed-source.mjs";

describe("AI confirmed evidence source smoke contract", () => {
  it("targets a disposable campaign dedicated to confirmed AI extraction proof", () => {
    expect(
      buildContentReportAiConfirmedSourceSmokeTargets({
        baseUrl: "http://localhost:4000",
      }),
    ).toMatchObject({
      baseUrl: "http://localhost:4000",
      campaignId: DEFAULT_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CAMPAIGN_ID,
      brandReportUrl: `http://localhost:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://localhost:4000/i/campaigns/${DEFAULT_CONTENT_REPORT_AI_CONFIRMED_SOURCE_CAMPAIGN_ID}`,
    });
  });

  it("rejects report evidence that only proves the edited AI source", () => {
    expect(() =>
      validateContentReportAiConfirmedSourceSmoke({
        brandReportText:
          "Application Flow Smoke Campaign Evidence Trail Dev Creator TikTok AI read, creator edited Verified",
        extractionStatus: "edited_by_creator",
        consoleErrors: [],
      }),
    ).toThrow(/ai confirmed source/i);
  });

  it("rejects report evidence that leaks unconfirmed AI values into totals", () => {
    expect(() =>
      validateContentReportAiConfirmedSourceSmoke({
        brandReportText:
          "Application Flow Smoke Campaign Evidence Trail Views 88.0K Dev Creator TikTok AI read, creator confirmed AI read, waiting for creator Verified",
        extractionStatus: "accepted_by_creator",
        consoleErrors: [],
      }),
    ).toThrow(/unconfirmed ai values/i);
  });

  it("requires the no-edit Gemini extraction path without adding it to critical smoke", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const source = readFileSync(
      "scripts/smoke-content-report-ai-confirmed-source.mjs",
      "utf8",
    );

    expect(packageJson.scripts["smoke:content-report-ai-confirmed-source"]).toBe(
      "node scripts/smoke-content-report-ai-confirmed-source.mjs",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:content-report-ai-confirmed-source",
    );
    expect(source).toContain("requireAiSuggestions: true");
    expect(source).toContain("editExtractedMetric: false");
    expect(source).toContain("content_performance_ai_extractions");
    expect(source).toContain("accepted_by_creator");
    expect(source).toContain("AI read, creator confirmed");
  });

  it("seeds the unconfirmed AI leak probe through the real evidence bucket path", () => {
    const source = readFileSync(
      "scripts/smoke-content-report-ai-confirmed-source.mjs",
      "utf8",
    );

    expect(source).toContain(".from(\"campaign-evidence\")");
    expect(source).toContain(".upload(evidencePath");
    expect(source).toContain("campaignId,\n    member.id,\n    task.id,\n    evidenceId,\n    fileName");
    expect(source).toContain('evidence_type: "analytics_export"');
  });

  it("verifies the creator-confirmed evidence before seeding the pending AI probe", () => {
    const source = readFileSync(
      "scripts/smoke-content-report-ai-confirmed-source.mjs",
      "utf8",
    );
    const runStart = source.indexOf("async function runContentReportAiConfirmedSourceSmoke");
    const runSource = source.slice(
      runStart,
      source.indexOf("validateContentReportWorkflowSmoke", runStart),
    );

    expect(runSource.indexOf("verifyBrandReportEvidence")).toBeGreaterThan(-1);
    expect(runSource.indexOf("seedUnconfirmedAiMetricLeakProbe")).toBeGreaterThan(-1);
    expect(runSource.indexOf("verifyBrandReportEvidence")).toBeLessThan(
      runSource.indexOf("seedUnconfirmedAiMetricLeakProbe"),
    );
    expect(runSource).toContain("readBrandReportEvidence");
  });

  it("moves the accepted campaign into active work before creator draft submission", () => {
    const source = readFileSync(
      "scripts/smoke-content-report-ai-confirmed-source.mjs",
      "utf8",
    );
    const runStart = source.indexOf("async function runContentReportAiConfirmedSourceSmoke");
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
