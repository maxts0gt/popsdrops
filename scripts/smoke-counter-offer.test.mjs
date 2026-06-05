import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  DEFAULT_COUNTER_OFFER_CAMPAIGN_ID,
  buildCounterOfferSmokeTargets,
  validateCounterOfferSmoke,
} from "./smoke-counter-offer.mjs";

const source = readFileSync(
  new URL("./smoke-counter-offer.mjs", import.meta.url),
  "utf8",
);

describe("brand counter-offer to creator acceptance smoke contract", () => {
  it("targets a disposable counter-offer campaign and both role surfaces", () => {
    expect(buildCounterOfferSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_COUNTER_OFFER_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_COUNTER_OFFER_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_COUNTER_OFFER_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_COUNTER_OFFER_CAMPAIGN_ID}`,
      creatorCampaignUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_COUNTER_OFFER_CAMPAIGN_ID}`,
      creatorCampaignsUrl: "http://127.0.0.1:4000/i/campaigns",
    });
  });

  it("rejects a counter-offer flow that never creates the accepted member", () => {
    expect(() =>
      validateCounterOfferSmoke({
        creatorCounterText:
          "Application Flow Smoke Campaign Counter-Offer Brand offered $320 (you asked $275) Accept offer Decline offer",
        creatorRoomText:
          "Application Flow Smoke Campaign Next action Brief Tasks Submit",
        brandMemberText: "Application Flow Smoke Campaign No applications yet.",
        consoleErrors: [],
      }),
    ).toThrow(/accepted member/i);
  });

  it("accepts the intended counter-offer to member state", () => {
    expect(
      validateCounterOfferSmoke({
        creatorCounterText:
          "Application Flow Smoke Campaign Counter-Offer Brand offered $320 (you asked $275) Accept offer Decline offer",
        creatorRoomText:
          "Application Flow Smoke Campaign Next action Brief Tasks Submit",
        brandMemberText:
          "Application Flow Smoke Campaign Members Dev Creator TikTok $320 No applications yet",
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("seeds the same published agreement gate used by acceptance before opening the creator room", () => {
    expect(source).toContain("await createSmokeCampaignAgreement");
    expect(source.indexOf("await createSmokeCampaignAgreement")).toBeLessThan(
      source.indexOf("const creatorRoomEvidence = await openAcceptedCreatorRoom"),
    );
  });

  it("uses the signed creator room text returned by the shared acceptance helper", () => {
    expect(source).toContain(
      "smokeEvidence.creatorRoomText = creatorRoomEvidence.signedCreatorRoomText",
    );
  });
});
