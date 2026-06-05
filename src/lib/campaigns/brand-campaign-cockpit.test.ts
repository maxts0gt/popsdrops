import { describe, expect, it } from "vitest";

import { getCampaignNextAction } from "./brand-campaign-cockpit";

describe("getCampaignNextAction", () => {
  const baseState = {
    pendingApplicants: 0,
    reportProofToReview: 0,
    reportCorrections: 0,
    missedReports: 0,
    pendingReports: 0,
    hasPublishedAgreement: true,
    hasCreatorPreviewImage: true,
    memberCount: 1,
    approvedContent: 1,
    totalContent: 1,
    missingLiveUrls: 0,
  };

  it("prioritizes brand-owned report proof before slower setup work", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        reportProofToReview: 2,
        pendingApplicants: 4,
        hasCreatorPreviewImage: false,
      }).kind,
    ).toBe("review_proof");
  });

  it("keeps correction resubmits ahead of general proof review", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        reportProofToReview: 2,
        reportCorrections: 1,
      }),
    ).toMatchObject({
      kind: "monitor_corrections",
      tone: "urgent",
    });
  });

  it("pushes recruiting work when there is no report review blocker", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        pendingApplicants: 3,
      }).kind,
    ).toBe("review_applicants");
  });

  it("keeps setup gates explicit before asking the brand to invite creators", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        hasPublishedAgreement: false,
        hasCreatorPreviewImage: false,
        memberCount: 0,
      }).kind,
    ).toBe("publish_rules");
  });

  it("does not ask for rules when the campaign has no signing gate", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        hasPublishedAgreement: false,
        requiresAgreement: false,
        memberCount: 0,
      }),
    ).toMatchObject({
      kind: "invite_creators",
      tone: "attention",
    });
  });

  it("asks for payment before inviting creators when invite sharing is still locked", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        memberCount: 0,
        serviceFeeRequired: true,
        serviceFeePaid: false,
      }),
    ).toMatchObject({
      kind: "pay_service_fee",
      tone: "attention",
    });
  });

  it("does not claim the campaign is clear when approved content is missing live URLs", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        approvedContent: 2,
        totalContent: 2,
        missingLiveUrls: 1,
      }),
    ).toMatchObject({
      kind: "collect_live_urls",
      tone: "attention",
    });
  });

  it("does not claim the campaign is clear while creator report reads are still pending", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        pendingReports: 2,
      }),
    ).toMatchObject({
      kind: "wait_for_reports",
      tone: "calm",
    });
  });

  it("returns a calm no-blocker state when the campaign is operationally clear", () => {
    expect(getCampaignNextAction(baseState)).toMatchObject({
      kind: "no_blockers",
      tone: "calm",
    });
  });

  it("promotes a fully settled running campaign to a completion action", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "monitoring",
        readyToComplete: true,
      }),
    ).toMatchObject({
      kind: "complete_campaign",
      tone: "attention",
    });
  });

  it("does not offer completion while the campaign is still recruiting", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "recruiting",
        readyToComplete: true,
      }),
    ).toMatchObject({
      kind: "start_work",
      tone: "attention",
    });
  });

  it("does not ask to complete a campaign that is already completed", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "completed",
        readyToComplete: true,
      }),
    ).toMatchObject({
      kind: "campaign_complete",
      tone: "calm",
    });
  });

  it("asks the brand to start work after recruiting has an accepted creator and no pending applicants", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "recruiting",
        memberCount: 1,
        approvedContent: 0,
        totalContent: 0,
      }),
    ).toMatchObject({
      kind: "start_work",
      tone: "attention",
    });
  });

  it("keeps unresolved applicants ahead of starting work", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "recruiting",
        pendingApplicants: 1,
        memberCount: 1,
        approvedContent: 0,
        totalContent: 0,
      }),
    ).toMatchObject({
      kind: "review_applicants",
      tone: "attention",
    });
  });

  it("does not ask brands to invite creators after the campaign is completed", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "completed",
        memberCount: 0,
        readyToComplete: true,
      }),
    ).toMatchObject({
      kind: "campaign_complete",
      tone: "calm",
    });
  });

  it("does not ask brands to invite creators when the campaign is paused or cancelled", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "paused",
        memberCount: 0,
      }),
    ).toMatchObject({
      kind: "campaign_paused",
      tone: "calm",
    });

    expect(
      getCampaignNextAction({
        ...baseState,
        campaignStatus: "cancelled",
        memberCount: 0,
      }),
    ).toMatchObject({
      kind: "campaign_cancelled",
      tone: "calm",
    });
  });

  it("does not claim the campaign is clear when the private campaign fee still blocks invite sharing", () => {
    expect(
      getCampaignNextAction({
        ...baseState,
        serviceFeeRequired: true,
        serviceFeePaid: false,
      }),
    ).toMatchObject({
      kind: "pay_service_fee",
      tone: "attention",
    });
  });
});
