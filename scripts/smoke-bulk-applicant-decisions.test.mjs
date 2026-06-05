import { describe, expect, it } from "vitest";

import {
  DEFAULT_BULK_APPLICANT_CAMPAIGN_ID,
  buildBulkApplicantSmokeTargets,
  validateBulkApplicantSmoke,
} from "./smoke-bulk-applicant-decisions.mjs";
import { SMOKE_CAMPAIGN_TITLE } from "./smoke-application-flow.mjs";

describe("bulk applicant decision smoke contract", () => {
  it("targets a disposable high-volume applicant campaign", () => {
    expect(buildBulkApplicantSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_BULK_APPLICANT_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_BULK_APPLICANT_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_BULK_APPLICANT_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_BULK_APPLICANT_CAMPAIGN_ID}`,
    });
  });

  it("rejects a smoke result that misses the capacity warning", () => {
    expect(() =>
      validateBulkApplicantSmoke({
        selectedText:
          `${SMOKE_CAMPAIGN_TITLE} 4 selected 3 open seats Accept selected`,
        acceptedText:
          "Bulk Creator 1 selected",
        clearedText: "No applications yet Bulk Creator",
        rosterFilterText:
          "Needs attention Missed proof Payment open Bulk Creator 3 0 selected",
        memberOpsText:
          "3 selected 2 missed proof Paid 2 follow-up requested",
        consoleErrors: [],
      }),
    ).toThrow(/capacity warning/i);
  });

  it("accepts the selected, accepted, and cleared bulk decision states", () => {
    expect(
      validateBulkApplicantSmoke({
        selectedText:
          `${SMOKE_CAMPAIGN_TITLE} 4 selected 3 open seats Select up to 3 open seats Accept selected`,
        acceptedText: "Bulk Creator 1 selected",
        clearedText: "No applications yet Bulk Creator",
        rosterFilterText:
          "Report readiness Ready To review Missed proof Payment open Needs attention Missed proof Payment open Bulk Creator 3 0 selected",
        memberOpsText:
          "3 selected 2 missed proof Follow up 2 missed proof Paid 2 follow-up requested",
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a smoke result that misses the accepted creator readiness summary", () => {
    expect(() =>
      validateBulkApplicantSmoke({
        selectedText:
          `${SMOKE_CAMPAIGN_TITLE} 4 selected 3 open seats Select up to 3 open seats Accept selected`,
        acceptedText: "Bulk Creator 1 selected",
        clearedText: "No applications yet Bulk Creator",
        rosterFilterText:
          "Needs attention Missed proof Payment open Bulk Creator 3 0 selected",
        memberOpsText:
          "3 selected 2 missed proof Paid 2 follow-up requested",
        consoleErrors: [],
      }),
    ).toThrow(/member roster filter proof: report readiness/i);
  });

  it("rejects a bulk follow-up action that hides how many creators will be contacted", () => {
    expect(() =>
      validateBulkApplicantSmoke({
        selectedText:
          `${SMOKE_CAMPAIGN_TITLE} 4 selected 3 open seats Select up to 3 open seats Accept selected`,
        acceptedText: "Bulk Creator 1 selected",
        clearedText: "No applications yet Bulk Creator",
        rosterFilterText:
          "Report readiness Ready To review Missed proof Payment open Needs attention Missed proof Payment open Bulk Creator 3 0 selected",
        memberOpsText:
          "3 selected 2 missed proof Paid Follow up missed proof 2 follow-up requested",
        consoleErrors: [],
      }),
    ).toThrow(/follow-up count/i);
  });

  it("rejects a smoke result that misses bulk accepted-creator proof", () => {
    expect(() =>
      validateBulkApplicantSmoke({
        selectedText:
          `${SMOKE_CAMPAIGN_TITLE} 4 selected 3 open seats Select up to 3 open seats Accept selected`,
        acceptedText: "Bulk Creator 1 selected",
        clearedText: "No applications yet Bulk Creator",
        rosterFilterText:
          "Report readiness Ready To review Missed proof Payment open Needs attention Missed proof Payment open Bulk Creator 3 0 selected",
        memberOpsText: "3 selected Paid",
        consoleErrors: [],
      }),
    ).toThrow(/bulk member operation proof/i);
  });
});
