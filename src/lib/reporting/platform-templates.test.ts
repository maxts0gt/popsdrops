import { describe, expect, it } from "vitest";

import {
  DEFAULT_REQUIRED_EVIDENCE,
  REPORTING_PLATFORM_LABELS,
  REPORTING_PLATFORMS,
  getDefaultReportingRequirement,
  getReportingMetricTemplate,
  getReportingPlatformLabel,
  isReportingPlatform,
} from "./platform-templates";

describe("reporting platform templates", () => {
  it("defines six named platforms plus generic", () => {
    expect(REPORTING_PLATFORMS).toEqual([
      "instagram",
      "tiktok",
      "youtube",
      "facebook",
      "snapchat",
      "x",
      "generic",
    ]);
    expect(Object.keys(REPORTING_PLATFORM_LABELS)).toEqual(REPORTING_PLATFORMS);
  });

  it("keeps X and Generic as reporting platforms without requiring OAuth support", () => {
    expect(isReportingPlatform("x")).toBe(true);
    expect(isReportingPlatform("generic")).toBe(true);
    expect(getReportingPlatformLabel("x")).toBe("X");
    expect(getReportingPlatformLabel("generic")).toBe("Generic");
  });

  it("ships default metric templates for each platform", () => {
    for (const platform of REPORTING_PLATFORMS) {
      const metrics = getReportingMetricTemplate(platform);
      expect(metrics.length).toBeGreaterThanOrEqual(5);
      expect(metrics.every((metric) => metric.metricKey.length > 0)).toBe(true);
    }

    expect(
      getReportingMetricTemplate("instagram").map((metric) => metric.metricKey),
    ).toEqual(
      expect.arrayContaining([
        "views",
        "reach",
        "likes",
        "comments",
        "shares",
        "saves",
      ]),
    );
    expect(getReportingMetricTemplate("x").map((metric) => metric.metricKey)).toEqual(
      expect.arrayContaining(["impressions", "likes", "reposts", "replies", "bookmarks"]),
    );
    expect(
      getReportingMetricTemplate("generic").map((metric) => metric.metricKey),
    ).toEqual(expect.arrayContaining(["views", "engagements", "clicks", "custom_1"]));
  });

  it("creates intentional default requirements for campaign setup", () => {
    const instagram = getDefaultReportingRequirement("instagram", "reel");
    expect(instagram).toMatchObject({
      platform: "instagram",
      platformLabel: null,
      contentFormat: "reel",
      accountRequirement: "native_insights_required",
      evidenceTypes: DEFAULT_REQUIRED_EVIDENCE,
      aiExtractionAllowed: true,
      creatorConfirmationRequired: true,
    });
    expect(instagram.requiredMetricKeys).toEqual(
      expect.arrayContaining(["views", "reach", "likes", "comments"]),
    );

    const generic = getDefaultReportingRequirement("generic", "custom");
    expect(generic.platformLabel).toBe("");
    expect(generic.accountRequirement).toBe("brand_defined");
  });
});
