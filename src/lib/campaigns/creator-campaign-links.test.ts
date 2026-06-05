import { describe, expect, it } from "vitest";

import {
  buildCreatorCampaignRoomHref,
  getCreatorNotificationHref,
} from "./creator-campaign-links";

describe("creator campaign operational links", () => {
  it("builds stable creator campaign room URLs with optional tabs", () => {
    expect(buildCreatorCampaignRoomHref("campaign-1")).toBe(
      "/i/campaigns/campaign-1",
    );
    expect(buildCreatorCampaignRoomHref("campaign-1", "submit")).toBe(
      "/i/campaigns/campaign-1?tab=submit",
    );
  });

  it("routes creator notifications to the smallest useful destination", () => {
    expect(
      getCreatorNotificationHref("report_correction_requested", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/campaigns/campaign-1?tab=submit");

    expect(
      getCreatorNotificationHref("revision_requested", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/campaigns/campaign-1?tab=submit");

    expect(
      getCreatorNotificationHref("content_due_soon", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/campaigns/campaign-1?tab=tasks");

    expect(
      getCreatorNotificationHref("campaign_match", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/i/discover/campaign-1");

    expect(getCreatorNotificationHref("report_follow_up_requested", null)).toBe(
      "/i/campaigns",
    );
  });

  it("routes creator payment updates to earnings even when sent as campaign updates", () => {
    expect(
      getCreatorNotificationHref("campaign_update", {
        campaign_id: "campaign-1",
        payment_status: "overdue",
      }),
    ).toBe("/i/earnings");

    expect(
      getCreatorNotificationHref("payment_received", {
        campaign_id: "campaign-1",
        payment_status: "paid",
      }),
    ).toBe("/i/earnings");
  });
});
