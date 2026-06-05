import { describe, expect, it } from "vitest";

import {
  buildBrandCampaignReportHref,
  buildBrandCampaignWorkspaceHref,
  getBrandCampaignListHref,
  getBrandNotificationHref,
} from "./brand-campaign-links";

describe("brand campaign operational links", () => {
  it("builds stable campaign workspace and report URLs", () => {
    expect(buildBrandCampaignWorkspaceHref("campaign-1")).toBe(
      "/b/campaigns/campaign-1",
    );
    expect(buildBrandCampaignWorkspaceHref("campaign-1", "content")).toBe(
      "/b/campaigns/campaign-1?tab=content",
    );
    expect(buildBrandCampaignReportHref("campaign-1")).toBe(
      "/b/campaigns/campaign-1/report",
    );
  });

  it("opens campaign list cards on the tab that matches the visible operational pressure", () => {
    expect(
      getBrandCampaignListHref({
        id: "campaign-1",
        reportHealth: { missed: 1, corrections: 0, toReview: 0 },
      }),
    ).toBe("/b/campaigns/campaign-1?tab=creators");

    expect(
      getBrandCampaignListHref({
        id: "campaign-1",
        reportHealth: { missed: 0, corrections: 1, toReview: 0 },
      }),
    ).toBe("/b/campaigns/campaign-1?tab=reporting");

    expect(
      getBrandCampaignListHref({
        id: "campaign-1",
        awaitingContent: 2,
        reportHealth: { missed: 0, corrections: 0, toReview: 0 },
      }),
    ).toBe("/b/campaigns/campaign-1?tab=content");

    expect(getBrandCampaignListHref({ id: "campaign-1" })).toBe(
      "/b/campaigns/campaign-1",
    );
  });

  it("routes brand notifications to the smallest useful destination", () => {
    expect(
      getBrandNotificationHref("new_application", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1?tab=creators");

    expect(
      getBrandNotificationHref("content_submitted", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1?tab=content");

    expect(
      getBrandNotificationHref("performance_submitted", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1?tab=reporting");

    expect(
      getBrandNotificationHref("report_ready_for_review", {
        campaign_id: "campaign-1",
      }),
    ).toBe("/b/campaigns/campaign-1/report");

    expect(getBrandNotificationHref("new_application", null)).toBe(
      "/b/campaigns",
    );
  });
});
