import { describe, expect, it } from "vitest";

import {
  buildDefaultCampaignReportingRequirements,
  validateRequirementMetricKeys,
} from "./requirements";

describe("campaign reporting requirements", () => {
  it("builds default reporting requirements from deliverables", () => {
    const requirements = buildDefaultCampaignReportingRequirements([
      { platform: "instagram", content_type: "reel", quantity: 1 },
      { platform: "tiktok", content_type: "short_video", quantity: 2 },
    ]);

    expect(requirements).toHaveLength(2);
    expect(requirements[0]).toMatchObject({
      platform: "instagram",
      contentFormat: "reel",
      platformLabel: null,
      aiExtractionAllowed: true,
      creatorConfirmationRequired: true,
    });
    expect(requirements[1].requiredMetricKeys).toContain("views");
  });

  it("allows X and Generic requirements without product OAuth support", () => {
    expect(
      validateRequirementMetricKeys({
        platform: "x",
        platformLabel: null,
        requiredMetricKeys: ["impressions", "likes", "bookmarks"],
      }),
    ).toEqual([]);

    expect(
      validateRequirementMetricKeys({
        platform: "generic",
        platformLabel: "Retail partner dashboard",
        requiredMetricKeys: ["views", "engagements", "custom_1"],
      }),
    ).toEqual([]);
  });

  it("rejects unknown metric keys for named platforms", () => {
    expect(
      validateRequirementMetricKeys({
        platform: "instagram",
        platformLabel: null,
        requiredMetricKeys: ["views", "video_breathing_rate"],
      }),
    ).toEqual(["video_breathing_rate"]);
  });

  it("requires a label for Generic requirements", () => {
    expect(
      validateRequirementMetricKeys({
        platform: "generic",
        platformLabel: "",
        requiredMetricKeys: ["views"],
      }),
    ).toEqual(["platform_label"]);
  });
});
