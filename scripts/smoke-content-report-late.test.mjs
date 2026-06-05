import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID,
  buildContentReportLateSmokeTargets,
  validateContentReportLateSmoke,
} from "./smoke-content-report-late.mjs";
import {
  SMOKE_CAMPAIGN_TITLE,
  getSmokeCreatorDisplayName,
} from "./smoke-application-flow.mjs";

const lateSmokeSource = readFileSync(
  new URL("./smoke-content-report-late.mjs", import.meta.url),
  "utf8",
);
const creatorName = getSmokeCreatorDisplayName();

describe("late content report workflow smoke contract", () => {
  it("targets a disposable campaign for missed and late reporting", () => {
    expect(buildContentReportLateSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID}`,
      brandReportUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID}/report`,
      creatorCampaignUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_CONTENT_REPORT_LATE_CAMPAIGN_ID}`,
    });
  });

  it("rejects a workflow that never exposes the overdue creator action", () => {
    expect(() =>
      validateContentReportLateSmoke({
        creatorOverdueText:
          `${SMOKE_CAMPAIGN_TITLE} Published Submit performance proof`,
        creatorLateText:
          `${SMOKE_CAMPAIGN_TITLE} Published submitted`,
        brandMissedText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue ${creatorName} TikTok Missed Follow up`,
        brandLateText:
          `${SMOKE_CAMPAIGN_TITLE} Evidence Trail ${creatorName} TikTok Needs review`,
        brandVerifiedText:
          `${SMOKE_CAMPAIGN_TITLE} Evidence Trail ${creatorName} TikTok Verified`,
        consoleErrors: [],
      }),
    ).toThrow(/overdue creator proof/i);
  });

  it("accepts missed proof becoming submitted late and then verified late", () => {
    expect(
      validateContentReportLateSmoke({
        creatorOverdueText:
          `${SMOKE_CAMPAIGN_TITLE} Performance overdue Report due May 10 Platform analytics proof`,
        creatorLateText:
          `${SMOKE_CAMPAIGN_TITLE} Proof sent for review The brand is reviewing your performance proof.`,
        brandMissedText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue ${creatorName} TikTok Missed Follow up Mark excused Follow-up requested`,
        brandLateText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue Evidence Trail ${creatorName} TikTok Submitted late Verify`,
        brandVerifiedText:
          `${SMOKE_CAMPAIGN_TITLE} Proof queue Evidence Trail ${creatorName} TikTok Verified late`,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("opens the late report review from the brand reporting workspace", () => {
    const openLateReportSource = lateSmokeSource.slice(
      lateSmokeSource.indexOf("async function openBrandLateReport"),
      lateSmokeSource.indexOf("async function verifyBrandLateReportEvidence"),
    );

    expect(openLateReportSource).toContain("openBrandReportingProofQueue");
    expect(openLateReportSource).toContain("Submitted late");
    expect(openLateReportSource).toContain("campaign-reporting-proof-queue");
    expect(openLateReportSource).not.toContain("openBrandReportEvidenceTrail");
    expect(openLateReportSource).not.toContain("await navigate(client, targets.brandReportUrl)");
  });

  it("sends missed-proof follow-up from the brand proof queue before creator recovery", () => {
    expect(lateSmokeSource).toContain("openBrandMissedProofQueue");
    expect(lateSmokeSource).toContain("content-report-late-brand-missed-queue-smoke.png");
    expect(lateSmokeSource).toContain("brandMissedQueueScreenshotPath");
    expect(lateSmokeSource).toContain("campaign-reporting-follow-up-missed");
    expect(lateSmokeSource).toContain("campaign-reporting-mark-excused");
    expect(lateSmokeSource).toContain(
      `clickButtonByText(client, "Follow up", '[data-testid="campaign-reporting-proof-queue"]')`,
    );
    expect(lateSmokeSource).toMatch(
      /smokeEvidence\.brandMissedText = await openBrandMissedProofQueue[\s\S]+smokeEvidence\.creatorOverdueText = await openCreatorOverdueReport/,
    );
  });

  it("moves accepted creators into active content work before draft submission", () => {
    expect(lateSmokeSource).toMatch(
      /acceptCreatorApplication\(client, targets\);[\s\S]+transitionSmokeCampaignToActiveWork\(admin, targets\.campaignId\);[\s\S]+submitCreatorDraft\(client, targets\);/,
    );
  });

  it("proves late verification by locating the verify action instead of relying on body copy", () => {
    const verifyLateReportSource = lateSmokeSource.slice(
      lateSmokeSource.indexOf("async function verifyBrandLateReportEvidence"),
      lateSmokeSource.indexOf("async function runContentReportLateSmoke"),
    );

    expect(verifyLateReportSource).toContain("campaign-reporting-verify-proof");
    expect(verifyLateReportSource).toContain("campaign-reporting-proof-queue");
    expect(verifyLateReportSource).toContain("clickButtonByText");
    expect(verifyLateReportSource).toContain("Verified late");
    expect(verifyLateReportSource).not.toContain("report-evidence-verify");
  });
});
