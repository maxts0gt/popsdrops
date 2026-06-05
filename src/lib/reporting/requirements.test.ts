import { describe, expect, it } from "vitest";

import {
  buildDefaultCampaignReportingRequirements,
  buildMeasurementContractReportingRequirements,
  getMeasurementContractMetricKeys,
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

  it("builds engagement-focused reporting requirements when the brand selects that proof goal", () => {
    const requirements = buildMeasurementContractReportingRequirements({
      deliverables: [
        { platform: "instagram", content_type: "reel", quantity: 1 },
        { platform: "tiktok", content_type: "short_video", quantity: 1 },
      ],
      goal: "engagement_quality",
    });

    expect(requirements).toHaveLength(2);
    expect(requirements[0].requiredMetricKeys).toEqual([
      "likes",
      "comments",
      "shares",
      "saves",
    ]);
    expect(requirements[1].requiredMetricKeys).toEqual([
      "likes",
      "comments",
      "shares",
      "favorites",
    ]);
  });

  it("lets custom metric keys override the preset while still using supported platform definitions", () => {
    const requirements = buildMeasurementContractReportingRequirements({
      deliverables: [
        { platform: "instagram", content_type: "reel", quantity: 1 },
      ],
      goal: "engagement_quality",
      selectedMetricKeysByPlatform: {
        instagram: ["comments", "likes"],
      },
    });

    expect(requirements[0].requiredMetricKeys).toEqual(["comments", "likes"]);
    expect(
      getMeasurementContractMetricKeys("traffic_actions", "instagram"),
    ).toEqual(["views", "link_clicks", "profile_visits"]);
  });

  it("adds reporting-only proof channels without turning them into deliverable platforms", () => {
    const requirements = buildMeasurementContractReportingRequirements({
      deliverables: [
        { platform: "instagram", content_type: "reel", quantity: 1 },
        { platform: "tiktok", content_type: "short_video", quantity: 1 },
        { platform: "instagram", content_type: "reel", quantity: 1 },
      ],
      goal: "luxury_proof",
      additionalProofChannels: [
        { platform: "x" },
        {
          platform: "generic",
          platformLabel: "Retail partner dashboard",
        },
      ],
    });

    expect(
      requirements.map((requirement) => ({
        platform: requirement.platform,
        contentFormat: requirement.contentFormat,
        platformLabel: requirement.platformLabel,
      })),
    ).toEqual([
      { platform: "instagram", contentFormat: "reel", platformLabel: null },
      { platform: "tiktok", contentFormat: "short_video", platformLabel: null },
      { platform: "x", contentFormat: "reel", platformLabel: null },
      {
        platform: "generic",
        contentFormat: "reel",
        platformLabel: "Retail partner dashboard",
      },
      { platform: "x", contentFormat: "short_video", platformLabel: null },
      {
        platform: "generic",
        contentFormat: "short_video",
        platformLabel: "Retail partner dashboard",
      },
    ]);
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
