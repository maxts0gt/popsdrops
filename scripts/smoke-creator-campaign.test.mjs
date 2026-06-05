import { describe, expect, it } from "vitest";

import {
  DEFAULT_CREATOR_CAMPAIGN_ID,
  buildCreatorSmokeTargets,
  validateCreatorCampaignSmoke,
} from "./smoke-creator-campaign.mjs";

describe("creator campaign smoke script contract", () => {
  it("targets a real creator-owned campaign room", () => {
    expect(buildCreatorSmokeTargets({})).toEqual({
      baseUrl: "http://localhost:4000",
      campaignId: DEFAULT_CREATOR_CAMPAIGN_ID,
      loginUrl: "http://localhost:4000/auth/dev-login?role=creator",
      campaignUrl: `http://localhost:4000/i/campaigns/${DEFAULT_CREATOR_CAMPAIGN_ID}`,
    });
  });

  it("rejects a creator shell that never renders the campaign room", () => {
    expect(() =>
      validateCreatorCampaignSmoke({
        bodyText: "PD Home Discover Campaigns Earnings Profile",
        consoleErrors: [],
      }),
    ).toThrow(/campaign title/i);
  });

  it("accepts the intended creator room state", () => {
    expect(
      validateCreatorCampaignSmoke({
        bodyText:
          "K-Beauty Retail Launch Status Brief Tasks Submit Creative Kit Content due Payment pending",
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a creator room missing payment status", () => {
    expect(() =>
      validateCreatorCampaignSmoke({
        bodyText:
          "K-Beauty Retail Launch Status Brief Tasks Submit Creative Kit Content due",
        consoleErrors: [],
      }),
    ).toThrow(/payment status/i);
  });
});
