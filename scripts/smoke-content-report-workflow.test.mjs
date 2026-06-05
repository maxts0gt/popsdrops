import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_CAMPAIGN_ID,
  buildSetInputValueExpression,
  buildContentReportWorkflowSmokeTargets,
  getSubmitPerformanceProofButtonTexts,
  getCreatorReportSubmittedWaitExpression,
  acceptCreatorApplication,
  openBrandReportEvidenceTrail,
  openBrandReportingProofQueue,
  waitForBrandCampaignTitle,
  submitCreatorDraft,
  submitCreatorPerformanceProof,
  verifyBrandReportEvidence,
  isRecoverableBrowserSmokeError,
  validateContentReportWorkflowSmoke,
} from "./smoke-content-report-workflow.mjs";

describe("accepted campaign content and report workflow smoke contract", () => {
  it("targets a disposable accepted campaign and all work-loop surfaces", () => {
    expect(buildContentReportWorkflowSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_CONTENT_REPORT_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_CONTENT_REPORT_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_CONTENT_REPORT_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_CAMPAIGN_ID}`,
      brandReportUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_CONTENT_REPORT_CAMPAIGN_ID}`,
    });
  });

  it("moves the accepted smoke campaign into active work before content review", () => {
    const source = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("transitionSmokeCampaignToActiveWork");
    expect(source).toContain('status: "in_progress"');
    expect(source.indexOf("await transitionSmokeCampaignToActiveWork")).toBeLessThan(
      source.indexOf('"submit creator draft"'),
    );
  });

  it("sets board-ready smoke identity before launching the app server", () => {
    const source = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );
    const runSource = source.slice(
      source.indexOf("async function runContentReportWorkflowSmoke"),
      source.indexOf("const admin = createAdminClient()"),
    );

    expect(source).toContain("ensureSmokeIdentityEnvDefaults");
    expect(runSource.indexOf("ensureSmokeIdentityEnvDefaults()")).toBeLessThan(
      runSource.indexOf("ensureDevServer"),
    );
    expect(source).toContain(
      'await submitCreatorApplication(client, targets);\n    await ensureSmokeDataDevUser(admin, "creator");',
    );
  });

  it("reasserts smoke creator identity after creator dev-login steps", () => {
    const source = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      'smokeEvidence.creatorSubmissionText = await runRecoverableStep(\n      "submit creator draft"',
    );
    expect(source).toContain(
      ');\n    await ensureSmokeDataDevUser(admin, "creator");\n    await captureScreenshot(client, creatorHandoffScreenshotPath);',
    );
    expect(source).toContain(
      'smokeEvidence.creatorReportText = await runRecoverableStep(\n      "submit creator performance proof"',
    );
    expect(source).toContain(
      ');\n    await ensureSmokeDataDevUser(admin, "creator");\n    await captureScreenshot(client, creatorReportScreenshotPath);',
    );
  });

  it("allows the accepted member row to render after slow local accept actions", () => {
    const source = acceptCreatorApplication.toString();

    expect(source).toContain('"accepted member row"');
    expect(source).toContain("180000");
  });

  it("rejects a workflow that never reaches verified reporting evidence", () => {
    expect(() =>
      validateContentReportWorkflowSmoke({
        creatorSubmissionText:
          "US Market Entry Proof Campaign Submit TikTok v1 Draft Submitted Live URL Waiting Proof After live URL",
        brandContentText:
          "US Market Entry Proof Campaign Content Mina Park TikTok Draft Submitted Live URL Waiting Proof Waiting Approve",
        creatorReportText:
          "US Market Entry Proof Campaign Published Proof sent for review",
        brandReportText:
          "US Market Entry Proof Campaign Evidence Trail Mina Park TikTok Report impact Excluded until brand review Needs review Verify",
        consoleErrors: [],
      }),
    ).toThrow(/verified report proof/i);
  });

  it("rejects a workflow that does not show the shared creator and brand handoff sequence", () => {
    expect(() =>
      validateContentReportWorkflowSmoke({
        creatorSubmissionText:
          "US Market Entry Proof Campaign Submit TikTok v1 Submitted",
        brandContentText:
          "US Market Entry Proof Campaign Content Mina Park TikTok Submitted Approve",
        creatorReportText:
          "US Market Entry Proof Campaign On track No creator action is waiting right now.",
        brandReportText:
          "US Market Entry Proof Campaign Evidence Trail Mina Park TikTok Verified",
        consoleErrors: [],
      }),
    ).toThrow(/creator handoff sequence/i);
  });

  it("builds valid browser input expressions for quoted selectors", () => {
    const expression = buildSetInputValueExpression(
      '[data-testid="creator-submit-workspace"] input[type=url]',
      "https://example.com/post",
    );

    expect(() => new Function(expression)).not.toThrow();
    expect(expression).toContain(
      JSON.stringify('[data-testid="creator-submit-workspace"] input[type=url]'),
    );
  });

  it("waits for the dedicated submitted-report UI state, not generic page copy", () => {
    const expression = getCreatorReportSubmittedWaitExpression();

    expect(expression).toContain("performance-report-submitted");
    expect(expression).toContain("creator-report-status-row");
    expect(expression).toContain("creator-handoff-row");
    expect(expression).toContain("proof sent for review");
    expect(expression).toContain("performance overdue");
    expect(expression).not.toContain("document.body.innerText.toLowerCase().includes(\"submitted\")");
    expect(() => new Function(`return (${expression});`)).not.toThrow();
  });

  it("opens the creator submit workspace by route state instead of visible English tab copy", () => {
    const source = submitCreatorDraft.toString();

    expect(source).toContain("?tab=submit");
    expect(source).toContain("creator-submit-workspace");
    expect(source).not.toContain('document.body.innerText.includes("Submit")');
  });

  it("waits for the performance proof form without reading from a missing body", () => {
    const source = submitCreatorPerformanceProof.toString() + submitCreatorDraft.toString();
    const publishSource = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );

    expect(publishSource).toContain("(document.body?.innerText || \"\")");
    expect(publishSource).not.toContain(
      'document.body.innerText.includes("Published") && document.querySelector("[data-testid=\\\\"performance-evidence-block\\"] input[type=file]") != null',
    );
    expect(source).toContain("performance-evidence-block");
  });

  it("checks the approved-content live URL state before publishing", () => {
    const publishSource = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );

    expect(publishSource).toContain("Publish approved post");
    expect(publishSource).toContain("Post the approved content on the platform");
    expect(publishSource).toContain("Publish next");
    expect(publishSource).toContain("content-report-creator-live-url-smoke.png");
    expect(publishSource).toContain("content-report-creator-proof-needed-smoke.png");
    expect(publishSource).toContain("liveUrlScreenshotPath");
    expect(publishSource).toContain("proofNeededScreenshotPath");
  });

  it("checks the proof-needed state before submitting analytics proof", () => {
    const publishSource = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );

    expect(publishSource).toContain("Upload analytics proof");
    expect(publishSource).toContain("Upload platform analytics");
    expect(publishSource).toContain("Upload screenshot or export");
    expect(publishSource).toContain("creatorProofNeededScreenshotPath");
    expect(publishSource).toContain("performance-evidence-block");
    expect(publishSource).toContain("window.scrollTo");
    expect(publishSource).toContain("creator proof evidence visible");
  });

  it("recovers the brand campaign detail wait from a transient dev chunk error", () => {
    const moduleSource = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );
    const source = waitForBrandCampaignTitle.toString();

    expect(source).toContain("This page couldn't load");
    expect(source).toContain("This page couldn’t load");
    expect(source).toContain("sawShellOnly");
    expect(moduleSource).toContain("getSmokeCampaignTitle");
    expect(moduleSource).toContain("getSmokeCampaignTitle()");
    expect(moduleSource).toContain("!lastPageState.includes(getSmokeCampaignTitle())");
    expect(moduleSource).toContain("await navigate(client, targets.brandCampaignUrl)");
    expect(source).toContain("(document.body?.innerText || \"\")");
    expect(source).toContain("lastPageState");
  });

  it("submits both first performance reports and correction resubmissions", () => {
    expect(getSubmitPerformanceProofButtonTexts()).toEqual([
      "Send 7-day report proof",
      "Resubmit proof",
    ]);
  });

  it("can force the creator proof smoke through AI suggestions before submission", () => {
    const source = submitCreatorPerformanceProof.toString();

    expect(source).toContain("requireAiSuggestions");
    expect(source).toContain("editExtractedMetric");
    expect(source).toContain("performance-ai-confirmation");
    expect(source).toContain("performance-metric-source");
    expect(source).toContain("AI");
    expect(source).toContain("Suggested");
    expect(source).toContain("Edited");
  });

  it("fills metric inputs after manual-only evidence fallback", () => {
    const source = submitCreatorPerformanceProof.toString();

    expect(source).toContain("manualOnlyEvidence");
    expect(source).toContain("fillCreatorPerformanceMetricInputs");
    expect(source).toMatch(/manualOnlyEvidence[\s\S]+fillCreatorPerformanceMetricInputs/);
  });

  it("reviews brand proof from the reporting workspace without depending on summary copy", () => {
    const openReportSource = openBrandReportEvidenceTrail.toString();
    const openQueueSource = openBrandReportingProofQueue.toString();
    const moduleSource = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );

    expect(openQueueSource).toContain("targets.brandCampaignUrl");
    expect(openQueueSource).toContain(
      'new URL(location.href).searchParams.get("tab") === "reporting"',
    );
    expect(openQueueSource).toContain("campaign-reporting-proof-queue");
    expect(openQueueSource).toContain("proofQueueScreenshotPath");
    expect(openQueueSource).toContain("Needs review");
    expect(openQueueSource).toContain("Correction returned");
    expect(openQueueSource).toContain("Open proof");
    expect(openQueueSource).toContain("Verify");
    expect(openQueueSource).toContain("Request correction");
    expect(openQueueSource).toContain("Report impact");
    expect(openQueueSource).toContain("Excluded until brand review");
    expect(openQueueSource).toContain("campaign-reporting-proof-review-age");
    expect(openQueueSource).toContain("data-proof-waiting-state");
    expect(openQueueSource).toContain("Waiting");
    expect(openQueueSource).toContain("brand proof queue visible");
    expect(openQueueSource).toContain("captureScreenshot");
    expect(moduleSource).toContain("content-report-brand-proof-queue-smoke.png");
    expect(moduleSource).toContain("content-report-brand-evidence-trail-smoke.png");
    expect(moduleSource).toContain("brandEvidenceTrailScreenshotPath");
    expect(moduleSource).toContain("REPORT_EVIDENCE_TRAIL_WAIT_MS");
    expect(moduleSource).toContain("REPORT_EVIDENCE_TRAIL_NAVIGATION_ATTEMPTS");
    expect(openReportSource).toContain("REPORT_EVIDENCE_TRAIL_WAIT_MS");
    expect(openReportSource).toContain("attempt <= REPORT_EVIDENCE_TRAIL_NAVIGATION_ATTEMPTS");
    expect(openReportSource).toContain("openBrandReportingProofQueue");
    expect(openReportSource).toContain("evidenceTrailExpression");
    expect(openReportSource).toContain("transientNotFound");
    expect(openReportSource).toContain("attempt === REPORT_EVIDENCE_TRAIL_NAVIGATION_ATTEMPTS");
    expect(openReportSource).toContain("Last report page");
    expect(openReportSource).toContain("await openBrandReportingProofQueue");
    expect(verifyBrandReportEvidence.toString()).toContain("Report impact");
    expect(verifyBrandReportEvidence.toString()).toContain("Leadership impact");
    expect(verifyBrandReportEvidence.toString()).toContain("report-evidence-review-provenance");
    expect(verifyBrandReportEvidence.toString()).toContain("Awaiting brand decision");
    expect(verifyBrandReportEvidence.toString()).toContain("Reviewed");
    expect(verifyBrandReportEvidence.toString()).toContain("proof review command");
    expect(verifyBrandReportEvidence.toString()).toContain("hold in proof room");
    expect(verifyBrandReportEvidence.toString()).toContain("ready to share");
    expect(verifyBrandReportEvidence.toString()).toContain("report-evidence-command");
    expect(verifyBrandReportEvidence.toString()).toContain("report-evidence-handoff-gate");
    expect(verifyBrandReportEvidence.toString()).toContain("report-evidence-handoff-counts");
    expect(verifyBrandReportEvidence.toString()).toContain("data-report-handoff-state");
    expect(verifyBrandReportEvidence.toString()).toContain("handoffText.toLowerCase()");
    expect(verifyBrandReportEvidence.toString()).toContain("countsText.toLowerCase()");
    expect(verifyBrandReportEvidence.toString()).toContain("Leadership handoff");
    expect(verifyBrandReportEvidence.toString()).toContain("Proof basis");
    expect(verifyBrandReportEvidence.toString()).toContain("Keep in proof room");
    expect(verifyBrandReportEvidence.toString()).toContain("Share with leadership");
    expect(verifyBrandReportEvidence.toString()).toContain("report-evidence-summary");
    expect(verifyBrandReportEvidence.toString()).toContain("Excluded until brand review");
    expect(verifyBrandReportEvidence.toString()).toContain("Correction returned");
    expect(verifyBrandReportEvidence.toString()).toContain("Included in report totals");
    expect(verifyBrandReportEvidence.toString()).toContain(
      "openBrandReportEvidenceTrail",
    );
    expect(verifyBrandReportEvidence.toString()).toContain("options");
    expect(verifyBrandReportEvidence.toString()).toContain("evidenceTrailScreenshotPath");
    expect(verifyBrandReportEvidence.toString()).not.toContain(
      "campaign-next-action",
    );
  });

  it("classifies poisoned browser or dev sessions as recoverable smoke infrastructure errors", () => {
    expect(
      isRecoverableBrowserSmokeError(
        new Error("Timed out waiting for Chrome DevTools Page.navigate response after 60000ms"),
      ),
    ).toBe(true);
    expect(
      isRecoverableBrowserSmokeError(
        new Error("brand dev login redirect failed after 3 attempts"),
      ),
    ).toBe(true);
    expect(isRecoverableBrowserSmokeError(new Error("Missing verified report proof"))).toBe(false);
  });

  it("restarts the browser session once when the long workflow hits a poisoned CDP page", () => {
    const moduleSource = readFileSync(
      new URL("./smoke-content-report-workflow.mjs", import.meta.url),
      "utf8",
    );

    expect(moduleSource).toContain("restartSmokeBrowserSession");
    expect(moduleSource).toContain("isRecoverableBrowserSmokeError");
    expect(moduleSource).toContain("Retrying content report smoke step");
    expect(moduleSource).toContain("await runRecoverableStep");
  });

  it("accepts the intended draft to approved content to verified report state", () => {
    expect(
      validateContentReportWorkflowSmoke({
        creatorSubmissionText:
          "US Market Entry Proof Campaign Submit TikTok v1 Draft Submitted Live URL Waiting Proof After live URL",
        brandContentText:
          "US Market Entry Proof Campaign Content Mina Park TikTok Draft Submitted Live URL Waiting Proof Waiting Approve",
        creatorReportText:
          "US Market Entry Proof Campaign Proof sent for review The brand is reviewing your performance proof. Draft Published Live URL Saved Proof Submitted",
        brandReportText:
          "US Market Entry Proof Campaign Evidence Trail Mina Park TikTok Report impact Verified Included in report totals",
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });
});
