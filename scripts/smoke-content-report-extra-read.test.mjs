import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID,
  buildContentReportExtraReadSmokeTargets,
  validateContentReportExtraReadSmoke,
} from "./smoke-content-report-extra-read.mjs";

describe("extra read reporting smoke contract", () => {
  it("targets the demo campaign reporting workspace and report page", () => {
    expect(buildContentReportExtraReadSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID,
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      brandCampaignUrl:
        `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID}`,
      brandReportingUrl:
        `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID}?tab=reporting`,
      brandReportUrl:
        `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CONTENT_REPORT_EXTRA_READ_CAMPAIGN_ID}/report`,
    });
  });

  it("prepares the demo campaign as active monitoring before reviewing proof", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("./smoke-content-report-extra-read.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("prepareContentReportExtraReadCampaign");
    expect(source).toContain('status: "monitoring"');
    expect(source).toContain("restoreContentReportExtraReadCampaign");
  });

  it("pins the extra read date to the campaign reporting window", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("./smoke-content-report-extra-read.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("EXTRA_READ_REPORTED_AT");
    expect(source).toContain("2026-05-17");
  });

  it("rejects a smoke that compresses both extra proofs into one ambiguous row", () => {
    expect(() =>
      validateContentReportExtraReadSmoke({
        brandSubmittedText:
          "Proof queue Dev Creator TikTok Instagram Submitted late extra read Verify",
        brandAfterFirstVerifyText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Verified extra-instagram-read.csv",
        brandVerifiedText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Verified extra-instagram-read.csv",
        reportText:
          "K-Beauty Retail Launch Report Evidence-backed reads 4/4 Verified reads 4/4 05/17 TikTok Instagram",
        consoleErrors: [],
      }),
    ).toThrow(/separate extra proof rows/i);
  });

  it("rejects a smoke where first verification closes the whole task", () => {
    expect(() =>
      validateContentReportExtraReadSmoke({
        brandSubmittedText:
          "Proof queue Dev Creator TikTok Submitted late extra-tiktok-read.csv Verify Instagram Submitted late extra-instagram-read.csv Verify",
        brandAfterFirstVerifyText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Verified extra-instagram-read.csv",
        brandVerifiedText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Verified extra-instagram-read.csv",
        reportText:
          "K-Beauty Retail Launch Report Evidence-backed reads 4/4 Verified reads 4/4 05/17 TikTok Instagram",
        consoleErrors: [],
      }),
    ).toThrow(/remaining extra proof/i);
  });

  it("rejects a smoke where the final queue still has one submitted extra proof", () => {
    expect(() =>
      validateContentReportExtraReadSmoke({
        brandSubmittedText:
          "Proof queue Dev Creator TikTok Submitted late extra-tiktok-read.csv Verify Instagram Submitted late extra-instagram-read.csv Verify",
        brandAfterFirstVerifyText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Submitted late extra-instagram-read.csv Verify",
        brandVerifiedText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Submitted late extra-instagram-read.csv Verify",
        reportText:
          "K-Beauty Retail Launch Report Evidence-backed reads 4/4 Verified reads 4/4 05/17 TikTok Instagram",
        consoleErrors: [],
      }),
    ).toThrow(/all extra proofs verified/i);
  });

  it("accepts evidence-level extra read verification and report uptake", () => {
    expect(
      validateContentReportExtraReadSmoke({
        brandSubmittedText:
          "Proof queue Dev Creator TikTok Submitted late extra-tiktok-read.csv Verify Instagram Submitted late extra-instagram-read.csv Verify",
        brandAfterFirstVerifyText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Submitted late extra-instagram-read.csv Verify",
        brandVerifiedText:
          "Proof queue Dev Creator TikTok Verified extra-tiktok-read.csv Instagram Verified extra-instagram-read.csv Reports 2/2",
        reportText:
          "K-Beauty Retail Launch Report Evidence-backed reads 4/4 Verified reads 4/4 05/17 TikTok 35.2K Instagram 19.4K",
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });
});
