import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID,
  buildContentReportRecoverySmokeTargets,
  validateContentReportRecoverySmoke,
} from "./smoke-content-report-recovery.mjs";
import {
  SMOKE_CAMPAIGN_TITLE,
  getSmokeCreatorDisplayName,
} from "./smoke-application-flow.mjs";

const recoverySmokeSource = readFileSync(
  new URL("./smoke-content-report-recovery.mjs", import.meta.url),
  "utf8",
);
const creatorName = getSmokeCreatorDisplayName();

describe("content and report recovery workflow smoke contract", () => {
  it("targets a disposable campaign for revision and correction recovery", () => {
    expect(buildContentReportRecoverySmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID}`,
      brandReportUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_CONTENT_REPORT_RECOVERY_CAMPAIGN_ID}`,
    });
  });

  it("rejects a recovery workflow that never reaches v2 and verified correction", () => {
    expect(() =>
      validateContentReportRecoverySmoke({
        creatorRevisionText:
          `${SMOKE_CAMPAIGN_TITLE} Upload revised content TikTok v1 Revision Requested`,
        brandRevisionText:
          `${SMOKE_CAMPAIGN_TITLE} Content ${creatorName} TikTok v1 Revision Requested`,
        creatorCorrectionText:
          `${SMOKE_CAMPAIGN_TITLE} Performance correction Submitted`,
        brandCorrectionText:
          `${SMOKE_CAMPAIGN_TITLE} Evidence Trail ${creatorName} TikTok Correction requested`,
        consoleErrors: [],
      }),
    ).toThrow(/creator revised content proof/i);
  });

  it("accepts content v2 and corrected report evidence reaching verified state", () => {
    expect(
      validateContentReportRecoverySmoke({
        creatorRevisionText:
          `${SMOKE_CAMPAIGN_TITLE} Upload revised content Please tighten the opening shot and show the product earlier. TikTok v1 Revision Requested TikTok v2 Submitted`,
        brandRevisionText:
          `${SMOKE_CAMPAIGN_TITLE} Content ${creatorName} TikTok v2 Submitted Approve`,
        creatorCorrectionText:
          `${SMOKE_CAMPAIGN_TITLE} Performance correction Please upload the analytics export with corrected view count. Submitted Upload corrected analytics evidence`,
        brandCorrectionText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue Evidence Trail ${creatorName} TikTok Correction requested Correction returned Verified Report status Ready Verified reads 1/1`,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a verified correction if the report is not leadership-ready afterward", () => {
    expect(() =>
      validateContentReportRecoverySmoke({
        creatorRevisionText:
          `${SMOKE_CAMPAIGN_TITLE} Upload revised content Please tighten the opening shot and show the product earlier. TikTok v1 Revision Requested TikTok v2 Submitted`,
        brandRevisionText:
          `${SMOKE_CAMPAIGN_TITLE} Content ${creatorName} TikTok v2 Submitted Approve`,
        creatorCorrectionText:
          `${SMOKE_CAMPAIGN_TITLE} Performance correction Please upload the analytics export with corrected view count. Submitted Upload corrected analytics evidence`,
        brandCorrectionText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue Evidence Trail ${creatorName} TikTok Correction requested Correction returned Verified Report status 1 to correct Verified reads 0/1`,
        consoleErrors: [],
      }),
    ).toThrow(/report ready state/i);
  });

  it("waits for corrected report submission using the stable creator report state", () => {
    const correctedPerformanceSource = recoverySmokeSource.slice(
      recoverySmokeSource.indexOf("async function submitCreatorCorrectedPerformance"),
      recoverySmokeSource.indexOf("async function runContentReportRecoverySmoke"),
    );

    expect(correctedPerformanceSource).toContain("getCreatorReportSubmittedWaitExpression");
    expect(correctedPerformanceSource).not.toContain(
      'document.body.innerText.includes("Submitted")',
    );
    expect(correctedPerformanceSource).toContain("const correctionRequestText");
    expect(correctedPerformanceSource).toContain(
      "return `${correctionRequestText} ${submittedCorrectionText}`",
    );
    expect(correctedPerformanceSource).toContain('await clickTab(client, "Submit")');
    expect(correctedPerformanceSource).toContain("creator corrected report submitted row");
  });

  it("moves the accepted campaign into active work before expecting creator submissions", () => {
    expect(recoverySmokeSource).toContain("transitionSmokeCampaignToActiveWork");
    expect(recoverySmokeSource).toMatch(
      /await acceptCreatorApplication\(client, targets\);\s+await transitionSmokeCampaignToActiveWork\(admin, targets\.campaignId\);\s+await submitCreatorDraft\(client, targets\);/,
    );
  });

  it("keeps revised content waits null-safe through route reloads", () => {
    const revisionSource = recoverySmokeSource.slice(
      recoverySmokeSource.indexOf("async function submitCreatorRevision"),
      recoverySmokeSource.indexOf("export async function requestReportCorrection"),
    );

    expect(revisionSource).toContain("(document.body?.innerText || \"\")");
    expect(revisionSource).not.toContain("document.body.innerText.includes(\"Brand reviewing\")");
    expect(revisionSource).not.toContain("creator revised content submitted next action");
    expect(revisionSource).toContain("creator v2 submitted content row");
    expect(revisionSource).toContain("creator-submit-workspace");
    expect(revisionSource).toContain('`${targets.creatorCampaignUrl}?tab=submit`');
  });

  it("checks returned correction proof before brand verification", () => {
    expect(recoverySmokeSource).toContain("reviewReturnedReportCorrection");
    expect(recoverySmokeSource).toContain("openBrandReportingProofQueue");
    expect(recoverySmokeSource).toContain("returnedQueueScreenshotPath");
    expect(recoverySmokeSource).toContain('"returned correction state", "Correction returned"');
    expect(recoverySmokeSource).toContain("brand report correction returned state");
    expect(recoverySmokeSource).toContain(
      'document.querySelector("[data-testid=\\\\"campaign-reporting-proof-queue\\\\"]")?.innerText.includes("Correction returned")',
    );
  });

  it("opens report correction review from the brand reporting workspace", () => {
    const correctionSource = recoverySmokeSource.slice(
      recoverySmokeSource.indexOf("export async function requestReportCorrection"),
      recoverySmokeSource.indexOf("export async function submitCreatorCorrectedPerformance"),
    );
    const returnedSource = recoverySmokeSource.slice(
      recoverySmokeSource.indexOf("export async function reviewReturnedReportCorrection"),
      recoverySmokeSource.indexOf("async function runContentReportRecoverySmoke"),
    );

    expect(correctionSource).toContain("openBrandReportingProofQueue");
    expect(correctionSource).toContain("campaign-reporting-proof-queue");
    expect(correctionSource).toContain("campaign-reporting-request-correction");
    expect(correctionSource).toContain("campaign-reporting-correction-dialog");
    expect(correctionSource).toContain("campaign-reporting-correction-note");
    expect(correctionSource).toContain("Send correction");
    expect(correctionSource).toContain('"brand report correction artifact state"');
    expect(correctionSource).toContain("reportCorrectionExpression");
    expect(correctionSource).toContain("transientNotFound");
    expect(correctionSource).toContain("attempt === 1 ? 15000 : 60000");
    expect(correctionSource).toContain(
      `clickButtonByText(client, "Request correction", '[data-testid="campaign-reporting-proof-queue"]')`,
    );
    expect(correctionSource).not.toContain(
      `clickButtonByText(client, "Request correction", '[data-testid="report-evidence-trail"]')`,
    );
    expect(correctionSource).not.toContain("report-correction-dialog");
    expect(returnedSource).toContain("openBrandReportingProofQueue");
    expect(returnedSource).toContain("proofQueueScreenshotPath: returnedQueueScreenshotPath");
    expect(returnedSource).toContain("campaign-reporting-proof-queue");
    expect(returnedSource).toContain("Correction returned");
    expect(returnedSource).toContain("campaign-reporting-verify-proof");
    expect(returnedSource).toContain(
      `clickButtonByText(client, "Verify", '[data-testid="campaign-reporting-proof-queue"]')`,
    );
    expect(returnedSource).toContain("targets.brandReportUrl");
    expect(returnedSource).toContain("brand report ready after correction");
    expect(returnedSource).toContain("report-trust-strip");
    expect(returnedSource).toContain("Ready");
    expect(returnedSource).toContain("1/1");
  });

  it("captures recovery screenshots at creator correction and brand queue checkpoints", () => {
    expect(recoverySmokeSource).toContain("content-report-recovery-brand-queue-smoke.png");
    expect(recoverySmokeSource).toMatch(
      /smokeEvidence\.creatorCorrectionText = await submitCreatorCorrectedPerformance[\s\S]+await captureScreenshot\(client, creatorRecoveryScreenshotPath\);[\s\S]+reviewReturnedReportCorrection/,
    );
    expect(recoverySmokeSource).toContain("brandReturnedQueueScreenshotPath");
  });
});
